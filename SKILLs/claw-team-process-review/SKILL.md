---
name: LZClaw-团队过程复盘
description: >-
  结合用户、可分配人员、AI 调用记录和客户数据输出团队过程复盘。
official: true
version: 1.0.0
---

# LZClaw-团队过程复盘技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-team-process-review/main.py" team-review
~~~

## Subcommands

- `team-review`
- `process`
- `users`

## Interfaces

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
- `GET /my-customers`
  - 用途：读取当前账号负责的客户列表，用于阶段、风险、预测、团队和经营分析。
  - 调用时机：当技能需要批量查看客户、统计客户阶段或选择重点客户时调用。
  - 参数来源：分页、阶段、关键词、负责人等筛选条件来自用户请求；缺省使用默认分页。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /ai-call-records`
  - 用途：读取 AI 调用记录，用于查看历史诊断、话术、阶段校验或过程证据。
  - 调用时机：当技能需要复盘 AI 输出、核对阶段证据或分析团队使用情况时调用。
  - 参数来源：客户、线索、时间范围等筛选条件来自用户请求或上下文。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
