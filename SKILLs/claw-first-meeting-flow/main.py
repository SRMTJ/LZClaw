import os
import subprocess
import sys

COMMAND_MAP = {'first-meeting': 'claw_first_meeting_flow.py', 'question-list': 'claw_first_meeting_flow.py', 'after-meeting': 'claw_first_meeting_flow.py'}
DEFAULT_SUBCOMMAND = 'first-meeting'


def print_usage() -> None:
    commands = ', '.join(COMMAND_MAP.keys())
    print('[claw-first-meeting-flow] missing or invalid subcommand, fallback to default', file=sys.stderr)
    print(f'[claw-first-meeting-flow] default subcommand: {DEFAULT_SUBCOMMAND}', file=sys.stderr)
    print(f'[claw-first-meeting-flow] supported subcommands: {commands}', file=sys.stderr)


def resolve_invocation(argv: list[str]) -> tuple[str, list[str]]:
    if len(argv) < 2:
        return DEFAULT_SUBCOMMAND, []
    subcommand = argv[1].strip()
    if subcommand in COMMAND_MAP:
        return subcommand, argv[2:]
    return DEFAULT_SUBCOMMAND, argv[1:]


def main() -> int:
    subcommand, passthrough_args = resolve_invocation(sys.argv)
    if len(sys.argv) < 2 or sys.argv[1].strip() not in COMMAND_MAP:
        print_usage()
    script_path = os.path.join(os.path.dirname(__file__), 'scripts', COMMAND_MAP[subcommand])
    command = [sys.executable, script_path, subcommand, *passthrough_args]
    return subprocess.call(command)


if __name__ == '__main__':
    raise SystemExit(main())
