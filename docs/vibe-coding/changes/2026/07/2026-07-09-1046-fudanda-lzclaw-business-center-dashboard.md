# LZClaw 优化业务中心首页仪表盘

任务：修改 LZClaw 业务中心页面
作者：fudanda <314553951@qq.com>
时间：2026-07-09 10:46 Asia/Shanghai
线程：019f269d-39ae-7233-9ffa-929aeb54bfa8
AI 协助：Codex 参与截图分析、页面实现、静态检查和构建验证。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（当前开发线程已完成实现与验证，后续交由独立提交准备线程处理）

## 为什么改

业务中心首页需要更贴近用户给出的企业后台设计图，减少原有顶部说明卡带来的冗余感，让导航、关键指标、Token 明细、已开通应用和平台使用情况在首屏内更清晰地呈现。

## 改了什么

- 将业务中心首页改为浅色后台仪表盘视觉，顶部业务导航优先展示。
- 移除原先的大型工作区说明卡，改为紧凑欢迎语和刷新按钮。
- 重做四张核心指标卡片，增加圆形图标、趋势折线和进度信息。
- 重排 Token 消耗明细表，按截图保留来源、员工、消耗和时间列。
- 已开通应用区域改为三条应用入口卡，包含已开通状态和打开后台按钮。
- 平台使用情况改为横向四指标栏，贴近截图中的底部统计区。

## 影响范围

- `src/renderer/components/businessCenter/BusinessCenterView.tsx`
- `docs/vibe-coding/changes/2026/07/2026-07-09-1046-fudanda-lzclaw-business-center-dashboard.md`

## 验证

- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src/renderer/components/businessCenter/BusinessCenterView.tsx`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过；仍有既有 Vite CJS Node API deprecated、`lottie-web` eval 警告。

## 风险和未验证

- 未启动 Electron 做人工截图对比，当前验证覆盖类型、Lint 和生产构建。
- 概览页部分运营指标仍是前端占位数据，后续接入真实 AIZhongtai 接口时需要替换。
- 组织架构和员工管理功能保留原有接口逻辑，本次只顺带继承新的指标卡视觉。
