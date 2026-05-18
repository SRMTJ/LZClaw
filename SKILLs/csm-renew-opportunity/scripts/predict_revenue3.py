#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

from crm_api import CrmApiClient, CrmApiError  # noqa: E402

OUTPUT_FILE = Path("revenue_prediction_results.json")


def to_number(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = re.sub(r"[^\d\.-]", "", text)
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def collect_revenue_fields(record: dict) -> dict:
    hints = ("amount", "price", "fee", "money", "revenue", "gmv", "contract")
    extracted = {}
    for key, value in record.items():
        key_lower = str(key).lower()
        if not any(hint in key_lower for hint in hints):
            continue
        numeric = to_number(value)
        if numeric is None:
            continue
        extracted[key] = numeric
    return extracted


def main() -> int:
    try:
        client = CrmApiClient.from_env()
        customers = client.get_my_customers()
        leads = client.get_my_leads()
    except CrmApiError as error:
        print(f"[csm-renew-opportunity] CRM API 调用失败: {error}")
        return 1

    field_totals: dict[str, float] = {}
    field_counts: dict[str, int] = {}
    for record in [*customers, *leads]:
        for key, amount in collect_revenue_fields(record).items():
            field_totals[key] = field_totals.get(key, 0.0) + amount
            field_counts[key] = field_counts.get(key, 0) + 1

    observed = bool(field_totals)
    output = {
        "agent": "CSM_Revenue_Predictor API Edition",
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "observedRevenueField": observed,
        "fieldTotals": {key: round(value, 2) for key, value in field_totals.items()},
        "fieldCounts": field_counts,
        "notice": "" if observed else "接口未提供可识别金额字段，无法输出金额预测。",
    }

    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[csm-renew-opportunity] dataSource=crm_api revenue_fields={len(field_totals)}")
    if not observed:
        print("[csm-renew-opportunity] 接口未提供可识别金额字段，已输出提示。")
    print(f"[csm-renew-opportunity] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


