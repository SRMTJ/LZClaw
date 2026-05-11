# LZClaw 定制修改说明

更新时间：2026-05-11

本文记录 `LZClaw/src` 内针对 LZClaw 分支做过的定制修改，目的是让后续合并上游项目代码时，可以快速判断哪些改动属于本项目保留项。

## 修改原则

- 定制项尽量集中在共享配置、适配层或入口函数中，避免在页面里散落大量分支判断。
- 不修改 `openclaw` 上游运行时源码，页面与业务逻辑改动限定在 `LZClaw/src` 及相关资源文件内。
- 与 LZService 对接的接口地址、可见功能、隐藏项优先通过统一配置表达。
- 合并上游代码时，优先保留 `src/shared/lzServiceConfig.ts` 与 `src/shared/lzCustomizationConfig.ts` 这类 LZClaw 定制配置文件。

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

## 已验证内容

已针对当前修改运行过以下检查：

- `npx vitest run src/shared/lzServiceConfig.test.ts`
- `npx eslint src/renderer/components/Settings.tsx`
- `npx eslint src/renderer/utils/regionFilter.ts src/shared/lzCustomizationConfig.ts src/renderer/components/im/IMSettings.tsx src/renderer/components/agent/AgentCreateModal.tsx src/renderer/components/agent/AgentSettingsPanel.tsx`
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
