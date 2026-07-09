# LZClaw 登录提示中文化

任务：提示信息都换成中文
作者：fudanda <314553951@qq.com>
时间：2026-07-09 13:36 Asia/Shanghai
线程：当前对话
AI 协助：Codex 参与登录页文案与工作站登录错误提示中文化。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（待用户测试确认后再进入提交准备）

## 为什么改

登录失败时会透传 AIZhongtai 或 Casdoor 的英文错误，例如 `client_id is invalid`、`Invalid account or password`，对业务用户不友好。登录页也仍有少量英文标签。

## 改了什么

- 登录页英文标签改为中文。
- 工作站登录错误按后端错误码转成中文。
- 对旧后端或 Casdoor 直接返回的英文关键词增加中文兜底。
- SSO exchange 失败兜底提示改为中文。

## 影响范围

- `src/renderer/App.tsx`
- `src/main/main.ts`
- `docs/vibe-coding/changes/2026/07/2026-07-09-1336-fudanda-lzclaw-login-errors-zh.md`

## 验证

- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src/renderer/App.tsx src/main/main.ts`：通过。
- `npx tsc --noEmit`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npm run compile:electron`：未通过；`better_sqlite3.node` 被当前进程占用，属于本机运行态文件锁。

## 风险和未验证

- 未重启 Electron 做界面截图确认。
- 本次只处理工作站登录链路的用户可见提示，不改全局开发日志。
