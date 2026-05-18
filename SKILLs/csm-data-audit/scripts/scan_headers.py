#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from crm_api import CrmApiClient, CrmApiError  # noqa: E402

LEAD_REQUIRED = {
    "lead_id",
    "company_name",
    "source",
    "lead_status",
    "created_at",
}
CUSTOMER_REQUIRED = {
    "customer_id",
    "company_name",
    "customer_stage",
    "customer_status",
    "source",
    "created_at",
}


def missing_fields(required: set[str], payload: dict) -> list[str]:
    keys = set(payload.keys())
    return sorted(item for item in required if item not in keys)


def main() -> int:
    try:
        client = CrmApiClient.from_env()
        leads = client.get_my_leads({"page_size": 1})
        customers = client.get_my_customers({"page_size": 1})
    except CrmApiError as error:
        print(f"[csm-data-audit] CRM API 调用失败: {error}")
        return 1

    lead_sample = leads[0] if leads else {}
    customer_sample = customers[0] if customers else {}

    print(f"[csm-data-audit] dataSource=crm_api scope=current_user generatedAt={datetime.now().isoformat(timespec='seconds')}")
    print(f"[csm-data-audit] lead sample fields={len(lead_sample.keys())} customer sample fields={len(customer_sample.keys())}")

    missing_lead = missing_fields(LEAD_REQUIRED, lead_sample)
    missing_customer = missing_fields(CUSTOMER_REQUIRED, customer_sample)

    print("\n[lead] required fields missing:")
    print(json.dumps(missing_lead, ensure_ascii=False))
    print("[customer] required fields missing:")
    print(json.dumps(missing_customer, ensure_ascii=False))

    print("\n[lead] sample payload:")
    print(json.dumps(lead_sample, ensure_ascii=False, indent=2))
    print("\n[customer] sample payload:")
    print(json.dumps(customer_sample, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


