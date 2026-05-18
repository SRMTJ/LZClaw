#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PIPELINE = [
    {
        "name": "客户健康分析",
        "command": [sys.executable, str(ROOT / "csm-health-risk" / "main.py"), "health"],
        "output": "health_results.json",
    },
    {
        "name": "风险客户识别",
        "command": [sys.executable, str(ROOT / "csm-health-risk" / "main.py"), "risk"],
        "output": "risk_results.json",
    },
    {
        "name": "经营机会识别",
        "command": [sys.executable, str(ROOT / "csm-renew-opportunity" / "main.py"), "opportunity"],
        "output": "opportunity_results.json",
    },
    {
        "name": "续费预测",
        "command": [sys.executable, str(ROOT / "csm-renew-opportunity" / "main.py"), "renew"],
        "output": "renew_results.json",
    },
    {
        "name": "任务清单生成",
        "command": [sys.executable, str(Path(__file__).resolve().parent / "gen_task_list.py")],
        "output": "task_results.json",
    },
    {
        "name": "明日任务生成",
        "command": [sys.executable, str(Path(__file__).resolve().parent / "gen_tomorrow_tasks.py")],
        "output": "tomorrow_tasks.json",
    },
]


def run_step(step: dict) -> tuple[bool, float, str]:
    start = time.time()
    proc = subprocess.run(step["command"], capture_output=True, text=True, encoding="utf-8", cwd=str(Path.cwd()))
    elapsed = time.time() - start
    if proc.returncode != 0:
        output = (proc.stderr or proc.stdout).strip()
        return False, elapsed, output
    return True, elapsed, proc.stdout.strip()


def load_json(path: str):
    file_path = Path(path)
    if not file_path.exists():
        return {}
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def print_summary() -> None:
    health = load_json("health_results.json")
    risk = load_json("risk_results.json")
    renew = load_json("renew_results.json")
    task = load_json("task_results.json")

    health_count = len(health) if isinstance(health, list) else len(health.get("clients", []))
    risk_count = len(risk) if isinstance(risk, list) else len(risk.get("risk_clients", []))
    renew_summary = renew.get("summary", {}) if isinstance(renew, dict) else {}
    task_summary = task.get("summary", {}) if isinstance(task, dict) else {}

    print("\n[CSM Task Flow Summary]")
    print(f"  health clients: {health_count}")
    print(f"  risk clients: {risk_count}")
    print(f"  renew high/mid/low: {renew_summary.get('high_prob', 0)}/{renew_summary.get('mid_prob', 0)}/{renew_summary.get('low_prob', 0)}")
    print(f"  tasks risk/scene/renew: {task_summary.get('risk_total', 0)}/{task_summary.get('scene_total', 0)}/{task_summary.get('renew_total', 0)}")


def main() -> int:
    print(f"[csm-task-flow] scheduler started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    all_ok = True
    total_seconds = 0.0

    for index, step in enumerate(PIPELINE, start=1):
        print(f"\n[step {index}/{len(PIPELINE)}] {step['name']}")
        ok, elapsed, output = run_step(step)
        total_seconds += elapsed
        if ok:
            print(f"  status: ok ({elapsed:.1f}s)")
            if output:
                for line in output.splitlines():
                    print(f"  | {line}")
        else:
            all_ok = False
            print(f"  status: failed ({elapsed:.1f}s)")
            if output:
                for line in output.splitlines():
                    print(f"  | {line}")
            break

        output_file = Path(step["output"])
        if output_file.exists():
            print(f"  output: {output_file.resolve()}")
        else:
            all_ok = False
            print(f"  output missing: {step['output']}")
            break

    print(f"\n[csm-task-flow] scheduler finished in {total_seconds:.1f}s")
    print(f"[csm-task-flow] result: {'success' if all_ok else 'failed'}")
    if all_ok:
        print_summary()
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
