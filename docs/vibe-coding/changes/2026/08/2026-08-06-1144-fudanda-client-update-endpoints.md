# LZClaw 客户端更新接口与平台制品适配

- 作者：fudanda
- AI 协助：Codex 完成接口契约核对、实现、测试和文档同步
- 变更类型：桌面更新接口配置
- 项目状态：ready_for_review

## 原因

LZClaw 更新器需要接入 `grit-platform-admin` 的统一客户端更新发布能力，并在当前
设备没有对应安装包时停止使用旧有道下载页兜底。

## 变更

- 共享更新端点解析器集中维护应用代码 `claw`、开发/生产主机和路由，不再包含
  `test/prod` 通道段。
- 开发构建请求 `http://127.0.0.1:8080/api/client-updates/claw/*`。
- 生产构建请求 `https://zhongtai.srmtj.com/api/client-updates/claw/*`。
- 自动检查与手动检查分别使用 `/update` 和 `/update-manual`，主进程与 renderer
  复用同一个解析器。
- 环境选择依据构建环境，不受用户可修改的 testMode 设置影响。
- 服务端尚未发布版本时记录 `no-release`；新版本缺少当前平台安装包时记录
  `platform-unavailable`，不显示升级提示且不跳转旧下载页。手动检查提供准确提示，
  自动检查保持静默。
- 正式版继续只接受默认端口 HTTPS 的 Windows `.exe` 直链且禁止凭据、片段和跳转；
  仅未打包开发版允许 `127.0.0.1`、`localhost` 或 `::1` 的 HTTP 安装包。
- 所有平台下载都禁止 HTTP 重定向并要求有效 `Content-Length`；响应头或实际接收字节
  超过 1 GiB 时中止下载并清理临时文件。
- 当前平台清单必须包含发布端确认的 SHA-256；下载完成后摘要不一致时立即删除文件，
  不进入 Ready/安装状态。更新检查和下载日志统一移除 URL 查询参数，避免记录 UUID、
  用户 ID、归因参数或预签名凭据。
- 下载、摘要计算和缓存清理期间都使用同一 flow 标识防止自动/手动检查竞态；旧流程被
  新流程抢占后会删除自身下载文件，不能覆盖新流程的持久化记录或 Ready 状态。

## 验证

- 定向 Vitest：共享端点、URL 策略、更新协调器和更新提示组件 4 个文件共 44 项测试
  通过；下载 URL、全平台重定向和 1 GiB 双重上限门禁 8 项通过。
- 改动 TypeScript 文件 ESLint `--max-warnings 0`：通过。
- `npx tsc --project electron-tsconfig.json --noEmit`：通过。
- `npx tsc --project tsconfig.json --noEmit`：通过。
- `npm run compile:electron`：通过。
- `git diff --check`：通过。
- 本轮未启动 Electron、未执行真实安装，也未访问尚未部署的新生产接口；运行时验收
  需在中台迁移/API/管理端部署并发布至少一个安装包之后进行。

## 风险与回滚

- 已发布生产中台尚未包含客户端更新公共路由时，生产包检查更新会收到 HTTP 404。
- 当前 SHA-256 清单与下载地址来自同一 HTTPS 服务，尚未增加独立非对称签名；安装前
  也尚未固定校验 Authenticode 或 macOS 签名/公证发行者身份。它们是后续供应链加固项。
- 回滚 LZClaw 端时恢复旧端点和协调器行为；服务端迁移与已发布制品应保留，除非已
  确认没有需要保留的发布数据。
- 未执行 commit、push、PR、合并、部署或发布。

## Review

- Review：已完成独立安全/正确性评审；发现的外链制品替换风险和两个更新流程竞态窗口
  均已修复并补充回归测试，最终复核无剩余 P0/P1/P2 问题。
- Token 消耗：未记录（当前规则不使用 Codex goal 统计）
