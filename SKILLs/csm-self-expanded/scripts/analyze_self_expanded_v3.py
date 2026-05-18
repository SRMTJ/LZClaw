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
    is_final_stage,
    is_self_source,
    stage_change_records,
)

OUTPUT_FILE = Path("self_expanded_results.json")


def get_window() -> tuple[datetime, datetime]:
    today = datetime.now()
    start_text = os.environ.get("CSM_ANALYSIS_START_DATE", "").strip()
    end_text = os.environ.get("CSM_ANALYSIS_END_DATE", "").strip()

    if start_text:
        start = parse_datetime(start_text) or datetime(today.year, today.month, 1)
    else:
        start = datetime(today.year, today.month, 1)

    if end_text:
        end = parse_datetime(end_text) or today
    else:
        end = today

    if end < start:
        end = start + timedelta(days=1)
    return start, end


def in_window(value: datetime | None, start: datetime, end: datetime) -> bool:
    if value is None:
        return False
    return start <= value <= end


def main() -> int:
    start, end = get_window()
    try:
        client = CrmApiClient.from_env()
        leads = client.get_my_leads()
        customers = client.get_my_customers()
    except CrmApiError as error:
        print(f"[csm-self-expanded] CRM API 调用失败: {error}")
        return 1

    self_leads = []
    for lead in leads:
        if not is_self_source(lead.get("source")):
            continue
        created = parse_datetime(lead.get("created_at"))
        if in_window(created, start, end):
            self_leads.append(
                {
                    "lead_id": lead.get("lead_id"),
                    "name": lead.get("company_name") or lead.get("poi_name") or f"lead-{lead.get('lead_id')}",
                    "created_at": lead.get("created_at"),
                }
            )

    c_transitions = []
    s_transitions = []
    for customer in customers:
        if not is_self_source(customer.get("source")):
            continue
        customer_id = customer.get("customer_id")
        if customer_id is None:
            continue
        detail = {}
        try:
            detail = client.get_customer_detail(customer_id)
        except CrmApiError:
            detail = {}
        for record in stage_change_records(detail):
            changed_at = extract_stage_change_time(record)
            if not in_window(changed_at, start, end):
                continue
            stage_code = extract_stage_code(record)
            item = {
                "customer_id": customer_id,
                "name": customer_name(customer),
                "stage": stage_code,
                "changed_at": changed_at.isoformat() if changed_at else "",
            }
            if stage_code.upper() == "C":
                c_transitions.append(item)
            if is_final_stage(stage_code):
                s_transitions.append(item)

    result = {
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "window": {
            "start": start.isoformat(timespec="seconds"),
            "end": end.isoformat(timespec="seconds"),
        },
        "summary": {
            "selfLeadCount": len(self_leads),
            "selfLeadToCCount": len(c_transitions),
            "selfSignedCount": len(s_transitions),
        },
        "selfLeads": self_leads,
        "toCTransitions": c_transitions,
        "toFinalTransitions": s_transitions,
    }

    OUTPUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[csm-self-expanded] dataSource=crm_api scope=current_user")
    print(f"[csm-self-expanded] window={start.date()}~{end.date()} selfLead={len(self_leads)} toC={len(c_transitions)} final={len(s_transitions)}")
    print(f"[csm-self-expanded] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


