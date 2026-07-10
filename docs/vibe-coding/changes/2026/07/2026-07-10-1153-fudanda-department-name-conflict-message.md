# 组织节点重名冲突提示

任务：LZClaw 显示组织节点名称和编码重复的真实原因
作者：fudanda <314553951@qq.com>
时间：2026-07-10 11:53 Asia/Shanghai
AI 协助：Codex 参与错误链路分析、桌面主进程提示映射和验证。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：AI：Codex/code-reviewer（独立 Review/提交任务；首轮及更新包复审均未发现阻塞问题）

## 为什么改

LZClaw 收到工作站 API 的 `CONFLICT` 后，会优先返回桌面端通用 409 文案，导致后端已经提供的组织节点名称或编码重复原因丢失。

## 改了什么

- `CONFLICT` 错误优先识别组织节点名称重复，显示“组织节点名称已存在，请更换名称后重试。”。
- 同时补齐组织节点编码重复映射，避免现有明确后端原因继续被通用文案覆盖。
- 删除、下级节点和员工归属冲突的现有提示保持不变。

## 验证

- `npx eslint src/main/main.ts`：通过（独立 Review/提交任务复验）。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过（独立 Review/提交任务复验）。
- `npm run compile:electron`：未完成；运行中的 Electron/Node 进程锁定 `better_sqlite3.node`，`electron-builder install-app-deps` 返回 `EBUSY/EPERM`，不是 TypeScript 编译错误。

## 风险

- 尚未在 Electron 界面手工触发一次真实重名新增；需要 API 重启并完成数据库迁移后验收。
- 当前映射函数沿用既有硬编码中文模式，未在本次扩大到 `src/main/i18n.ts`；后续可统一偿还主进程国际化债务。
- 按仓库规则，用户测试确认前不执行本地 commit。
