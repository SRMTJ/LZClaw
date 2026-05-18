#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
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

INPUT_HEALTH = Path("health_results.json")
OUTPUT_FILE = Path("risk_results.json")


def load_health_scores() -> dict[str, int]:
    if not INPUT_HEALTH.exists():
        return {}
    try:
        payload = json.loads(INPUT_HEALTH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if isinstance(payload, list):
        items = payload
    else:
        items = payload.get("clients", [])
    scores: dict[str, int] = {}
    for item in items:
        name = safe_text(item.get("name"))
        score = item.get("score")
        if name and isinstance(score, (int, float)):
            scores[name] = int(score)
    return scores


def build_risk_item(customer: dict, detail: dict, health_score: int | None) -> dict | None:
    name = customer_name(customer)
    stage = stage_label(customer)
    status = safe_text(customer.get("customer_status"))
    tags = split_tokens(customer.get("customer_tags"))
    pain = safe_text(customer.get("business_pain_points"))
    contact_status = safe_text(customer.get("contact_status"))
    scene_count = infer_scene_count(customer)

    last_follow = customer.get("latest_follow_up_time") or customer.get("last_follow_up_time")
    days_since_follow = parse_days_since(last_follow)
    follow_records = detail.get("follow_up_records") if isinstance(detail, dict) else []
    if not isinstance(follow_records, list):
        follow_records = []

    risks: list[str] = []
    actions: list[str] = []

    if days_since_follow is None:
        risks.append("无最近跟进记录")
        actions.append("今天完成首次触达并补录跟进记录")
    elif days_since_follow >= 60:
        risks.append(f"{days_since_follow}天未跟进")
        actions.append("48小时内完成电话或企微回访")

    if scene_count <= 0:
        risks.append("场景绑定不足")
        actions.append("补齐至少1个经营场景落地计划")

    if "断约" in stage or "流失" in status:
        risks.append("客户处于断约/流失状态")
        actions.append("升级主管介入，执行挽回动作")

    if any(contains_risk_keywords(tag) for tag in tags) or contains_risk_keywords(pain):
        risks.append("标签或痛点命中风险关键词")
        actions.append("复核风险标签并更新经营诊断")

    if contact_status in {"not_connected", "失联", "未接通"}:
        risks.append("联系状态异常")
        actions.append("使用多渠道触达并确认有效联系人")

    if len(follow_records) == 0:
        risks.append("无跟进记录")
        actions.append("新增本周跟进计划与跟进记录")

    if health_score is not None and health_score < 40 and len(risks) >= 2:
        risks.append("健康分过低且风险叠加")
        actions.append("列入本周重点保客清单")

    if not risks:
        return None

    deduped_actions = list(dict.fromkeys(actions))
    risk_count = len(risks)
    danger_level = "高风险" if risk_count >= 2 else "中风险"
    danger_label = "[流失] 高风险" if danger_level == "高风险" else "[成长] 中风险"
    return {
        "customer_id": customer.get("customer_id"),
        "name": name,
        "csm": customer_owner(customer),
        "danger_level": danger_level,
        "danger_label": danger_label,
        "risk_count": risk_count,
        "risk_reasons": risks,
        "risks": risks,
        "suggested_actions": deduped_actions,
        "last_contact": safe_text(last_follow),
        "stage": stage,
        "status": status,
        "data_source": "crm_api",
        "scope": "current_user",
    }


def main() -> int:
    health_scores = load_health_scores()
    try:
        client = CrmApiClient.from_env()
        customers = client.get_my_customers()
    except CrmApiError as error:
        print(f"[csm-health-risk] CRM API 调用失败: {error}")
        return 1

    risks: list[dict] = []
    for customer in customers:
        customer_id = customer.get("customer_id")
        detail: dict = {}
        if customer_id is not None:
            try:
                detail = client.get_customer_detail(customer_id)
            except CrmApiError:
                detail = {}
        item = build_risk_item(customer, detail, health_scores.get(customer_name(customer)))
        if item:
            risks.append(item)

    risks.sort(key=lambda item: (0 if item["danger_level"] == "高风险" else 1, -item["risk_count"]))
    OUTPUT_FILE.write_text(json.dumps(risks, ensure_ascii=False, indent=2), encoding="utf-8")

    high = sum(1 for item in risks if item["danger_level"] == "高风险")
    mid = sum(1 for item in risks if item["danger_level"] == "中风险")
    print(f"[csm-health-risk] dataSource=crm_api scope=current_user generatedAt={datetime.now().isoformat(timespec='seconds')}")
    print(f"[csm-health-risk] risk_customers={len(risks)} high={high} mid={mid}")
    print(f"[csm-health-risk] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


