# 修复组织架构操作点击无响应

任务：组织架构停用和删除按钮仍无效，且启用/停用/删除成功后不需要提示
作者：fudanda <314553951@qq.com>
时间：2026-07-09 17:39 Asia/Shanghai
AI 协助：Codex 参与排查、实现、验证和变更记录。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（待独立提交准备线程 Review）

## 为什么改

用户反馈业务中心组织架构列表的停用和删除操作仍然无效，同时不希望启用、停用或删除成功后弹出成功提示。上一版已处理空响应兼容，但交互层仍可能受 Electron 拖拽区域影响，且删除请求与其他 mutation 请求的 body 形态不一致。

## 改了什么

- 组织架构确认弹窗显式标记为 `non-draggable`，避免按钮点击被窗口拖拽区域吞掉。
- 组织架构操作列显式标记为 `non-draggable`，并在操作进行中禁用启停和删除按钮，避免重复点击。
- DELETE 部门请求改为与 POST/PATCH 一致，携带 JSON body 和 `keyfrom` 信息。
- 移除删除成功 toast，并删除对应 i18n 成功文案；启用、停用、删除成功后只静默刷新列表。

## 验证

- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src\renderer\components\businessCenter\BusinessCenterView.tsx src\renderer\services\businessCenter.ts src\renderer\services\i18n.ts src\main\main.ts`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npm run build`：通过；仍有既有 Vite CJS Node API deprecation 和 `lottie-web` eval 警告。
- `npm run compile:electron`：未通过，原因是当前运行中的 Electron 进程锁住 `node_modules\better-sqlite3\build\Release\better_sqlite3.node`，属于本机运行态锁文件问题。

## 未完成和风险

- 需要重启当前正在运行的 LZClaw 窗口后再手工验证，因为 main 进程 DELETE 请求改动不会被已运行的 Electron 进程热更新。
