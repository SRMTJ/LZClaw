#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from crm_api import CrmApiClient  # noqa: E402
from csm_metrics import is_self_source  # noqa: E402

FINAL_STAGE_HINTS = ("s", "签约", "成交", "已合作", "won", "closed")


def add_count(bucket: dict[str, int], key: Any) -> None:
    label = str(key or "未知").strip() or "未知"
    bucket[label] = bucket.get(label, 0) + 1


def get_stage_label(value: Any) -> str:
    return str(value or "未知").strip() or "未知"


def is_final_stage(stage: Any) -> bool:
    text = str(stage or "").strip().lower()
    if not text:
        return False
    return any(hint.lower() in text for hint in FINAL_STAGE_HINTS)


def to_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    text = re.sub(r"[^\d\.-]", "", str(value))
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def load_data() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    client = CrmApiClient.from_env()
    leads = client.get_my_leads()
    customers = client.get_my_customers()
    return leads, customers


def summarize_conversion(leads: list[dict[str, Any]], customers: list[dict[str, Any]]) -> dict[str, Any]:
    stages: dict[str, int] = {}
    sources: dict[str, int] = {}
    industries: dict[str, int] = {}
    final_count = 0

    for lead in leads:
        add_count(sources, lead.get("source"))
        add_count(industries, lead.get("sub_industry") or lead.get("industry_code"))
    for customer in customers:
        stage = get_stage_label(customer.get("customer_stage"))
        add_count(stages, stage)
        if is_final_stage(stage):
            final_count += 1

    total_leads = len(leads)
    total_customers = len(customers)
    conversion_rate = f"{(total_customers / total_leads * 100):.1f}%" if total_leads > 0 else "0.0%"
    final_rate = f"{(final_count / total_customers * 100):.1f}%" if total_customers > 0 else "0.0%"

    return {
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "leads": total_leads,
        "customers": total_customers,
        "leadToCustomerRate": conversion_rate,
        "finalStageCount": final_count,
        "finalStageRate": final_rate,
        "stageDistribution": stages,
        "sourceDistribution": sources,
        "industryDistribution": industries,
    }


def summarize_source(leads: list[dict[str, Any]], customers: list[dict[str, Any]]) -> dict[str, Any]:
    lead_source: dict[str, int] = {}
    customer_source: dict[str, int] = {}
    self_lead = 0
    self_customer = 0

    for lead in leads:
        source = lead.get("source") or "未知"
        add_count(lead_source, source)
        if is_self_source(source):
            self_lead += 1
    for customer in customers:
        source = customer.get("source") or "未知"
        add_count(customer_source, source)
        if is_self_source(source):
            self_customer += 1

    return {
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "leadSource": lead_source,
        "customerSource": customer_source,
        "selfDeveloped": {
            "leads": self_lead,
            "customers": self_customer,
        },
    }


def summarize_industry(leads: list[dict[str, Any]], customers: list[dict[str, Any]]) -> dict[str, Any]:
    lead_industry: dict[str, int] = {}
    customer_industry: dict[str, int] = {}
    for lead in leads:
        add_count(lead_industry, lead.get("sub_industry") or lead.get("industry_code"))
    for customer in customers:
        add_count(customer_industry, customer.get("sub_industry") or customer.get("industry_code"))

    return {
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "leadIndustry": lead_industry,
        "customerIndustry": customer_industry,
    }


def summarize_industry_focus(leads: list[dict[str, Any]], customers: list[dict[str, Any]]) -> dict[str, Any]:
    combos: dict[str, int] = {}
    for lead in leads:
        source = str(lead.get("source") or "未知").strip() or "未知"
        industry = str(lead.get("sub_industry") or lead.get("industry_code") or "未知").strip() or "未知"
        key = f"{source} -> {industry}"
        add_count(combos, key)

    top_combos = [
        {"label": label, "count": count}
        for label, count in sorted(combos.items(), key=lambda item: item[1], reverse=True)[:10]
    ]

    stage_distribution: dict[str, int] = {}
    for customer in customers:
        add_count(stage_distribution, customer.get("customer_stage") or "未知")

    return {
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "topSourceIndustryCombos": top_combos,
        "stageDistribution": stage_distribution,
    }


def summarize_revenue(leads: list[dict[str, Any]], customers: list[dict[str, Any]]) -> dict[str, Any]:
    numeric_buckets: dict[str, float] = {}
    revenue_field_hints = ("amount", "price", "fee", "revenue", "contract", "gmv", "money")
    observed_revenue = False
    total = 0.0
    count = 0

    for item in [*leads, *customers]:
        for key, value in item.items():
            lower_key = str(key).lower()
            if not any(hint in lower_key for hint in revenue_field_hints):
                continue
            numeric = to_number(value)
            if numeric is None:
                continue
            observed_revenue = True
            total += numeric
            count += 1
            numeric_buckets[key] = numeric_buckets.get(key, 0.0) + numeric

    return {
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "observedRevenue": observed_revenue,
        "totalRevenue": round(total, 2),
        "recordCount": count,
        "fieldTotals": numeric_buckets,
        "notice": "" if observed_revenue else "接口未提供可识别金额字段，已跳过金额汇总。",
    }


def print_summary(title: str, data: dict[str, Any]) -> None:
    print(f"\n========== {title} ==========\n")
    print(json.dumps(data, ensure_ascii=False, indent=2))


def run_mode(mode: str) -> None:
    leads, customers = load_data()
    loaded_at = datetime.now().strftime("%Y-%m-%d")
    print(
        f"[csm-sales-insight] dataSource=crm_api scope=current_user date={loaded_at} "
        f"leads={len(leads)} customers={len(customers)}"
    )

    if mode == "analyze-conversion":
        print_summary("销售转化分析", summarize_conversion(leads, customers))
        return
    if mode == "analyze-source":
        print_summary("来源分析", summarize_source(leads, customers))
        return
    if mode == "analyze-industry":
        print_summary("行业分析", summarize_industry(leads, customers))
        return
    if mode == "analyze-industry-focus":
        print_summary("来源-行业聚焦分析", summarize_industry_focus(leads, customers))
        return
    if mode == "analyze-revenue":
        summary = summarize_revenue(leads, customers)
        print_summary("金额分析", summary)
        if not summary["observedRevenue"]:
            print("[csm-sales-insight] 接口未提供金额字段，已输出提示。")
        return
    raise RuntimeError(f"unsupported mode: {mode}")



