# LZClaw 优化业务中心组织架构页面

任务：优化业务中心组织架构页面
作者：fudanda <314553951@qq.com>
时间：2026-07-08 14:48 Asia/Shanghai
线程：019f269d-39ae-7233-9ffa-929aeb54bfa8
AI 协助：Codex 参与 diff 审查、边界拆分、健壮性修补、验证和提交准备。
Token 消耗：未记录（当前规则不使用 Codex goal 统计）
Review：Codex/code-reviewer 第一轮发现 2 个阻塞问题，已修复；聚焦复审结论为阻塞问题：无。

## 为什么改

组织架构页需要从基础列表升级为更接近后台管理的页面，让企业工作站用户能在业务中心里查看组织统计、搜索组织树、查看选中部门详情、预览下级部门和部门成员，并在组织架构页刷新时同步拉取部门与员工数据。

## 改了什么

- 新增业务中心页面 `BusinessCenterView`，包含概览、组织架构和员工管理视图。
- 新增业务中心 renderer service，并通过 preload 暴露部门与员工 IPC。
- 主进程接入 AIZhongtai 工作站组织与员工接口，沿用工作站 Bearer token 和刷新逻辑。
- 侧边栏新增业务中心入口，App 增加业务中心主视图路由。
- 补充业务中心导航文案的中英文 i18n。
- Review 期间修补组织树深度计算、部门/员工缺省字段访问、成员数展示、占位 Token 数值、非管理员访问门禁、员工分页和部门成员预览来源。

## 拆分边界

纳入本次提交：

- `src/renderer/components/businessCenter/BusinessCenterView.tsx`
- `src/renderer/services/businessCenter.ts`
- `src/main/main.ts`
- `src/main/preload.ts`
- `src/renderer/types/electron.d.ts`
- `src/renderer/App.tsx` 中业务中心相关 hunk
- `src/renderer/components/Sidebar.tsx`
- `src/renderer/services/i18n.ts`
- 本 change fragment

排除本次提交：

- `src/renderer/components/window/WindowTitleBar.tsx`，属于窗口按钮/hover 中文与视觉动效，不是组织架构页面优化的必要改动。
- `src/renderer/App.tsx` 中登录页沉浸式标题栏与 scheduled task 初始化超时调整，属于其他任务遗留改动。

## 验证

- `py -3 scripts\vibe-doctor.py --json`（在 `D:\AI-AI\vibe-coding`）：通过。
- `git diff --check`：通过。
- `npx tsc --noEmit`：通过。
- `npx eslint src/renderer/components/businessCenter/BusinessCenterView.tsx`：通过。
- `npx eslint --ext ts,tsx --report-unused-disable-directives --max-warnings 0 src/main/main.ts src/main/preload.ts src/renderer/App.tsx src/renderer/components/Sidebar.tsx src/renderer/services/i18n.ts src/renderer/types/electron.d.ts src/renderer/components/businessCenter/BusinessCenterView.tsx src/renderer/services/businessCenter.ts`：通过。
- `npm run build`：通过；仍有既有 Vite CJS Node API deprecated、`lottie-web` eval 警告。

## 风险和未验证

- 未启动 Electron 做人工视觉走查，移动端/窄宽度布局依赖 Tailwind 响应式和构建检查。
- 组织架构页的部门成员预览改为按选中部门分页拉取；部门总人数以后端 `employeeCount` 或员工接口 `total` 为准。
- 概览页仍包含部分后续功能占位数据，当前提交重点是组织架构页。
- 本地提交不包含 push、PR 创建、合并或发布。
