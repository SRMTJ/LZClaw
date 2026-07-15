# Cognee OpenClaw 记忆接入

LZClaw 通过官方 `@cognee/cognee-openclaw` 插件接入自托管 Cognee。当前固定插件版本为 `2026.6.11`，对应仓库固定的 OpenClaw `v2026.6.1`；不要在插件设置中升级到 npm latest。

## 用户配置入口

在“设置 → 插件”中找到 `cognee-openclaw`：

1. 打开插件配置，填写 Cognee API 地址。Docker 在本机运行时默认使用 `http://127.0.0.1:8000`。
2. 选择“用户名 + 密码”或 API Key 认证方式并填写对应凭据。密码/API Key 留空时保留已安全保存的值。
3. 先点击“测试 Cognee 连接”。测试会依次检查 `/health`、登录/API Key 和 `/api/v1/auth/me`，不是只检查端口是否可访问。
4. 保存配置并启用插件。配置同步会重启正在运行的 OpenClaw gateway。

默认非敏感配置采用：

- 数据集：`lzclaw`。
- 智能体数据集前缀：`lzclaw-agent`。
- 默认写入和召回作用域：`agent`。
- 自动召回、启动索引、会话记忆、会话结束持久化和 Cognify：启用。
- 搜索模式：`FEELING_LUCKY`。

## OpenClaw 配置契约

启用 Cognee 时，配置同步器会生成以下关键状态：

```yaml
plugins:
  slots:
    memory: cognee-openclaw
  entries:
    memory-core:
      enabled: false
    memory-lancedb:
      enabled: false
    cognee-openclaw:
      enabled: true
      hooks:
        allowConversationAccess: true
      config:
        baseUrl: http://127.0.0.1:8000
        password: ${COGNEE_PASSWORD}
```

`allowConversationAccess` 是 Cognee 监听 `agent_end` 并同步会话文件所必需的 OpenClaw 权限。禁用 Cognee 后，记忆槽恢复为 `memory-core`。

## 对话完成写入

LZClaw 在固定版 Cognee 插件上维护一层可重复应用的运行时补丁。每次 OpenClaw 成功触发 `agent_end` 且 `enableSessions` 已启用时，补丁会：

1. 从事件消息中找到本轮最后一条用户消息及其后的可见助手回答。
2. 移除 LZClaw 注入的托管上下文，只保留 `[Current user request]` 后的真实用户输入。
3. 忽略 `thinking`、`reasoning` 和工具调用块，不把内部推理或工具参数写入记忆。
4. 调用 Cognee `POST /api/v1/remember/entry`，写入 `qa` 类型的 `question`、`answer`、`dataset_name` 和 `session_id`。
5. 多作用域模式下写入当前智能体的数据集，例如 `lzclaw-agent-main`；同一进程内按会话和消息身份去重。

该补丁源文件位于 `scripts/openclaw-plugin-patches/cognee.cjs`，并由 `npm run openclaw:plugins` 在每次重新生成 OpenClaw runtime 后自动应用。禁止直接把生成目录中的修改作为唯一实现来源。

写入采用零 HTTP 重试，因为 Cognee 当前接口没有接收 LZClaw 幂等键；这样可避免超时后重试产生重复记录。网络或 Cognee 故障时会记录不含对话正文的 warning，并允许同一进程内后续事件再次尝试，但当前没有持久化 outbox，失败期间的本轮记录可能缺失。

## 凭据安全

- Renderer 只通过 preload IPC 提交凭据。
- 主进程使用 Electron `safeStorage`（Windows 上为系统凭据加密能力）加密密码/API Key。
- 密文保存在应用 userData 下的 `secure/plugin-credentials.json`。
- `user_plugins.config` 只保存非敏感配置；`openclaw.json` 只保存 `${COGNEE_PASSWORD}` 或 `${COGNEE_API_KEY}` 占位符。
- gateway 启动前，主进程才把解密后的凭据注入子进程环境变量。
- 系统加密能力不可用时拒绝保存，不允许回退到明文。

## 运行时打包

`package.json` 的 `openclaw.plugins` 固定声明 Cognee `2026.6.11`。该版本没有生产依赖，构建脚本使用 `npm pack` 完整性校验后直接解包，并额外校验：

- 包版本必须等于固定版本。
- `openclaw.plugin.json` 的 ID 必须为 `cognee-openclaw`。
- 不允许出现 `dependencies` 或 `optionalDependencies`；一旦上游新增运行时依赖，构建立即失败，必须重新评估安装方式。

这是为规避 OpenClaw 2026.6 安装器与 npm 11 `--allow-scripts` 的兼容问题，不是通用的插件安装降级策略。

## 已知限制

- 连接测试不执行写入、Cognify 或召回，避免测试按钮污染正式记忆数据。
- Cognee 当前若尚未配置可用 LLM/Embedding，健康检查和认证仍可成功，但实际记忆处理会失败；配置 LLM 后再做端到端记忆验收。
- 本接入默认做 agent 级隔离。企业、租户、用户级数据集前缀需要结合 SaaS 身份映射另行配置和验证。
- 对话完成写入会把用户问题和助手最终回答发送给 Cognee。SaaS 上线前必须补齐租户/用户身份映射、访问授权、保留期限、删除流程和用户告知，不能把记忆库直接当作审计后台使用。
- `agent_end` 写入当前仅做进程内去重，没有跨重启持久化幂等和失败补偿队列；需要“绝不漏、绝不重”的审计需求时，应另建事件表/outbox 和审计存储。
