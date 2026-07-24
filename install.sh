#!/usr/bin/env bash
# Manual/standalone entry point for setup.
#
# If this repo is installed as a Claude Code plugin, you do NOT need to run
# this: scripts/bootstrap.sh runs automatically as a SessionStart hook the
# moment the plugin is enabled, and re-runs (cheaply, idempotently) every
# session after that. This script exists only for people working with the
# repo directly (outside Claude Code) or troubleshooting -- it just calls
# bootstrap.sh with CLAUDE_PLUGIN_ROOT/CLAUDE_PLUGIN_DATA pointed at this
# checkout instead of the plugin cache.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export CLAUDE_PLUGIN_ROOT="${SCRIPT_DIR}"
export CLAUDE_PLUGIN_DATA="${SCRIPT_DIR}/.plugin-data"

"${SCRIPT_DIR}/scripts/bootstrap.sh"

echo
echo "==> Try it:"
echo "    PDF_TO_MD_PYLIBS_DIR=\"${CLAUDE_PLUGIN_DATA}/pylibs\" PDF_TO_MD_TESSDATA_DIR=\"${CLAUDE_PLUGIN_DATA}/tessdata\" python3 scripts/pdf_to_md.py examples/sample-turkish.pdf"
