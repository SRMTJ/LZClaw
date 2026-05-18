#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import sys

SCRIPT_DIR = os.path.join(os.path.dirname(__file__), "scripts")
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from sales_insight_api import run_mode  # noqa: E402

COMMAND_MAP = {
    "analyze-conversion": "analyze-conversion",
    "analyze-industry": "analyze-industry",
    "analyze-industry-focus": "analyze-industry-focus",
    "analyze-source": "analyze-source",
    "analyze-revenue": "analyze-revenue",
}
DEFAULT_SUBCOMMAND = "analyze-conversion"


def print_usage() -> None:
    commands = ", ".join(COMMAND_MAP.keys())
    print("[csm-sales-insight] missing or invalid subcommand, fallback to default", file=sys.stderr)
    print(f"[csm-sales-insight] default subcommand: {DEFAULT_SUBCOMMAND}", file=sys.stderr)
    print(f"[csm-sales-insight] supported subcommands: {commands}", file=sys.stderr)


def resolve_invocation(argv: list[str]) -> str:
    if len(argv) < 2:
        return DEFAULT_SUBCOMMAND
    subcommand = argv[1].strip()
    if subcommand in COMMAND_MAP:
        return subcommand
    return DEFAULT_SUBCOMMAND


def main() -> int:
    subcommand = resolve_invocation(sys.argv)
    if len(sys.argv) < 2 or sys.argv[1].strip() not in COMMAND_MAP:
        print_usage()
    try:
        run_mode(COMMAND_MAP[subcommand])
    except Exception as error:
        print(f"[csm-sales-insight] {subcommand} failed: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

