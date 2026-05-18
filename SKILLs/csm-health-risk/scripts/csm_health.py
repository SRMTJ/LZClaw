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
    parse_days_since,
    safe_text,
    stage_label,
)

OUTPUT_FILE = Path("health_results.json")


def compute_health(customer: dict) -> dict:
    score = 100
    flags: list[str] = []

    stage = stage_label(customer)
    status = safe_text(customer.get("customer_status"))
    tags = split_tokens(customer.get("customer_tags"))
    pain_points = safe_text(customer.get("business_pain_points"))
    scene_count = infer_scene_count(customer)

    last_follow = customer.get("latest_follow_up_time") or customer.get("last_follow_up_time")
    days_since_follow = parse_days_since(last_follow)

    if days_since_follow is None:
        score -= 25
        flags.append("无最近跟进记录")
    elif days_since_follow > 60:
        score -= 30
        flags.append(f"{days_since_follow}天未跟进")
    elif days_since_follow > 30:
        score -= 15
        flags.append(f"{days_since_follow}天未跟进")
    elif days_since_follow <= 7:
        score += 5

    if "断约" in stage or "流失" in status:
        score -= 35
        flags.append("客户处于断约/流失状态")

    if any(contains_risk_keywords(item) for item in tags):
        score -= 20
        flags.append("标签包含风险信号")

    if contains_risk_keywords(pain_points):
        score -= 10
        flags.append("经营痛点包含风险信号")

    if scene_count <= 0:
        score -= 15
        flags.append("场景绑定不足")
    elif scene_count == 1:
        score -= 8
        flags.append("场景较少")

    score = max(0, min(100, score))
    if score >= 80:
        level = "健康客户"
        label = "[健康] 健康客户"
    elif score >= 60:
        level = "成长客户"
        label = "[成长] 成长客户"
    elif score >= 40:
        level = "风险客户"
        label = "[警告] 风险客户"
    else:
        level = "流失客户"
        label = "[流失] 流失客户"

    return {
        "customer_id": customer.get("customer_id"),
        "name": customer_name(customer),
        "csm": customer_owner(customer),
        "stage": stage,
        "status": status,
        "score": score,
        "level": level,
        "label": label,
        "scenes": scene_count,
        "last_contact": safe_text(last_follow),
        "risk_flags": flags,
        "data_source": "crm_api",
        "scope": "current_user",
    }


def main() -> int:
    try:
        client = CrmApiClient.from_env()
        customers = client.get_my_customers()
    except CrmApiError as error:
        print(f"[csm-health-risk] CRM API 调用失败: {error}")
        return 1

    health_results = [compute_health(customer) for customer in customers]
    health_results.sort(key=lambda item: item["score"])

    OUTPUT_FILE.write_text(json.dumps(health_results, ensure_ascii=False, indent=2), encoding="utf-8")

    level_counter = Counter(item["level"] for item in health_results)
    print(f"[csm-health-risk] dataSource=crm_api scope=current_user generatedAt={datetime.now().isoformat(timespec='seconds')}")
    print(f"[csm-health-risk] customers={len(health_results)} -> health={level_counter.get('健康客户', 0)} growing={level_counter.get('成长客户', 0)} risk={level_counter.get('风险客户', 0)} churn={level_counter.get('流失客户', 0)}")
    print(f"[csm-health-risk] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


