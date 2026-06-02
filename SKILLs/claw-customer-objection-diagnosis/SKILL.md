---
name: LZClaw-异议与卡点诊断
description: >-
  识别价格、时机、决策人、价值感、信任感等异议，并结构化拜访记录和补充问题。
official: true
version: 1.0.0
---

# LZClaw-异议与卡点诊断技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-customer-objection-diagnosis/main.py" objection
~~~

## Subcommands

- `objection`
- `blocker`
- `record-structure`

## Interfaces

- `GET /my-customers/{customer_id}`
  - 用途：读取指定客户详情，用于诊断需求、阶段、跟进记录、成交要素和风险。
  - 调用时机：当用户指定客户，或前置客户列表返回候选客户后需要深入判断时调用。
  - 参数来源：`customer_id` 来自用户输入或 `GET /my-customers` 的返回结果。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /ai-call-records`
  - 用途：读取 AI 调用记录，用于查看历史诊断、话术、阶段校验或过程证据。
  - 调用时机：当技能需要复盘 AI 输出、核对阶段证据或分析团队使用情况时调用。
  - 参数来源：客户、线索、时间范围等筛选条件来自用户请求或上下文。
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
