---
name: LZClaw-二次触达与异议应答
description: >-
  处理客户忙、不需要、发资料看看、未通过微信等早期异议，并生成二次触达策略。
official: true
version: 1.0.0
---

# LZClaw-二次触达与异议应答技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-second-touch-objection/main.py" second-touch
~~~

## Subcommands

- `second-touch`
- `early-objection`
- `retry-script`

## Interfaces

- `GET /my-leads/{lead_id}`
  - 用途：读取指定线索详情，用于查看行业、地区、联系方式、来源和历史跟进。
  - 调用时机：当用户指定线索，或前置列表返回候选线索后需要深入判断时调用。
  - 参数来源：`lead_id` 来自用户输入或 `GET /my-leads` 的返回结果。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /ai-call-records`
  - 用途：读取 AI 调用记录，用于查看历史诊断、话术、阶段校验或过程证据。
  - 调用时机：当技能需要复盘 AI 输出、核对阶段证据或分析团队使用情况时调用。
  - 参数来源：客户、线索、时间范围等筛选条件来自用户请求或上下文。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `POST /leads/{lead_id}/follow-ups`
  - 用途：保存线索跟进记录，并触发转客户校验链路。
  - 调用时机：仅在用户明确要求保存线索跟进记录时调用。
  - 参数来源：`lead_id` 来自线索；跟进内容、下次动作来自用户确认。
  - 安全边界：POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
