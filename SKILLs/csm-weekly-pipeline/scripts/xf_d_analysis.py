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

    d_records = details.get("D", [])
    print("[csm-weekly-pipeline] D 阶段专项分析")
    print(f"  D 新增: {summary.get('D', 0)}")
    print(f"  C 新增: {summary.get('C', 0)}")
    print(f"  D->C 转化率: {(summary.get('C', 0) / summary.get('D', 1) * 100):.1f}%" if summary.get("D", 0) else "  D->C 转化率: 0.0%")

    if not d_records:
        print("  本周无 D 阶段变更记录")
        return 0

    print("  最近 D 阶段客户（最多 20 条）：")
    for row in d_records[:20]:
        print(f"    - {row.get('name', '')} | {row.get('changed_at', '')}")
    if len(d_records) > 20:
        print(f"    ... 还有 {len(d_records) - 20} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
