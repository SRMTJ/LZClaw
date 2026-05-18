import os
import subprocess
import sys

COMMAND_MAP = {
    'weekly': 'analyze_weekly.py',
    'pipeline-detail': 'pipeline_detail.py',
    'xf-d-analysis': 'xf_d_analysis.py',
}
DEFAULT_SUBCOMMAND = 'weekly'


def print_usage() -> None:
    commands = ', '.join(COMMAND_MAP.keys())
    print('[csm-weekly-pipeline] missing or invalid subcommand, fallback to default', file=sys.stderr)
    print(f'[csm-weekly-pipeline] default subcommand: {DEFAULT_SUBCOMMAND}', file=sys.stderr)
    print(f'[csm-weekly-pipeline] supported subcommands: {commands}', file=sys.stderr)


def resolve_invocation(argv: list[str]) -> tuple[str, list[str]]:
    if len(argv) < 2:
        return DEFAULT_SUBCOMMAND, []
    subcommand = argv[1].strip()
    if subcommand in COMMAND_MAP:
        return subcommand, argv[2:]
    return DEFAULT_SUBCOMMAND, argv[1:]


def main() -> int:
    subcommand, passthrough_args = resolve_invocation(sys.argv)
    script_name = COMMAND_MAP.get(subcommand)
    if not script_name:
        print_usage()
        return 1

    script_path = os.path.join(os.path.dirname(__file__), 'scripts', script_name)
    if len(sys.argv) < 2 or sys.argv[1].strip() not in COMMAND_MAP:
        print_usage()
    result = subprocess.run([sys.executable, script_path, *passthrough_args], check=False)
    return result.returncode


if __name__ == '__main__':
    raise SystemExit(main())
