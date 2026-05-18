#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime
from typing import Any

from crm_api import parse_datetime, split_tokens


RISK_TAG_HINTS = ("风险", "流失", "预警", "断约", "停业", "关店", "换系统")
SELF_SOURCE_HINTS = ("自拓", "自主", "自开发")
FINAL_STAGE_HINTS = ("S", "签约", "成交", "已合作", "won", "closed")


def safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def customer_name(customer: dict[str, Any]) -> str:
    return (
        safe_text(customer.get("company_name"))
        or safe_text(customer.get("customer_name"))
        or safe_text(customer.get("name"))
        or f"customer-{customer.get('customer_id', 'unknown')}"
    )


def customer_owner(customer: dict[str, Any]) -> str:
    return safe_text(customer.get("owner_name")) or safe_text(customer.get("csm")) or "当前用户"


def is_self_source(source: Any) -> bool:
    text = safe_text(source)
    return bool(text) and any(hint in text for hint in SELF_SOURCE_HINTS)


def contains_risk_keywords(value: Any) -> bool:
    text = safe_text(value).lower()
    if not text:
        return False
    return any(hint.lower() in text for hint in RISK_TAG_HINTS)


def parse_days_since(value: Any, now: datetime | None = None) -> int | None:
    dt = parse_datetime(value)
    if not dt:
        return None
    current = now or datetime.now(dt.tzinfo)
    delta = current - dt
    return max(0, int(delta.total_seconds() // 86400))


def parse_days_until(value: Any, now: datetime | None = None) -> int | None:
    dt = parse_datetime(value)
    if not dt:
        return None
    current = now or datetime.now(dt.tzinfo)
    delta = dt - current
    return int(delta.total_seconds() // 86400)


def stage_label(customer: dict[str, Any]) -> str:
    return safe_text(customer.get("customer_stage")) or "未知"


def is_final_stage(stage: Any) -> bool:
    text = safe_text(stage).lower()
    if not text:
        return False
    return any(hint.lower() in text for hint in FINAL_STAGE_HINTS)


def infer_scene_count(customer: dict[str, Any]) -> int:
    tags = split_tokens(customer.get("customer_tags"))
    pain_points = split_tokens(customer.get("business_pain_points"))
    scene_tokens = set(tags)
    for token in pain_points:
        if "场景" in token:
            scene_tokens.add(token)
    if scene_tokens:
        return len(scene_tokens)
    store_count = customer.get("store_count")
    try:
        parsed = int(float(store_count))
        if parsed <= 0:
            return 0
        if parsed <= 2:
            return 1
        if parsed <= 5:
            return 2
        return 3
    except (TypeError, ValueError):
        return 0


def stage_change_records(detail: dict[str, Any]) -> list[dict[str, Any]]:
    records = detail.get("stage_change_records")
    if isinstance(records, list):
        return records
    alt = detail.get("history_flow_records")
    if isinstance(alt, list):
        return alt
    return []


def extract_stage_code(record: dict[str, Any]) -> str:
    return safe_text(record.get("to_stage")) or safe_text(record.get("stage_changed_to")) or safe_text(record.get("customer_stage"))


def extract_stage_change_time(record: dict[str, Any]) -> datetime | None:
    return (
        parse_datetime(record.get("stage_changed_at"))
        or parse_datetime(record.get("create_time"))
        or parse_datetime(record.get("created_at"))
        or parse_datetime(record.get("update_time"))
    )
