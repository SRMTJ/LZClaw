---
name: LZClaw-服务群衔接
description: >-
  客户付款或进入 S 阶段后，检查服务群、交付资料和上线动作。
official: true
version: 1.0.0
---

# LZClaw-服务群衔接技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-service-handoff/main.py" handoff
~~~

## Subcommands

- `handoff`
- `stage-check`
- `stage-confirm`

## Interfaces

- `POST /customers/{customer_id}/stage-transitions`
  - 用途：执行 AI 阶段推进校验。
  - 调用时机：当用户需要判断客户是否能推进到目标阶段时调用。
  - 参数来源：`customer_id` 来自客户；`target_stage` 来自用户请求或技能目标。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。
- `POST /customers/{customer_id}/stage-transitions/confirm`
  - 用途：确认客户阶段推进。
  - 调用时机：仅在阶段校验通过且用户明确确认推进后调用。
  - 参数来源：`customer_id` 和 `target_stage` 来自校验结果及用户确认。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。
- `GET /notifications`
  - 用途：读取通知列表，用于主管督办、服务衔接和经营风险提醒。
  - 调用时机：当技能需要查看待处理通知、阶段提醒或系统提醒时调用。
  - 参数来源：通知状态、类型、时间范围来自用户请求；缺省读取当前账号通知。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
