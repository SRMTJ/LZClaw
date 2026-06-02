---
name: LZClaw-线索挖掘任务
description: >-
  发起高德线索挖掘、读取挖掘任务与结果，并在用户确认后将结果加入线索公海。
official: true
version: 1.0.0
---

# LZClaw-线索挖掘任务技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-source-search-run/main.py" create-search
~~~

## Subcommands

- `create-search`
- `search-runs`
- `search-results`
- `join-pool`

## Interfaces

- `POST /source-search-runs`
  - 用途：发起高德线索挖掘任务。
  - 调用时机：仅在用户确认城市、关键词和搜索目标后调用。
  - 参数来源：城市、关键词、行业、区域等来自用户输入和关键词策略结果。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。
- `GET /source-search-runs`
  - 用途：读取线索挖掘任务列表，用于查看任务状态和历史挖掘记录。
  - 调用时机：当用户询问挖掘任务进度或需要选择任务结果时调用。
  - 参数来源：分页、状态、时间范围来自用户请求；缺省使用默认分页。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /source-search-runs/{id}/results`
  - 用途：读取指定线索挖掘任务的结果列表。
  - 调用时机：当挖掘任务完成后需要筛选、去重或入池时调用。
  - 参数来源：`id` 来自用户输入或 `GET /source-search-runs` 的返回结果。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `POST /source-search-results/join-pool`
  - 用途：将挖掘结果加入线索公海。
  - 调用时机：仅在用户确认要入池哪些挖掘结果后调用。
  - 参数来源：结果 ID 列表来自 `GET /source-search-runs/{id}/results` 的返回结果。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
