# 海豚买买AI工作台品牌替换

## 目标

将 `dev-htmm-v1` 的用户可见产品名从 `LobsterAI` 统一为“海豚买买AI工作台”，覆盖窗口、欢迎页、设置、托盘、登录回调页、模型提示、安装器、打包元数据和项目说明。

## 兼容边界

以下标识继续沿用旧值，避免现有安装、数据、认证、升级和服务端协议失效：

- URL scheme：`lobsterai://`
- Electron app ID：`com.lobsterai.app`
- Windows executable：`LobsterAI.exe`
- 用户数据目录：`LobsterAI`
- SQLite 文件名：`lobsterai.sqlite`
- provider、请求头、环境变量、分析埋点等机器接口

默认 Agent 名称和未自定义的 `IDENTITY.md` 会从旧品牌安全迁移；用户自定义身份内容不会被覆盖。

## 验证

- 变更 TypeScript/TSX 文件 ESLint：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npx tsc --project tsconfig.json --noEmit`：通过。
- 品牌、默认 Agent、身份迁移、登录、OpenClaw 上下文、皮肤和电脑操作相关测试：407 个通过。
- SQLite 相关完整测试使用 Electron ABI 运行：13 个文件、138 个测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。
- 源码模式运行后，Windows 实际窗口标题确认为“海豚买买AI工作台”。

全量非 SQLite 测试在 Windows 上另有 4 个既有平台敏感失败：1 个邮件附件相对路径断言和 3 个 macOS 更新器路径断言；与本次品牌改动无关，其余 2735 个通过、2 个跳过。
