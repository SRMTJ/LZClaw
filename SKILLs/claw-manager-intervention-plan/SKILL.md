---
name: LZClaw-主管介入与辅导
description: >-
  判断主管何时介入、如何介入、对销售如何辅导，并可创建跟进计划。
official: true
version: 1.0.0
---

# LZClaw-主管介入与辅导技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-manager-intervention-plan/main.py" intervention
~~~

## Subcommands

- `intervention`
- `coaching`
- `create-plan`

## Interfaces

- `GET /my-customers/{customer_id}`
  - 用途：读取指定客户详情，用于诊断需求、阶段、跟进记录、成交要素和风险。
  - 调用时机：当用户指定客户，或前置客户列表返回候选客户后需要深入判断时调用。
  - 参数来源：`customer_id` 来自用户输入或 `GET /my-customers` 的返回结果。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /users`
  - 用途：读取用户列表，用于团队分析、主管辅导、销售归因和组织视角复盘。
  - 调用时机：当技能需要按销售人员或团队成员聚合数据时调用。
  - 参数来源：用户筛选条件来自用户请求；缺省使用默认分页。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /assignable-users`
  - 用途：读取可分配用户列表，用于线索/客户分配、转移或主管介入。
  - 调用时机：当技能需要选择负责人、协作人或分配对象时调用。
  - 参数来源：分页或角色筛选来自用户请求；缺省使用默认分页。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `POST /customers/{customer_id}/follow-up-plans`
  - 用途：创建客户跟进计划。
  - 调用时机：仅在用户明确要求创建计划、倒排节点或主管督办计划时调用。
  - 参数来源：`customer_id` 来自客户；计划内容、时间和责任人来自用户确认。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
