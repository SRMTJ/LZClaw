# 修复组织架构启停删除空响应处理

任务：业务中心组织架构停用和删除点击后仍无效
作者：fudanda <314553951@qq.com>
时间：2026-07-09 16:55 Asia/Shanghai
AI 协助：Codex 参与排查、实现、验证和变更记录。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：AI：Codex（提交准备线程 Review，发现并修复空响应解析边界后复审无阻塞）

## 为什么改

组织架构启停和删除操作已经改为页面内确认弹窗，但部分 AIZhongtai 工作站接口在成功时可能返回 204 或空响应体。LZClaw 主进程和业务中心 service 仍强依赖 `data` 字段，导致接口成功也被前端当作失败，列表不会刷新，看起来操作无效。

## 改了什么

- `fetchWorkstationData` 兼容 204 或空响应体的成功响应，同时避免把非 JSON 响应误判为成功。
- 组织架构启停和删除只按 `success` 判断结果，不再要求接口必须返回部门对象。
- 去掉启用/停用成功后的“组织节点已启用/已停用”提示，只保留失败提示和列表刷新。

## 验证

- `git diff --check -- src/main/main.ts src/renderer/services/businessCenter.ts src/renderer/components/businessCenter/BusinessCenterView.tsx docs/vibe-coding/changes/2026/07/2026-07-09-1655-fudanda-business-center-org-actions-empty-response.md`：通过，仅有 Windows LF/CRLF 提示。
- `rg -n "组织节点已启用|组织节点已停用|组织节点已\$\{actionText\}|组织节点已" src\renderer\components\businessCenter\BusinessCenterView.tsx src\renderer\services\businessCenter.ts src\renderer\services\i18n.ts -S`：未发现启停成功提示残留，仅剩保存、新增、删除等文案。
- `py -3 scripts\vibe-doctor.py --json`（`D:\AI-AI\vibe-coding`）：通过，`ok: true`。
- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src\renderer\components\businessCenter\BusinessCenterView.tsx src\renderer\services\businessCenter.ts src\main\main.ts`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npm run build`：通过；仍有既有的 Vite CJS Node API deprecation 和 `lottie-web` eval 警告。

## 未完成和风险

- 未启动 Electron 做真实点击验收；需要重启 LZClaw 后在业务中心组织架构页面手工验证启停、删除和刷新效果。
