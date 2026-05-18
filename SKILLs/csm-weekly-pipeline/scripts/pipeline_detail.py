#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from pathlib import Path

RESULT_FILE = Path("weekly_pipeline_results.json")


def main() -> int:
    if not RESULT_FILE.exists():
        print("[csm-weekly-pipeline] 未找到 weekly_pipeline_results.json，请先执行 weekly 子命令。")
        return 1

    payload = json.loads(RESULT_FILE.read_text(encoding="utf-8"))
    summary = payload.get("summary", {})
    details = payload.get("details", {})
    window = payload.get("window", {})

    print("[csm-weekly-pipeline] pipeline detail")
    print(f"  dataSource: {payload.get('dataSource')}")
    print(f"  scope: {payload.get('scope')}")
    print(f"  window: {window.get('start')} ~ {window.get('end')}")
    print(f"  counts: L={summary.get('L', 0)} D={summary.get('D', 0)} C={summary.get('C', 0)} B={summary.get('B', 0)} S={summary.get('S', 0)}")
    print(f"  finalStageFallbackToB: {summary.get('finalStageFallbackToB', False)}")

    for stage in ("D", "C", "B", "S"):
        records = details.get(stage, [])
        print(f"\n  [{stage}] {len(records)} 条")
        for row in records[:10]:
            print(f"    - {row.get('name', '')} ({row.get('changed_at', '')})")
        if len(records) > 10:
            print(f"    ... 还有 {len(records) - 10} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
