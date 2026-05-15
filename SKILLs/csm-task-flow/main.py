import os
import subprocess
import sys

COMMAND_MAP = {
    'task-list': 'gen_task_list.py',
    'tomorrow-tasks': 'gen_tomorrow_tasks.py',
    'scheduler': 'scheduler.py',
}


def print_usage() -> None:
    commands = ', '.join(COMMAND_MAP.keys())
    print('[csm-task-flow] missing or invalid subcommand', file=sys.stderr)
    print(f'[csm-task-flow] supported subcommands: {commands}', file=sys.stderr)


def main() -> int:
    if len(sys.argv) < 2:
        print_usage()
        return 1

    subcommand = sys.argv[1].strip()
    script_name = COMMAND_MAP.get(subcommand)
    if not script_name:
        print_usage()
        return 1

    script_path = os.path.join(os.path.dirname(__file__), 'scripts', script_name)
    result = subprocess.run([sys.executable, script_path, *sys.argv[2:]], check=False)
    return result.returncode


if __name__ == '__main__':
    raise SystemExit(main())
