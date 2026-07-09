# LZClaw 引导页增加配置开关

任务：引导页的开启关闭做成配置 默认关闭
作者：fudanda <314553951@qq.com>
时间：2026-07-09 12:07 Asia/Shanghai
线程：当前对话
AI 协助：Codex 参与实现、类型对齐和验证。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（后续交由独立提交准备线程处理）

## 为什么改

引导页现在用于产品介绍和新手说明，但在日常开发、演示和企业分发中不应默认弹出。需要把它改成显式配置开启，默认保持关闭，避免启动后先进入引导页影响正常使用。

## 改了什么

- 新增本地开关 key：`onboarding_enabled`。
- 新增企业配置字段：`onboarding.enabled`。
- 启动时只有企业配置或本地配置显式开启时才判断是否展示引导页。
- 移除开发模式下每次启动强制展示引导页的行为。
- 隐私协议同意后也会遵守同一套引导页开关。
- 完成引导后仍写入 `onboarding_version_completed`，保留版本级完成状态。

## 影响范围

- `src/shared/onboarding/constants.ts`
- `src/main/libs/enterpriseConfigSync.ts`
- `src/renderer/types/electron.d.ts`
- `src/renderer/components/Settings.tsx`
- `src/renderer/App.tsx`
- `docs/vibe-coding/changes/2026/07/2026-07-09-1207-fudanda-lzclaw-onboarding-config.md`

## 验证

- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src/renderer/App.tsx src/renderer/components/Settings.tsx src/renderer/types/electron.d.ts src/main/libs/enterpriseConfigSync.ts src/shared/onboarding/constants.ts`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过；仍有既有 Vite CJS Node API deprecated、`lottie-web` eval 和大 chunk 警告。

## 风险和未验证

- 本次只增加配置入口，没有新增设置页 UI 开关。
- 如果需要本地手动开启，可写入本地 store 的 `onboarding_enabled=true`；正式环境建议使用企业 manifest 的 `onboarding.enabled=true`。
- 未启动 Electron 做人工确认；当前验证覆盖类型、Lint 和生产构建。
