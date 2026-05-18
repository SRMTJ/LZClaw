#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from crm_api import CrmApiClient, CrmApiError, parse_datetime  # noqa: E402
from csm_metrics import (  # noqa: E402
    customer_name,
    extract_stage_change_time,
    extract_stage_code,
    stage_change_records,
)

OUTPUT_FILE = Path("weekly_pipeline_results.json")
FINAL_STAGE_HINTS = ("s", "签约", "成交", "已合作", "won", "closed")


def get_window() -> tuple[datetime, datetime]:
    today = datetime.now()
    start_text = os.environ.get("CSM_WEEKLY_START_DATE", "").strip()
    end_text = os.environ.get("CSM_WEEKLY_END_DATE", "").strip()

    if start_text:
        start = parse_datetime(start_text) or (today - timedelta(days=6))
    else:
        start = today - timedelta(days=6)

    if end_text:
        end = parse_datetime(end_text) or today
    else:
        end = today

    if end < start:
        end = start + timedelta(days=1)
    return start, end


def in_window(value: datetime | None, start: datetime, end: datetime) -> bool:
    return bool(value) and start <= value <= end


def looks_like_final_stage(code: str) -> bool:
    normalized = code.strip().lower()
    return bool(normalized) and any(hint in normalized for hint in FINAL_STAGE_HINTS)


def main() -> int:
    start, end = get_window()
    try:
        client = CrmApiClient.from_env()
        leads = client.get_my_leads()
        customers = client.get_my_customers()
        stage_dicts = client.get_dictionaries("customer_stage_display")
    except CrmApiError as error:
        print(f"[csm-weekly-pipeline] CRM API 调用失败: {error}")
        return 1

    final_stage_codes = set()
    for item in stage_dicts:
        code = str(item.get("dict_code", "")).strip()
        name = str(item.get("dict_name", "")).strip()
        if looks_like_final_stage(code) or looks_like_final_stage(name):
            if code:
                final_stage_codes.add(code)
            if name:
                final_stage_codes.add(name)

    counts = {"L": 0, "D": 0, "C": 0, "B": 0, "S": 0}
    details = {"D": [], "C": [], "B": [], "S": []}

    for lead in leads:
        created = parse_datetime(lead.get("created_at"))
        if in_window(created, start, end):
            counts["L"] += 1

    stage_map = {"D": {"D"}, "C": {"C"}, "B": {"B"}}
    for customer in customers:
        customer_id = customer.get("customer_id")
        if customer_id is None:
            continue
        try:
            detail = client.get_customer_detail(customer_id)
        except CrmApiError:
            detail = {}

        for record in stage_change_records(detail):
            changed_at = extract_stage_change_time(record)
            if not in_window(changed_at, start, end):
                continue
            stage_code = extract_stage_code(record)
            stage_upper = stage_code.upper()
            entry = {
                "customer_id": customer_id,
                "name": customer_name(customer),
                "stage": stage_code,
                "changed_at": changed_at.isoformat() if changed_at else "",
            }
            if stage_upper in stage_map["D"]:
                counts["D"] += 1
                details["D"].append(entry)
            elif stage_upper in stage_map["C"]:
                counts["C"] += 1
                details["C"].append(entry)
            elif stage_upper in stage_map["B"]:
                counts["B"] += 1
                details["B"].append(entry)

            is_final = False
            if final_stage_codes:
                is_final = stage_code in final_stage_codes
            else:
                is_final = looks_like_final_stage(stage_code)
            if is_final:
                counts["S"] += 1
                details["S"].append(entry)

    fallback_used = False
    if counts["S"] == 0 and counts["B"] > 0:
        counts["S"] = counts["B"]
        details["S"] = list(details["B"])
        fallback_used = True

    result = {
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "window": {
            "start": start.isoformat(timespec="seconds"),
            "end": end.isoformat(timespec="seconds"),
        },
        "summary": {
            **counts,
            "finalStageFallbackToB": fallback_used,
            "finalStageCodes": sorted(final_stage_codes),
        },
        "details": details,
    }

    OUTPUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    ld = (counts["D"] / counts["L"] * 100.0) if counts["L"] else 0.0
    dc = (counts["C"] / counts["D"] * 100.0) if counts["D"] else 0.0
    cb = (counts["B"] / counts["C"] * 100.0) if counts["C"] else 0.0
    bs = (counts["S"] / counts["B"] * 100.0) if counts["B"] else 0.0
    print(f"[csm-weekly-pipeline] dataSource=crm_api scope=current_user")
    print(f"[csm-weekly-pipeline] L={counts['L']} D={counts['D']} C={counts['C']} B={counts['B']} S={counts['S']} (fallback={fallback_used})")
    print(f"[csm-weekly-pipeline] rate L->D={ld:.1f}% D->C={dc:.1f}% C->B={cb:.1f}% B->S={bs:.1f}%")
    print(f"[csm-weekly-pipeline] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


