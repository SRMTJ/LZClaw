# 内嵌登录 Web Session 恢复

任务：修复内嵌登录完成后应用停留在 `/users` 用户管理页的问题。
时间：2026-08-05 Asia/Shanghai
AI 协助：Codex 完成诊断、实现、测试和契约文档同步。
Review：未提交、未推送、未发布。

## 原因

登录服务在本次流程中写入了 HttpOnly Web Session Cookie 并进入 `/users`，
但没有调用 Electron 本地回调。桌面端因此没有原生访问令牌，登录视图也不会
关闭，最终把用户管理页显示在欢迎页区域。

## 修复

- 仅识别配置门户同源的 `/users` 主框架导航。
- 主进程读取专用 Session 中的 `lzclaw_web_session` HttpOnly Cookie，并通过
  `/api/auth/refresh` 换取原生访问令牌和刷新令牌。
- 恢复成功后保存原生令牌、关闭登录视图，并通知 renderer 重新加载用户、
  配额和服务端模型状态。
- Cookie 缺失、刷新被拒绝或请求失败时重新加载带桌面回调参数的登录 URL，
  不继续显示用户管理页。
- 原有本地 HTTP 回调和 `lobsterai://` 深链流程保持不变。

## 验证

- 相关 Vitest：3 个文件、20 项测试全部通过。
- 变更 TypeScript/TSX 文件 ESLint：通过。
- `npx tsc --project electron-tsconfig.json`：通过。
- `npx tsc --project tsconfig.json --noEmit`：通过。
- `git diff --check`：通过。
- `npm run compile:electron` 的 `precompile` 在运行中的应用锁定
  `better_sqlite3.node` 时失败；其实际 Electron TypeScript 编译命令已单独通过。
