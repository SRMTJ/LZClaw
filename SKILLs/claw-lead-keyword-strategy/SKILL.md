---
name: LZClaw-地图关键词策略
description: >-
  根据行业、地区和客户画像生成高德/地图搜索关键词，并读取细分行业与城市字典辅助拓客。
official: true
version: 1.0.0
---

# LZClaw-地图关键词策略技能

## Usage

~~~bash
python "$SKILLS_ROOT/claw-lead-keyword-strategy/main.py" keywords
~~~

## Subcommands

- `keywords`
- `industry-dict`
- `search-plan`

## Interfaces

- `GET /dictionaries?dict_type=sub_industry`
  - 用途：读取细分行业字典，用于生成行业关键词、案例匹配和行业机会分析。
  - 调用时机：当技能需要按行业细分扩展关键词或判断行业方向时调用。
  - 参数来源：`dict_type` 固定为 `sub_industry`。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。
- `GET /dictionaries?dict_type=city_adcode`
  - 用途：读取城市和行政区划字典，用于生成地图搜索区域和区域机会分析。
  - 调用时机：当技能需要把城市、区域或商圈转换成搜索条件时调用。
  - 参数来源：`dict_type` 固定为 `city_adcode`。
  - 安全边界：只读接口，可直接用于分析，不修改 CRM 数据。

## CRM 运行约定

- 本技能打包后必须自包含运行，不查找外部示例 Agent、历史 Agent 或只存在于当前工作区的文件。
- 入口：`main.py` 根据子命令转发到 `scripts/` 下的业务脚本；业务脚本导入本技能目录内的 `scripts/crm_api.py`，并调用 `CrmApiClient.from_env()`。
- 鉴权：`crm_api.py` 读取 `CSM_CRM_BASE_URL`、`CSM_CRM_USERNAME` 或 `CSM_CRM_MOBILE`、`CSM_CRM_PASSWORD`、`CSM_CRM_PAGE_SIZE`，先调用 `POST /auth/login` 获取 `access_token`，再调用 CRM 业务接口。
- 接口范围：本技能只能使用 `## Interfaces` 中列出的接口；`{lead_id}`、`{customer_id}` 和 `{id}` 必须来自用户请求或 CRM 返回的真实 ID。
- 安全边界：`GET` 接口可用于读取和分析；`POST`、`PUT`、`DELETE` 接口必须在用户明确要求执行对应业务动作后才调用。
