# 显示组织节点删除失败的具体原因

任务：组织架构删除失败时显示真实业务原因，不再统一提示状态冲突
作者：fudanda <314553951@qq.com>
时间：2026-07-10 09:37 Asia/Shanghai
AI 协助：Codex 参与排查、实现、验证和变更记录。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（待独立提交准备线程 Review）

## 为什么改

组织节点因存在下级节点或已绑定员工而无法删除时，AIZhongtai 返回 409，LZClaw 会按通用 `CONFLICT` 错误统一显示“数据已存在或状态冲突”，用户无法知道应先处理哪类关联数据。

## 改了什么

- LZClaw 对组织节点存在下级节点、已有员工归属两类删除冲突显示对应中文原因。
- 同时兼容新版 AIZhongtai 中文消息和旧版后端英文业务消息。
- 未识别的冲突继续使用通用提示，避免暴露数据库内部错误。

## 验证

- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src\main\main.ts`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。

## 未完成和风险

- 需要配合包含 AIZhongtai 错误本地化改动的 API 版本，才能从接口直接返回中文具体原因。
- 实际删除流程仍需重启 LZClaw 和 AIZhongtai API 后手工验证。
