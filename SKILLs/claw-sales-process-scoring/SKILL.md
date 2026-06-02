---
name: LZClaw-销售过程评分
description: >-
  按沟通质量、记录质量、阶段推进能力对销售过程评分。
official: true
version: 1.0.0
---

# LZClaw-销售过程评分技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-sales-process-scoring/main.py" score
~~~

## Subcommands

- `score`
- `process-review`
- `quality`

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
- `GET /dictionaries`
  - 用途：读取 CRM 字典项，用于解释阶段、行业、状态等枚举字段。
  - 调用时机：当技能需要把 CRM 枚举值转成业务含义，或需要行业/城市参考值时调用。
  - 参数来源：`dict_type` 来自技能需要；未指定时读取通用字典列表。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
