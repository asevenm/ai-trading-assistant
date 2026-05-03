# Vercel + Neon Postgres 部署 Checklist

**日期**：2026-05-03
**前提**：SQLite → Postgres 迁移已完成（见 `2026-05-03-postgres-migration-design.md`）

---

## 阶段 1️⃣  Neon 建库（你来 - 约 5 分钟）

### 1.1 注册 / 登录
- 访问 https://console.neon.tech
- 用 GitHub 登录（推荐 - 后续 Vercel 集成会用到）

### 1.2 建项目
- **Project name**: `ai-trading-assistant`
- **Postgres version**: `16`（与本地 Docker 一致）
- **Region**: 选 **AWS Asia Pacific (Singapore)** 或 **AWS US East (N. Virginia)**
  - 新加坡：访问东财快（同亚洲）
  - 美东：Vercel Edge 默认就近，但东财跨海
  - **推荐新加坡**

### 1.3 拷贝连接串
- 项目首页 → Connection Details → Copy
- 形如：`postgresql://user:pass@ep-xxx-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

### 1.4 推 schema 到 Neon（我帮你跑）
```bash
# 临时用 Neon URL 跑迁移
DATABASE_URL="<粘贴 Neon URL>" pnpm prisma migrate deploy

# 验证表结构创建成功
DATABASE_URL="<Neon URL>" pnpm prisma db pull --print | head -50
```

> ⚠️ **不要把数据从本地 Postgres 同步到 Neon** —— 生产环境从空库开始，让你以新身份注册，避免本地测试数据进生产。

---

## 阶段 2️⃣  Vercel 项目创建（你来 - 约 3 分钟）

### 2.1 登录 Vercel
- 访问 https://vercel.com
- 用 **同一个 GitHub 账号** 登录

### 2.2 导入项目
- Add New → **Project**
- 选 `ai-trading-assistant` 仓库 → **Import**
- Framework Preset: **Next.js**（自动识别）
- Build & Output Settings: **保持默认**
- Install Command: 自动用 `pnpm install`
- Root Directory: `./`

### 2.3 ⚠️ **先不要点 Deploy** — 配完环境变量再部署

---

## 阶段 3️⃣  Vercel 环境变量（关键 - 你来 + 我引导）

在 **Environment Variables** 区域添加以下 6 个：

| Key | Value | 环境 | 来源 |
|-----|-------|------|------|
| `DATABASE_URL` | Neon 连接串 | Production, Preview | 阶段 1.3 |
| `AUTH_SECRET` | 32 字节 hex | Production, Preview | 见下方生成命令 |
| `OPENAI_API_KEY` | sk-... | Production, Preview | 你的 OpenAI 密钥 |
| `OPENAI_BASE_URL` | （可选）代理地址 | Production, Preview | 如不用代理则跳过 |
| `ROTATION_CRON_TOKEN` | 32 字节 hex | Production, Preview | 见下方生成命令 |
| `AUTH_TRUST_HOST` | `true` | Production, Preview | NextAuth v5 在 Vercel 必须 |

**生成随机密钥：**
```bash
# AUTH_SECRET 和 ROTATION_CRON_TOKEN 都用这个生成
openssl rand -hex 32
```

> 🔐 **AUTH_SECRET** 和 **ROTATION_CRON_TOKEN** 各生成一个独立值，不要复用。
> 💾 **本地用一份、Vercel 用另一份** —— 不要把本地 .env 的值上传，那是开发用的。

---

## 阶段 4️⃣  首次部署（你点 Deploy - 约 3-5 分钟）

### 4.1 触发部署
- Vercel 配完环境变量页面 → **Deploy**
- 看 Build Logs：
  - `Generating Prisma Client` 应该出现
  - `Creating an optimized production build` 应该出现
  - 无 ERROR 即成功

### 4.2 部署完成后检查
- 访问分配的域名 `https://<project>.vercel.app`
- 期望：被重定向到 `/login`
- 注册一个生产账号（独立于本地账号）

---

## 阶段 5️⃣  Cron 验证（关键 - 容易踩坑）

### 5.1 查看 Cron 列表
- Vercel 项目 → Settings → Cron Jobs
- 应看到 7 条任务，全部 enabled

### 5.2 手动触发测试（不等到下个交易日）
```bash
# 替换为你的实际域名和 token
curl -H "Authorization: Bearer <ROTATION_CRON_TOKEN>" \
     https://<project>.vercel.app/api/rotation/cron
```

期望返回 JSON 包含 `success: true` 或 timeSlot 信息。

### 5.3 ⚠️ Hobby 计划限制
- **Hobby 免费版每个项目只能有 2 个 cron**
- 你的 `vercel.json` 有 **7 个** → **必须升级到 Pro ($20/月)**
- 或者：合并成 1 个 cron，由 endpoint 内部根据当前北京时间分发到对应 slot
  - 你的代码里 `getScheduledSlot()` 已经支持自动判断 ✅

---

## 阶段 6️⃣  生产烟测（你来 - 约 5 分钟）

- [ ] 访问域名能打开
- [ ] 注册新账号成功
- [ ] 添加一只自选股（如 `600519` 茅台）→ 能查到名字
- [ ] 进入 `/rotation-live` 看板块数据
- [ ] 进入 `/morning-brief` 触发一次晨报生成（OpenAI 调用）
- [ ] 查看 Vercel 日志确认无错误

---

## 🚨 常见踩坑

### 1. `prisma migrate deploy` 报 P1001 (timeout)
- Neon 免费版会自动休眠，第一次连接需要冷启动
- 重试 1 次即可

### 2. Vercel Build 失败：Prisma client not found
- 项目根 `package.json` 添加 postinstall：
  ```json
  "scripts": {
    "postinstall": "prisma generate"
  }
  ```

### 3. NextAuth 报 `[next-auth][error][CLIENT_FETCH_ERROR]`
- 检查 `AUTH_TRUST_HOST=true` 已配
- 检查 `AUTH_SECRET` 至少 32 字节

### 4. Cron 不触发
- 确认 Hobby 计划 cron 数量没超限
- 确认 `vercel.json` 在 git 仓库根目录已提交

### 5. 东财 API 在 Vercel 上 timeout
- Vercel Functions 默认 10 秒超时（Hobby）
- Pro 计划可调到 60 秒
- 优化方向：把 API 调用改成批量、减少串行

---

## 🔄 回滚

部署失败或想暂停：
1. Vercel 项目 → Settings → 暂停部署
2. 删除 Vercel 项目（不影响 Neon 数据）
3. 删除 Neon 项目（数据全失，慎重）

---

## ✅ 完成标志

- [ ] Neon 库 schema 已 deploy
- [ ] Vercel 项目已部署成功
- [ ] 6 个环境变量已配置
- [ ] 至少触发 1 次 cron 验证 200 OK
- [ ] 浏览器登录 + 添加自选股 + 查看数据全流程跑通

完成后可以把 Vercel 域名分享给同事用，或者绑定自定义域名。
