#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

RISK_FILE = Path("risk_results.json")
HEALTH_FILE = Path("health_results.json")
RENEW_FILE = Path("renew_results.json")
OPP_FILE = Path("opportunity_results.json")
OUTPUT_FILE = Path("task_results.json")


def load_json(path: Path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> int:
    risk_payload = load_json(RISK_FILE)
    health_payload = load_json(HEALTH_FILE)
    renew_payload = load_json(RENEW_FILE)
    opp_payload = load_json(OPP_FILE)

    risk_clients = risk_payload if isinstance(risk_payload, list) else risk_payload.get("risk_clients", [])
    health_clients = health_payload if isinstance(health_payload, list) else health_payload.get("clients", [])
    renew_clients = renew_payload.get("all_clients", []) if isinstance(renew_payload, dict) else []
    opp_clients = opp_payload.get("clients", []) if isinstance(opp_payload, dict) else []

    scene_candidates = []
    for item in opp_clients:
        opportunities = item.get("opportunities", [])
        if not opportunities:
            continue
        top = opportunities[0]
        if top.get("type") in {"场景拓展机会", "多门店协同机会"}:
            scene_candidates.append(
                {
                    "customer_id": item.get("customer_id"),
                    "name": item.get("name"),
                    "csm": item.get("csm"),
                    "type": top.get("type"),
                    "reason": top.get("reason"),
                    "action": top.get("action"),
                }
            )

    renew_tasks = []
    for item in renew_clients:
        if item.get("prob_level") == "高":
            continue
        renew_tasks.append(
            {
                "customer_id": item.get("customer_id"),
                "name": item.get("name"),
                "csm": item.get("csm"),
                "prob_label": item.get("prob_label"),
                "horizon": item.get("horizon"),
                "action": item.get("action"),
            }
        )

    risk_high = [item for item in risk_clients if item.get("danger_level") == "高风险"]
    risk_mid = [item for item in risk_clients if item.get("danger_level") == "中风险"]

    output = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "risk_total": len(risk_clients),
            "risk_high": len(risk_high),
            "risk_mid": len(risk_mid),
            "scene_total": len(scene_candidates),
            "renew_total": len(renew_tasks),
            "health_total": len(health_clients),
        },
        "risk_clients": risk_clients,
        "scene_clients": scene_candidates,
        "renew_clients": renew_tasks,
    }

    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[csm-task-flow] dataSource=crm_api scope=current_user")
    print(f"[csm-task-flow] risk={len(risk_clients)} scene={len(scene_candidates)} renew={len(renew_tasks)}")
    print(f"[csm-task-flow] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
