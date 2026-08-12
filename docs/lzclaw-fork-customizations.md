# LZClaw 分支定制台账

本文档记录 `dev-htmm-v1` 相对上游 `origin/main` 必须长期保留的产品行为。
它不是一次性的改动日志，而是后续合并、冲突处理和回归验收的权威契约。

## 维护信息

- 定制分支：`dev-htmm-v1`
- 上游基线：`origin/main`
- 最近同步的上游提交：`ac8a6734d227d7508815e8255a2aed7369771644`
- 最近已完成合并提交：`17fe9dad3f057a5d9fceaacc40f6c87554df55dd`（本次合并待人工验收后提交）
- 最近更新：2026-08-12
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
| 应用品牌与兼容标识 | P0 | 用户可见产品名统一为“海豚买买AI工作台”，日志导出文件名使用该显示名称；Windows 全新安装目录末级名称和全平台 Electron 用户数据目录均使用 `htmmai`，安装向导浏览并选择父目录后立即在目录框中补回 `htmmai` 且不得重复追加，不迁移也不读取旧的 `Dolphin`/`LobsterAI` 用户数据目录，Windows 升级安装位置仍沿用注册表中的原目录；继续使用 `lobsterai://`、`com.lobsterai.app`、`LobsterAI.exe`、数据库文件名、provider ID、请求头和环境变量等旧标识，避免深链和服务端协议断裂 | `src/main/appConstants.ts`、`src/main/main.ts`、`src/renderer/constants/app.ts`、`electron-builder.json`、`src/main/i18n.ts`、`src/renderer/services/i18n.ts`、`scripts/nsis-installer.nsh`、`patches/app-builder-lib+24.13.3.patch` |
| 登录门禁与欢迎页 | P0 | 用户未登录时显示欢迎/登录页并阻止使用主程序；已登录时不显示欢迎页；退出或会话失效后立即回到欢迎页 | `src/renderer/App.tsx`、`src/renderer/components/WelcomeDialog.tsx` |
| 应用内嵌网页登录 | P0 | 登录在欢迎页内全区域显示，不打开额外 `BrowserWindow`；开发和生产构建均固定使用 `https://qiye.srmtj.com/login`；同时保留系统浏览器登录和回调能力 | `src/main/libs/authInAppLoginView.ts`、`src/main/libs/authLocalCallbackServer.ts`、`src/renderer/services/endpoints.ts`、`src/renderer/services/auth.ts`、`src/shared/auth/constants.ts` |
| 登录完成后的落点 | P0 | 企业工作站登录成功后只接受固定的管理员/员工门户来源；系统浏览器和内嵌登录均通过严格回环回调、服务端绑定的 `state`、S256 PKCE 与短时单次授权码回到桌面，交换时在专用 Electron Session 中安装对应 Portal 的 HttpOnly Session，并通过同源 `/api/v1/me` 复验；复验成功后关闭登录视图、隐藏业务中心并进入“新建任务”，不继续显示企业门户；旧登录服务落到同源 `/users` 时仍可恢复原生令牌，任一复验失败都返回桌面登录页 | `src/main/libs/authInAppLoginView.ts`、`src/main/libs/enterpriseDesktopAuth.ts`、`src/main/libs/enterpriseWebSessionAuth.ts`、`src/main/libs/authWebSessionRecovery.ts`、`src/main/main.ts`、`src/renderer/services/auth.ts`、`src/renderer/App.tsx` |
| 退出登录 | P0 | 企业登录尽力携带最新 CSRF 调用同源退出接口，然后清除企业会话引用、原生令牌、用户、服务端模型元数据和专用 Web Session；立即回欢迎页；不因为退出登录而重启 OpenClaw 网关 | `src/main/libs/enterpriseWebSessionAuth.ts`、`src/main/main.ts`、`src/renderer/services/auth.ts` |
| 持久化网页 Session | P0 | 登录页和业务中心共享 `persist:lzclaw-web`；应用重启后可以恢复有效登录状态；专用 Session 默认拒绝网页权限检查和请求；使用 `@fudanda/electron-persistent-view` 精确版本 `0.5.0` | `package.json`、`src/shared/auth/constants.ts`、`src/main/main.ts`、`src/main/libs/lzclawWebSessionSecurity.ts` |
| 业务中心 | P0 | 侧边栏在 MCP 下方显示“业务中心”；开发和生产构建均固定加载 `https://qiye.srmtj.com`；切换菜单时只隐藏视图并保留滚动、表单和页面状态；只有持久化视图返回 `opened` 才向当前 IPC 调用报告打开成功 | `src/renderer/components/Sidebar.tsx`、`src/renderer/components/businessCenter/BusinessCenterView.tsx`、`src/main/libs/businessCenterInAppView.ts`、`src/shared/businessCenter/constants.ts` |
| 原生视图覆盖保护 | P0 | 欢迎页、设置、更新、权限等覆盖层出现时隐藏业务中心原生视图；覆盖层关闭后恢复显示且不重载 | `src/renderer/App.tsx`、`src/renderer/components/businessCenter/BusinessCenterView.tsx` |
| 版本更新分发 | P0 | 更新检查固定使用中台 `claw` 应用且只有一个发布通道：开发构建请求本地 `127.0.0.1:8080`，生产构建请求 `https://zhongtai.srmtj.com`；自动与手动检查共享同一环境解析逻辑，不能由用户可修改的 testMode 让生产包回连本机；安装包下载全平台禁止重定向、限制为 1 GiB，并在进入可安装状态前验证发布清单 SHA-256 | `src/shared/appUpdate/endpoints.ts`、`src/main/libs/endpoints.ts`、`src/renderer/services/endpoints.ts`、`src/main/libs/appUpdateInstaller.ts`、`src/main/libs/appUpdateCoordinator.ts` |
| 模型目录 | P0 | 登录后的服务端模型列表固定读取中台 `claw` 公共目录：开发构建请求本地 `127.0.0.1:8080`，生产构建请求 `https://zhongtai.srmtj.com`；目录请求不携带桌面认证令牌，响应只接受经过清洗的模型字段，不得暴露超级网关通道、凭据或上游错误；模型执行仍保留原有权限与运行时能力门禁 | `src/shared/modelCatalog/endpoints.ts`、`src/main/libs/clientModelCatalog.ts`、`src/main/libs/endpoints.ts`、`src/main/main.ts`、`src/renderer/services/auth.ts` |
| 企业模型凭据 | P0 | 企业桌面授权码交换可以同时返回该企业的超级网关永久 Key 与 HTTPS 模型地址；凭据只由 Electron 主进程接收，经系统安全存储加密后由回环代理使用，不进入 renderer、Redux、日志或 OpenClaw 配置；退出登录、切换企业或旧原生登录时必须清除。首期使用永久 Key，后续短期模型令牌不得破坏该兼容回退 | `src/shared/modelCredential/constants.ts`、`src/main/libs/enterpriseDesktopAuth.ts`、`src/main/libs/enterpriseModelCredentialStore.ts`、`src/main/libs/openclawTokenProxy.ts`、`src/main/libs/claudeSettings.ts`、`src/main/main.ts` |
| 业务网页会话失效 | P0 | 业务中心普通导航或 SPA 导航到 `/login` 时，隐藏业务视图、清除桌面登录状态并返回欢迎页 | `src/main/libs/businessCenterInAppView.ts`、`src/main/main.ts` |
| 导航与 Electron 安全 | P0 | 保持 Node 主线程、Worker 和子框架集成关闭，启用 `contextIsolation`、`sandbox` 和 `webSecurity`，禁用不安全混合内容、WebView、实验特性和宿主 Blink 特性；同源业务导航留在应用内，外部 HTTP/HTTPS 使用系统浏览器，其他协议阻止 | `src/main/libs/authInAppLoginView.ts`、`src/main/libs/businessCenterInAppView.ts` |
| IPC 契约集中管理 | P1 | 登录和业务中心 IPC 名称、请求类型、状态类型继续放在 `src/shared`，主进程、preload 和 renderer 不各自写字符串 | `src/shared/auth/constants.ts`、`src/shared/businessCenter/constants.ts`、`src/main/preload.ts`、`src/renderer/types/electron.d.ts` |
| 本地开发隔离 | P2 | 忽略 `.codex-run/`；项目 `.npmrc` 清空继承的用户级 `allow-scripts`，避免嵌套 npm 安装被本机配置污染 | `.gitignore`、`.npmrc` |
| IM 通道精简 | P1 | “IM 机器人”、智能体绑定和定时任务只提供当前产品支持的通道；云信、小蜜蜂、POPO、龙虾邮箱保留旧数据识别能力但不可再配置、不会同步到 OpenClaw，且对应第三方插件不安装、不打包并会从已有运行时清理 | `src/shared/platform/constants.ts`、`src/renderer/utils/regionFilter.ts`、`src/main/libs/openclawConfigSync.ts`、`scripts/ensure-openclaw-plugins.cjs`、`package.json` |
| “我的”菜单精简 | P2 | “我的”账户菜单不显示“用量概览”“去充值”“邀请好友”入口；保留积分权益活动、签到和退出登录等现有账户功能 | `src/renderer/components/LoginButton.tsx` |
| 设置菜单精简 | P1 | 设置左侧菜单不显示“自定义模型”入口，快捷键列表不显示也不注册“打开设置：自定义模型”；底层自定义 provider、历史配置读取和内部兼容入口保持不变 | `src/renderer/App.tsx`、`src/renderer/components/Settings.tsx` |
| 任务分享入口 | P1 | 任务列表的会话操作菜单不显示“分享”按钮；内部导出、分享事件和底层兼容实现保持不变 | `src/renderer/components/agentSidebar/AgentTaskRow.tsx` |
| Artifact 分享入口 | P1 | 消息中的 Artifact 文件卡片、Artifact 预览工具栏和受管 HTML 浏览器工具栏不显示“分享”按钮；本地服务部署入口及底层 Artifact 分享兼容实现保持不变 | `src/renderer/components/artifacts/ArtifactPreviewCard.tsx`、`src/renderer/components/artifacts/ArtifactPanel.tsx`、`src/renderer/components/artifacts/artifactToolbarPublishPolicy.ts` |
| Agent 聊天媒体生成入口 | P1 | Agent 聊天输入工具栏不显示“图片/视频生成服务”按钮及其模型选择弹层；图片附件上传、消息内媒体预览和底层兼容代码保持不变 | `src/renderer/components/cowork/CoworkPromptInput.tsx` |
| 行为埋点关闭 | P0 | 不向有道行为分析端点发送产品使用事件；新旧用户配置都强制关闭，设置页不提供重新开启入口；本地主进程日志、OpenClaw 网关日志和用户主动导出的诊断包继续可用 | `src/renderer/constants/analytics.ts`、`src/renderer/services/logReporter.ts`、`src/renderer/services/config.ts`、`src/renderer/config.ts`、`src/renderer/components/Settings.tsx` |

持久化网页视图的详细架构和生命周期见
[`architecture-persistent-web-views.md`](./architecture-persistent-web-views.md)。

## 外部服务契约

版本更新由 `D:\AI-AI\AIZhongtai\grit-platform-admin` 提供：

- 开发自动检查：`http://127.0.0.1:8080/api/client-updates/claw/update`
- 开发手动检查：`http://127.0.0.1:8080/api/client-updates/claw/update-manual`
- 生产自动检查：`https://zhongtai.srmtj.com/api/client-updates/claw/update`
- 生产手动检查：`https://zhongtai.srmtj.com/api/client-updates/claw/update-manual`
- 更新发布只有一个通道，不读取应用 testMode，也不在服务端数据或 URL 中区分
  test/prod；开发/生产只切换 API 主机。
- 新版本缺少当前平台安装包时自动检查保持静默，手动检查显示“当前平台暂无可用更新”，
  且不得回退到旧有道下载页。未打包开发版仅允许从 `127.0.0.1`、`localhost`
  回环 HTTP 地址下载 `.exe`；正式版 Windows 安装包继续强制 HTTPS。所有平台下载均
  禁止重定向、要求有效 `Content-Length`，并同时按响应头和实际接收字节执行 1 GiB
  上限；服务端清单还必须提供 64 位十六进制 SHA-256，实际文件不一致时删除临时文件
  且禁止安装。
- 开发/生产选择以 Electron 是否为打包构建和 renderer 构建环境为准；应用设置中的
  testMode 不改变更新服务环境。

模型目录同样由 `D:\AI-AI\AIZhongtai\grit-platform-admin` 提供：

- 开发：`http://127.0.0.1:8080/api/client-models/claw/models`
- 生产：`https://zhongtai.srmtj.com/api/client-models/claw/models`
- 接口无需登录，不接受强制刷新参数；只返回模型标识、名称、统一 provider、API 格式、
  支持平台和可用状态，不返回超级网关通道 ID、通道名称、凭据或原始上游错误。
- 开发/生产只按 Electron 是否为打包构建切换主机，不读取应用 testMode；公开可读仅代表
  可展示模型目录，模型执行仍必须通过客户端既有认证、配额和运行时能力检查。

企业模型凭据由登录交换链路按当前服务端 Session 的企业身份返回：

- 当前阶段使用企业专属永久 Key；新企业在超级网关账号同步成功后立即尝试创建，已有企业
  或创建时上游暂时失败的企业在首次桌面登录时幂等补齐。
- Key 由平台中台加密保存，经企业中台的服务间签名接口获取，再随一次性桌面授权码交换
  只返回给 Electron 主进程。renderer 不得获取该字段。
- Electron 使用操作系统安全存储保存凭据；OpenClaw 只接收回环代理地址和
  `${LOBSTER_PROXY_TOKEN}`，永久 Key 仅在主进程代理向已校验的 HTTPS 模型地址发请求时使用，
  且不得跟随重定向。
- 退出登录、切换企业或改用旧原生令牌时删除本地企业模型凭据。后续改为短期模型令牌时，
  可以复用同一主进程存储和代理边界，过渡期保留永久 Key 兼容读取。

登录页面由 `D:\AI-AI\AIZhongtai\grit-enterprise-admin\apps\workstation-web`
提供：

- 开发和生产登录页：`https://qiye.srmtj.com/login`
- 开发和生产管理员/员工会话复验：`https://qiye.srmtj.com/admin/api/v1/me`、
  `https://qiye.srmtj.com/employee/api/v1/me`；所有构建均不接受回环来源
- 桌面授权码交换：开发和生产构建均使用
  `https://qiye.srmtj.com/auth/workstation-desktop-exchange`；授权码短时单次有效，
  企业桌面码使用 `ent_` 协议前缀，交换响应只能安装服务端绑定的管理员或员工
  Portal Session；登录请求只携带 S256 `code_challenge`，`codeVerifier` 只保存在 Electron
  主进程并在授权码交换请求体中一次性使用，不得进入 renderer、回调 URL、日志或本地记录；
  可选的 `modelCredential` 只允许包含当前 Session 企业的 `super_gateway` HTTPS 地址和永久 Key，
  缺失或模型凭据服务暂不可用不能使已消费的一次性登录码失效；
  企业桌面码只接受当前回环服务器完成 `state` 校验后的回调，必须拒绝从旧
  `lobsterai://` 深链注入；无此前缀的旧授权码继续交给原有交换端点
- 内嵌登录导航仅额外放行当前登录操作创建的精确
  `http://127.0.0.1:<随机端口>/auth/callback` 目标；其他回环端口或路径仍须拦截

企业工作站仍按服务端判定的角色进入管理员或员工门户。LZClaw 不信任页面
传入的角色、企业或用户字段，只在门户同源 Session 通过 `/api/v1/me` 复验且
身份、企业、成员均为 `active` 后保存最小桌面身份摘要；CSRF、handoff、授权码和 Cookie
不得写入本地用户记录。主进程忽略 renderer 传入的登录地址，内嵌视图只允许当前
构建固定登录来源和对应管理员/员工门户来源；切换企业会话与旧原生令牌体系时，
必须定向清除被替代体系的 Cookie/存储，禁止两套可恢复凭据并存。

其余现有认证和业务中心契约包括：

- 业务中心：开发和生产构建均使用 `https://qiye.srmtj.com`
- 桌面登录：本地 HTTP 回调、一次性授权码交换和 `lobsterai://` 深链回退
- Web Session Cookie：`lzclaw_web_session`，写入专用持久化 Session
- Web 流程兼容：同源 `/users` 落点可使用 Web Session Cookie 调用
  `/api/auth/refresh` 恢复桌面原生令牌

如果登录服务修改路由、Cookie 名称、回调参数或授权码交换协议，必须同步更新
本台账、认证测试和持久化视图架构文档。

## 冲突处理矩阵

| 冲突文件 | 默认处理原则 | 合并后重点检查 |
| --- | --- | --- |
| `src/main/appConstants.ts`、`src/renderer/constants/app.ts`、`electron-builder.json` | 保留“海豚买买AI工作台”显示名；不得顺手改动旧协议、App ID、可执行文件名或数据目录 | 窗口、欢迎页、设置、托盘与安装器显示名；旧用户数据和深链仍可用 |
| `src/main/main.ts` | 接收上游基础设施、更新器和运行时改进，再接回共享 Session、登录视图、业务中心和无网关重启的退出清理 | 初始化与关闭顺序、认证 IPC、Session 清理、上游新增监听器 |
| `src/main/preload.ts` | 合并上游新增 API，同时保留 `auth.loginInApp` 和完整 `businessCenter` 暴露 | channel 名称、参数类型、取消订阅函数 |
| `src/renderer/App.tsx` | 接收上游页面结构，再恢复认证门禁、登录成功进入新建任务、业务中心入口和覆盖层隐藏规则 | 未登录不可操作、已登录无欢迎页、overlay 状态完整 |
| `src/renderer/services/auth.ts` | 接收上游认证诊断和数据刷新逻辑，保留 LZClaw 登录地址、内嵌登录和退出后的本地状态更新 | 浏览器登录与内嵌登录都可用 |
| `src/renderer/types/electron.d.ts` | 对上游和分支 API 做并集，必须与 preload 实际暴露一致 | TypeScript 编译和可选 API 兼容 |
| `src/renderer/components/Sidebar.tsx` | 接收上游菜单调整，在 MCP 菜单后重新插入业务中心 | 展开和折叠布局、选中状态 |
| `package.json` | 接收上游版本和依赖更新，保留精确依赖 `@fudanda/electron-persistent-view: 0.5.0`，除非明确执行包升级 | CommonJS 加载、打包时进入 `app.asar` |

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
git diff --name-status HEAD..origin/main -- `
  src/main/main.ts `
  src/main/libs/authInAppLoginView.ts `
  src/main/libs/businessCenterInAppView.ts `
  src/renderer/services/auth.ts `
  src/renderer/App.tsx `
  src/shared/auth/constants.ts
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
git merge --no-commit --no-ff origin/main
git diff --name-only --diff-filter=U
```

先阅读冲突文件的 base、ours 和 theirs，再按照“冲突处理矩阵”合并行为。
不要通过移动本地 `main`、强制推送或重写 `dev-htmm-v1` 历史完成同步。
如果上一步的热点检查有输出，本次合并按“认证敏感合并”处理，必须同时保留：

1. 内嵌登录完成后关闭网页登录视图并进入主任务界面，不直接暴露 `/users`。
2. 登录服务误走 Web 流程进入同源 `/users` 时，可以从 HttpOnly Web Session
   恢复桌面原生令牌；恢复失败时回到桌面登录页。
3. `/users` 作为业务中心页面，只能通过业务中心入口正常显示。

禁止删除、跳过或弱化对应测试来让合并通过。测试文件缺失视为合并阻塞。

### 3. 合并验证

基础检查：

```powershell
npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 <本次冲突文件>
npx tsc --project electron-tsconfig.json --noEmit
npx tsc --noEmit
npx vitest run `
  src/main/libs/authWebSessionRecovery.test.ts `
  src/main/libs/authInAppLoginView.test.ts `
  src/main/libs/authLocalCallbackServer.test.ts `
  src/main/libs/authCallbackRouter.test.ts `
  src/main/libs/businessCenterInAppView.test.ts `
  src/renderer/services/auth.test.ts
git diff --check
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
3. 内嵌企业登录成功后复验管理员或员工 Session，关闭网页并进入新建任务，不停留在企业门户。
4. 系统浏览器登录仍能通过本地回调或深链完成。
5. 业务中心打开当前构建固定的企业门户首页，切换菜单后页面状态不丢失。
6. 设置、更新、权限和欢迎覆盖层不会被原生网页视图遮挡。
7. 从应用或业务网页退出后立即回欢迎页，网关不重启。
8. 重启应用后，有效的企业 Web Session 或旧原生令牌可恢复；退出状态不会恢复成已登录。
9. 线上企业门户不可用时，业务中心显示错误和重试状态。
10. 登录页和业务中心的摄像头、麦克风、通知等网页权限请求默认被拒绝。

以上自动检查和人工验收完成前，不创建合并提交。用户确认后执行：

```powershell
git commit --no-edit
git merge-base --is-ancestor origin/main HEAD
git status --short --branch
```

如果当前环境无法完成登录运行时验收，应保持合并未提交并报告缺失门禁，不能把
“代码已无冲突”视为“合并已经完成”。

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
