#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


def load_json(filename: str) -> Any:
    file_path = Path.cwd() / filename
    if not file_path.exists():
        return None
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def render_top_risk(risks: Any) -> str:
    if not isinstance(risks, list) or len(risks) == 0:
        return "- 暂无风险客户数据"
    lines: list[str] = []
    for index, item in enumerate(risks[:10], start=1):
        reasons = item.get("risk_reasons") if isinstance(item, dict) else []
        if isinstance(reasons, list) and reasons:
            reason_text = "；".join(str(reason) for reason in reasons)
        else:
            reason_text = "未提供"
        suggested_actions = item.get("suggested_actions") if isinstance(item, dict) else []
        action_text = (
            str(suggested_actions[0])
            if isinstance(suggested_actions, list) and len(suggested_actions) > 0
            else "尽快跟进"
        )
        customer_name = str(item.get("name") or "未知客户")
        danger_label = str(item.get("danger_label") or item.get("danger_level") or "风险")
        lines.append(
            f"{index}. {customer_name}（{danger_label}）\n"
            f"   - 风险原因：{reason_text}\n"
            f"   - 建议动作：{action_text}"
        )
    return "\n".join(lines)


def render_renew(renew_payload: Any) -> str:
    summary = renew_payload.get("summary", {}) if isinstance(renew_payload, dict) else {}
    rows = renew_payload.get("all_clients", []) if isinstance(renew_payload, dict) else []
    top_lines: list[str] = []
    for index, item in enumerate(rows[:10], start=1):
        top_lines.append(
            f"{index}. {item.get('name') or '未知客户'} - {item.get('prob_label') or '未知'} - {item.get('action') or '待跟进'}"
        )
    return "\n".join(
        [
            f"- 总客户数：{summary.get('total', 0)}",
            f"- 高/中/低续费概率：{summary.get('high_prob', 0)}/{summary.get('mid_prob', 0)}/{summary.get('low_prob', 0)}",
            f"- 到期窗口（30/60/90/逾期）：{summary.get('expire_30d', 0)}/{summary.get('expire_60d', 0)}/{summary.get('expire_90d', 0)}/{summary.get('overdue', 0)}",
            "",
            "\n".join(top_lines) if top_lines else "- 暂无续费预测数据",
        ]
    )


def render_opportunities(payload: Any) -> str:
    summary = payload.get("summary", {}) if isinstance(payload, dict) else {}
    type_counts = summary.get("opportunity_type_counts", {}) if isinstance(summary, dict) else {}
    clients = payload.get("clients", []) if isinstance(payload, dict) else []
    type_lines = [f"- {type_name}: {count}" for type_name, count in sorted(type_counts.items(), key=lambda item: item[1], reverse=True)]
    sample_lines: list[str] = []
    visible_clients = [item for item in clients if isinstance(item.get("opportunities"), list) and len(item.get("opportunities")) > 0]
    for index, item in enumerate(visible_clients[:8], start=1):
        top = item["opportunities"][0]
        sample_lines.append(f"{index}. {item.get('name') or '未知客户'} - {top.get('type')} - {top.get('action')}")

    return "\n".join(
        [
            f"- 有机会客户：{summary.get('has_opportunity', 0)}/{summary.get('total_customers', 0)}",
            "\n".join(type_lines) if type_lines else "- 暂无机会分类数据",
            "",
            "\n".join(sample_lines) if sample_lines else "- 暂无机会明细数据",
        ]
    )


def render_tasks(payload: Any) -> str:
    summary = payload.get("summary", {}) if isinstance(payload, dict) else {}
    risk_items = payload.get("risk_clients", []) if isinstance(payload, dict) else []
    renew_items = payload.get("renew_clients", []) if isinstance(payload, dict) else []
    scene_items = payload.get("scene_clients", []) if isinstance(payload, dict) else []

    lines = [
        f"- 风险任务：{summary.get('risk_total', 0)}（高风险 {summary.get('risk_high', 0)} / 中风险 {summary.get('risk_mid', 0)}）",
        f"- 续费任务：{summary.get('renew_total', 0)}",
        f"- 场景任务：{summary.get('scene_total', 0)}",
        "",
        "### 风险任务 TOP5",
    ]
    for index, item in enumerate(risk_items[:5], start=1):
        suggested_actions = item.get("suggested_actions") if isinstance(item, dict) else []
        action = suggested_actions[0] if isinstance(suggested_actions, list) and suggested_actions else "尽快跟进"
        lines.append(f"{index}. {item.get('name') or '未知客户'} - {action}")

    lines.extend(["", "### 续费任务 TOP5"])
    for index, item in enumerate(renew_items[:5], start=1):
        lines.append(f"{index}. {item.get('name') or '未知客户'} - {item.get('action') or '确认续费计划'}")

    lines.extend(["", "### 场景任务 TOP5"])
    for index, item in enumerate(scene_items[:5], start=1):
        lines.append(f"{index}. {item.get('name') or '未知客户'} - {item.get('action') or '推进场景落地'}")
    return "\n".join(lines)


def main() -> int:
    risk_payload = load_json("risk_results.json") or []
    renew_payload = load_json("renew_results.json") or {}
    opp_payload = load_json("opportunity_results.json") or {}
    task_payload = load_json("task_results.json") or {}

    if isinstance(risk_payload, list):
        risk_items = risk_payload
    else:
        risk_items = risk_payload.get("risk_clients", [])

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    markdown = "\n".join(
        [
            "# CSM API 数据分析报告",
            "",
            f"- 生成时间：{now}",
            "- 数据来源：CRM API（当前登录用户口径）",
            "",
            "## 一、风险客户概览",
            render_top_risk(risk_items),
            "",
            "## 二、续费预测概览",
            render_renew(renew_payload),
            "",
            "## 三、经营机会概览",
            render_opportunities(opp_payload),
            "",
            "## 四、任务清单概览",
            render_tasks(task_payload),
            "",
        ]
    )

    out_path = Path.cwd() / "csm_detailed_analysis.md"
    out_path.write_text(markdown, encoding="utf-8")
    print(f"[csm-doc-export] 已生成报告: {out_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

