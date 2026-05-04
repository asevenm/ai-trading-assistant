# cron-job.org 配置手册

**日期**：2026-05-04
**用途**：替代 GitHub Actions cron，提供精度更高的 7 时点定时触发

---

## 为什么换 cron-job.org

| 项 | GitHub Actions | cron-job.org |
|---|:---:|:---:|
| 时间精度 | 1-30 min（高峰期延迟）| **±1 min** ✅ |
| 月成本 | 免费（私有 repo 2000min/mo） | **完全免费** ✅ |
| 可靠性 | 偶尔丢任务 | 高 ✅ |
| 配置方式 | YAML 文件 | 网页 UI |
| 测试便利度 | Actions 标签页 | 仪表盘 + 立即触发 |

实测教训：5/4 当天 GitHub Actions 触发 #5/#6/#7 分别延迟了 1.5h+，已经超出 ±10 min 容错窗口。换 cron-job.org 解决精度问题。

---

## 一次性配置（约 5 分钟）

### Step 1：注册账号

1. 访问 https://cron-job.org
2. 右上角 **Signup** → 邮箱 + 密码
3. 验证邮箱

### Step 2：把 token 存为 "Header preset"（避免 7 次重复填）

1. 左侧菜单 → **Settings** → **Headers**
2. **Add header**：
   - Name: `Authorization`
   - Value: `Bearer 71b362d2d448f9510804316988a49ba73bf659b5a1bdab814160fcd542c7bbfe`
   - Save

> 注：上面 token 就是你 Vercel env 里的 `ROTATION_CRON_TOKEN`。

### Step 3：创建 7 个 cron job

仪表盘 → **Cronjobs** → **CREATE CRONJOB**

每个 cron 填这些字段（**只有 Title 和 Schedule 不同**）：

| 字段 | 值 |
|------|------|
| **Title** | 见下表 |
| **URL** | `https://<你的vercel域名>/api/rotation/cron` |
| **Save responses** | 取 `7 days`（出问题方便排查） |
| **Schedule** → 切 **Cron Expression** 模式 | 见下表 |
| **Notifications** | 推荐勾 **Notify on failure**（失败邮件） |
| **Advanced** → **Request method** | `POST` |
| **Advanced** → **Headers** | 应用前面建的 `Authorization` preset |
| **Advanced** → **Timezone** | **UTC**（默认即可） |

#### 7 个任务参数

| Title | Schedule (UTC) | 对应 BJT | TimeSlot |
|---|:---|:---:|:---:|
| `rotation-PRE_OPEN` | `15 1 * * 1-5` | 09:15 | PRE_OPEN |
| `rotation-0930` | `35 1 * * 1-5` | 09:35 | 0930 |
| `rotation-1030` | `30 2 * * 1-5` | 10:30 | 1030 |
| `rotation-1100` | `25 3 * * 1-5` | 11:25 | 1100 |
| `rotation-1330` | `30 5 * * 1-5` | 13:30 | 1330 |
| `rotation-1430` | `30 6 * * 1-5` | 14:30 | 1430 |
| `rotation-CLOSE` | `5 7 * * 1-5` | 15:05 | CLOSE |

### Step 4：用 "Test run" 立即验证

随便选一个 job → 详情页右上角 **Test run** → 看 **History** 标签：

- 期望：HTTP 200，响应体 `{"skipped": "non_trading_day"}`（如果当天非交易日）
- 或：HTTP 200，响应体 `{"skipped": "off_window"}`（不在任何 slot 窗口）
- 或：HTTP 200，响应体 `{"success": true, "result": {...}}`（在窗口内，真触发）

**任何 200 都说明通路正常**。如果 401 → token 写错；404 → URL 写错。

---

## 上线后的运维

### 看历史记录
- Dashboard → 点 job 名 → **History** 标签
- 默认保留 7 天的请求/响应详情

### 暂停某个任务
- Job 详情页右上角 **Pause** 按钮
- 周末或法定节假日期间通常不需要暂停（endpoint 自带节假日检查会返回 `non_trading_day`）

### 监控失败
- 配 Settings → Notifications → 邮箱
- 任何非 200 返回都会发邮件

---

## 已停用的 GitHub Actions cron

`.github/workflows/rotation-cron.yml` 中的 `on.schedule` 已删除，**只保留 `workflow_dispatch`**（手动触发）用于调试。

如果你以后想切回 GH Actions：
1. 暂停 cron-job.org 的 7 个 job
2. 把 `on.schedule` 加回来（git 历史里能找到）

---

## 常见问题

### Q1: cron-job.org 免费版有没有限额？
- 默认每分钟 1 次，超长执行时间（>30s）需要 Premium
- 你 7 个 job 每天总计 7 次，远低于任何限额

### Q2: 节假日要手动暂停吗？
不用。endpoint 里 `isTradingDay()` 会检查 `CN_HOLIDAYS_2026`，节假日返回 `non_trading_day`，不会写脏数据。

### Q3: 5/4-5/5 这种调休补班的工作日怎么办？
代码里 `CN_HOLIDAYS_2026` 已经包含调休：5/1 5/4 5/5 都标记为节假日。**但调休补班的周日/周六**（如某些年份的 5/8 是补班的星期日）需要在 `isTradingDay` 加补班逻辑——目前你的代码用 `day === 0 || day === 6` 排除周末，**会漏掉补班日**。

如果今年有补班，需要改 `scheduler.ts` 加 `CN_WORKDAY_OVERRIDES` 列表。这是后续优化项，**当前不影响主流程**。

### Q4: 想增加新的 slot 怎么办？
1. 改 `lib/rotation/snapshot/scheduler.ts` 的 `SCHEDULED_SLOTS` 数组
2. 在 cron-job.org 加一个新 job（cron 表达式 = BJT - 8h）
3. 不需要重新部署 Vercel
