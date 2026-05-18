#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

TASK_FILE = Path("task_results.json")
OUTPUT_FILE = Path("tomorrow_tasks.json")


def load_tasks() -> dict:
    if not TASK_FILE.exists():
        return {}
    try:
        return json.loads(TASK_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def main() -> int:
    task_payload = load_tasks()
    if not task_payload:
        print("[csm-task-flow] 未找到 task_results.json，请先执行 task-list 子命令。")
        return 1

    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    risk_tasks = task_payload.get("risk_clients", [])
    scene_tasks = task_payload.get("scene_clients", [])
    renew_tasks = task_payload.get("renew_clients", [])

    todo_items = []
    for item in risk_tasks:
        todo_items.append(
            {
                "priority": "P0",
                "type": "风险客户跟进",
                "customer": item.get("name"),
                "owner": item.get("csm"),
                "action": (item.get("suggested_actions") or ["立即联系客户"])[0],
            }
        )
    for item in renew_tasks:
        todo_items.append(
            {
                "priority": "P1",
                "type": "续费推进",
                "customer": item.get("name"),
                "owner": item.get("csm"),
                "action": item.get("action") or "确认续费计划",
            }
        )
    for item in scene_tasks:
        todo_items.append(
            {
                "priority": "P2",
                "type": "场景拓展",
                "customer": item.get("name"),
                "owner": item.get("csm"),
                "action": item.get("action") or "推进场景落地",
            }
        )

    output = {
        "date": tomorrow,
        "dataSource": "crm_api",
        "scope": "current_user",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "total": len(todo_items),
            "P0": sum(1 for item in todo_items if item["priority"] == "P0"),
            "P1": sum(1 for item in todo_items if item["priority"] == "P1"),
            "P2": sum(1 for item in todo_items if item["priority"] == "P2"),
        },
        "items": todo_items,
    }

    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[csm-task-flow] 明日任务生成完成: total={len(todo_items)}")
    print(f"[csm-task-flow] 输出文件: {OUTPUT_FILE.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
