# LZClaw 企业桌面登录 PKCE

- 作者：yaoguoliang1030
- AI 协助：Codex 完成 PKCE 主进程实现、测试、契约文档同步和源码模式启动验收
- 变更类型：桌面认证与安全
- 项目状态：ready_for_review；按用户当前要求暂时跳过独立 Review

## 原因

企业登录服务端已经把短时桌面授权码绑定到 S256 challenge，但 LZClaw 仍只提交
`authCode`，会导致新版交换端点拒绝请求，无法完成本地桌面登录。

## 变更

- 本地回调服务器为每次活动登录生成 43 字符 PKCE verifier 和 S256 challenge。
- 系统浏览器与内嵌登录 URL 只携带 `code_challenge`；verifier 只传给 Electron 主进程。
- state 校验成功后，主进程把 verifier 短时绑定到 `ent_` 授权码；renderer 仍只接收
  授权码，不接触 verifier。
- 企业授权码交换按授权码一次性消费 verifier，并提交
  `{ authCode, codeVerifier }`；缺失、非法、过期或重复消费均在发起网络请求前失败。
- 保留旧非 `ent_` 授权码的兼容交换路径，并更新分支定制契约台账。

## 验证

- 认证定向 Vitest：6 个文件、55 项测试通过。
- 改动文件 ESLint `--max-warnings 0`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npx tsc --project tsconfig.json --noEmit`：通过。
- `npm run compile:electron`：通过。
- `git diff --check`：通过。
- 源码模式重新启动成功：Vite 5175、Electron 主进程和 OpenClaw gateway 均 ready。
- 配套 AIZhongtai 本地真实 PKCE 密码登录、handoff、交换和 Portal `/api/v1/me`
  往返全部为 200。

## 风险与回滚

- Windows 界面控制插件缺少其规范要求的文档接口，因此未自动在桌面窗口输入密码；
  应用已保持运行，最终可见界面登录留给人工确认。
- verifier 不进入 renderer、回调 URL、日志、Cookie 或本地身份摘要。
- LZClaw 与企业登录服务端必须成对发布或回滚，禁止形成单边 PKCE 契约。
- 未执行 push、PR、合并或发布。

## Review

- Review：未评审（用户明确要求继续修复时暂时跳过 Review）
- Token 消耗：未记录（当前规则不使用 Codex goal 统计）
