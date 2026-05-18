#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from crm_api import CrmApiClient, CrmApiError, split_tokens  # noqa: E402
from csm_metrics import contains_risk_keywords, safe_text  # noqa: E402


def main() -> int:
    try:
        client = CrmApiClient.from_env()
        customers = client.get_my_customers()
        leads = client.get_my_leads()
        customer_stage_dict = client.get_dictionaries("customer_stage_display")
        customer_status_dict = client.get_dictionaries("customer_status")
    except CrmApiError as error:
        print(f"[csm-data-audit] CRM API 调用失败: {error}")
        return 1

    valid_stages = {safe_text(item.get("dict_code")) for item in customer_stage_dict if safe_text(item.get("dict_code"))}
    valid_status = {safe_text(item.get("dict_code")) for item in customer_status_dict if safe_text(item.get("dict_code"))}

    missing_name = []
    invalid_stage = []
    invalid_status = []
    risk_tagged = 0
    stage_counter: Counter[str] = Counter()
    status_counter: Counter[str] = Counter()

    for customer in customers:
        customer_id = customer.get("customer_id")
        company_name = safe_text(customer.get("company_name"))
        stage = safe_text(customer.get("customer_stage"))
        status = safe_text(customer.get("customer_status"))
        tags = split_tokens(customer.get("customer_tags"))

        if not company_name:
            missing_name.append(customer_id)
        if valid_stages and stage and stage not in valid_stages:
            invalid_stage.append({"customer_id": customer_id, "value": stage})
        if valid_status and status and status not in valid_status:
            invalid_status.append({"customer_id": customer_id, "value": status})
        if any(contains_risk_keywords(tag) for tag in tags):
            risk_tagged += 1

        if stage:
            stage_counter[stage] += 1
        if status:
            status_counter[status] += 1

    lead_missing_name = [lead.get("lead_id") for lead in leads if not safe_text(lead.get("company_name"))]

    report = {
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "leadCount": len(leads),
            "customerCount": len(customers),
            "leadMissingCompanyName": len(lead_missing_name),
            "customerMissingCompanyName": len(missing_name),
            "invalidStageCount": len(invalid_stage),
            "invalidStatusCount": len(invalid_status),
            "riskTaggedCustomerCount": risk_tagged,
        },
        "distribution": {
            "stage": dict(stage_counter),
            "status": dict(status_counter),
        },
        "issues": {
            "leadMissingCompanyNameIds": lead_missing_name[:50],
            "customerMissingCompanyNameIds": missing_name[:50],
            "invalidStage": invalid_stage[:50],
            "invalidStatus": invalid_status[:50],
        },
    }

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


