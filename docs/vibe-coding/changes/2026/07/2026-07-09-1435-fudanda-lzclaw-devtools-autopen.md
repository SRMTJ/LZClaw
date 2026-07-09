# LZClaw 开发模式稳定自动打开 DevTools

任务：修复启动开发模式时没有自动打开开发者工具
作者：fudanda <314553951@qq.com>
时间：2026-07-09 14:35 Asia/Shanghai
AI 协助：Codex 参与排查、实现、重启验证和变更记录。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（本次为开发体验小修复；当前对话已完成类型检查和运行时验证）

## 为什么改

开发模式下 `mainWindow.webContents.openDevTools()` 原本在 `loadURL()` 后立刻执行，但主窗口此时仍是 `show: false`，窗口真正显示发生在 `ready-to-show`。Windows/Electron 下这会导致 DevTools 自动打开被吞掉或没有激活。

## 改了什么

- 新增 `openMainWindowDevTools()`，只在开发模式下执行，并避免重复打开。
- DevTools 使用 `detach` 独立窗口模式和 `activate: true`。
- 在 `did-finish-load` 和 `ready-to-show` 后延迟尝试打开，保证主窗口和页面生命周期更稳定。
- 移除 `loadURL()` 后立即打开 DevTools 的旧调用。

## 验证

- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npx tsc --project electron-tsconfig.json`：通过。
- 已重启 `npm run electron:dev`。
- 进程窗口检查出现 `Developer Tools - http://localhost:5175/`。
- 启动日志出现 `[Main] opened DevTools after ready-to-show`。

## 未完成和风险

- 当前 `src/main/main.ts` 还有此前登录错误中文化相关未提交改动；本次没有回退或整理这些无关改动。
- 本次只保证主窗口开发者工具自动打开，不改变 webview 或登录子窗口的 DevTools 行为。
