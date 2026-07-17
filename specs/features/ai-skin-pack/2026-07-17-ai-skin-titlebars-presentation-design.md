# AI 皮肤标题栏适配设计文档

## 1. 概述

### 1.1 问题与背景

沉浸式 AI 皮肤已经使用结构化 `presentation` 配色适配 Cowork 画布、Sidebar、快捷操作和输入区，但 Windows 应用标题栏与 Cowork 会话标题栏仍使用用户保存的颜色主题。在深色或高饱和背景皮肤中，两条浅色横栏会切断整体视觉，显得与 Sidebar 和背景不协调。

### 1.2 目标

- 在不改变标题栏高度、内容、布局、拖拽和窗口控制行为的前提下适配两条标题栏。
- 复用现有 `presentation.palette`，不新增生图次数、图片槽位或模型字段。
- 只对启用了 `immersive_shell` 表现层的 Cowork 页面生效。
- 默认主题、纯颜色主题和没有 `presentation` 的旧 AI 皮肤保持原行为。

## 2. 用户场景

### 场景 1：应用沉浸式 AI 皮肤

**Given** 用户已应用一套带有合法 `immersive_shell` 表现配置的 AI 皮肤  
**When** 用户进入 Cowork 首页或会话  
**Then** Windows 应用标题栏和会话标题栏使用与 Sidebar 协调的面板渐变、文字和边框颜色，原有标题、按钮及布局不变。

### 场景 2：恢复默认皮肤

**Given** 两条标题栏正在使用 AI 皮肤表现色  
**When** 用户恢复默认皮肤或切换到没有表现配置的旧皮肤  
**Then** 表现层标记失效，两条标题栏恢复用户保存的颜色主题。

### 场景 3：进入非 Cowork 页面

**Given** 当前应用了沉浸式 AI 皮肤  
**When** 用户进入技能、Kit、MCP、定时任务或其他非 Cowork 页面  
**Then** `SkinPresentationScope` 停用，应用标题栏继续使用用户保存的颜色主题。

## 3. 功能需求

### FR-1：稳定样式插入点

- Windows 自绘应用标题栏增加 `data-skin-app-titlebar`。
- Cowork 会话标题栏增加 `data-skin-session-titlebar`。
- 标记只作为受控 CSS 白名单，不承载皮肤数据或业务逻辑。

### FR-2：复用现有语义色

- 两条标题栏复用 `panelRaised`、`panel` 与 `canvas` 形成和 Sidebar 一致的克制渐变。
- 标题和窗口操作按钮继续通过现有语义类读取 `foreground`、`muted` 和表面色。
- 底部分隔线使用皮肤 `border`。
- 不修改 Logo、标题文字、窗口按钮图标或会话标题内容。

### FR-3：作用域隔离

- 样式必须受 `[data-skin-presentation="immersive_shell"]` 限制。
- 标题栏节点加入现有皮肤语义变量白名单，使其内部 Tailwind 语义类读取皮肤变量。
- 不添加 `.dark`，不修改根主题 ID，不覆盖全局主题变量。

## 4. 实现方案

`WindowsAppTitleBar` 和 `CoworkSessionDetail` 只增加 data attribute。集中样式继续维护在 `src/renderer/components/skin/skinPresentation.css`：

1. 将两条标题栏加入现有语义变量作用域。
2. 用与 Sidebar 相同的面板渐变覆盖原 `bg-surface-raised` 或 `bg-background`。
3. 覆盖底边框颜色，内部按钮继续使用现有 hover 和文字语义类。

该方案不修改主进程、preload、皮肤存储、工具 Schema、Skill 提示词或生成资产。

## 5. 边界情况

| 场景 | 处理方式 |
|------|---------|
| macOS 或 Linux 没有 Windows 自绘标题栏 | 不渲染 `WindowsAppTitleBar`；仅适配 Cowork 会话标题栏 |
| Artifact 面板展开 | 会话标题栏仍是同一个容器，宽度和交互逻辑不变 |
| Sidebar 折叠 | 两条标题栏颜色不变，折叠按钮继续使用皮肤语义色 |
| 窗口失焦 | 现有窗口按钮透明度规则继续生效 |
| 旧皮肤缺少 `presentation` | 不存在表现层标记，保持原主题 |
| 切换到非 Cowork 页面 | 表现层停用，应用标题栏恢复原主题 |

## 6. 涉及文件

- `src/renderer/components/window/WindowsAppTitleBar.tsx`
- `src/renderer/components/cowork/CoworkSessionDetail.tsx`
- `src/renderer/components/skin/skinPresentation.css`

## 7. 验收标准

1. 沉浸式 AI 皮肤启用时，两条标题栏与 Sidebar 使用协调的面板、文字和边框颜色。
2. 标题栏高度、布局、拖拽区、窗口按钮、Sidebar 切换和 Artifact 操作均保持不变。
3. 不增加图片、生成调用、皮肤字段或运行时数据。
4. 恢复默认皮肤后，两条标题栏立即恢复用户保存的颜色主题。
5. 默认主题、纯颜色主题、非 Cowork 页面和旧 AI 皮肤不受影响。
