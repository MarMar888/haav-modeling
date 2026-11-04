#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"${PYTHON:-python3}" -m venv "$HERE/.venv"
"$HERE/.venv/bin/python" -m pip install -r "$HERE/requirements.txt"
"$HERE/.venv/bin/python" "$HERE/v4-2026-10-30/run_navaltoolbox.py" "$@"
