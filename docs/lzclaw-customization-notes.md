# LZClaw 定制修改说明

更新时间：2026-05-11

本文记录 `LZClaw/src` 内针对 LZClaw 分支做过的定制修改，目的是让后续合并上游项目代码时，可以快速判断哪些改动属于本项目保留项。

## 修改原则

- 定制项尽量集中在共享配置、适配层或入口函数中，避免在页面里散落大量分支判断。
- 不修改 `openclaw` 上游运行时源码，页面与业务逻辑改动限定在 `LZClaw/src` 及相关资源文件内。
- 与 LZService 对接的接口地址、可见功能、隐藏项优先通过统一配置表达。
- 合并上游代码时，优先保留 `src/shared/lzServiceConfig.ts` 与 `src/shared/lzCustomizationConfig.ts` 这类 LZClaw 定制配置文件。

## 文档维护约定

- 每次修改 LZClaw 定制内容后，都必须同步更新本文档。
- 新记录至少说明：修改目的、涉及文件、验证情况、后续合并上游时的注意点。
- 如果修改只是调整已有定制项，应更新对应章节，不重复新增相同主题。
- 如果新增一类定制能力，应新增独立章节，并优先说明它放在哪个统一配置或适配层里。

## LZService 接口接入

新增共享配置：

- `src/shared/lzServiceConfig.ts`
- `src/shared/lzServiceConfig.test.ts`

主要用途：

- 统一配置 LZService 默认地址：`http://127.0.0.1:5000`
- 统一生成登录、更新、手动更新接口地址。
- 支持通过 `LZ_SERVICE_BASE_URL` 覆盖接口服务地址。

已接入的 LZService 路由：

- 登录地址：`/openapi/get/luna/hardware/lobsterai/{test|prod}/login-url`
- 自动更新：`/openapi/get/luna/hardware/lobsterai/{test|prod}/update`
- 手动更新：`/openapi/get/luna/hardware/lobsterai/{test|prod}/update-manual`
- 用户接口：`/api/auth/*`、`/api/user/*`、`/api/models/available`

相关文件：

- `src/main/libs/endpoints.ts`
- `src/main/main.ts`
- `src/renderer/services/auth.ts`
- `src/renderer/services/endpoints.ts`

## LZService 登录后可用模型

LZService 的 mock 登录配置已调整为登录成功后返回 DeepSeek 模型，并声明为 OpenAI 兼容协议。

返回模型：

```json
{
  "modelId": "deepseek-v3.2",
  "modelName": "DeepSeek V3.2",
  "provider": "deepseek",
  "apiFormat": "openai",
  "supportsImage": false
}
```

修改目的：

- LZClaw 登录成功后调用 `/api/models/available` 时，服务端模型列表直接出现 DeepSeek。
- LZClaw 侧已有 `lobsterai-server` 代理与 OpenAI 兼容运行时配置，`apiFormat: "openai"` 会沿用该链路。

相关文件：

- `D:/SRMTJ/LZClaw/LZService/public/auth.mock.json`
- `D:/SRMTJ/LZClaw/LZService/tests/feature/auth_test.go`

合并注意：

- 该修改位于 LZService 项目，不在 LZClaw 前端仓库内。
- 如果后续 LZService 接入真实模型配置，应保持 `/api/models/available` 返回字段不变：`modelId`、`modelName`、`provider`、`apiFormat`、`supportsImage`。
- DeepSeek 当前按文本模型处理，`supportsImage` 为 `false`。

## 登录协议修复

开发模式下，Windows 会把 `lobsterai://auth/callback?...` 错误识别为 Electron app 路径，导致启动失败。

已在主进程中增加开发模式协议注册逻辑：

- 开发模式使用 `process.execPath` 加当前 Electron app 入口路径注册协议。
- 打包模式仍使用默认协议注册方式。

相关文件：

- `src/main/main.ts`

## Logo 显示适配

`public/logo.png` 尺寸调整后，原先部分页面使用固定宽高导致图片变形。

已将相关页面改为按原图比例显示，使用 `w-auto`、`object-contain`、最大宽度限制等方式避免拉伸。

相关文件：

- `src/renderer/components/WelcomeDialog.tsx`
- `src/renderer/components/Settings.tsx`
- `src/renderer/components/cowork/CoworkView.tsx`
- `src/renderer/components/cowork/CoworkSessionDetail.tsx`

## 设置页关于信息隐藏

设置页「关于」中已隐藏以下内容：

- 服务条款
- 导出日志
- 网易有道版权信息
- 联系邮箱
- 用户手册
- 用户社群

相关文件：

- `src/renderer/components/Settings.tsx`

## 设置页 Agent 引擎隐藏

设置页侧边栏已隐藏「Agent 引擎」入口。

处理方式：

- 从设置页 tab 列表移除 `coworkAgentEngine`。
- 如果外部仍传入 `coworkAgentEngine` 作为初始 tab，则自动回退到 `general`。
- 保留底层 `agentEngine` 配置读取和保存逻辑，避免影响已有配置。

相关文件：

- `src/renderer/components/Settings.tsx`

## IM 机器人平台白名单

设置页「IM 机器人」只保留以下平台：

- 微信
- 钉钉
- 飞书
- 企业微信

新增共享配置：

- `src/shared/lzCustomizationConfig.ts`

白名单配置：

```ts
export const LZ_VISIBLE_IM_PLATFORMS = [
  'weixin',
  'dingtalk',
  'feishu',
  'wecom',
];
```

平台显示统一从 `getVisibleIMPlatforms` 过滤，因此设置页、Agent 创建页、Agent 绑定页会保持同一套可见平台规则。

相关文件：

- `src/shared/lzCustomizationConfig.ts`
- `src/renderer/utils/regionFilter.ts`
- `src/renderer/components/im/IMSettings.tsx`
- `src/renderer/components/agent/AgentCreateModal.tsx`
- `src/renderer/components/agent/AgentSettingsPanel.tsx`

## 应用名称与安装目录

应用打包名称已从 `LobsterAI` 修改为 `LZClaw`。

修改目的：

- Windows 默认安装目录改为 `%LOCALAPPDATA%\Programs\LZClaw`
- Windows 可执行文件名改为 `LZClaw.exe`
- 应用运行时 `userData` 目录改为 `%APPDATA%\LZClaw`
- Windows 安装脚本中的安装日志、技能备份、进程关闭逻辑同步使用 `LZClaw`
- 关于页、欢迎页、托盘文案和核心应用显示名称同步使用 `LZClaw`

相关文件：

- `electron-builder.json`
- `package.json`
- `package-lock.json`
- `scripts/nsis-installer.nsh`
- `src/main/appConstants.ts`
- `src/renderer/constants/app.ts`
- `src/main/main.ts`
- `src/main/i18n.ts`
- `src/renderer/services/i18n.ts`
- `src/renderer/components/Settings.tsx`
- `src/renderer/components/WelcomeDialog.tsx`
- `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- `src/main/logger.ts`
- `src/main/libs/openclawMemoryFile.ts`
- `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
- `src/main/libs/openaiCodexAuth.ts`

合并注意：

- `lobsterai://` 登录回调协议暂时保留，因为 LZService 返回的登录回调仍依赖该协议。
- LZService 路由中的 `/lobsterai/` 路径暂时保留，因为这是后端当前接口契约。
- `lobsterai-server` provider id、模型 id、数据库文件名等内部兼容标识暂时保留，避免影响已有配置和数据。
- 旧安装和旧用户数据目录不会自动迁移；如需迁移 `%APPDATA%\LobsterAI` 数据，需要单独增加迁移逻辑。

## 已验证内容

已针对当前修改运行过以下检查：

- `npx vitest run src/shared/lzServiceConfig.test.ts`
- `npx eslint src/renderer/components/Settings.tsx`
- `npx eslint src/renderer/utils/regionFilter.ts src/shared/lzCustomizationConfig.ts src/renderer/components/im/IMSettings.tsx src/renderer/components/agent/AgentCreateModal.tsx src/renderer/components/agent/AgentSettingsPanel.tsx`
- `npx eslint src/main/appConstants.ts src/main/i18n.ts src/main/libs/agentEngine/openclawRuntimeAdapter.ts src/main/libs/openaiCodexAuth.ts src/main/libs/openclawMemoryFile.ts src/main/logger.ts src/main/main.ts src/renderer/components/Settings.tsx src/renderer/components/WelcomeDialog.tsx src/renderer/components/cowork/CoworkSessionDetail.tsx src/renderer/constants/app.ts src/renderer/services/i18n.ts`
- `node -e "JSON.parse(require('fs').readFileSync('electron-builder.json','utf8')); JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); console.log('json ok')"`
- `node -e "JSON.parse(require('fs').readFileSync('public/auth.mock.json','utf8')); console.log('auth mock json ok')"`（在 `D:/SRMTJ/LZClaw/LZService`）
- `go test ./tests/feature -run TestAuthTestSuite -count=1`（在 `D:/SRMTJ/LZClaw/LZService`）
- `npx tsc --noEmit`
- `npx tsc --project electron-tsconfig.json --noEmit`

完整 `npm run test` 和 `npm run compile:electron` 曾因 Windows 下 `better_sqlite3.node` 被占用导致原生模块 rebuild 失败；这是本地文件锁问题，不是上述定制代码的类型或语法错误。

## 后续修改建议

新增 LZClaw 定制项时，优先按以下顺序放置：

1. 可配置的功能开关或白名单：放入 `src/shared/lzCustomizationConfig.ts`
2. LZService 接口路径和环境差异：放入 `src/shared/lzServiceConfig.ts`
3. 页面展示隐藏：尽量通过统一配置或现有可见性函数过滤
4. 业务流程适配：优先放在 service、endpoint、adapter 层，避免直接散落在组件 JSX 中

合并上游代码时，应重点检查上述相关文件是否被覆盖或冲突。
