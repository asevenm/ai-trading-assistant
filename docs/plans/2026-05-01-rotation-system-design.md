# 轮动作战系统设计稿

**日期**: 2026-05-01
**作者**: 与 Claude 共同设计
**目标**: 在轮动行情下快速发掘市场轮动机会和节奏

---

## 一、需求收敛结论

| 维度 | 选择 |
|------|------|
| **时间尺度** | B 日间主线切换 + C 周期级风格轮动 + D 题材发酵阶段（不做盘中分钟级） |
| **使用时刻** | 全部 4 个：A 盘后复盘、B 盘前预判、C 盘中监控、D 阶段地图 |
| **轮动对象** | C 双轨并行：行业（申万）看大趋势/风格，概念（东财）看主线/题材 |
| **阶段判定** | D 复合打分法 + 硬触发规则（龙头炸板 → 立即分歧） |
| **阶段集合** | 4 阶段：启动 / 主升 / 分歧 / 退潮（不要休眠） |

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────┐
│  数据采集层  (东方财富 API, ut+fltt=2)                     │
│  ─ 行业板块行情 (申万一级 28 / 二级 124)                   │
│  ─ 概念板块行情 (东财 300+)                                │
│  ─ 板块成分股 + 涨停板列表 + 连板梯队                       │
│  ─ 主力资金流 (板块/个股)                                   │
│  ─ 题材关联新闻 (复用 news-intel)                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  时序快照层  (Prisma + SQLite)                             │
│  每交易日 7 个快照点：                                       │
│  PRE_OPEN / 0930 / 1030 / 1100 / 1330 / 1430 / CLOSE    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  评分 & 阶段判定引擎                                         │
│  ─ 6 维复合打分 → 0-100 强度分                             │
│  ─ 一阶/二阶导计算                                          │
│  ─ 阶段分类器 → 启动/主升/分歧/退潮                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌──────────────┬──────────────┬──────────────┬─────────────┐
│ A 盘后复盘   │ B 盘前预判   │ C 盘中监控    │ D 阶段地图   │
│ daily-review │ morning-brief│ rotation-live│ theme-radar │
│   增强       │   增强       │  (新建)      │   重做      │
└──────────────┴──────────────┴──────────────┴─────────────┘
```

**关键设计原则**:
1. 一个轮动引擎驱动 4 个视图，避免重复抓取/算分
2. 视图最大化复用已有页面（仅新建 rotation-live 一个）
3. 数据采集和评分写为纯函数库 `lib/rotation/`
4. 7 个快照点 + 实时拉取双链路，平衡存储与时效

---

## 三、评分模型

### 3.1 六维强度评分

每维归一化到 0-100，加权求和得到板块强度分 S。

| 维度 | 权重 | 计算方式 | 数据源 |
|------|------|---------|--------|
| 涨幅强度 | 20% | 板块涨幅在所有同类板块中的百分位排名 | 东财板块行情 |
| 涨停密度 | 25% | 板块内涨停股数 / 板块内非ST非新股数（标准化） | 涨停池 + 成分股 |
| 主力净流入 | 20% | 主力净流入 / 板块流通市值（百分位） | 东财板块资金流 |
| 龙头高度 | 20% | 板块内最高连板数 ×权重 + 二板数量 | 连板梯队 |
| 活跃度 | 10% | 板块平均换手率百分位 | 东财行情 |
| 消息热度 | 5% | 题材关联新闻数 + 涨停原因命中数 | news-intel |

> 涨停密度权重最高(25%)：直接反映赚钱效应和资金真实参与度。

### 3.2 阶段判定

```
S(t)  = 当前强度分
ΔS    = S(t) - S(t-1)        一阶导（势头）
Δ²S   = ΔS(t) - ΔS(t-1)      二阶导（加速度）
```

| 阶段 | 判定规则 | 直觉 |
|------|----------|------|
| 启动 🟢 | S<60, ΔS>+15, Δ²S>0 | 还不高但加速上行 |
| 主升 🔥 | S≥75, ΔS>0, 持续≥2 日 | 高分且仍在涨 |
| 分歧 ⚠️ | S≥70, Δ²S<0 (加速度转负) | 高位但开始减速 |
| 退潮 🔻 | S<50 且 ΔS<-10，或龙头断板 | 量价齐跌 |

**硬触发规则**（优先级高于阈值判定）：
- **板块龙头炸板** → 立即标记分歧（不论分数多少），并发出 `LEADER_BROKEN` 事件

### 3.3 双轨差异化

- **行业板块**：日级数据（每日收盘快照），看 5 日/10 日趋势 → 服务 C 周期级风格轮动
- **概念板块**：日内 7 快照 + 跨日，看小时级和日级 → 服务 B 主线切换 + D 题材发酵

---

## 四、视图设计

### A. 盘后复盘 `/daily-review` 增强
- 轮动热力图（横轴时间点 / 纵轴 Top 20 概念 / 颜色=强度分）
- 主线判定卡（Top 3 概念 + 阶段 + LLM 一句话点评）
- 切换轨迹（今日 vs 昨日 Top 5）
- 明日埋伏建议（启动阶段 + ΔS 持续正 → LLM 名单）

### B. 盘前预判 `/morning-brief` 增强
- 昨日尾盘强度延续度（14:30→收盘）
- 隔夜消息映射（news-intel → 命中板块阶段）
- 接力候选池（昨日启动/主升 + 利好 + 板块内未涨停低位股）
- 风险预警（昨日分歧的高位板块）

### C. 盘中实时监控 `/rotation-live`（新建）
- 顶部：当前主线 Top 5 + 实时强度分变化条
- 中部：双栏热力图（左行业 / 右概念），与上一快照对比高亮
- 右侧告警栏：
  - 🔥 板块强度分破 75（新主升）
  - ⚠️ 龙头炸板 → 自动标记分歧
  - 🟢 强度分破 60 + 加速（启动）
  - 🔻 强度分跌破 50 + 龙头大跌（退潮）
- 底部：龙头股族群迁移图
- 30 秒轮询

### D. 阶段地图 `/theme-radar` 重做
四象限气泡图：
- X 轴：加速度 ΔS
- Y 轴：强度分 S
- 气泡大小：主力净流入
- 气泡颜色：阶段
- 拖动时间轴看 T-1/T-3/T-5 轨迹
- 点击进入板块详情

---

## 五、数据模型

### Prisma Schema 增量

```prisma
model BoardSnapshot {
  id              String   @id @default(cuid())
  tradeDate       String   // YYYY-MM-DD
  timeSlot        String   // "PRE_OPEN" | "0930" | "1030" | "1100" | "1330" | "1430" | "CLOSE"
  boardType       String   // "INDUSTRY" | "CONCEPT"
  boardId         String   // 东财板块代码
  boardName       String

  changePct       Float
  limitUpCount    Int
  mainNetInflow   Float
  topStreak       Int
  turnoverRate    Float
  newsHeat        Int

  strengthScore   Float
  deltaScore      Float?
  accelScore      Float?
  stage           String?  // "STARTING" | "RISING" | "DIVERGING" | "FADING" | null
  stageReason     String?

  leaderStocks    String   // JSON

  createdAt       DateTime @default(now())

  @@unique([tradeDate, timeSlot, boardType, boardId])
  @@index([tradeDate, boardType, strengthScore])
}

model RotationEvent {
  id          String   @id @default(cuid())
  tradeDate   String
  timestamp   DateTime
  eventType   String   // "RISING_BREAKOUT" | "LEADER_BROKEN" | "STAGE_CHANGE" | ...
  boardType   String
  boardId     String
  boardName   String
  fromStage   String?
  toStage     String?
  payload     String   // JSON
  createdAt   DateTime @default(now())

  @@index([tradeDate, timestamp])
}
```

---

## 六、文件结构

```
lib/rotation/
├── collectors/
│   ├── board-quote.ts        # 板块行情
│   ├── board-flow.ts         # 资金流
│   ├── board-stocks.ts       # 成分股 + 涨停
│   └── leader-detector.ts    # 龙头识别（含炸板）
├── scoring/
│   ├── normalize.ts          # 6 维归一化
│   ├── compose.ts            # 加权求和
│   └── stage-classifier.ts   # 阶段判定（含硬规则）
├── snapshot/
│   ├── take-snapshot.ts      # 触发一次快照入库
│   └── scheduler.ts          # 7 个时间点调度
├── events/
│   └── detector.ts           # 关键事件检测
└── views/
    ├── daily-rotation.ts     # A 视图数据装配
    ├── morning-rotation.ts   # B
    ├── live-rotation.ts      # C
    └── theme-radar.ts        # D

app/api/rotation/
├── snapshot/route.ts         # POST 触发快照
├── live/route.ts             # GET 当前最新快照
├── events/route.ts           # GET 当日事件流
├── radar/route.ts            # GET 阶段地图数据
└── replay/route.ts           # GET 历史回放

app/(dashboard)/
└── rotation-live/page.tsx    # 新建 C 视图
```

---

## 七、实施分期

| 阶段 | 内容 | 备注 |
|------|------|------|
| Step 1 | 数据采集 + Prisma schema + 评分引擎 + 快照机制 | 核心库，最大头 |
| Step 2 | D 阶段地图（重做 theme-radar）+ 历史回放 | 最先看到效果，验证模型 |
| Step 3 | A daily-review + B morning-brief 增强 | 复用 LLM 链路 |
| Step 4 | C rotation-live 实时看板 + 告警 | 最依赖前面的事件检测 |

> 为什么 Step 2 先做 D：纯查询 + 可视化，不依赖 LLM 和定时任务，快速验证评分模型。

---

## 八、Cron 自动化（每日 7 时点快照）

### 鉴权机制
- 通过环境变量 `ROTATION_CRON_TOKEN` 配置共享 token
- 端点 `/api/rotation/cron` 同时支持：
  - `Authorization: Bearer <token>` header（推荐）
  - `?token=<token>` query 参数（不推荐，可能进日志）
- 未配置 token → 端点直接 500 拒绝（fail-closed）

### 服务端保护
- 自动跳过周末（北京时间）+ 节假日（`CN_HOLIDAYS_2026` 静态列表）
- 容错时间窗 ±8 分钟：cron 因延迟晚到也能正确归档到对应 timeSlot
- 不在任何窗口 → 返回 `skipped: "off_window"`，不报错
- 测试参数：`?force=1` 跳过节假日检查，`?timeSlot=PRE_OPEN` 强制指定槽

### 7 个调度时点（北京时间）

| Slot | 触发时间 | 用途 |
|------|---------|------|
| PRE_OPEN | 09:15 | 集合竞价前数据 |
| 0930 | 09:35 | 开盘后 5 分钟 |
| 1030 | 10:30 | 上午中段 |
| 1100 | 11:25 | 上午尾盘（午休前） |
| 1330 | 13:30 | 午后开盘 |
| 1430 | 14:30 | 午后尾盘 |
| CLOSE | 15:05 | 收盘后 5 分钟（数据稳定） |

### 部署方式 A：Vercel Cron

`vercel.json` 已配置（注意 Vercel 用 UTC，已转换为 BJT - 8h）。

⚠️ **限制**：
- Vercel Hobby 套餐每天只能执行 2 次 cron。本系统需要 Pro 套餐或更高。
- Vercel Cron 无法用 `CRON_TZ`，必须用 UTC。

部署后在 Vercel 项目设置中添加环境变量 `ROTATION_CRON_TOKEN`（与 .env 一致），Vercel 会自动用 `Authorization: Bearer <CRON_SECRET>` 触发，需要让 `CRON_SECRET = ROTATION_CRON_TOKEN` 或修改端点接收两个变量。

### 部署方式 B：本地 / 自托管 crontab（推荐自用）

1. 生成 token：
   ```bash
   openssl rand -hex 32
   ```

2. 写入 `.env`：
   ```
   ROTATION_CRON_TOKEN="<生成的 64 位 hex>"
   ```

3. 设置 shell 环境变量（用于 crontab 脚本读取）：
   ```bash
   echo 'export ROTATION_CRON_TOKEN="<同上>"' >> ~/.zshrc
   echo 'export ROTATION_BASE_URL="http://localhost:3000"' >> ~/.zshrc
   source ~/.zshrc
   ```

4. 编辑 crontab（`crontab -e`）：
   ```
   CRON_TZ=Asia/Shanghai
   15  9 * * 1-5  /path/to/repo/scripts/rotation-cron.sh PRE_OPEN >> /tmp/rotation-cron.log 2>&1
   35  9 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 0930     >> /tmp/rotation-cron.log 2>&1
   30 10 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 1030     >> /tmp/rotation-cron.log 2>&1
   25 11 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 1100     >> /tmp/rotation-cron.log 2>&1
   30 13 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 1330     >> /tmp/rotation-cron.log 2>&1
   30 14 * * 1-5  /path/to/repo/scripts/rotation-cron.sh 1430     >> /tmp/rotation-cron.log 2>&1
    5 15 * * 1-5  /path/to/repo/scripts/rotation-cron.sh CLOSE    >> /tmp/rotation-cron.log 2>&1
   ```

5. macOS 注意：
   - 系统 `cron` 需要 Full Disk Access（系统设置 → 隐私与安全 → 完全磁盘访问 → 添加 `cron`）
   - 如果不想给 cron Full Disk Access，可用 launchd（`~/Library/LaunchAgents/com.rotation.cron.plist`）
   - macOS 可能不支持 `CRON_TZ`，那就把所有时间换算到本地时区

### 测试 cron 端点

```bash
# 1. 节假日跳过 / 容错窗口跳过
curl -H "Authorization: Bearer $ROTATION_CRON_TOKEN" \
  http://localhost:3000/api/rotation/cron

# 2. 强制触发指定 slot（用于补录或测试）
curl -X POST -H "Authorization: Bearer $ROTATION_CRON_TOKEN" \
  "http://localhost:3000/api/rotation/cron?force=1&timeSlot=CLOSE"

# 3. 补录历史日期（注意：东财 API 取的是当前数据，过去日期不会回测）
curl -X POST -H "Authorization: Bearer $ROTATION_CRON_TOKEN" \
  "http://localhost:3000/api/rotation/cron?force=1&timeSlot=CLOSE&tradeDate=2026-04-30"
```

### 节假日维护

`lib/rotation/snapshot/scheduler.ts` 中的 `CN_HOLIDAYS_2026` 是静态列表。**每年 12 月需要更新**为次年节假日（参考国务院办公厅公告）。

未来可改为：
- 启动时从交易所日历 API 拉取并缓存
- 或在 DB 维护一张 `TradingCalendar` 表，每年初 import 一次
