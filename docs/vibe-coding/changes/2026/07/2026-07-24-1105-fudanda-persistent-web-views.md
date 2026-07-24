# 持久化内嵌登录与业务中心

> 本文是首次接入时的历史快照，当时使用本地 `0.1.0` 包。当前 LZClaw
> 已切换到公开的 `@fudanda/electron-persistent-view@0.2.0`。长期产品契约
> 以 `docs/lzclaw-fork-customizations.md` 和
> `docs/architecture-persistent-web-views.md` 为准。

任务：引入 `@fudanda/electron-persistent-view`，让欢迎页登录和业务中心共享持久化 Web Session
作者：fudanda <314553951@qq.com>
时间：2026-07-24 11:05 Asia/Shanghai
AI 协助：Codex 参与独立包实现、LZClaw 接入、测试、文档和运行时验收。
Token 消耗：未记录
Review：未评审（本轮未明确授权创建独立 Review/提交任务；按要求不提交、不推送、不创建 PR）

## 为什么改

原有登录页由 LZClaw 自己管理 `WebContentsView`，业务中心则使用 iframe。两者没有稳定共享同一个 Electron Session，业务中心切换菜单时也无法保留完整页面实例、滚动和表单状态。原生 View 还需要统一处理覆盖层、窗口关闭、并发加载和安全偏好。

## 改了什么

- 在相邻项目 `D:\AI-AI\electron-persistent-view` 实现 MIT 授权的 `@fudanda/electron-persistent-view` v0.1.0。
- 包提供持久化 partition/path Session 解析和 `PersistentViewController` 生命周期控制，强制安全 WebPreferences，输出 ESM、CommonJS 和声明文件。
- LZClaw 通过 `file:../electron-persistent-view` 使用本地包，登录页与业务中心共享 `persist:lzclaw-web`。
- 登录控制器改为组合包控制器，保留本地回调、授权码、深链、登录 URL 和导航规则。
- 欢迎页期间认证成功后统一关闭内嵌登录视图，并执行现有“新建任务”动作：清理当前会话选择、切回 `cowork` 并聚焦任务输入区；内嵌登录和浏览器回调行为一致。
- Web 登录 Cookie 改存到共享 Session；桌面刷新令牌保存为 HttpOnly Cookie，应用启动时恢复。
- 业务中心 iframe 改为持久化原生 View，固定加载 `http://localhost:3100/users`，通过集中 IPC 上报边界、可见性、重试和状态。
- 业务中心同源导航留在 View，外部 HTTP/HTTPS 使用系统浏览器，其他协议阻止；普通导航和 SPA 导航到 `/login` 都会使桌面会话失效。
- 网页退出或会话过期时清理原生认证、专用 Session 和服务端模型元数据，renderer 立即回到封锁功能的欢迎页，不重启 OpenClaw 网关。
- 设置、升级、权限和欢迎覆盖层出现时隐藏业务 View，覆盖层消失后恢复且不重载；应用窗口关闭和退出登录时彻底关闭 View。
- 增加业务中心主进程测试和 `docs/architecture-persistent-web-views.md` 架构说明。

## 验证

- 包 `npm run typecheck`：通过。
- 包 Vitest：1 个测试文件、9 个测试通过。
- 包 ESM/CommonJS/声明构建：通过。
- Electron 40.2.1 partition/path 持久化烟测：通过。
- `npm pack --dry-run`：通过，未执行发布。
- LZClaw Electron 与 renderer TypeScript 检查：通过。
- LZClaw 目标 ESLint：通过。
- LZClaw 认证与业务中心 Vitest：4 个测试文件、25 个测试通过。
- `npm run compile:electron`：通过。
- 真实启动 `lzclaw-login-v1:3100` 和 LZClaw `5175`：通过。
- 已登录状态下业务中心直接显示 `/users`；设置弹层出现时 View 隐藏，关闭后原页面无重载恢复。
- 开发实例运行日志未出现持久化 View 或 Session 错误。
- `npm run pack` 已执行：renderer 构建、Electron 构建、原生依赖重建和 skills 构建通过；正式 electron-builder 阶段被现有预装插件校验阻止，因为网易私有 registry 连续两次重置 `moltbot-popo@2.1.13` 的下载连接。
- 使用临时空构建钩子完成仅用于依赖收集检查的诊断目录打包，随后删除临时钩子；`app.asar` 中包含 `node_modules/@fudanda/electron-persistent-view/dist/index.cjs`，大小 6772 字节，并包含两个公共导出。

## 边界和风险

- 仅修改 `D:\AI-AI\LZClaw` 的 `dev-htmm-v1` 和 `D:\AI-AI\electron-persistent-view`；未修改 LZClaw `main` 或 `D:\SRMTJ` 下的版本。
- 未迁移旧 `persist:lzclaw-auth` 数据，下一次成功登录会建立 `persist:lzclaw-web` 状态。
- 未封装 renderer/React，不支持同一个 View 同时挂载到多个窗口，不包含具体认证业务。
- 为保留当前用户登录状态，未在真实开发实例执行破坏性退出；退出与 Session 清理使用自动化测试和代码路径验证。
- `release/win-unpacked` 是跳过 OpenClaw runtime 钩子的诊断产物，不是可发布安装包；恢复网易私有 registry 访问并成功同步 `moltbot-popo` 后，仍需重新执行标准 `npm run pack`。
- 本次不执行 `git add`、`git commit`、`git push`、`npm publish`，不创建 PR。
