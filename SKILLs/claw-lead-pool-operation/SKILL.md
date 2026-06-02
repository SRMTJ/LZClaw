---
name: LZClaw-线索公海操作
description: >-
  读取线索公海、线索公海详情、可分配用户，并在确认后执行公海线索认领、分配或手动创建。
official: true
version: 1.0.0
---

# LZClaw-线索公海操作技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-lead-pool-operation/main.py" pool-list
~~~

## Subcommands

- `pool-list`
- `pool-detail`
- `claim`
- `assign`
- `create-lead`

## Interfaces

- `GET /lead-pool`
  - 用途：读取线索公海列表，用于查看待认领、待分配或待筛选线索。
  - 调用时机：当用户需要处理线索公海、认领线索或分配线索时调用。
  - 参数来源：筛选条件来自用户请求；缺省使用默认分页。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /lead-pool/{lead_id}`
  - 用途：读取线索公海详情，用于确认公海线索是否值得认领或分配。
  - 调用时机：当用户指定公海线索或列表结果需要进一步核验时调用。
  - 参数来源：`lead_id` 来自用户输入或 `GET /lead-pool` 的返回结果。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /assignable-users`
  - 用途：读取可分配用户列表，用于线索/客户分配、转移或主管介入。
  - 调用时机：当技能需要选择负责人、协作人或分配对象时调用。
  - 参数来源：分页或角色筛选来自用户请求；缺省使用默认分页。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `POST /lead-pool`
  - 用途：手动创建公海线索，用于把用户提供的线索写入 CRM 公海。
  - 调用时机：仅在用户明确要求创建公海线索，并提供必要字段后调用。
  - 参数来源：线索名称、行业、地区、联系方式等来自用户输入或已确认的搜索结果。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。
- `POST /lead-pool/{lead_id}/claim`
  - 用途：认领公海线索，将线索归入当前账号可跟进范围。
  - 调用时机：仅在用户明确要求认领指定公海线索时调用。
  - 参数来源：`lead_id` 来自用户输入或 `GET /lead-pool` 的返回结果。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。
- `POST /lead-pool/{lead_id}/assign`
  - 用途：分配公海线索给指定销售或用户。
  - 调用时机：仅在用户明确要求分配线索，并确认接收人后调用。
  - 参数来源：`lead_id` 来自公海线索；`target_user_id` 来自 `GET /assignable-users`。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
