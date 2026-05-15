# LZClaw 定制修改说明

更新时间：2026-05-14

本文记录 `LZClaw/src` 内针对 LZClaw 分支做过的定制修改，目的是让后续合并上游项目代码时，可以快速判断哪些改动属于本项目保留项。

## CSM 技能从 32 合并为 8（2026-05-14）

修改目的：

- 减少技能数量，合并相似能力，保持内置 CSM 技能数量 `<= 10`。
- 旧 32 个 CSM skill ID 直接下线，仅保留新 8 个 skill ID。

涉及文件：

- `D:/SRMTJ/LZClaw/agent-and-skill/csm-skill-manifest.json`
- `D:/SRMTJ/LZClaw/LZClaw/SKILLs/skills.config.json`
- `D:/SRMTJ/LZClaw/LZClaw/SKILLs/csm-*/`
- `D:/SRMTJ/LZClaw/LZService/app/http/controllers/csm_manifest_sync.go`
- `D:/SRMTJ/LZClaw/LZService/scripts/build_csm_skill_zips.ps1`
- `D:/SRMTJ/LZClaw/LZService/tests/feature/skill_store_test.go`
- `D:/SRMTJ/LZClaw/LZService/tests/feature/agent_template_test.go`

修改内容：

- 将 CSM 技能清单改为 8 个合并技能：
  - `csm-sales-insight`
  - `csm-doc-export`
  - `csm-self-expanded`
  - `csm-health-risk`
  - `csm-renew-opportunity`
  - `csm-task-flow`
  - `csm-data-audit`
  - `csm-weekly-pipeline`
- 每个新技能采用“单技能多子命令”入口（`main.js` / `main.py`）。
- `skills.config.json` 默认启用项改为仅这 8 个 CSM 技能。
- LZService 同步逻辑增加旧 32 ID 清理，仅清理历史 32 个 ID 的本地/市场技能记录。
- zip 构建脚本增加陈旧 zip 清理，`public/skills/csm` 只保留 manifest 当前技能 zip。
- 销售 Agent 自动同步的 `skillIds` 由 manifest 驱动，自动切换为“新 8 个 + web-search/docx/xlsx”。

验证情况：

- `LZClaw/SKILLs` 下仅保留 8 个 `csm-*` 技能目录。
- 新技能脚本入口和子命令脚本均已就位。
- `csm-skill-manifest.json` 已降为 8 条。

## CSM 技能中文描述修复（2026-05-14）

修改目的：

- 修复新增 CSM 技能在技能市场显示“中文描述字段仍为英文”的问题。

涉及文件：

- `D:/SRMTJ/LZClaw/agent-and-skill/csm-skill-manifest.json`
- `D:/SRMTJ/LZClaw/LZClaw/SKILLs/csm-*/SKILL.md`
- `D:/SRMTJ/LZClaw/LZService/scripts/build_csm_skill_zips.ps1`
- `D:/SRMTJ/LZClaw/LZService/public/skills/csm/manifest.json`

修改内容：

- 将 CSM manifest 的 `nameZh` 与 `descriptionZh` 统一改为中文文案。
- 将 32 个内置 `csm-*` 技能 `SKILL.md` 中描述改为中文。
- 修复 `build_csm_skill_zips.ps1` 对 manifest 的读取编码，显式使用 `UTF8`，避免中文解析异常。

验证情况：

- 重新执行 `powershell -ExecutionPolicy Bypass -File D:/SRMTJ/LZClaw/LZService/scripts/build_csm_skill_zips.ps1` 成功生成 32 个技能 zip。
- `go test ./tests/feature -run TestSkillStoreTestSuite -count=1` 通过。

## CSM 技能版本字段补充（2026-05-14）

修改目的：

- 修复新增 `csm-*` 技能 `SKILL.md` 顶部元信息缺少 `version` 的问题。

涉及文件：

- `D:/SRMTJ/LZClaw/LZClaw/SKILLs/csm-*/SKILL.md`

修改内容：

- 为 32 个 `csm-*` 技能统一补充前置元数据字段：`version: 1.0.0`。

验证情况：

- 抽样检查多个 `csm-*` 的 `SKILL.md`，均包含 `version: 1.0.0`。
- 全量统计命中 32/32。

## CSM 技能读取路径改为当前工作目录（2026-05-14）

修改目的：

- 去除新增 `csm-*` 技能脚本中的固定绝对路径，统一从“当前工作目录”读取输入文件。

涉及文件：

- `D:/SRMTJ/LZClaw/LZClaw/SKILLs/csm-*/scripts/*`（本次共 19 个脚本）

修改内容：

- 将 `C:\Users\...`、`/Users/...`、`数据表/...` 等固定路径改为当前目录文件名（例如 `销售管理表.xlsx`、`客户成功总表.xlsx`、`销售管理系统 .xlsx`）。
- `scan_headers.py` 的扫描目录由固定目录改为 `os.getcwd()`。
- 同步将部分固定输出路径改为当前目录输出（如 `health_results.json`、`risk_results.json`、`renew_results.json`、`opportunity_results.json`、`task_results.json`、`详细客户分析_3.16-3.19.docx`）。

验证情况：

- 全量检索确认不再存在 `C:\Users\...`、`/Users/...`、`数据表/`、`生成结果/` 等固定路径引用。
- 受影响 Python 脚本执行 `python -m py_compile` 通过。
- 受影响 JS 脚本执行 `node --check` 通过。

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
- 技能市场：`/openapi/get/luna/hardware/lobsterai/{test|prod}/skill-store`
- Agent 模板：`/openapi/get/luna/hardware/lobsterai/{test|prod}/agent-template`
- 用户接口：`/api/auth/*`、`/api/user/*`、`/api/models/available`

相关文件：

- `src/main/libs/endpoints.ts`
- `src/main/main.ts`
- `src/renderer/services/auth.ts`
- `src/renderer/services/endpoints.ts`

### 技能市场接口

LZService 已新增静态 JSON 管理的技能市场接口，响应格式兼容原 `api-overmind` 的 `skill-store`。配置按环境拆分，避免 test/prod 技能市场互相影响。

LZService 配置文件：

- `D:/SRMTJ/LZClaw/LZService/public/skill_store_test.json`
- `D:/SRMTJ/LZClaw/LZService/public/skill_store_prod.json`

LZService 相关文件：

- `D:/SRMTJ/LZClaw/LZService/app/http/controllers/skill_store_controller.go`
- `D:/SRMTJ/LZClaw/LZService/routes/web.go`
- `D:/SRMTJ/LZClaw/LZService/tests/feature/skill_store_test.go`
- `D:/SRMTJ/LZClaw/LZService/app/http/controllers/skill_store_controller_test.go`

接口路径：

- `/openapi/get/luna/hardware/lobsterai/test/skill-store`
- `/openapi/get/luna/hardware/lobsterai/prod/skill-store`

配置覆盖：

- 可通过 `LZ_SERVICE_SKILL_STORE_TEST_CONFIG_PATH` 指定 test 环境替代 JSON 文件。
- 可通过 `LZ_SERVICE_SKILL_STORE_PROD_CONFIG_PATH` 指定 prod 环境替代 JSON 文件。

LZClaw 侧已将技能市场地址纳入 `src/shared/lzServiceConfig.ts`，并让主进程 `skills:fetchMarketplace` 使用 Electron `session.defaultSession.fetch` 请求接口，因此支持本地 `http://127.0.0.1:5000`。

技能接口与安装日志：

- LZService `SkillStoreAPI` 会记录技能市场配置加载路径、请求环境，以及返回的 `localSkill`、`marketTags`、`marketplace` 数量。
- LZClaw 主进程 `skills:fetchMarketplace` 会记录技能市场请求 URL、HTTP 状态，以及解析出的本地技能、标签、市场技能数量。
- LZClaw `SkillManager` 会记录技能安装来源、发现的候选技能目录、直接安装结果、待确认安装处理、升级请求、升级安全扫描摘要和失败原因。
- 这些日志用于排查 LZService 技能市场接口调用、本地技能包安装、市场技能升级的完整链路。

合并注意：

- 不要把技能市场 URL 写回 `api-overmind.youdao.com`。
- 如需增删市场技能，优先按环境维护 LZService 的 `public/skill_store_test.json` 或 `public/skill_store_prod.json`。

### Agent 模板接口

LZService 已新增静态 JSON 管理的 Agent 模板接口，LZClaw 的“预设 Agent”和“使用模板”入口会优先从该接口读取模板。

LZService 配置文件：

- `D:/SRMTJ/LZClaw/LZService/public/agent_templates_test.json`
- `D:/SRMTJ/LZClaw/LZService/public/agent_templates_prod.json`

LZService 相关文件：

- `D:/SRMTJ/LZClaw/LZService/app/http/controllers/agent_template_controller.go`
- `D:/SRMTJ/LZClaw/LZService/routes/web.go`
- `D:/SRMTJ/LZClaw/LZService/tests/feature/agent_template_test.go`
- `D:/SRMTJ/LZClaw/LZService/app/http/controllers/agent_template_controller_test.go`

接口路径：

- `/openapi/get/luna/hardware/lobsterai/test/agent-template`
- `/openapi/get/luna/hardware/lobsterai/prod/agent-template`

配置覆盖：

- 可通过 `LZ_SERVICE_AGENT_TEMPLATES_TEST_CONFIG_PATH` 指定 test 环境替代 JSON 文件。
- 可通过 `LZ_SERVICE_AGENT_TEMPLATES_PROD_CONFIG_PATH` 指定 prod 环境替代 JSON 文件。

响应格式：

```json
{
  "data": {
    "value": {
      "templates": []
    }
  }
}
```

LZClaw 侧已将 Agent 模板地址纳入 `src/shared/lzServiceConfig.ts`，主进程通过 Electron `session.defaultSession.fetch` 请求接口并校验模板字段。接口不可用或返回为空时，会回退到本地 `src/main/presetAgents.ts` 的内置模板，避免 LZService 未启动时 Agent 页面不可用。

相关文件：

- `src/shared/lzServiceConfig.ts`
- `src/main/libs/endpoints.ts`
- `src/renderer/services/endpoints.ts`
- `src/main/main.ts`
- `src/main/agentManager.ts`
- `src/main/presetAgents.ts`

合并注意：

- 不要重新把 Agent 模板仅固定在 `src/main/presetAgents.ts`。该文件现在主要作为接口失败时的兜底和模板字段规范。
- 如需增删模板，优先按环境维护 LZService 的 `public/agent_templates_test.json` 或 `public/agent_templates_prod.json`。

### LZService 管理后台

LZService 已新增 Next.js 静态管理后台，用于在线管理技能市场、Agent 模板和更新配置。后台构建产物由 Goravel 托管在 `/admin/`，不会改变 LZClaw 调用的现有接口路径。

LZService 相关文件：

- `D:/SRMTJ/LZClaw/LZService/web`
- `D:/SRMTJ/LZClaw/LZService/app/http/controllers/admin_controller.go`
- `D:/SRMTJ/LZClaw/LZService/database/migrations/20260512000001_create_users_table.go`
- `D:/SRMTJ/LZClaw/LZService/docs/admin.md`

后台接口：

- `/api/admin/auth/login`
- `/api/admin/auth/logout`
- `/api/admin/auth/me`
- `/api/admin/status`
- `/api/admin/config/skill-store/{test|prod}`
- `/api/admin/config/agent-template/{test|prod}`
- `/api/admin/config/update/{test|prod}`

数据库说明：

- `users` 表兼容 SQLite 和 PostgreSQL。
- `role` 使用字符串：`admin`、`user`。
- `status` 使用整数，`1` 表示启用。
- 后台只允许 `admin` 用户登录；普通用户账号不进入后台。

合并注意：

- 后台只管理 LZService 配置文件，LZClaw 仍然通过公开的 `skill-store`、`agent-template`、`update` 接口读取。
- 如需首次创建管理员账号，可使用 `LZ_SERVICE_ADMIN_USERNAME` 和 `LZ_SERVICE_ADMIN_PASSWORD` 在服务启动时写入数据库。

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

### 服务端模型直连参数

`/api/models/available` 已支持可选字段：

- `apiBaseUrl`
- `apiKey`

LZClaw 行为：

- 当模型同时下发 `apiBaseUrl + apiKey` 时，OpenClaw token proxy 会按模型直连该上游地址；
- 当模型未下发或字段不完整时，自动回退到原有链路：`{LZ_SERVICE_BASE_URL}/api/proxy/v1/chat/completions`；
- 请求日志会打印模型路由来源（`direct`/`fallback`）和最终上游 URL，`apiKey` 会脱敏显示。

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

## 设置页模型 Tab 隐藏

设置页侧边栏已隐藏「模型」Tab。

处理方式：

- 从设置页侧边栏 tab 列表移除 `model`。
- 如果外部仍传入 `model` 作为初始 tab，则自动回退到 `general`。
- 保留模型配置的底层逻辑与渲染代码，避免影响已有数据结构和后续恢复能力。

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
- `node -e "for (const f of ['public/skill_store_test.json','public/skill_store_prod.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('skill store json ok')"`（在 `D:/SRMTJ/LZClaw/LZService`）
- `node -e "for (const f of ['public/agent_templates_test.json','public/agent_templates_prod.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('agent template json ok')"`（在 `D:/SRMTJ/LZClaw/LZService`）
- `go test ./tests/feature -run TestAuthTestSuite -count=1`（在 `D:/SRMTJ/LZClaw/LZService`）
- `go test ./app/http/controllers -run TestLoadSkillStoreConfigFromEnvPath -count=1`（在 `D:/SRMTJ/LZClaw/LZService`）
- `go test ./tests/feature -run TestSkillStoreTestSuite -count=1`（在 `D:/SRMTJ/LZClaw/LZService`）
- `go test ./app/http/controllers -run TestLoadAgentTemplateConfigFromEnvPath -count=1`（在 `D:/SRMTJ/LZClaw/LZService`）
- `go test ./tests/feature -run TestAgentTemplateTestSuite -count=1`（在 `D:/SRMTJ/LZClaw/LZService`）
- `npx eslint src/main/main.ts src/main/skillManager.ts`
- `npx eslint src/shared/lzServiceConfig.ts src/shared/lzServiceConfig.test.ts src/main/libs/endpoints.ts src/renderer/services/endpoints.ts src/main/presetAgents.ts src/main/agentManager.ts src/main/main.ts`
- `npx vitest run src/shared/lzServiceConfig.test.ts`
- `npx tsc --noEmit`
- `npx tsc --project electron-tsconfig.json --noEmit`

完整 `npm run test` 和 `npm run compile:electron` 曾因 Windows 下 `better_sqlite3.node` 被占用导致原生模块 rebuild 失败；这是本地文件锁问题，不是上述定制代码的类型或语法错误。

## LZService 默认地址（开发/生产）

按环境调整了 LZService 默认地址策略：

- 本地开发默认：`http://127.0.0.1:5000`
- 生产模式默认：`http://120.53.3.76:7001`

实现方式：

- 在 `src/shared/lzServiceConfig.ts` 新增 `getLzServiceDefaultBaseUrl(...)`；
- 主进程按 `app.isPackaged` / `NODE_ENV` 选择默认地址；
- 渲染进程按 `NODE_ENV` 选择默认地址；
- 若显式设置 `LZ_SERVICE_BASE_URL`，仍优先使用环境变量覆盖默认值。

## 登录 URL 调试日志

为便于排查登录跳转地址问题，在 LZClaw 主进程登录流程增加了关键日志：

- 打印 `auth:login` 实际请求的 login-url 接口地址；
- 打印 LZService 返回的登录 URL（`data.value`）；
- 打印追加 `source=electron` 后最终调用 `openExternal` 的 URL；
- 若渲染层显式传入 `loginUrl`，也会单独打印“使用渲染层传入 URL”。

## 隐藏服务协议弹窗

已隐藏应用启动时的服务协议弹窗（`PrivacyDialog`）：

- 启动初始化阶段会自动写入 `privacy_agreed=true`；
- 不再渲染服务协议弹窗组件；
- 保持原有欢迎页和后续流程可用，不再因协议弹窗阻塞。

## 登录后默认模型切换到套餐模型

登录成功后，默认模型会从本地自定义模型切换为套餐模型（服务端模型）：

- 在 `auth:exchange` 成功后，拉取 `/api/models/available`；
- 将服务端模型写入模型列表后，强制把默认模型切换到第一个套餐模型；
- 仅在登录成功当次强制切换，不影响后续用户手动切换模型。

## 模型/Provider 配置不足时不再弹设置页

已调整 cowork 页面行为：当模型或 Provider 配置不足时，不再自动弹出“设置-模型”页面，也不再 toast 提示。

- 初始化检查 `checkApiConfig` 失败时：静默处理（仅记录日志）；
- 发起会话前检查 `checkApiConfig` 失败时：静默拦截并阻止本次发送（仅记录日志）；
- 不再触发设置页弹窗，也不再显示配置不足 toast。

## CSM 销售技能内置（32 子技能）

已将 `agent-and-skill/csm-claw-skill/scripts` 现有 32 个脚本按“每脚本一个技能”方式内置到 `LZClaw/SKILLs`，技能 ID 统一使用 `csm-` 前缀。

本次定制包含：

- 新增统一技能清单：`/agent-and-skill/csm-skill-manifest.json`（作为 LZClaw/LZService 对齐来源）；
- 在 `LZClaw/SKILLs` 新增 32 个 `csm-*` 技能目录（含 `SKILL.md` 与对应脚本入口）；
- 对 JS 技能补充 `package.json`（`docx` + `xlsx` 依赖），保障安装版环境可运行；
- 在 `LZClaw/SKILLs/skills.config.json` 中将 32 个 `csm-*` 技能加入 `defaults` 且默认启用；
- 保持现有技能打包与首次同步链路不变（新增技能自动随安装包下发）。

## CSM 预制技能中文展示名

已将 8 个合并后的 CSM 预制技能展示名改为中文，便于在技能列表中直接识别业务含义：

- `csm-sales-insight` → `销售洞察分析`
- `csm-doc-export` → `报告导出与文档生成`
- `csm-self-expanded` → `客户扩展分析`
- `csm-health-risk` → `健康与风险识别`
- `csm-renew-opportunity` → `续费与商机分析`
- `csm-task-flow` → `任务流编排`
- `csm-data-audit` → `数据审计`
- `csm-weekly-pipeline` → `周度经营与漏斗分析`

实现说明：

- 调整 `SKILL.md` 的 `name`（展示字段）和文档标题；
- 同步将 8 个 CSM 技能目录名与 `skillId` 去掉 `-py/-js` 后缀，并更新配置与接口对齐引用。

## CSM 技能 ID 去后缀（2026-05-14）

为统一命名，8 个 CSM 技能 ID 已从 `*-py/*-js` 形式调整为无运行时后缀：

- `csm-sales-insight-js` → `csm-sales-insight`
- `csm-doc-export-js` → `csm-doc-export`
- `csm-self-expanded-py` → `csm-self-expanded`
- `csm-health-risk-py` → `csm-health-risk`
- `csm-renew-opportunity-py` → `csm-renew-opportunity`
- `csm-task-flow-py` → `csm-task-flow`
- `csm-data-audit-py` → `csm-data-audit`
- `csm-weekly-pipeline-py` → `csm-weekly-pipeline`

同步范围：

- `LZClaw/SKILLs` 目录名、`skills.config.json`、`SKILL.md` 内路径与脚本日志标识；
- `agent-and-skill/csm-skill-manifest.json`；
- `LZService/public/skills/csm/manifest.json` 与静态 zip 文件名；
- `LZService` 自动同步清理旧 32 ID 时，额外清理上述 8 个旧后缀 ID。

## CSM 技能展示名增加 LZClaw 前缀（2026-05-14）

8 个 CSM 合并技能的 `SKILL.md` 前置展示名已统一增加 `LZClaw-` 前缀：

- `LZClaw-销售洞察分析`
- `LZClaw-报告导出与文档生成`
- `LZClaw-客户扩展分析`
- `LZClaw-健康与风险识别`
- `LZClaw-续费与商机分析`
- `LZClaw-任务流编排`
- `LZClaw-数据审计`
- `LZClaw-周度经营与漏斗分析`

实现范围：

- 仅调整 `LZClaw/SKILLs/csm-*/SKILL.md` 的 frontmatter `name` 字段；
- `skillId`、目录名、接口返回 ID、脚本入口均保持不变。

补充（LZService 接口侧）：

- `LZService` CSM 同步逻辑已增加 `LZClaw-` 前缀兜底，确保 `skill-store` 接口返回的 CSM 技能名称同样带此前缀；
- `agent-and-skill/csm-skill-manifest.json` 与 `LZService/public/skills/csm/manifest.json` 的 `nameZh` 也同步为带前缀版本。

## 后续修改建议

新增 LZClaw 定制项时，优先按以下顺序放置：

1. 可配置的功能开关或白名单：放入 `src/shared/lzCustomizationConfig.ts`
2. LZService 接口路径和环境差异：放入 `src/shared/lzServiceConfig.ts`
3. 页面展示隐藏：尽量通过统一配置或现有可见性函数过滤
4. 业务流程适配：优先放在 service、endpoint、adapter 层，避免直接散落在组件 JSX 中

合并上游代码时，应重点检查上述相关文件是否被覆盖或冲突。
