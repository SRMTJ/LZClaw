#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from typing import Any


class CrmApiError(RuntimeError):
    pass


class CrmUnauthorizedError(CrmApiError):
    pass


@dataclass
class CrmConfig:
    base_url: str
    username: str
    mobile: str
    password: str
    page_size: int

    @classmethod
    def from_env(cls) -> "CrmConfig":
        # Built-in defaults for the current LZClaw CRM skill runtime.
        # Environment variables still take precedence when explicitly provided.
        base_url = os.environ.get("CSM_CRM_BASE_URL", "http://lzcrm.srmtj.com/api/v1").strip()
        username = os.environ.get("CSM_CRM_USERNAME", "demo_admin").strip()
        mobile = os.environ.get("CSM_CRM_MOBILE", "").strip()
        password = os.environ.get("CSM_CRM_PASSWORD", "Passw0rd!").strip()
        page_size_raw = os.environ.get("CSM_CRM_PAGE_SIZE", "100").strip()
        try:
            page_size = int(page_size_raw)
        except ValueError:
            page_size = 100
        page_size = max(1, min(page_size, 100))

        if not password:
            raise CrmApiError("missing CSM_CRM_PASSWORD")
        if not username and not mobile:
            raise CrmApiError("missing CSM_CRM_USERNAME or CSM_CRM_MOBILE")

        if base_url.endswith("/"):
            base_url = base_url[:-1]
        return cls(
            base_url=base_url,
            username=username,
            mobile=mobile,
            password=password,
            page_size=page_size,
        )


class CrmApiClient:
    def __init__(self, config: CrmConfig):
        self.config = config
        self._access_token = ""

    @classmethod
    def from_env(cls) -> "CrmApiClient":
        return cls(CrmConfig.from_env())

    def login(self) -> str:
        body: dict[str, Any] = {"password": self.config.password}
        if self.config.username:
            body["username"] = self.config.username
        else:
            body["mobile"] = self.config.mobile

        data = self._request(
            "POST",
            "/auth/login",
            body=body,
            include_auth=False,
            retry_unauthorized=False,
        )
        token = str(data.get("access_token", "")).strip()
        if not token:
            raise CrmApiError("login succeeded but access_token missing")
        self._access_token = token
        return token

    def fetch_paginated(self, path: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        page = 1
        page_size = self.config.page_size
        items: list[dict[str, Any]] = []
        while True:
            query = dict(params or {})
            query["page"] = page
            query["page_size"] = page_size
            data = self._request("GET", path, params=query)
            page_items = list(data.get("list") or [])
            items.extend(page_items)

            pagination = data.get("pagination") or {}
            total = pagination.get("total")
            if isinstance(total, int) and total >= 0:
                if len(items) >= total:
                    break
            if len(page_items) < page_size:
                break
            page += 1
        return items

    def get_my_leads(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated("/my-leads", params=params)

    def get_lead_detail(self, lead_id: int | str) -> dict[str, Any]:
        return self._request("GET", f"/my-leads/{lead_id}")

    def get_my_customers(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated("/my-customers", params=params)

    def get_customer_detail(self, customer_id: int | str) -> dict[str, Any]:
        return self._request("GET", f"/my-customers/{customer_id}")

    def get_dictionaries(self, dict_type: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {}
        if dict_type:
            params["dict_type"] = dict_type
        return self.fetch_paginated("/dictionaries", params=params)

    def get_ai_call_records(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated("/ai-call-records", params=params)

    def get_async_task(self, task_id: int | str) -> dict[str, Any]:
        return self._request("GET", f"/async-tasks/{task_id}")

    def get_notifications(self, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("GET", "/notifications", params=params or {})

    def create_customer_follow_up_plan(self, customer_id: int | str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", f"/customers/{customer_id}/follow-up-plans", body=body)

    def draft_customer_previsit_summary(self, customer_id: int | str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", f"/customers/{customer_id}/previsit-summary-drafts", body=body)

    def draft_customer_follow_up_summary(self, customer_id: int | str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", f"/customers/{customer_id}/follow-up-summary-drafts", body=body)

    def check_customer_stage_transition(self, customer_id: int | str, target_stage: str) -> dict[str, Any]:
        return self._request("POST", f"/customers/{customer_id}/stage-transitions", body={"target_stage": target_stage})

    def confirm_customer_stage_transition(self, customer_id: int | str, target_stage: str) -> dict[str, Any]:
        return self._request("POST", f"/customers/{customer_id}/stage-transitions/confirm", body={"target_stage": target_stage})

    def draft_lead_follow_up_summary(self, lead_id: int | str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", f"/leads/{lead_id}/follow-up-summary-drafts", body=body)

    def generate_lead_script(self, lead_id: int | str) -> dict[str, Any]:
        return self._request("POST", f"/leads/{lead_id}/script", body={})


    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("GET", path, params=params)

    def post(self, path: str, body: dict[str, Any] | None = None, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("POST", path, params=params, body=body or {})

    def put(self, path: str, body: dict[str, Any] | None = None, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("PUT", path, params=params, body=body or {})

    def delete(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._request("DELETE", path, params=params)

    def list_users(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated("/users", params=params)

    def list_assignable_users(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated("/assignable-users", params=params)

    def list_lead_pool(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated("/lead-pool", params=params)

    def get_lead_pool_detail(self, lead_id: int | str) -> dict[str, Any]:
        return self._request("GET", f"/lead-pool/{lead_id}")

    def list_customer_pool(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated("/customer-pool", params=params)

    def get_customer_pool_detail(self, customer_id: int | str) -> dict[str, Any]:
        return self._request("GET", f"/customer-pool/{customer_id}")

    def list_source_search_runs(self, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated("/source-search-runs", params=params)

    def list_source_search_results(self, run_id: int | str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.fetch_paginated(f"/source-search-runs/{run_id}/results", params=params)

    def create_source_search_run(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/source-search-runs", body=body)

    def join_source_search_results(self, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/source-search-results/join-pool", body=body)

    def claim_lead_pool(self, lead_id: int | str) -> dict[str, Any]:
        return self._request("POST", f"/lead-pool/{lead_id}/claim", body={})

    def assign_lead_pool(self, lead_id: int | str, target_user_id: int | str, reason: str = "") -> dict[str, Any]:
        return self._request("POST", f"/lead-pool/{lead_id}/assign", body={"target_user_id": int(target_user_id), "reason": reason})

    def enrich_lead(self, lead_id: int | str) -> dict[str, Any]:
        return self._request("POST", f"/leads/{lead_id}/enrichment", body={})

    def save_lead_follow_up(self, lead_id: int | str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", f"/leads/{lead_id}/follow-ups", body=body)

    def convert_lead_to_customer(self, lead_id: int | str) -> dict[str, Any]:
        return self._request("POST", f"/leads/{lead_id}/convert-to-customer", body={})

    def transfer_lead(self, lead_id: int | str, target_user_id: int | str, reason: str = "") -> dict[str, Any]:
        return self._request("POST", f"/leads/{lead_id}/transfer-records", body={"target_user_id": int(target_user_id), "reason": reason})

    def save_customer_follow_up_record(self, customer_id: int | str, body: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", f"/customers/{customer_id}/follow-up-records", body=body)

    def transfer_customer(self, customer_id: int | str, target_user_id: int | str, reason: str = "") -> dict[str, Any]:
        return self._request("POST", f"/customers/{customer_id}/transfer-records", body={"target_user_id": int(target_user_id), "reason": reason})

    def mark_all_notifications_read(self) -> dict[str, Any]:
        return self._request("POST", "/notifications/read-all", body={})

    def mark_notification_read(self, notification_id: int | str) -> dict[str, Any]:
        return self._request("POST", f"/notifications/{notification_id}/read", body={})

    def _ensure_token(self) -> None:
        if not self._access_token:
            self.login()

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
        include_auth: bool = True,
        retry_unauthorized: bool = True,
    ) -> dict[str, Any]:
        if include_auth:
            self._ensure_token()

        url = f"{self.config.base_url}{path}"
        if params:
            qp = urllib.parse.urlencode({k: "" if v is None else str(v) for k, v in params.items()})
            url = f"{url}?{qp}"

        headers = {"Content-Type": "application/json"}
        if include_auth and self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"

        payload_bytes = None
        if body is not None:
            payload_bytes = json.dumps(body, ensure_ascii=False).encode("utf-8")

        req = urllib.request.Request(url=url, data=payload_bytes, method=method.upper(), headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode("utf-8")
                payload = json.loads(raw) if raw else {}
        except urllib.error.HTTPError as err:
            raw = err.read().decode("utf-8", errors="ignore")
            payload = {}
            if raw:
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    pass
            if err.code == 401:
                if include_auth and retry_unauthorized:
                    self.login()
                    return self._request(
                        method=method,
                        path=path,
                        params=params,
                        body=body,
                        include_auth=include_auth,
                        retry_unauthorized=False,
                    )
                raise CrmUnauthorizedError(f"http 401 on {method} {path}")
            msg = payload.get("message") if isinstance(payload, dict) else ""
            raise CrmApiError(f"http {err.code} on {method} {path}: {msg or raw[:160]}")
        except urllib.error.URLError as err:
            raise CrmApiError(f"request failed {method} {path}: {err}") from err

        if isinstance(payload, dict) and "code" in payload:
            code = payload.get("code")
            if code not in (0, "0", None):
                if str(code) == "40101":
                    if include_auth and retry_unauthorized:
                        self.login()
                        return self._request(
                            method=method,
                            path=path,
                            params=params,
                            body=body,
                            include_auth=include_auth,
                            retry_unauthorized=False,
                        )
                    raise CrmUnauthorizedError(f"api unauthorized on {method} {path}")
                message = str(payload.get("message", "unknown error"))
                raise CrmApiError(f"api error code={code} on {method} {path}: {message}")
            data = payload.get("data")
            if isinstance(data, dict):
                return data
            return {"value": data}

        if isinstance(payload, dict):
            return payload
        return {"value": payload}


def parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def split_tokens(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value).strip()
    if not text:
        return []
    sep_chars = [",", "，", "/", "|", ";", "；", "\n"]
    for sep in sep_chars:
        text = text.replace(sep, ",")
    return [part.strip() for part in text.split(",") if part.strip()]
