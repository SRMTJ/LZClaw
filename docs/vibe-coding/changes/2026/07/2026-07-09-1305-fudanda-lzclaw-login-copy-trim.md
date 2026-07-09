# LZClaw 登录页文案减量

任务：优化登录页，减少文字，只保留关键信息
作者：fudanda <314553951@qq.com>
时间：2026-07-09 13:05 Asia/Shanghai
线程：当前对话
AI 协助：Codex 参与登录页文案和布局收敛。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（待用户测试确认后再进入提交准备）

## 为什么改

登录页已有沉浸式背景和登录表单，过多功能解释会分散注意力，也会和引导页内容重复。首屏登录页应该只保留账号入口、默认工作区和安全提示等关键决策信息。

## 改了什么

- 移除登录页左侧三条功能说明。
- 移除登录卡片内三列卖点区。
- 将标题和说明压缩为“企业账号登录 / 登录后进入默认工作区”。
- 将提交按钮从“登录并进入工作区”简化为“登录”。
- 将底部安全提示压缩为“仅保存业务会话，不保存身份 Token。”

## 影响范围

- `src/renderer/App.tsx`
- `docs/vibe-coding/changes/2026/07/2026-07-09-1305-fudanda-lzclaw-login-copy-trim.md`

## 验证

- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src/renderer/App.tsx`：通过。
- `npx tsc --noEmit`：通过。
- `git diff --check -- src/renderer/App.tsx`：通过；仅有既有 Windows 换行提示。

## 风险和未验证

- 未启动 Electron 做实际截图确认。
- 本次只压缩文案和局部结构，不改变登录接口、登录态或错误处理逻辑。
