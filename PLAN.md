# 短线交易功能实现计划

## 概览

为短线交易者新增8大功能模块，按优先级分3个阶段实施。

---

## Phase 1 — P0 核心功能（每天必用）

### 1.1 盘前作战计划（Morning Brief）

**页面**: `/morning-brief`
**API**: `/api/morning-brief/generate`, `/api/morning-brief/[date]`
**数据库**: `MorningBrief` 表

**功能清单**:
- [ ] 昨日涨停股分析（首板/连板/炸板统计）
- [ ] 昨日涨停今日竞价表现（溢价率）
- [ ] 今日重点关注板块（基于资金流向+连续性）
- [ ] AI 生成当日交易策略建议
- [ ] 个股关注池（AI推荐 + 手动添加）

**数据源**: 东方财富涨停板API、板块资金流API
**AI**: GPT-4o-mini 生成策略建议

---

### 1.2 板块资金流向 + 轮动分析

**页面**: `/sector-flow`
**API**: `/api/sector-flow/ranking`, `/api/sector-flow/detail`

**功能清单**:
- [ ] 板块资金净流入排行（今日/3日/5日）
- [ ] 个股主力资金流入Top20
- [ ] 板块资金流向趋势图（近5日）
- [ ] 连续资金流入板块高亮
- [ ] AI 分析当前市场主线

**数据源**: 东方财富板块资金流API (`data.eastmoney.com`)

---

### 1.3 涨停板分析

**页面**: `/limit-up`  
**API**: `/api/limit-up/today`, `/api/limit-up/history`

**功能清单**:
- [ ] 今日涨停股列表（按首板/2板/3板+分层）
- [ ] 涨停原因归类（AI自动打标签）
- [ ] 连板股梯队图（市场高度可视化）
- [ ] 昨日涨停今日表现（溢价/亏钱效应统计）
- [ ] 炸板率统计（当日+近20日趋势）

**数据源**: 东方财富涨停数据API

---

## Phase 2 — P1 提升胜率

### 2.1 增强选股策略

**文件**: `lib/ai/stock-screener.ts` 扩展, `lib/indicators.ts` 扩展

**新增策略**:
- [x] 龙回头：强势股回调到MA10/MA20支撑
- [x] 底部反转：长期下跌后首次放量阳线
- [x] 突破平台：横盘≥10日后突破前高
- [x] 缩量回踩：上涨趋势中缩量回踩均线

---

### 2.2 市场情绪仪表盘

**页面**: `/market-sentiment`
**API**: `/api/market-sentiment`

**功能清单**:
- [x] 涨跌家数比（实时大饼图）
- [x] 涨停/跌停数量近20日趋势图
- [x] 炸板率趋势
- [x] 两市成交额趋势（量能柱状图）
- [x] 北向资金分时流向
- [x] 综合情绪指数（0-100，AI加权打分）

---

### 2.3 交易风控系统

**页面**: 嵌入现有交易计划页
**API**: `/api/risk-control/check`, `/api/risk-control/settings`
**数据库**: `RiskSettings` 表

**功能清单**:
- [x] 单日最大亏损限制
- [x] 连续亏损预警（连亏N次提醒休息）
- [x] 仓位管理面板（总仓位/单票仓位）
- [x] 持仓盈亏实时监控
- [x] 每笔交易强制录入买入理由

---

## Phase 3 — P2 提升认知

### 3.1 交易日志 + 单笔复盘

**页面**: `/trade-log` 增强
**功能清单**:
- [x] 按策略分类统计胜率
- [x] 同类型交易横向比较
- [x] AI 分析买卖点是否合理
- [x] 月度交易报告

---

### 3.2 龙虎榜数据

**页面**: `/billboard`
**API**: `/api/billboard/today`, `/api/billboard/detail`

**功能清单**:
- [x] 当日龙虎榜个股
- [x] 知名游资席位追踪
- [x] 机构买入/卖出
- [x] 历史龙虎榜查询

---

## 实施顺序

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 1 | 数据库 Schema 扩展 | `prisma/schema.prisma` |
| 2 | 东方财富新API封装 | `lib/market-api.ts`, `lib/limit-up-api.ts`, `lib/sector-flow-api.ts` |
| 3 | 涨停板分析页面 | `app/(dashboard)/limit-up/page.tsx`, `app/api/limit-up/` |
| 4 | 板块资金流向页面 | `app/(dashboard)/sector-flow/page.tsx`, `app/api/sector-flow/` |
| 5 | 盘前作战计划页面 | `app/(dashboard)/morning-brief/page.tsx`, `app/api/morning-brief/` |
| 6 | 市场情绪仪表盘 | `app/(dashboard)/market-sentiment/page.tsx` |
| 7 | 增强选股策略 | `lib/ai/stock-screener.ts` |
| 8 | 交易风控系统 | `app/(dashboard)/trade-plan/page.tsx` 增强 |
| 9 | 交易日志增强 | `app/(dashboard)/trade-log/page.tsx` 增强 |
| 10 | 龙虎榜数据 | `app/(dashboard)/billboard/page.tsx` |
| 11 | 侧边栏导航更新 | `components/layout/Sidebar.tsx` |

---

## 技术约定

- 所有新API使用 `ut=fa5fd1943c7b386f172d6893dbfba10b&fltt=2` 参数
- `cache: "no-store"` 用于实时数据
- 使用 `App.useApp()` 获取 message
- Tag 使用 `variant="filled"` 而非 `bordered={false}`
- Statistic 使用 `styles={{ content: {} }}` 而非 `valueStyle`
- 不使用 antd `List` 组件，用 div 替代
- 文件保持 200-400 行，超过则拆分
