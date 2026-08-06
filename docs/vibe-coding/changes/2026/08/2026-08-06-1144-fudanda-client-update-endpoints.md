# LZClaw 版本更新接口环境切换

- 作者：fudanda
- AI 协助：Codex 完成接口契约核对、实现、测试和文档同步
- 变更类型：桌面更新接口配置
- 项目状态：ready_for_review；按用户当前要求暂时跳过独立 Review

## 原因

LZClaw 更新器仍请求上游有道接口，无法读取本地 `grit-platform-admin` 创建的测试
版本，也无法在生产包中使用海豚买买中台域名。

## 变更

- 新增共享更新端点解析器，集中维护应用代码 `lzclaw`、环境、通道和路由。
- 开发构建固定请求 `http://127.0.0.1:8080` 的 `test` 通道。
- 生产构建固定请求 `https://zhongtai.srmtj.com` 的 `prod` 通道。
- 自动检查与手动检查分别使用 `/update` 和 `/update-manual`，主进程与 renderer
  复用同一个解析器。
- 环境选择依据构建环境，不受用户可修改的 testMode 设置影响。

## 验证

- 定向 Vitest：3 个文件、25 项测试通过，覆盖共享端点、更新协调器和 renderer
  端点既有行为。
- 改动 TypeScript 文件 ESLint `--max-warnings 0`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npx tsc --project tsconfig.json --noEmit`：通过。
- `npm run compile:electron`：通过；首次执行因运行中的 Electron 占用
  `better_sqlite3.node` 失败，定向停止并重启 LZClaw 后复验通过。
- `git diff --check`：通过。
- 源码模式重新启动成功：Vite 5175、Electron 和 OpenClaw gateway 均 ready；启动日志
  确认更新器实际请求本地 `lzclaw/test/update` 路由。
- 本地中台 API 启动到数据库连接成功后，被兼容门禁拒绝：当前 PostgreSQL 缺少
  `schema_migrations`。未擅自执行数据库迁移，因此真实响应验收仍待本地数据库初始化。
- 生产域名当前对应新路由返回 HTTP 404，需部署包含公共更新路由的中台 API 后验收。

## 风险与回滚

- 已发布生产中台尚未包含客户端更新公共路由时，生产包检查更新会收到 HTTP 404。
- 回滚只需恢复两个端点调用方并删除共享解析器，不影响下载、校验和安装状态。
- 未执行 commit、push、PR、合并、部署或发布。

## Review

- Review：未评审（用户明确要求继续修复时暂时跳过 Review）
- Token 消耗：未记录（当前规则不使用 Codex goal 统计）
