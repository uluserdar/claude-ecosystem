#!/usr/bin/env python3
"""PreToolUse hook: blocks the built-in Read tool from opening .pdf files.

Why this exists: Read has native PDF support, so without this hook, Claude
can (and does) just call Read directly on a .pdf path -- including one that
arrived via a chat attachment/drag-and-drop, which resolves to a real file
path in the prompt the same way a typed path does. That silently bypasses
the pdf-to-md subagent entirely: no OCR of embedded images, no Turkish-
character guarantees, and no [claude-ecosystem:pdf-to-md ran] marker, even
though the plugin's whole point is that PDFs go through that pipeline.

Blocking is enforced here, at the tool level, rather than only asked for in
the pdf-to-md agent's own instructions, because instructions compete with
Read's built-in capability and can lose -- a model that already "can" read
the PDF has no structural reason to delegate instead. This hook removes
that option so delegating is the only path.

Reads the PreToolUse hook JSON from stdin. Exit code 2 blocks the tool call
and shows stderr back to Claude as feedback it can act on; exit 0 allows it.
"""

import json
import sys


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        # Malformed/unexpected hook input: fail open rather than blocking
        # something we can't actually evaluate.
        return 0

    if payload.get("tool_name") != "Read":
        return 0

    file_path = (payload.get("tool_input") or {}).get("file_path", "")
    if not isinstance(file_path, str) or not file_path.lower().endswith(".pdf"):
        return 0

    print(
        "Blocked: do not use the Read tool on .pdf files directly, even "
        "though Read has native PDF support. Delegate to the pdf-to-md "
        "subagent instead -- it runs OCR on embedded images and guarantees "
        "correct Turkish-character extraction, which Read's built-in PDF "
        "reader does not. Pass this exact file path to that subagent.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
