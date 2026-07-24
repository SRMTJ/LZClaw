# LZClaw 分支定制台账

本文档记录 `dev-htmm-v1` 相对上游 `origin/main` 必须长期保留的产品行为。
它不是一次性的改动日志，而是后续合并、冲突处理和回归验收的权威契约。

## 维护信息

- 定制分支：`dev-htmm-v1`
- 上游基线：`origin/main`
- 最近同步的上游提交：`2921c1e5bddbd96a503da4acd7538cac45bcd0f2`
- 最近合并提交：`2b49ccd6e755373d299fef399bad8f3c6c616a36`
- 最近更新：2026-07-24
- 合并策略：只把 `origin/main` 合并到 `dev-htmm-v1`，不修改或推送 `main`

每次合并上游后都要更新以上两个提交号。功能实现可以随上游结构调整，
但下文标记为“必须保留”的行为不能在没有明确产品决策时删除。

## 定制优先级

- `P0 必须保留`：LZClaw 产品契约。冲突时必须恢复，并完成对应验收。
- `P1 实现可替换`：行为必须保留，但允许采用上游的新 API、组件或目录结构重写。
- `P2 开发维护`：只在仍然解决当前问题时保留，可在确认不再需要后删除。

## 定制功能清单

| 功能 | 优先级 | 必须保留的行为 | 主要代码位置 |
| --- | --- | --- | --- |
| 登录门禁与欢迎页 | P0 | 用户未登录时显示欢迎/登录页并阻止使用主程序；已登录时不显示欢迎页；退出或会话失效后立即回到欢迎页 | `src/renderer/App.tsx`、`src/renderer/components/WelcomeDialog.tsx` |
| 应用内嵌网页登录 | P0 | 登录在欢迎页内全区域显示，不打开额外 `BrowserWindow`；固定使用 LZClaw 登录地址；同时保留系统浏览器登录和回调能力 | `src/main/libs/authInAppLoginView.ts`、`src/renderer/services/auth.ts`、`src/shared/auth/constants.ts` |
| 登录完成后的落点 | P0 | 登录成功后关闭登录视图，隐藏业务中心，进入“新建任务”状态并聚焦任务输入，而不是跳到 `/users` | `src/renderer/App.tsx` |
| 退出登录 | P0 | 清除原生令牌、用户、服务端模型元数据和专用 Web Session；立即回欢迎页；不因为退出登录而重启 OpenClaw 网关 | `src/main/main.ts`、`src/renderer/services/auth.ts` |
| 持久化网页 Session | P0 | 登录页和业务中心共享 `persist:lzclaw-web`；应用重启后可以恢复有效登录状态；使用 `@fudanda/electron-persistent-view` 精确版本 `0.2.0` | `package.json`、`src/shared/auth/constants.ts`、`src/main/main.ts` |
| 业务中心 | P0 | 侧边栏在 MCP 下方显示“业务中心”；应用内加载 `http://localhost:3100/users`；切换菜单时只隐藏视图并保留滚动、表单和页面状态 | `src/renderer/components/Sidebar.tsx`、`src/renderer/components/businessCenter/BusinessCenterView.tsx`、`src/main/libs/businessCenterInAppView.ts` |
| 原生视图覆盖保护 | P0 | 欢迎页、设置、更新、权限等覆盖层出现时隐藏业务中心原生视图；覆盖层关闭后恢复显示且不重载 | `src/renderer/App.tsx`、`src/renderer/components/businessCenter/BusinessCenterView.tsx` |
| 业务网页会话失效 | P0 | 业务中心普通导航或 SPA 导航到 `/login` 时，隐藏业务视图、清除桌面登录状态并返回欢迎页 | `src/main/libs/businessCenterInAppView.ts`、`src/main/main.ts` |
| 导航与 Electron 安全 | P0 | 保持 `nodeIntegration=false`、`contextIsolation=true`、`sandbox=true`、`webSecurity=true`；同源业务导航留在应用内，外部 HTTP/HTTPS 使用系统浏览器，其他协议阻止 | `src/main/libs/authInAppLoginView.ts`、`src/main/libs/businessCenterInAppView.ts` |
| IPC 契约集中管理 | P1 | 登录和业务中心 IPC 名称、请求类型、状态类型继续放在 `src/shared`，主进程、preload 和 renderer 不各自写字符串 | `src/shared/auth/constants.ts`、`src/shared/businessCenter/constants.ts`、`src/main/preload.ts`、`src/renderer/types/electron.d.ts` |
| 本地开发隔离 | P2 | 忽略 `.codex-run/`；项目 `.npmrc` 清空继承的用户级 `allow-scripts`，避免嵌套 npm 安装被本机配置污染 | `.gitignore`、`.npmrc` |

持久化网页视图的详细架构和生命周期见
[`architecture-persistent-web-views.md`](./architecture-persistent-web-views.md)。

## 外部服务契约

当前实现依赖 `D:\AI-AI\lzclaw-login-v1` 提供以下接口和页面：

- 登录页：`http://localhost:3100/login`
- 业务中心：`http://localhost:3100/users`
- 桌面登录：本地 HTTP 回调、一次性授权码交换和 `lobsterai://` 深链回退
- Web Session Cookie：`lzclaw_web_session`，写入专用持久化 Session

如果登录服务修改路由、Cookie 名称、回调参数或授权码交换协议，必须同步更新
本台账、认证测试和持久化视图架构文档。

## 冲突处理矩阵

| 冲突文件 | 默认处理原则 | 合并后重点检查 |
| --- | --- | --- |
| `src/main/main.ts` | 接收上游基础设施、更新器和运行时改进，再接回共享 Session、登录视图、业务中心和无网关重启的退出清理 | 初始化与关闭顺序、认证 IPC、Session 清理、上游新增监听器 |
| `src/main/preload.ts` | 合并上游新增 API，同时保留 `auth.loginInApp` 和完整 `businessCenter` 暴露 | channel 名称、参数类型、取消订阅函数 |
| `src/renderer/App.tsx` | 接收上游页面结构，再恢复认证门禁、登录成功进入新建任务、业务中心入口和覆盖层隐藏规则 | 未登录不可操作、已登录无欢迎页、overlay 状态完整 |
| `src/renderer/services/auth.ts` | 接收上游认证诊断和数据刷新逻辑，保留 LZClaw 登录地址、内嵌登录和退出后的本地状态更新 | 浏览器登录与内嵌登录都可用 |
| `src/renderer/types/electron.d.ts` | 对上游和分支 API 做并集，必须与 preload 实际暴露一致 | TypeScript 编译和可选 API 兼容 |
| `src/renderer/components/Sidebar.tsx` | 接收上游菜单调整，在 MCP 菜单后重新插入业务中心 | 展开和折叠布局、选中状态 |
| `package.json` | 接收上游版本和依赖更新，保留精确依赖 `@fudanda/electron-persistent-view: 0.2.0`，除非明确执行包升级 | CommonJS 加载、打包时进入 `app.asar` |

禁止用整文件 `ours` 或 `theirs` 处理上述文件。应先接受两边新增能力，再按本表逐项恢复产品契约。

## 上游合并流程

### 1. 合并前

```powershell
cd D:\AI-AI\LZClaw
git rev-parse --show-toplevel
git switch dev-htmm-v1
git status --short --branch
git fetch origin
git rev-list --left-right --count HEAD...origin/main
git log --oneline HEAD..origin/main
```

工作区不干净时，先确认修改归属。需要临时保存时使用带说明的 stash，并包含
未跟踪文件：

```powershell
git stash push -u -m "before merging origin/main into dev-htmm-v1"
```

可以在本仓库启用 Git 的冲突复用能力，减少相同热点文件在以后合并时重复处理：

```powershell
git config rerere.enabled true
git config rerere.autoupdate true
```

### 2. 执行合并

```powershell
git merge --no-edit origin/main
git diff --name-only --diff-filter=U
```

先阅读冲突文件的 base、ours 和 theirs，再按照“冲突处理矩阵”合并行为。
不要通过移动本地 `main`、强制推送或重写 `dev-htmm-v1` 历史完成同步。

### 3. 合并验证

基础检查：

```powershell
npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 <本次冲突文件>
npx tsc --project electron-tsconfig.json --noEmit
npx tsc --noEmit
npx vitest run src/main/libs/authLocalCallbackServer.test.ts src/main/libs/authCallbackRouter.test.ts src/main/libs/businessCenterInAppView.test.ts src/renderer/services/auth.test.ts
git diff --check
git merge-base --is-ancestor origin/main HEAD
git status --short --branch
```

涉及持久化视图时还要执行：

```powershell
npm ls @fudanda/electron-persistent-view --depth=0
npm run compile:electron
```

运行验收清单：

1. 未登录启动后只能操作欢迎/登录页。
2. 已登录启动后直接进入主程序，不显示欢迎页。
3. 内嵌登录成功后关闭网页并进入新建任务，不进入用户列表。
4. 系统浏览器登录仍能通过本地回调或深链完成。
5. 业务中心打开 `/users`，切换菜单后页面状态不丢失。
6. 设置、更新、权限和欢迎覆盖层不会被原生网页视图遮挡。
7. 从应用或业务网页退出后立即回欢迎页，网关不重启。
8. 重启应用后，有效登录可恢复；退出状态不会恢复成已登录。
9. `3100` 不可用时业务中心显示错误和重试状态。

### 4. 合并后维护

- 更新本文“最近同步的上游提交”和“最近合并提交”。
- 检查 `git diff origin/main...HEAD`，确认每项差异都能对应到本台账或 change fragment。
- 新增长期产品行为时，先更新“定制功能清单”，再提交实现。
- 只记录实现过程、一次性故障和当次验证结果的内容放入
  `docs/vibe-coding/changes/YYYY/MM/`，不要塞进长期契约。
- 未经明确要求，不推送分支、不创建 PR，也不修改 `main`。

## 比只写文档更稳的方案

长期维护采用四层组合：

1. `AGENTS.md`：约束自动化工具和开发者如何合并。
2. 本文：记录不可丢失的产品行为、冲突优先级和验收标准。
3. `docs/vibe-coding/changes/`：记录每次修改的原因、范围和验证证据。
4. 自动化测试与 CI：把 P0 行为变成失败即阻止合并的门禁。

文档解决“应该保留什么”，`git rerere` 解决“重复冲突怎么更快处理”，测试和
CI 解决“合并后是否真的还可用”。三者配合比单独维护一份修改清单可靠。
