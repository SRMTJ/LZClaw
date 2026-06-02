#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import sys
from datetime import datetime
from typing import Any

from crm_api import CrmApiClient, CrmApiError

CONFIG = {
  "agent_name": "灵犀探客 Agent",
  "skill_name": "LZClaw-L阶段评级与标签",
  "skill_dir": "claw-lead-rating-tagging",
  "default_mode": "rate",
  "sources": [
    "leads",
    "lead_detail",
    "dictionaries"
  ],
  "dict_types": [
    "lead_status",
    "sub_industry"
  ],
  "interfaces": [
    "GET /my-leads",
    "GET /my-leads/{lead_id}",
    "GET /dictionaries",
    "POST /leads/{lead_id}/enrichment"
  ],
  "interface_usage": [
    {
      "endpoint": "GET /my-leads",
      "purpose": "读取当前账号负责的线索列表，用于筛选、转化、建联和漏斗分析。",
      "timing": "当技能需要批量查看线索池、统计线索或选择待处理线索时调用。",
      "params": "分页、阶段、关键词等筛选条件来自用户请求；缺省使用默认分页。",
      "safety": "只读接口，可直接用于分析，不修改 CRM 数据。"
    },
    {
      "endpoint": "GET /my-leads/{lead_id}",
      "purpose": "读取指定线索详情，用于查看行业、地区、联系方式、来源和历史跟进。",
      "timing": "当用户指定线索，或前置列表返回候选线索后需要深入判断时调用。",
      "params": "`lead_id` 来自用户输入或 `GET /my-leads` 的返回结果。",
      "safety": "只读接口，可直接用于分析，不修改 CRM 数据。"
    },
    {
      "endpoint": "GET /dictionaries",
      "purpose": "读取 CRM 字典项，用于解释阶段、行业、状态等枚举字段。",
      "timing": "当技能需要把 CRM 枚举值转成业务含义，或需要行业/城市参考值时调用。",
      "params": "`dict_type` 来自技能需要；未指定时读取通用字典列表。",
      "safety": "只读接口，可直接用于分析，不修改 CRM 数据。"
    },
    {
      "endpoint": "POST /leads/{lead_id}/enrichment",
      "purpose": "补充或刷新线索画像信息。",
      "timing": "仅在用户要求补充线索画像或信息不足需要补全时调用。",
      "params": "`lead_id` 来自用户输入或 `GET /my-leads` 的返回结果。",
      "safety": "POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。"
    }
  ],
  "primary": "leads",
  "judgment": "评级必须有字段依据，不能只凭行业名称。",
  "next_action": "高优先级线索交给破冰建联，信息不足线索先补充画像。",
  "handoff": "破冰建联官·许开 Agent",
  "checks": [
    "行业匹配度",
    "联系方式完整度",
    "门店规模信号",
    "补充画像必要性"
  ]
}


def safe_text(value: Any, default: str = "") -> str:
    return str(value or default).strip()


def first_text(item: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = safe_text(item.get(key))
        if value:
            return value
    return ""


def flatten_detail(raw: dict[str, Any], base_key: str) -> dict[str, Any]:
    if base_key not in raw:
        return dict(raw)
    merged = dict(raw.get(base_key) or {})
    for key, value in raw.items():
        if key != base_key:
            merged[key] = value
    return merged


def numeric_arg(args: list[str]) -> str:
    return next((arg for arg in args if arg.isdigit()), "")


def option_value(args: list[str], name: str, default: str = "") -> str:
    if name not in args:
        return default
    index = args.index(name)
    if index + 1 >= len(args):
        return default
    return args[index + 1]


def load_sources(client: CrmApiClient, args: list[str]) -> dict[str, Any]:
    data: dict[str, Any] = {}
    detail_id = numeric_arg(args)
    for source in CONFIG["sources"]:
        if source == "leads":
            data["leads"] = client.get_my_leads()
        elif source == "lead_detail" and detail_id:
            data["lead_detail"] = flatten_detail(client.get_lead_detail(detail_id), "lead")
        elif source == "lead_pool":
            data["lead_pool"] = client.list_lead_pool()
        elif source == "lead_pool_detail" and detail_id:
            data["lead_pool_detail"] = client.get_lead_pool_detail(detail_id)
        elif source == "customers":
            data["customers"] = client.get_my_customers()
        elif source == "customer_detail" and detail_id:
            data["customer_detail"] = flatten_detail(client.get_customer_detail(detail_id), "customer")
        elif source == "customer_pool":
            data["customer_pool"] = client.list_customer_pool()
        elif source == "customer_pool_detail" and detail_id:
            data["customer_pool_detail"] = client.get_customer_pool_detail(detail_id)
        elif source == "dictionaries":
            data["dictionaries"] = {name: client.get_dictionaries(name) for name in CONFIG.get("dict_types", [])} if CONFIG.get("dict_types") else {"all": client.get_dictionaries()}
        elif source == "users":
            data["users"] = client.list_users()
        elif source == "assignable_users":
            data["assignable_users"] = client.list_assignable_users()
        elif source == "notifications":
            data["notifications"] = client.get_notifications()
        elif source == "ai_records":
            data["ai_records"] = client.get_ai_call_records()
        elif source == "search_runs":
            data["search_runs"] = client.list_source_search_runs()
        elif source == "search_results" and detail_id:
            data["search_results"] = client.list_source_search_results(detail_id)
    return data


def flatten_items(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item if isinstance(item, dict) else {"value": item} for item in value]
    if isinstance(value, dict):
        if isinstance(value.get("list"), list):
            return flatten_items(value["list"])
        items: list[dict[str, Any]] = []
        for key, nested in value.items():
            for item in flatten_items(nested):
                item = dict(item)
                item.setdefault("source", key)
                items.append(item)
        if items:
            return items
        return [value]
    return []


def primary_items(data: dict[str, Any]) -> list[dict[str, Any]]:
    primary = CONFIG.get("primary", "customers")
    if primary in data:
        return flatten_items(data[primary])
    for fallback in ("customers", "leads", "ai_records", "users", "notifications", "dictionaries"):
        if fallback in data:
            return flatten_items(data[fallback])
    return []


def build_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for item in primary_items(data)[:30]:
        name = first_text(item, ("poi_name", "company_name", "customer_name", "lead_name", "name", "title")) or "未知对象"
        stage = first_text(item, ("stage", "customer_stage", "status", "lead_status")) or "未知"
        owner = first_text(item, ("owner_name", "user_name", "sales_name", "assigned_user_name")) or "未返回"
        summary = first_text(item, ("summary", "remark", "description", "business_pain_points", "content")) or "接口未返回摘要字段"
        rows.append(
            {
                "name": name,
                "stageOrStatus": stage,
                "owner": owner,
                "summary": summary,
                "judgment": CONFIG["judgment"],
                "nextAction": CONFIG["next_action"],
                "handoff": CONFIG["handoff"],
            }
        )
    return rows


def post_body_for(path: str, args: list[str]) -> dict[str, Any]:
    content = option_value(args, "--content", f"{CONFIG['skill_name']} generated action")
    target_stage = option_value(args, "--target-stage", "A" if "stage-to-a" in CONFIG["skill_dir"] else "C")
    target_user_id = option_value(args, "--target-user-id", "")
    reason = option_value(args, "--reason", CONFIG["skill_name"])
    if "stage-transitions" in path:
        return {"target_stage": target_stage}
    if "follow-up-plans" in path:
        return {"title": CONFIG["skill_name"], "content": content, "next_action": CONFIG["next_action"]}
    if "follow-up-records" in path or "follow-ups" in path:
        return {"content": content, "next_action": CONFIG["next_action"]}
    if "follow-up-summary-drafts" in path or "previsit-summary-drafts" in path:
        return {"content": content}
    if "transfer-records" in path or path.endswith("/assign"):
        if not target_user_id:
            return {"missing": "target_user_id"}
        return {"target_user_id": int(target_user_id), "reason": reason}
    if path == "/source-search-runs":
        return {"keyword": option_value(args, "--keyword", ""), "city": option_value(args, "--city", "")}
    if path == "/source-search-results/join-pool":
        ids = [int(arg) for arg in args if arg.isdigit()]
        return {"result_ids": ids}
    if path == "/lead-pool":
        return {"company_name": option_value(args, "--name", ""), "source": CONFIG["skill_name"], "remark": content}
    return {}


def maybe_execute_write(client: CrmApiClient, args: list[str]) -> dict[str, Any] | None:
    endpoint = option_value(args, "--endpoint", "")
    if not endpoint:
        return None
    if endpoint not in CONFIG["interfaces"]:
        return {"dryRun": True, "reason": "endpoint_not_allowed_for_skill", "endpoint": endpoint}
    method, path_template = endpoint.split(" ", 1)
    if method == "GET":
        return {"dryRun": True, "reason": "read_endpoint_no_write_needed", "endpoint": endpoint}
    entity_id = numeric_arg(args)
    path = path_template
    if "{lead_id}" in path or "{customer_id}" in path or "{id}" in path:
        if not entity_id:
            return {"dryRun": True, "reason": "missing_numeric_id", "endpoint": endpoint}
        path = path.replace("{lead_id}", entity_id).replace("{customer_id}", entity_id).replace("{id}", entity_id)
    body = post_body_for(path, args)
    if body.get("missing"):
        return {"dryRun": True, "reason": f"missing_{body['missing']}", "endpoint": endpoint}
    if "--execute" not in args:
        return {"dryRun": True, "reason": "write_requires_--execute", "endpoint": endpoint, "path": path, "body": body}
    if method == "POST":
        return client.post(path, body=body)
    if method == "PUT":
        return client.put(path, body=body)
    if method == "DELETE":
        return client.delete(path)
    return {"dryRun": True, "reason": "unsupported_method", "endpoint": endpoint}


def build_report(mode: str, data: dict[str, Any], action_result: dict[str, Any] | None) -> dict[str, Any]:
    rows = build_rows(data)
    return {
        "agent": CONFIG["agent_name"],
        "skill": CONFIG["skill_name"],
        "mode": mode,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "interfaces": CONFIG["interfaces"],
        "interfaceUsage": CONFIG["interface_usage"],
        "summary": {
            "loadedSources": sorted(data.keys()),
            "rows": len(rows),
            "judgment": CONFIG["judgment"],
            "nextAction": CONFIG["next_action"],
            "handoff": CONFIG["handoff"],
        },
        "coreChecks": CONFIG["checks"],
        "rows": rows,
        "actionResult": action_result,
    }


def print_report(report: dict[str, Any]) -> None:
    print(f"\n========== {CONFIG['skill_name']} ==========")
    print("\n## 一、判断结论\n")
    print(report["summary"]["judgment"])
    print("\n## 二、接口使用边界\n")
    for item in report["interfaceUsage"]:
        print(f"- {item['endpoint']}：{item['purpose']} 调用时机：{item['timing']} 安全边界：{item['safety']}")
    print("\n## 三、关键检查项\n")
    for check in CONFIG["checks"]:
        print(f"- {check}")
    print("\n## 四、数据摘要\n")
    if report["rows"]:
        for index, row in enumerate(report["rows"], 1):
            print(f"{index}. {row['name']} | 阶段/状态：{row['stageOrStatus']} | 负责人：{row['owner']}")
            print(f"   摘要：{row['summary']}")
            print(f"   建议：{row['nextAction']}")
    else:
        print("- 当前接口未返回可展示列表；请补充 ID、筛选条件或检查账号权限。")
    print("\n## 五、动作结果\n")
    print(json.dumps(report["actionResult"], ensure_ascii=False, indent=2) if report["actionResult"] is not None else "- 未执行写操作。")


def run_mode(mode: str, args: list[str]) -> None:
    client = CrmApiClient.from_env()
    data = load_sources(client, args)
    action_result = maybe_execute_write(client, args)
    print(f"[{CONFIG['skill_dir']}] dataSource=crm_api scope=current_user mode={mode}")
    print_report(build_report(mode, data, action_result))


def main() -> int:
    mode = sys.argv[1].strip() if len(sys.argv) >= 2 else CONFIG["default_mode"]
    args = sys.argv[2:]
    try:
        run_mode(mode, args)
    except CrmApiError as error:
        print(f"[{CONFIG['skill_dir']}] CRM API 调用失败: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
