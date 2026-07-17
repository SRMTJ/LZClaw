# AI 皮肤沉浸式表现层设计文档

## 1. 概述

### 1.1 背景

AI 皮肤包 MVP 已支持串行生成 `workspace.backdrop` 与 `home.emblem`、受管注册、应用、停用和本地皮肤重用。现有实现刻意保持用户颜色主题，因此生成背景与 Sidebar、快捷项、输入框之间可能缺少视觉协调。

本迭代在不改变 LobsterAI 首页和会话布局的前提下，引入一个受限、结构化的沉浸式表现层。表现层只为 Cowork、Sidebar、现有快捷项和输入框提供经过校验的语义颜色、背景焦点与克制的环境光点；不新增图片槽位，也不让模型控制 CSS 或布局。

### 1.2 目标

- 保持现有首页结构、组件位置、尺寸和顺序不变。
- Sidebar 不使用图片，通过皮肤面板色、强调色和选中态与背景协调。
- 首页和会话继续复用同一个稳定挂载的背景节点，并支持结构化裁切焦点。
- 现有快捷项、提示面板和输入框使用皮肤语义色，但不改变功能和布局。
- 用户保存的颜色主题不变；停用皮肤后立即恢复原主题表现。
- 旧皮肤没有 `presentation` 时完全保持 MVP 行为。

### 1.3 非目标

- 不新增 Hero、拍立得、Sidebar 背景图或快捷卡片图片。
- 不改变应用标题栏、会话标题栏或其高度、文案、布局和装饰。
- 不移动、增删或重排首页组件。
- 不替换系统、快捷项、权限、状态、Artifact、用户或 Agent 图标。
- 不接受任意 CSS、HTML、SVG、字体、动画脚本或绝对定位。
- 不增加图片生成次数；仍围绕两个必需资产串行完成。

## 2. 用户场景

### 场景 1：生成沉浸式皮肤

**Given** 用户通过“AI 皮肤设计师”描述一种视觉风格
**When** Skill 在生图前创建包含有效 `presentation` 的 draft
**Then** 应用完成后，背景、Sidebar、现有快捷项和输入框呈现一致配色，首页布局不变。

### 场景 2：恢复默认皮肤

**Given** 用户的保存主题为任意浅色或深色主题，当前应用了沉浸式 AI 皮肤
**When** 用户恢复默认皮肤
**Then** 表现层变量与图片同时停用，保存主题及其原始颜色完整恢复。

### 场景 3：应用旧皮肤

**Given** 本地存在 MVP 阶段生成、没有 `presentation` 的皮肤
**When** 用户重新应用该皮肤
**Then** Renderer 继续使用原背景和 emblem 行为，不启用沉浸式表面颜色或粒子。

## 3. 功能需求

### FR-1：结构化表现数据

`create_draft` 可选接受：

```text
presentation:
  mode: immersive_shell
  palette:
    canvas
    panel
    panelRaised
    accent
    accentForeground
    accentAlt
    foreground
    muted
    border
  art:
    focusX
    focusY
  effects:
    particleDensity
```

- 所有颜色只接受 `#RRGGBB`。
- `focusX`、`focusY` 必须位于 `0..1`。
- `particleDensity` 只接受 `none` 或 `sparse`。
- 对象只接受白名单字段。
- 主文字对 canvas、panel、panelRaised 的对比度至少为 4.5:1。
- 次要文字和强调色对上述表面的对比度至少为 3:1。
- `accentForeground` 对 accent 的对比度至少为 4.5:1。
- 非法表现数据必须在付费生图前拒绝。

### FR-2：作用范围

- 皮肤自定义变量只在主视图为 Cowork 时启用。
- Windows 独立标题栏、会话标题栏、设置页、技能、Kit、MCP 和定时任务页面不读取皮肤表现变量。
- Cowork 会话正文和工具结果继续使用现有主题语义色，避免扩大可读性风险。
- Sidebar、首页快捷项、展开的快捷提示面板和输入框局部覆盖所需语义 Token。

### FR-3：背景与焦点

- 背景继续使用 `workspace.backdrop`，不增加 Hero 容器。
- 首页使用较强背景表现，会话使用较低透明度和更强 canvas 遮罩。
- `focusX/focusY` 只控制宿主 `object-position`，不能控制尺寸、坐标或布局。
- 背景图仍在稳定 Cowork 容器复用，切换 Agent、会话和首页状态不得重新挂载同一图片。

### FR-4：Sidebar

- Sidebar 不读取或显示任何图片。
- Sidebar 使用 panel、panelRaised、canvas 构成宿主固定渐变。
- Hover 使用低透明 accent；`aria-current="page"` 和 `aria-selected="true"` 使用 accent 选中态。
- Sidebar 宽度、折叠、拖动、滚动、任务树和底部入口行为保持不变。

### FR-5：现有组件皮肤化

- 快捷项和快捷提示面板只改变语义色、边框、阴影和轻微透明材质。
- 输入框只改变既有面板、文字、边框、焦点色、按钮和状态胶囊的语义色。
- 不新增输入框徽章，不调整输入框 DOM 顺序和尺寸。
- `particleDensity=sparse` 时仅在空会话首页显示少量宿主光点；正常会话不显示。
- 光点不得拦截鼠标，并遵守 `prefers-reduced-motion`。

## 4. 实现方案

### 4.1 共享 Schema

`src/shared/skin/presentation.ts` 负责白名单解析、颜色规范化和对比度校验。主进程存储和 Renderer IPC 边界复用同一解析器，避免两套规则漂移。

`SkinRecord` 与 `PresentedSkin` 增加可选 `presentation`。注册表版本保持不变，因为字段可选且旧记录仍符合原 Schema；读取新字段时统一规范化，旧字段缺失时不产生迁移。

### 4.2 工具和 Skill

`lobsterai_skin_manage create_draft` 增加可选的结构化 `presentation` 参数。Skill 先建立风格与可访问配色，创建 draft 成功后才进入图片工具调用。背景 Prompt 必须复用相同配色和焦点，并继续禁止文字、UI、Logo 和伪控件。

该变化不修改普通 `lobsterai_image_generate` 与 `lobsterai_video_generate` 的参数、路由、调用次数或返回行为。

### 4.3 Renderer 表现层

`SkinPresentationScope` 位于 `SkinProvider` 内，仅设置 `--lobster-skin-*` 自定义变量和启用标记，不改全局主题变量。具体组件通过 `data-skin-*` 白名单标记选择性使用表现层：

- `data-skin-sidebar`
- `data-skin-cowork-frame`
- `data-skin-cowork`
- `data-skin-home-copy`
- `data-skin-quick-actions`
- `data-skin-prompt-panel`
- `data-skin-prompt-input`

样式集中维护在 `src/renderer/components/skin/skinPresentation.css`。大型现有组件只增加稳定插入点，不承载皮肤业务逻辑。

## 5. 边界情况

| 场景 | 处理方式 |
|------|---------|
| 模型给出低对比配色 | `create_draft` 拒绝，要求先修正元数据，不开始生图 |
| 模型附加 CSS 或未知字段 | 整个 presentation 拒绝 |
| 旧皮肤缺少 presentation | 继续使用现有图片皮肤表现 |
| 切换到非 Cowork 页面 | 停用沉浸式表现变量，其他页面使用保存主题 |
| Artifact 面板或会话标题栏显示 | 保持原主题和原布局 |
| 皮肤背景加载失败 | 背景层回退，结构化表面颜色仍可显示 |
| 用户启用减少动态效果 | 光点停止动画 |
| 用户停用皮肤 | 移除图片和表现变量，恢复保存主题 |

## 6. 涉及文件

- `SKILLs/skin-creator/`：表现配色与背景 Prompt 规则。
- `openclaw-extensions/lobster-media-generation/index.ts`：工具参数 Schema。
- `src/shared/skin/`：表现常量、类型和校验。
- `src/main/skins/`：表现数据持久化、工具解析和 IPC 输出。
- `src/main/libs/agentEngine/mediaGenerationTurnInstruction.ts`：结构化工作流约束。
- `src/renderer/components/skin/`：表现 Scope、背景和环境光点。
- `src/renderer/components/Sidebar.tsx`：Sidebar 稳定样式插入点。
- `src/renderer/components/cowork/`：Cowork、首页文案和输入框插入点。
- `src/renderer/components/quick-actions/`：现有快捷项插入点。
- `src/renderer/services/skin.ts`：IPC 表现数据归一化。

## 7. 验收标准

1. 新皮肤仍只需要两个串行生成资产，不增加 Hero、Sidebar 或卡片图片。
2. 首页、输入框、快捷项、Sidebar 的位置、尺寸、顺序和行为与改动前一致。
3. 标题栏和会话标题栏没有新增内容、装饰或布局变化。
4. 新生成皮肤可应用经过校验的统一 Cowork 配色；旧皮肤行为不变。
5. Sidebar 不显示图片，并与背景使用协调的 panel/canvas/accent 色。
6. 首页背景按结构化焦点裁切；正常会话降低背景强度且不显示粒子。
7. 切换 Agent 或会话时复用背景节点，不出现同主题重复加载。
8. 恢复默认皮肤后保存主题完整恢复，皮肤从未修改主题 ID。
9. 非 Cowork 页面、设置页和标题栏不读取沉浸式表现变量。
10. presentation 非法字段、非法颜色、低对比配色和越界焦点在生图前被拒绝。
