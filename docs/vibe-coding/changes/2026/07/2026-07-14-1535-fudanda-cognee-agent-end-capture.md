# Cognee agent_end 对话写入

任务：补上 LZClaw `agent_end` 调用 Cognee `/api/v1/remember/entry` 的逻辑
作者：fudanda <314553951@qq.com>
时间：2026-07-14 15:35 Asia/Shanghai
AI 协助：Codex 参与运行时事件契约核验、固定插件补丁、消息内容过滤、测试和真实链路验收。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（待独立 Review/提交任务）

## 为什么改

原 Cognee OpenClaw 插件的 `agent_end` 主要同步工作区记忆文件，不会把 LZClaw 当前聊天问答写入 Cognee Sessions，因此用户完成新对话后 Cognee 页面没有对应内容。

## 改了什么

- 给固定版 Cognee HTTP client 增加 `rememberEntry()`，调用本地 `/api/v1/remember/entry` 并写入 `qa` 记录。
- 在成功的 `agent_end` 上提取最后一轮用户问题和最终可见助手回答，写入当前会话与 agent 数据集。
- 去掉 LZClaw 托管提示前缀，过滤 thinking、reasoning 和工具调用内容。
- 增加进程内重复事件去重；接口调用关闭自动重试，避免非幂等接口因超时重试产生重复数据。
- 将修改做成 `scripts/openclaw-plugin-patches/cognee.cjs` 的源码受控补丁，并接入插件重建流程。
- 增加提取、过滤、缺失回答和补丁幂等测试，同步 Cognee 接入文档。

## 验证

- `node node_modules/vitest/vitest.mjs run tests/openclaw-plugin-patches-cognee.test.ts src/main/plugins/cogneeIntegration.test.ts src/main/plugins/pluginCredentialStore.test.ts src/main/libs/openclawConfigSync.runtime.test.ts`：通过，4 个文件、57 个测试。
- `node node_modules/typescript/bin/tsc --project electron-tsconfig.json --noEmit`：通过。
- `node --check scripts/openclaw-plugin-patches/cognee.cjs`：通过。
- `node node_modules/vitest/vitest.mjs run`：尝试执行全量测试，但当前 `better-sqlite3` 是 Electron ABI 143，命令行 Node 需要 ABI 137，110 项 SQLite 相关测试在加载原生模块时失败；这是当前运行环境的 native module ABI 状态，不是本次 Cognee 代码断言失败。为避免破坏正在运行的 Electron，未擅自重编译依赖。
- `npm run openclaw:plugins`：退出码 0；重建后日志确认自动增加 `rememberEntry()` 和 `agent_end` 捕获。可选 POPO 源出现 `ECONNRESET`，按 optional 规则跳过，不影响 Cognee。
- 重启 OpenClaw gateway 后发起真实会话 `3c408178-6c56-4a27-bd5a-219221ed48d9`，助手回答“记忆写入成功”；gateway 日志确认写入 `lzclaw-agent-main`，Cognee 返回 entry `d13fa666-84e9-4f81-979a-eb2c4364ced9`。
- Cognee 容器访问日志确认 `POST /api/v1/remember/entry` 返回 200；只读查询 `cache_qa_entries` 确认问题、答案、session 和 context 各字段正确，且本次测试只有一条记录。
- `git diff --check`：通过；只有仓库既有 LF/CRLF 提示。

## 风险

- `/api/v1/remember/entry` 当前没有接收 LZClaw 幂等键。本实现优先避免重复，不进行 HTTP 自动重试；Cognee 或网络故障期间可能漏写。
- 去重集合只存在于 gateway 进程内，重启后相同事件再次投递仍可能重复。需要强一致审计时必须增加持久化 outbox/唯一键，不能仅依赖记忆插件。
- 当前按 agent 数据集隔离，尚未建立 SaaS tenant/user 到 Cognee dataset/session 的正式身份映射。
- 聊天正文属于用户数据。生产启用前需要明确授权、访问控制、保留期限和删除机制。
- 按仓库规则，用户测试确认前不执行本地 commit。
