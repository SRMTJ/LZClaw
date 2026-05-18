#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

from crm_api import CrmApiClient, CrmApiError, split_tokens  # noqa: E402
from csm_metrics import (  # noqa: E402
    contains_risk_keywords,
    customer_name,
    customer_owner,
    is_final_stage,
    parse_days_since,
    parse_days_until,
    safe_text,
    stage_label,
)

OUTPUT_FILE = Path("renew_results.json")


def predict_customer(customer: dict) -> dict:
    stage = stage_label(customer)
    status = safe_text(customer.get("customer_status"))
    tags = split_tokens(customer.get("customer_tags"))
    pain = safe_text(customer.get("business_pain_points"))

    score = 50
    if "续费" in stage:
        score += 15
    if is_final_stage(stage):
        score += 10
    if "owned" in status or "活跃" in status:
        score += 5
    if "流失" in status or "断约" in stage:
        score -= 30
    if any(contains_risk_keywords(tag) for tag in tags) or contains_risk_keywords(pain):
        score -= 20

    last_follow = customer.get("latest_follow_up_time") or customer.get("last_follow_up_time")
    days_since_follow = parse_days_since(last_follow)
    if days_since_follow is None:
        score -= 15
    elif days_since_follow > 60:
        score -= 20
    elif days_since_follow > 30:
        score -= 10
    elif days_since_follow <= 7:
        score += 5

    next_follow = customer.get("next_follow_up_time")
    days_left = parse_days_until(next_follow)
    horizon = "无到期信息"
    if days_left is not None:
        if days_left < 0:
            horizon = "逾期"
            score -= 10
        elif days_left <= 30:
            horizon = "30天内"
            score += 8
        elif days_left <= 60:
            horizon = "60天内"
            score += 4
        elif days_left <= 90:
            horizon = "90天内"
        else:
            horizon = "90天以上"

    score = max(0, min(100, score))
    if score >= 70:
        prob_level = "高"
        prob_label = "[健康] 高续费概率"
        action = "确认续费窗口并推动签约"
    elif score >= 40:
        prob_level = "中"
        prob_label = "[成长] 中续费概率"
        action = "安排深度沟通，排除续费阻碍"
    else:
        prob_level = "低"
        prob_label = "[流失] 低续费概率"
        action = "升级保客预警，启动挽回动作"

    return {
        "customer_id": customer.get("customer_id"),
        "name": customer_name(customer),
        "csm": customer_owner(customer),
        "stage": stage,
        "status": status or "未知",
        "expire_date": safe_text(next_follow),
        "days_left": days_left,
        "horizon": horizon,
        "intent": safe_text(customer.get("recommendation_reason")) or "未提供",
        "renew_score": score,
        "prob_level": prob_level,
        "prob_label": prob_label,
        "action": action,
        "data_source": "crm_api",
        "scope": "current_user",
    }


def main() -> int:
    try:
        client = CrmApiClient.from_env()
        customers = client.get_my_customers()
    except CrmApiError as error:
        print(f"[csm-renew-opportunity] CRM API 调用失败: {error}")
        return 1

    results = [predict_customer(customer) for customer in customers]
    results.sort(key=lambda item: item["renew_score"], reverse=True)

    high = [item for item in results if item["prob_level"] == "高"]
    mid = [item for item in results if item["prob_level"] == "中"]
    low = [item for item in results if item["prob_level"] == "低"]

    summary = {
        "total": len(results),
        "high_prob": len(high),
        "mid_prob": len(mid),
        "low_prob": len(low),
        "expire_30d": sum(1 for item in results if item["horizon"] == "30天内"),
        "expire_60d": sum(1 for item in results if item["horizon"] == "60天内"),
        "expire_90d": sum(1 for item in results if item["horizon"] == "90天内"),
        "overdue": sum(1 for item in results if item["horizon"] == "逾期"),
    }

    output = {
        "date": str(date.today()),
        "agent": "CSM_Renew_Predictor API Edition",
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": summary,
        "high_prob_clients": high,
        "mid_prob_clients": mid,
        "low_prob_clients": low,
        "all_clients": results,
    }

    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[csm-renew-opportunity] dataSource=crm_api scope=current_user total={summary['total']} high={summary['high_prob']} mid={summary['mid_prob']} low={summary['low_prob']}")
    print(f"[csm-renew-opportunity] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


