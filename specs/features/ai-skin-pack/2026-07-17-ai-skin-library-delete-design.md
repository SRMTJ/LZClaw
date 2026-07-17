# AI 皮肤库删除功能设计文档

## 1. 概述

### 1.1 问题与背景

AI 皮肤管理页面已经支持查看、应用、重新应用和恢复默认皮肤，但已生成皮肤只能持续保留在本地。随着用户反复生成，皮肤卡片和 `%APPDATA%/LobsterAI/skins` 中的托管副本会不断累积，用户缺少明确的清理入口。

### 1.2 目标

- 在外观设置的每张已生成皮肤卡片上提供删除入口。
- 删除前明确告知影响范围并要求用户确认。
- 允许删除当前正在使用的皮肤；删除后自动停用 AI 皮肤并恢复用户已保存的颜色主题。
- 删除皮肤注册记录和 LobsterAI 管理的资产副本。
- 不删除会话中的原始生成图片，不卸载 AI 皮肤设计师套件，也不改变生图工具行为。
- 删除能力仅暴露给可信设置页，不加入模型可调用的 `lobsterai_skin_manage`。

## 2. 用户场景

### 场景 1：删除未使用的皮肤

**Given** 用户的皮肤库中存在一套未激活皮肤  
**When** 用户点击删除并确认  
**Then** 皮肤从管理页面消失，当前皮肤和颜色主题保持不变，托管资产目录被清理。

### 场景 2：删除正在使用的皮肤

**Given** 用户正在使用目标 AI 皮肤  
**When** 用户确认删除  
**Then** 注册表在同一次串行变更中移除皮肤并清空 `activeSkinId`，Renderer 恢复已保存颜色主题，皮肤从管理页面消失。

### 场景 3：取消删除

**Given** 删除确认弹窗已经打开  
**When** 用户点击取消或关闭弹窗  
**Then** 注册记录、当前皮肤和本地资产均不发生变化。

## 3. 功能需求

### FR-1：卡片删除入口

- 每张 `ready` 皮肤卡片显示一个可访问的删除按钮。
- 删除按钮必须包含皮肤名称的 `aria-label`。
- 应用、恢复和删除进行期间，其他皮肤变更按钮禁用，防止并发操作。

### FR-2：删除确认

- 弹窗展示将删除的皮肤名称。
- 当前皮肤需要额外说明：删除后恢复已保存颜色主题。
- 弹窗说明只删除 LobsterAI 托管副本，不删除会话原始图片或 AI 皮肤设计师套件。
- 删除进行时不能重复提交或关闭弹窗。

### FR-3：Store 删除语义

- `SkinStore.deleteSkin(skinId)` 复用现有串行 mutation queue。
- 非法 ID 返回 `invalid_skin_id`，不存在的皮肤返回 `skin_not_found`。
- 删除当前皮肤时必须在写入注册表前把 `activeSkinId` 设为 `null`。
- 注册表原子写入成功后，递归清理 `<skinRoot>/<skinId>` 托管目录。
- 托管文件清理失败属于可恢复的磁盘残留：记录警告，但注册表删除结果仍为成功，避免 UI 与权威状态冲突。

### FR-4：可信 IPC 边界

- 新增 `skin:delete` IPC，只接受皮肤 ID。
- 删除成功后广播 `skin:changed`，所有窗口重新读取活动皮肤和皮肤库。
- preload、共享响应类型和 Renderer service 使用同一 IPC 常量。
- 不向 OpenClaw 皮肤管理工具增加删除 action。

## 4. 实现方案

### 4.1 主进程

`SkinStore` 在 mutation queue 内校验目标、更新注册表并清理受管目录。`registerSkinElectronIntegration` 暴露删除 IPC，并在 Store 成功后调用现有 `notifySkinChanged()`。

注册表是用户可见状态的权威来源。文件系统清理发生在原子注册表写入之后；这样即使 Windows 文件占用导致清理暂时失败，皮肤也不会继续显示成可用状态或留下失效的活动引用。

### 4.2 Renderer

`skinService` 与 `SkinProvider` 增加删除方法。设置页维护待确认皮肤和删除中的皮肤 ID；确认成功后复用 Provider 的刷新逻辑。

确认弹窗使用现有 `Modal`，并使用主题语义色、`alertdialog` 角色以及中英文 i18n 文案。

### 4.3 删除范围

删除范围只包括：

- `registry.json` 中的目标皮肤记录；
- `%APPDATA%/LobsterAI/skins/<skinId>` 下的托管副本。

以下内容明确保留：

- 生图工具返回并展示在会话中的原始文件；
- Cowork 会话和消息；
- AI 皮肤设计师 Kit 与 Skill；
- 订阅权益和自定义模型 Key；
- 用户颜色主题设置。

## 5. 边界情况

| 场景 | 处理方式 |
|------|---------|
| 删除当前皮肤 | 同一 Store mutation 中清空活动 ID 并删除记录 |
| 删除非当前皮肤 | 当前皮肤保持不变 |
| 连续点击删除 | 删除期间禁用所有皮肤变更按钮 |
| 目标已不存在 | 返回失败并保留当前 UI 状态 |
| 托管目录不存在 | `force` 清理视为成功 |
| 托管目录被占用 | 记录可恢复警告，注册表删除仍成功 |
| 会话仍展示原始图片 | 原始图片不属于皮肤托管目录，继续保留 |
| 中断生成留下 draft | 本次设置页仍只管理 `ready` 皮肤；草稿清理另行设计 |

## 6. 涉及文件

- `src/shared/skin/constants.ts`
- `src/shared/skin/types.ts`
- `src/main/skins/skinStore.ts`
- `src/main/skins/registerSkinElectron.ts`
- `src/main/preload.ts`
- `src/renderer/types/electron.d.ts`
- `src/renderer/services/skin.ts`
- `src/renderer/providers/SkinProvider.tsx`
- `src/renderer/components/skin/SkinSettingsSection.tsx`
- `src/renderer/components/skin/SkinDeleteConfirmDialog.tsx`
- `src/renderer/services/i18n.ts`

## 7. 验收标准

1. 未使用皮肤可以从设置页确认删除，当前皮肤不受影响。
2. 当前皮肤可以确认删除，删除后立即恢复已保存颜色主题。
3. 删除后皮肤卡片从列表消失，重启应用后不会恢复。
4. 托管皮肤目录被清理，会话原始生成图片保持存在。
5. 取消确认不会产生注册表或文件变更。
6. 删除过程中不能触发应用、恢复或第二次删除。
7. 非法或不存在的皮肤 ID 不会触发目录清理。
8. 删除操作不会出现在模型工具 Schema 中。
9. 中英文界面均无硬编码或缺失文案。
