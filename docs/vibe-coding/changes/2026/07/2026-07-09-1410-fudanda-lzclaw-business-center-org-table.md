# LZClaw 重构业务中心组织架构表格页

任务：业务中心组织架构页面按设计图重构
作者：fudanda <314553951@qq.com>
时间：2026-07-09 14:10 Asia/Shanghai
AI 协助：Codex 参与实现、契约对齐、验证和变更记录。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（当前工具规则不允许在未显式要求创建新线程时自动创建独立 Review/提交准备线程；已完成本线程验证）

## 为什么改

组织架构页需要从原来的“双栏组织树 + 部门详情卡片”改为更贴近设计图的企业后台表格页，让用户能直接搜索、筛选、展开层级，并通过弹窗新增或编辑组织节点。

## 改了什么

- 将业务中心“组织架构”页改为全宽后台表格布局。
- 支持组织节点搜索、状态筛选、树形缩进、展开/收起、刷新和空状态。
- 新增组织节点新增/编辑弹窗，字段包含名称、编码、上级组织、负责人、排序和状态。
- 将部门启用/停用改为调用 PATCH 状态更新；DELETE 只用于真实删除节点。
- 补充业务中心组织架构页面中英文 i18n 文案。
- 补充 renderer business center service 的 update/delete/status 封装和常见后端错误中文化。

## 验证

- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src/renderer/components/businessCenter/BusinessCenterView.tsx src/renderer/services/businessCenter.ts src/renderer/types/electron.d.ts src/main/main.ts src/main/preload.ts src/renderer/services/i18n.ts`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npm run build`：通过；仍有既有 Vite CJS Node API deprecated、`lottie-web` eval、部分 chunk size 警告。

## 未完成和风险

- `npm run compile:electron` 被正在运行的 LZClaw Electron dev 进程占用 `better_sqlite3.node` 阻塞，未完整通过；已用直接 TypeScript 检查和 `npm run build` 覆盖代码验证。
- 未做真实 Electron 截图验收；视觉按给定设计图实现，仍建议在业务中心页面手工检查窄屏和弹窗状态。
- 当前工作区存在此前未提交的登录页、引导页和设置相关改动，本次未回退也未合并这些无关改动。
