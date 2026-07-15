# Cognee OpenClaw 正式记忆接入

任务：LZClaw 固定版本接入 Cognee，补齐配置同步、安全凭据入口和连接测试
作者：fudanda <314553951@qq.com>
时间：2026-07-14 11:45 Asia/Shanghai
AI 协助：Codex 参与插件兼容性核验、主进程安全存储、OpenClaw 配置同步、设置页、连接测试和自动化验证。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：未评审（待独立 Review/提交任务）

## 为什么改

LZClaw 原有通用插件链路会把插件密码直接写入 SQLite，而且配置同步固定选择 `memory-core`，无法安全、稳定地把 Cognee 作为正式记忆后端。Cognee npm latest 与当前固定 OpenClaw 版本也不兼容，不能使用浮动版本安装。

## 改了什么

- 固定 `@cognee/cognee-openclaw@2026.6.11`，禁止用户卸载或自动升级托管插件。
- 构建脚本增加仅适用于无生产依赖固定包的受限直接解包路径，校验版本、manifest ID 和运行时依赖。
- 插件设置页增加 Cognee 默认配置、安全凭据状态和保存前连接测试。
- 密码/API Key 使用 Electron `safeStorage` 加密保存；SQLite 和 `openclaw.json` 不保留明文。
- 启用 Cognee 时同步唯一记忆槽、`allowConversationAccess` hook，并禁用 `memory-core`、`memory-lancedb`；禁用后恢复原记忆槽。
- gateway 通过环境变量获取解密后的凭据。
- 新增凭据存储、连接测试和 OpenClaw 配置输出测试，并同步模块文档。

## 验证

- `npm view @cognee/cognee-openclaw@2026.6.11 version peerDependencies`：确认固定版本与 OpenClaw `>=2026.4.1` 兼容。
- `npm run openclaw:plugins`：通过；Cognee `2026.6.11` 已缓存并安装到当前运行时，包版本、manifest ID 和零运行时依赖校验通过。可选 POPO 私有源出现 `ECONNRESET` 警告，但按 optional 规则跳过且脚本最终成功。
- `npx vitest run src/main/plugins/pluginManager.test.ts src/main/plugins/pluginCredentialStore.test.ts src/main/plugins/cogneeIntegration.test.ts src/main/libs/openclawConfigSync.runtime.test.ts`：通过，4 个文件、57 个测试。
- `$env:NPM_CONFIG_USERCONFIG='NUL'; npm test`：通过，194 个测试文件、2065 个测试通过、1 个跳过；仅对本次命令绕过本机 npm 11 的 `allow-scripts` 用户配置，未修改全局配置。
- `npm run compile:electron`：通过。
- `npm run build`：通过。
- 本机 `http://127.0.0.1:8000` 真实连接测试：健康检查、用户名密码登录和 `/api/v1/auth/me` 均通过，Cognee 返回 `1.3.0-local`。
- `npm run electron:dev` 运行时验收：配置同步成功；Cognee 未启用状态包含 `allowConversationAccess`、默认非敏感配置和 `${COGNEE_PASSWORD}` 占位符；OpenClaw `2026.6.1` gateway 启动并进入 `ready`，随后已停止开发进程。

## 风险

- 尚未在 Electron 设置页人工输入并保存凭据；启用后的记忆槽切换由自动化测试覆盖，未用真实用户配置启动一次 Cognee 插件。
- 本机 Cognee 尚未配置真实 LLM Key；连接认证通过不代表记忆写入、Cognify、召回已可用。
- 安全凭据和记忆后端切换属于安全/运行方式变更，合并前需要独立 AI Review 和人工验证。
- 按仓库规则，用户测试确认前不执行本地 commit。
