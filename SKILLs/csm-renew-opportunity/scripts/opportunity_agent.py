#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from crm_api import CrmApiClient, CrmApiError, split_tokens  # noqa: E402
from csm_metrics import (  # noqa: E402
    contains_risk_keywords,
    customer_name,
    customer_owner,
    infer_scene_count,
    is_final_stage,
    safe_text,
    stage_label,
)

OUTPUT_FILE = Path("opportunity_results.json")


def evaluate_opportunities(customer: dict) -> list[dict]:
    stage = stage_label(customer)
    tags = split_tokens(customer.get("customer_tags"))
    pain = safe_text(customer.get("business_pain_points"))
    store_count = customer.get("store_count")
    industry = safe_text(customer.get("sub_industry"))
    scene_count = infer_scene_count(customer)
    is_risk = any(contains_risk_keywords(tag) for tag in tags) or contains_risk_keywords(pain)

    opportunities: list[dict] = []

    if scene_count <= 1 and not is_risk:
        opportunities.append(
            {
                "type": "场景拓展机会",
                "priority": 90,
                "reason": "场景覆盖不足，优先补齐核心经营场景",
                "action": "推进会员/储值/分销中的至少1个场景上线",
            }
        )
    if "连锁" in industry or ("门店" in safe_text(store_count)):
        opportunities.append(
            {
                "type": "多门店协同机会",
                "priority": 80,
                "reason": "门店规模具备协同运营潜力",
                "action": "推进多门店统一会员、库存和活动策略",
            }
        )
    if "续费" in stage and not is_risk:
        opportunities.append(
            {
                "type": "续费增购机会",
                "priority": 95,
                "reason": "客户处于续费窗口且风险可控",
                "action": "结合续费方案打包推荐增购能力",
            }
        )
    if is_final_stage(stage):
        opportunities.append(
            {
                "type": "增购机会",
                "priority": 88,
                "reason": "已成交客户可推进二次增购",
                "action": "结合当前使用情况推荐升级或插件增购",
            }
        )
    if is_risk:
        opportunities.append(
            {
                "type": "保客修复机会",
                "priority": 70,
                "reason": "存在风险标签或经营痛点，先修复再扩展",
                "action": "先完成保客动作，再评估续费与增购机会",
            }
        )

    opportunities.sort(key=lambda item: item["priority"], reverse=True)
    return opportunities[:2]


def main() -> int:
    try:
        client = CrmApiClient.from_env()
        customers = client.get_my_customers()
    except CrmApiError as error:
        print(f"[csm-renew-opportunity] CRM API 调用失败: {error}")
        return 1

    clients: list[dict] = []
    type_counter: Counter[str] = Counter()

    for customer in customers:
        opportunities = evaluate_opportunities(customer)
        for item in opportunities:
            type_counter[item["type"]] += 1
        clients.append(
            {
                "customer_id": customer.get("customer_id"),
                "name": customer_name(customer),
                "csm": customer_owner(customer),
                "stage": stage_label(customer),
                "status": safe_text(customer.get("customer_status")),
                "opportunities": opportunities,
                "data_source": "crm_api",
                "scope": "current_user",
            }
        )

    has_opportunity = sum(1 for client_item in clients if client_item["opportunities"])
    summary = {
        "total_customers": len(clients),
        "has_opportunity": has_opportunity,
        "opportunity_type_counts": dict(type_counter),
    }

    output = {
        "agent": "CSM_Opportunity_Analyzer API Edition",
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": summary,
        "clients": clients,
    }

    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[csm-renew-opportunity] dataSource=crm_api scope=current_user customers={len(clients)} with_opportunity={has_opportunity}")
    print(f"[csm-renew-opportunity] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


