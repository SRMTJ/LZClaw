# 修复组织架构启停和删除按钮无效

任务：业务中心组织架构列表停用和删除按钮无效
作者：fudanda <314553951@qq.com>
时间：2026-07-09 15:22 Asia/Shanghai
AI 协助：Codex 参与排查、实现、验证和变更记录。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：AI：Codex/code-reviewer（阻塞问题：无；测试缺口见下方未完成和风险）

## 为什么改

主窗口启用了 `disableDialogs: true`，因此渲染层的 `window.confirm()` 不会弹出确认框。组织架构列表的停用、启用和删除操作在调用 API 前依赖 `window.confirm()`，导致点击后直接中断，看起来按钮无效。

## 改了什么

- 扩展 `window.electron.dialog.showMessageBox` 的 preload、主进程和 TypeScript 声明，支持 `detail/buttons/defaultId/cancelId/noLink`。
- 组织架构停用、启用和删除改用 Electron 原生确认弹窗。
- 保留删除前确认，并继续沿用后端的“有下级节点或员工归属时拒绝删除”保护。

## 验证

- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src\renderer\components\businessCenter\BusinessCenterView.tsx src\main\preload.ts src\renderer\types\electron.d.ts`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npx tsc --project electron-tsconfig.json`：通过。
- `git diff --check -- src\renderer\components\businessCenter\BusinessCenterView.tsx src\main\preload.ts src\renderer\types\electron.d.ts src\main\main.ts`：通过，仅有 LF 将被 CRLF 替换的提示。
- `py -3 scripts\vibe-doctor.py --json`（`D:\AI-AI\vibe-coding`）：通过。

## 未完成和风险

- 员工管理中的禁用员工仍有一处 `window.confirm()`，重置密码仍有一处 `window.prompt()`；本次只修复用户反馈的组织架构列表操作。
- 需要重启 LZClaw 才能加载新的 main/preload 编译产物。
