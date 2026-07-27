# 持久化网页视图生命周期与权限加固

任务：落实 `@fudanda/electron-persistent-view` 审计建议，并加固 LZClaw
宿主集成。
作者：fudanda <314553951@qq.com>
时间：2026-07-27 10:56 Asia/Shanghai
AI 协助：Codex 完成实现、测试、发布门禁和契约文档同步。
Review：未提交、未推送、未发布。

## 包侧改动

- `open()` 的边界设置、可见性和焦点异常都会关闭并分离失败视图。
- 用操作 ID 和同步回调保护阻止旧操作或重入调用破坏当前生命周期。
- 新增 `flushPersistentData()`，同时刷新 DOMStorage 和 Cookie Store。
- 持久化 partition 拒绝仅包含空白的名称。
- 发布前执行完整 `release:check`，Electron peer 范围限定为已验证的
  `40.x`。
- 开发编译器从实验性的 TypeScript 7 回退到稳定版 `6.0.3`。
- 包已发布为 `0.4.0`，GitHub `main` 和 `v0.4.0` 标签指向对应发布提交。

## LZClaw 集成改动

- 登录和业务中心显式检查持久化视图的 `open()` 结果。
- 业务中心 IPC 不再把当前已关闭的打开请求报告为成功，并用操作 ID
  隔离过期结果。
- `persist:lzclaw-web` Session 同时安装权限检查和权限请求处理器，默认
  拒绝所有网页权限。
- LZClaw 依赖升级到公开精确版本 `0.4.0`，没有临时切换到本地
  `file:` 依赖。

## 验证

- 包 `npm run release:check`：32 项 Vitest、构建、真实 Electron smoke、
  `publint` 和 AreTheTypesWrong 全部通过。
- npm registry 的 `latest` 和 `0.4.0` 版本对象均已确认可见。
- LZClaw 相关 Vitest：4 个文件、12 项测试全部通过。
- LZClaw 改动文件 ESLint：通过。
- `npm run compile:electron`：通过。
- `npx tsc --project tsconfig.json --noEmit`：通过。
- 完整 `npm test` 共 246 个测试文件，其中 242 个通过、4 个无关文件
  失败：3 个 macOS 路径断言在 Windows 使用反斜杠，另有 4 项既有
  5 秒超时。本次相关测试未失败。
