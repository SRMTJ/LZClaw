# AI 皮肤推荐深浅模式设计文档

## 1. 概述

### 1.1 问题与背景

沉浸式 AI 皮肤拥有结构化背景、面板、文字和强调色，但 LobsterAI 原有颜色主题仍决定 Artifact、Markdown、代码编辑器、弹窗及大量 `dark:` 分支。深色 AI 皮肤叠加浅色主题时，会出现白色 Artifact 卡片、深色正文与背景对比不足等问题。

逐个给这些组件增加 AI 皮肤专用规则会复制现有主题系统的职责，并持续扩大皮肤作用域。更稳妥的方案是让 AI 皮肤从结构化 palette 推导推荐的浅色或深色模式，在应用皮肤时复用现有 ThemeService 完成一次普通主题切换。

### 1.2 目标

- 从经过可访问性校验的 `presentation.palette` 确定性推导 `light` 或 `dark`。
- 推导由 LobsterAI 完成，模型不选择颜色主题 ID，也不能伪造与 palette 矛盾的结果。
- 当前主题深浅一致时保留用户所选的精确主题。
- 当前主题深浅不一致时，通过现有 ThemeService 选择并持久化兼容的经典浅色或经典深色主题。
- 每次皮肤激活只自动处理一次；之后用户手动切换主题优先。
- 停用或删除 AI 皮肤只移除皮肤，不自动恢复此前的颜色主题。
- 没有 `presentation` 的旧皮肤继续沿用当前主题。

## 2. 用户场景

### 场景 1：浅色主题应用深色皮肤

**Given** 用户当前使用浅色主题，目标 AI 皮肤的背景和面板为深色、正文为浅色  
**When** 用户应用该皮肤  
**Then** LobsterAI 推导 `preferredAppearance=dark`，通过现有主题系统切换为经典深色，再叠加 AI 皮肤表现层。

### 场景 2：深色主题应用深色皮肤

**Given** 用户当前已经使用任意深色主题  
**When** 用户应用推荐深色模式的 AI 皮肤  
**Then** 保留用户当前精确主题，不切换到其他深色主题。

### 场景 3：应用后手动选择主题

**Given** AI 皮肤已经完成一次推荐模式匹配  
**When** 用户在外观设置中手动选择任意颜色主题  
**Then** 用户选择立即生效，后续普通皮肤刷新和应用重启不会再次覆盖同一皮肤的选择。

### 场景 4：停用或删除皮肤

**Given** AI 皮肤曾自动切换颜色主题  
**When** 用户停用或删除该皮肤  
**Then** AI 背景和表现层被移除，当前颜色主题保持不变；用户可按需重新选择。

### 场景 5：旧皮肤缺少表现数据

**Given** 旧 AI 皮肤没有 `presentation`  
**When** 用户应用该皮肤  
**Then** 不执行深浅模式推导或主题切换，继续使用当前颜色主题。

## 3. 功能需求

### FR-1：确定性深浅模式推导

- 使用 `canvas`、`panel`、`panelRaised` 的平均相对亮度代表表面亮度。
- `foreground` 比表面亮时推导为 `dark`，反之推导为 `light`。
- `parseSkinPresentation` 输出规范化的 `preferredAppearance`。
- 输入携带的 `preferredAppearance` 如果与 palette 推导结果矛盾，整个 presentation 无效。
- 旧数据缺少该字段时读取阶段自动补全，不需要注册表版本迁移。

### FR-2：复用现有主题系统

- 不直接增删根节点 `.dark` 或 `.light`。
- 通过 ThemeService 和 ThemeManager 更新完整主题，使 `data-theme`、语义 Token、Tailwind dark 分支、编辑器主题和窗口颜色保持一致。
- 当前有效主题的 appearance 已匹配时不切换主题 ID。
- 不匹配时优先复用同 appearance 的已保存主题；没有匹配项时使用主题列表中的首个兼容主题，即经典浅色或经典深色。
- 自动切换同时持久化 `AppConfig.theme` 和主题 ID，避免重启后 mode 与 ID 不一致。

### FR-3：一次性应用与手动优先

- Renderer 记录 `<skinId>:<preferredAppearance>` 激活标记。
- 同一激活标记只调用一次主题匹配。
- 手动主题选择不会清除该标记，因此不会被后台刷新重新覆盖。
- 停用皮肤、删除当前皮肤或切换到没有 presentation 的旧皮肤时清除标记，使下一次重新应用皮肤可以再次自动匹配。
- 标记存储失败不阻塞皮肤应用或主题切换。

### FR-4：删除与停用语义

- 删除当前皮肤会清除 active skin 并移除托管资源，但保留当前颜色主题。
- 恢复默认皮肤只停用 AI 皮肤，不恢复之前的颜色主题。
- 设置页说明和删除确认文案必须明确该行为。

## 4. 实现方案

### 4.1 Shared

在 `src/shared/skin/constants.ts` 增加受控的 `SkinPreferredAppearance` 常量。在 `presentation.ts` 使用已有相对亮度计算推导 appearance，并由解析器规范化输出。

### 4.2 Renderer 主题联动

`ThemeService.applyThemeAppearance()` 负责：

1. 检查当前有效主题 appearance；
2. 解析兼容主题；
3. 更新 `AppConfig.theme`；
4. 通过现有 ThemeManager 应用并持久化完整主题。

`skinThemeAppearance.ts` 维护一次性激活标记并调用 ThemeService。`SkinProvider` 在有效 active skin 加载完成后触发同步，不把主题逻辑放入大型 UI 组件。

### 4.3 Skill 与工具说明

Skill 仍负责提供可访问的统一 palette，但不选择颜色主题 ID。工具说明明确 LobsterAI 会从 palette 推导深浅模式，`baseThemeId` 继续作为旧兼容元数据，不参与该决策。

## 5. 边界情况

| 场景 | 处理方式 |
|------|---------|
| palette 低对比或字段非法 | draft 阶段拒绝，不开始生图 |
| 调用者提交矛盾 appearance | presentation 拒绝 |
| 当前主题已匹配 | 保留精确主题 ID，只记录本次激活已处理 |
| 主题配置持久化失败 | 记录错误，不写激活标记，后续可重试 |
| 激活标记存储失败 | 保留已完成的主题切换，运行期可能再次做无害匹配 |
| 用户应用后手动切换主题 | 用户选择优先，同一激活不再次自动覆盖 |
| 应用另一套皮肤 | 新 skin ID 产生新标记并重新判断 |
| 停用后重新应用同一皮肤 | 停用清除标记，重新应用时再次判断 |
| 旧皮肤无 presentation | 不切换主题并清理旧标记 |

## 6. 涉及文件

- `src/shared/skin/constants.ts`
- `src/shared/skin/presentation.ts`
- `src/renderer/services/theme.ts`
- `src/renderer/services/skinThemeAppearance.ts`
- `src/renderer/providers/SkinProvider.tsx`
- `src/renderer/services/i18n.ts`
- `SKILLs/skin-creator/SKILL.md`
- `src/main/libs/agentEngine/mediaGenerationTurnInstruction.ts`
- `openclaw-extensions/lobster-media-generation/index.ts`

## 7. 验收标准

1. 红黑、深蓝等深色 palette 自动推导为 dark；明亮纸张、浅色水彩 palette 自动推导为 light。
2. 浅色主题应用深色 AI 皮肤后，Artifact、Markdown、编辑器和其他现有 dark 分支正常启用。
3. 当前主题深浅已匹配时，不改变用户选择的精确主题。
4. 同一 AI 皮肤应用后，用户手动切换颜色主题不会被刷新或重启重新覆盖。
5. 停用或删除 AI 皮肤后保留当前颜色主题。
6. 旧皮肤缺少 presentation 时不自动切换主题。
7. 模型不能选择主题 ID 或提交与 palette 矛盾的 appearance。
8. 默认主题和纯颜色主题用户在未应用 AI 皮肤时不受影响。
