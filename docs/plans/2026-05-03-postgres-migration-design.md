# SQLite → PostgreSQL 迁移设计文档

**日期**：2026-05-03
**作者**：trading-assistant 项目
**状态**：待执行

## 背景

当前 `ai-trading-assistant` 项目使用 SQLite (`dev.db`) 作为数据库，准备部署到 Vercel + Neon Postgres。SQLite 在 serverless 环境中无法持久化，必须迁移到 Postgres。

## 目标

- 把现有 `dev.db` 中的数据完整迁移到 Postgres（A1 路径：保留数据）
- 本地开发环境通过 Docker 跑 Postgres 16，与生产环境一致
- 不修改任何业务代码（仅改 schema provider 与 DATABASE_URL）
- 全程可回滚：保留 SQLite 备份 + 旧迁移历史副本

## 范围

**包含**：
- Prisma schema provider 切换
- 数据导出（SQLite → JSON）与导入（JSON → Postgres）
- Docker compose 配置
- 本地 `.env` 切换

**不包含**：
- 业务代码改动
- 生产部署到 Vercel / Neon（后续单独推进）
- Schema 结构变更

## 架构与方案

### 方案对比与选择

| 方案 | 工作量 | 风险 | 选用 |
|------|--------|------|------|
| A. 保留数据 + Docker PG | 中 | 低 | ✅ |
| B. 推倒重来 + Docker PG | 极小 | 无（数据丢失） | ✗ |
| C. 双 schema（本地 SQLite，生产 PG） | 大（持续维护） | 中 | ✗ |

**选 A 的原因**：dev.db 包含 4 个月真实使用积累的自选股、研究笔记、交易记录等数据，重输成本高；本地用 Docker 跑 PG 与生产一致，避免类型差异带来的隐藏 bug。

### 数据流

```
┌──────────┐                ┌─────────────┐                ┌──────────────┐
│ dev.db   │  export ────►  │ JSON files  │  import ────►  │  Postgres    │
│ (SQLite) │  (Prisma)      │ tmp/...     │  (Prisma)      │  (Docker)    │
└──────────┘                └─────────────┘                └──────────────┘
     │                                                            │
     └────────────  备份 backups/dev.db.YYYY-MM-DD ──────────────┘
```

利用 **Prisma client 在两个阶段使用不同 provider** 的能力：
1. 阶段 1：schema.prisma 仍是 sqlite → 生成的 client 连 SQLite → 导出
2. 切换 schema.prisma 为 postgresql + `prisma migrate dev` → 生成的 client 连 Postgres
3. 阶段 2：新 client → 读 JSON → 写 Postgres

### 类型映射

Prisma 自动处理大部分类型转换：

| Prisma 类型 | SQLite 存储 | JSON 序列化 | Postgres 存储 |
|------------|-------------|-------------|---------------|
| `String` | TEXT | string | TEXT/VARCHAR |
| `Int` | INTEGER | number | INTEGER |
| `Float` | REAL | number | DOUBLE PRECISION |
| `Boolean` | INTEGER (0/1) | boolean | BOOLEAN |
| `DateTime` | TEXT (ISO 8601) | ISO string | TIMESTAMP |
| `String?` (JSON 内容) | TEXT | string | TEXT |

**唯一需要手工处理**：DateTime 经 JSON.stringify 变 string，导入时需用 reviver 转回 Date 对象（脚本已实现，见 `DATE_FIELDS` 集合）。

## 组件

### 1. `docker-compose.yml`
- postgres:16-alpine 容器
- 用户：`trading` / 密码：`trading_dev_password`（本地 only）
- 库：`ai_trading`
- 卷：`ai-trading-postgres-data`（持久化）
- 时区：`Asia/Shanghai`（与 A 股交易时段一致）

### 2. `scripts/migration/export-sqlite.ts`
- 用 Prisma client 遍历 21 张表，每张表导成独立 JSON 文件
- 输出 `_summary.json` 记录每表行数，作为导入校验依据

### 3. `scripts/migration/import-postgres.ts`
- 按外键依赖顺序导入（user → stockGroup → stock → ...）
- 使用 `createMany` 批量插入
- DateTime 字段用 JSON reviver 反序列化
- **健康检查**：目标库非空时拒绝导入（防止覆盖）
- **行数校验**：导入完毕对比每表 expected vs actual

### 4. Schema 改动
```diff
- provider = "sqlite"
+ provider = "postgresql"
```
旧 migrations 目录归档到 `prisma/migrations.sqlite.bak/`，重新 `migrate dev --name init`。

## 数据流细节

### 导入顺序（按外键拓扑排序）

```
Tier 0: user
Tier 1: account, session, verificationToken, stockGroup, riskSettings, alertRule
Tier 2: stock
Tier 3: event, validationIndicator, tradePlan
Tier 4: researchNote, tradeLog
Tier 5: weeklyReview, dailyReview, screenResult, deepResearch, morningBrief, alert
Tier ∞: boardSnapshot, rotationEvent (无外键)
```

## 错误处理

| 故障点 | 处理 |
|--------|------|
| 导出阶段 Prisma 连不上 SQLite | 检查 DATABASE_URL，dev.db 文件存在 |
| 导入时外键冲突 | 检查 IMPORT_ORDER，是否漏了父表 |
| createMany 类型错误 | 多半是 DateTime 没 revive，检查 DATE_FIELDS |
| 行数不匹配 | 退出码 2，人工查 _summary.json 与日志 |
| Docker 端口 5432 被占 | docker-compose down 其他 PG 实例 |

## 测试策略

1. **导出后**：检查 tmp/migration-data/_summary.json 的总行数 > 0
2. **migrate 后**：`docker exec -it ai-trading-postgres psql -U trading -d ai_trading -c "\dt"` 应看到 21 张表
3. **导入后**：脚本自动对比行数，不一致退出码 2
4. **业务验证**：
   - `pnpm dev` 启动
   - 登录已有账号
   - 检查自选股列表完整
   - 检查交易记录、研究笔记可见
   - 跑一次 cron（手动 curl `/api/rotation/cron`）

## 回滚方案

如果导入失败或验证不通过：

```bash
# 1. 关 Postgres 容器（保留卷以便排查）
docker-compose down

# 2. 恢复 schema 和 .env
git checkout prisma/schema.prisma .env
mv prisma/migrations.sqlite.bak prisma/migrations

# 3. 重新生成 SQLite client
pnpm prisma generate

# 4. 应用还在用 dev.db，无任何数据损失
pnpm dev
```

## 检查清单

执行前：
- [x] dev.db 已备份
- [x] docker-compose.yml 就绪
- [x] export/import 脚本就绪
- [x] 设计文档已写

执行中：
- [ ] Docker Postgres 健康
- [ ] 导出生成完整 JSON
- [ ] schema 切换成功
- [ ] migrate 生成新 init 迁移
- [ ] 导入行数校验通过

执行后：
- [ ] 本地 pnpm dev 启动正常
- [ ] 核心数据可见（自选股、交易记录、复盘）
- [ ] 一次 cron 触发成功
- [ ] 提交 git
