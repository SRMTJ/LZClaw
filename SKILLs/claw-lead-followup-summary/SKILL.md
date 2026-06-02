---
name: LZClaw-线索跟进总结
description: >-
  生成线索跟进总结草稿、保存跟进记录，并触发转客户校验链路。
official: true
version: 1.0.0
---

# LZClaw-线索跟进总结技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-lead-followup-summary/main.py" summary-draft
~~~

## Subcommands

- `summary-draft`
- `save-followup`
- `convert-check`

## Interfaces

- `POST /leads/{lead_id}/follow-up-summary-drafts`
  - 用途：生成线索跟进总结草稿。
  - 调用时机：当用户提供沟通内容并需要整理跟进总结时调用。
  - 参数来源：`lead_id` 来自线索；沟通内容来自用户输入或 CRM 跟进上下文。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。
- `POST /leads/{lead_id}/follow-ups`
  - 用途：保存线索跟进记录，并触发转客户校验链路。
  - 调用时机：仅在用户明确要求保存线索跟进记录时调用。
  - 参数来源：`lead_id` 来自线索；跟进内容、下次动作来自用户确认。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。
- `GET /async-tasks/{id}`
  - 用途：查询异步任务状态。
  - 调用时机：当写接口返回异步任务 ID，需要查看处理进度或结果时调用。
  - 参数来源：`id` 来自前置 POST 接口返回的任务 ID。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
