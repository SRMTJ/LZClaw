#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from pathlib import Path

from crm_api import CrmApiClient, CrmApiError  # noqa: E402


def collect_keys(payload, prefix="") -> list[str]:
    keys: list[str] = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            next_prefix = f"{prefix}.{key}" if prefix else key
            keys.append(next_prefix)
            keys.extend(collect_keys(value, next_prefix))
    elif isinstance(payload, list):
        for index, value in enumerate(payload[:2]):
            next_prefix = f"{prefix}[{index}]"
            keys.extend(collect_keys(value, next_prefix))
    return keys


def main() -> int:
    try:
        client = CrmApiClient.from_env()
        customers = client.get_my_customers({"page_size": 1})
        if not customers:
            print("[csm-health-risk] 当前账号无客户数据")
            return 0
        customer = customers[0]
        customer_id = customer.get("customer_id")
        detail = client.get_customer_detail(customer_id) if customer_id is not None else {}
    except CrmApiError as error:
        print(f"[csm-health-risk] CRM API 调用失败: {error}")
        return 1

    merged = {"list_item": customer, "detail": detail}
    keys = collect_keys(merged)
    keywords = ("renew", "续费", "expire", "到期", "stage", "status", "risk", "标签")
    matched = [key for key in keys if any(word.lower() in key.lower() for word in keywords)]

    print("[csm-health-risk] dataSource=crm_api scope=current_user")
    print(f"[csm-health-risk] sample_customer_id={customer_id}")
    print("[csm-health-risk] renew/risk 相关字段路径：")
    for key in sorted(set(matched)):
        print(f"  - {key}")

    print("[csm-health-risk] 样本摘要：")
    print(json.dumps(customer, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


