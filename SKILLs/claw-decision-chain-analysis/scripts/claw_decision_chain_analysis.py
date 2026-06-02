#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import sys
from datetime import datetime
from typing import Any

from crm_api import CrmApiClient, CrmApiError

CONFIG = {
  "agent_name": "成交转化官·顾成 Agent",
  "skill_name": "LZClaw-决策链分析",
  "skill_dir": "claw-decision-chain-analysis",
  "default_mode": "decision-chain",
  "sources": [
    "customer_detail",
    "ai_records"
  ],
  "dict_types": [],
  "interfaces": [
    "GET /my-customers/{customer_id}",
    "GET /ai-call-records",
    "POST /customers/{customer_id}/follow-up-records"
  ],
  "interface_usage": [
    {
      "endpoint": "GET /my-customers/{customer_id}",
      "purpose": "读取指定客户详情，用于诊断需求、阶段、跟进记录、成交要素和风险。",
      "timing": "当用户指定客户，或前置客户列表返回候选客户后需要深入判断时调用。",
      "params": "`customer_id` 来自用户输入或 `GET /my-customers` 的返回结果。",
      "safety": "只读接口，可直接用于分析，不修改 CRM 数据。"
    },
    {
      "endpoint": "GET /ai-call-records",
      "purpose": "读取 AI 调用记录，用于查看历史诊断、话术、阶段校验或过程证据。",
      "timing": "当技能需要复盘 AI 输出、核对阶段证据或分析团队使用情况时调用。",
      "params": "客户、线索、时间范围等筛选条件来自用户请求或上下文。",
      "safety": "只读接口，可直接用于分析，不修改 CRM 数据。"
    },
    {
      "endpoint": "POST /customers/{customer_id}/follow-up-records",
      "purpose": "保存客户跟进记录。",
      "timing": "仅在用户明确要求保存客户跟进、付款推进或过程记录时调用。",
      "params": "`customer_id` 来自客户；记录内容来自用户确认。",
      "safety": "POST 写操作，会改变 CRM 状态或生成业务记录，必须在用户明确要求并确认对象后才调用；脚本默认 dry-run，需 `--execute` 才执行。"
    }
  ],
  "primary": "ai_records",
  "judgment": "没有决策人和流程证据，不建议推进到 A。",
  "next_action": "决策链清晰且付款条件明确后进入 B→A 推进。",
  "handoff": "LZClaw-B到A推进",
  "checks": [
    "决策人",
    "影响人",
    "审批流程",
    "风险角色"
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
