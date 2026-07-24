#!/usr/bin/env bash
# Thin launcher for block_pdf_read.py so the hook command doesn't need to
# guess "python" vs "python3" itself. `exec` replaces this shell process
# with Python, so the hook's JSON stdin and Python's exit code both pass
# through unchanged.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$(command -v python3 || command -v python)"
exec "${PYTHON_BIN}" "${SCRIPT_DIR}/block_pdf_read.py"
