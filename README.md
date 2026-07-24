# claude-ecosystem

A personal, growing collection of [Claude Code](https://code.claude.com) agents and skills, distributed as a plugin/marketplace.

## What's in here right now

**`pdf-to-md`** — a subagent that converts PDF files to Markdown:

- Converts **one or more PDFs in a single request** — type/paste several
  paths, or attach multiple PDFs through the chat UI. Each file is
  converted independently, so one bad file doesn't stop the rest.
- Handles **only** `.pdf` files. If a request mixes PDFs with other file
  types (`.docx`, `.txt`, images, ...), only the `.pdf` paths go to this
  subagent — the rest stay with the calling agent to handle directly.
- Extracts real text directly from the PDF when possible.
- Falls back to OCR (per page) when a page's extracted text looks corrupted
  or garbled, e.g. because of a broken font character map.
- Runs OCR on any text embedded inside images in the PDF and inlines that
  text into the Markdown output. Images themselves are never saved, and no
  captions or links are added — only the recognized text.
- Fully supports Turkish characters (`ı ğ ü ş ö ç İ`) end to end: UTF-8
  throughout, and OCR runs with both English and Turkish language data
  (`eng+tur`).
- Returns the **complete** Markdown text for every file to the calling
  agent — never summarized or truncated, and a failure on one file never
  suppresses the results of the others.
- Runs on the `haiku` model, since it only orchestrates a deterministic
  Python script (`scripts/pdf_to_md.py`) rather than doing the text
  understanding itself.

## Setup: fully automatic

**You don't need to install or run anything by hand.** The moment this
plugin is enabled, a `SessionStart` hook (`hooks/hooks.json` →
`scripts/bootstrap.sh`) runs automatically and:

1. Installs the pinned Python packages (PyMuPDF, pytesseract, Pillow) into
   the plugin's own data directory — not your system Python.
2. Installs the Tesseract OCR binary via your platform's package manager
   (winget / Homebrew / apt / dnf) if it isn't already on `PATH`.
3. Downloads English and Turkish language data
   (`eng.traineddata`, `tur.traineddata`) into the plugin's own data
   directory and points OCR at that copy directly.

Step 3 exists because the Windows Tesseract installer [can't select
language components in silent/unattended mode](https://github.com/UB-Mannheim/tesseract/issues/91)
— so relying on the system package manager for the Turkish language pack
specifically is unreliable on Windows. Managing our own copy sidesteps
that entirely and works identically on every platform.

Every step is idempotent and cached, so only the very first session after
install does any real work; every session after that is a fast no-op check.
Nothing here needs admin/root rights — everything installs into
`${CLAUDE_PLUGIN_DATA}` (a directory you already own), except the Tesseract
binary itself, which needs your platform's normal package-manager
permissions (passwordless on macOS/Windows via Homebrew/winget; on Linux,
only if passwordless `sudo` is available, otherwise you'll see a one-line
warning with the manual install command).

If a step can't complete automatically (no package manager found, no
`sudo`, offline, etc.), you'll see a `pdf-to-md setup: WARNING - ...` line
with the exact manual command to run instead — nothing fails silently.

**Manual / standalone setup** (only if you're working with this repo
outside Claude Code, or troubleshooting): run `./install.sh`, which calls
the same `scripts/bootstrap.sh` logic against this checkout directly.

**Prerequisite:** Python 3.9+ needs to already be on `PATH` — bootstrapping
Python itself is out of scope.

## Install this plugin in Claude Code

Once this repo is pushed to GitHub (see below), add it as a marketplace and
install the plugin from it:

```
/plugin marketplace add <your-github-username>/claude-ecosystem
/plugin install claude-ecosystem@claude-ecosystem
/reload-plugins
```

Or from the CLI, non-interactively:

```bash
claude plugin marketplace add <your-github-username>/claude-ecosystem
claude plugin install claude-ecosystem@claude-ecosystem
```

To test locally before pushing anywhere, point at the folder directly:

```
/plugin marketplace add ./claude-ecosystem
/plugin install claude-ecosystem@claude-ecosystem
```

## Verify the install

A sample PDF with Turkish text (both a real text layer and an embedded
image containing Turkish text) is included at `examples/sample-turkish.pdf`.
See `examples/generate_sample_pdf.py` for how it was generated.

After installing, ask Claude Code to convert it:

```
Convert examples/sample-turkish.pdf to markdown
```

Claude should delegate to the `pdf-to-md` subagent and return the full
Markdown content, including OCR'd Turkish text from the embedded image on
page 2. Try it with more than one file too (e.g. attach the same PDF twice,
or point at two different PDFs) to see the multi-file output.

You can also run the conversion script directly, without Claude Code, after
running `./install.sh`:

```bash
./install.sh
PDF_TO_MD_PYLIBS_DIR="$(pwd)/.plugin-data/pylibs" \
PDF_TO_MD_TESSDATA_DIR="$(pwd)/.plugin-data/tessdata" \
  python scripts/pdf_to_md.py examples/sample-turkish.pdf
# or several at once:
  python scripts/pdf_to_md.py examples/sample-turkish.pdf examples/sample-turkish.pdf

PDF_TO_MD_PYLIBS_DIR="$(pwd)/.plugin-data/pylibs" \
PDF_TO_MD_TESSDATA_DIR="$(pwd)/.plugin-data/tessdata" \
  python scripts/test_turkish_roundtrip.py
```

## How it works

`agents/pdf-to-md.md` defines the subagent: it filters the paths it was
given down to just `.pdf` files (leaving anything else for the calling
agent), validates each one exists, shells out to `scripts/pdf_to_md.py`
with all of them in a single invocation (pointing it at the auto-installed
dependencies via two environment variables), and passes the script's output
straight through per file. All the actual PDF parsing, text-extraction,
garbled-text detection, and OCR logic lives in the Python script, not in
the model — this keeps conversion deterministic and keeps a cheap model
(`haiku`) sufficient for the agent itself.

`pdf_to_md.py` accepts one or more paths on the command line and converts
each independently, so a single corrupted/encrypted/timed-out file doesn't
block the rest of the batch. It prints one delimited block per file:

```
===PDF-TO-MD-FILE-START===<path>
STATUS: OK
<the full Markdown for this file>
===PDF-TO-MD-FILE-END===
```

(or `STATUS: ERROR` followed by that file's error message). The agent
parses strictly on those marker lines — never on Markdown-looking content —
since a converted document can itself contain lines that look like headers
or separators.

`scripts/pdf_to_md.py` uses [PyMuPDF](https://pymupdf.readthedocs.io/) for
both text extraction and page rendering (no separate Poppler/`pdf2image`
dependency is needed), and [pytesseract](https://github.com/madmaze/pytesseract)
for OCR. Two environment variables (set automatically by the agent, and
produced by `scripts/bootstrap.sh`) let it use the auto-installed
dependencies instead of whatever is on the system:

| Variable | Purpose |
| --- | --- |
| `PDF_TO_MD_PYLIBS_DIR` | Added to `sys.path` before importing PyMuPDF/pytesseract/Pillow |
| `PDF_TO_MD_TESSDATA_DIR` | Set as `TESSDATA_PREFIX` so OCR uses the bundled `eng`+`tur` language data |

The script also checks a couple of well-known install paths directly if
`tesseract` isn't resolvable via `PATH` yet — on Windows, a just-installed
binary's `PATH` update doesn't reach a process (Claude Code included) that
was already running before the install happened, only new ones, so waiting
for `shutil.which` alone would fail on the very first use after install.

Before running OCR, the script also proactively checks that the Turkish
language pack is actually available (`pytesseract.get_languages()`) rather
than trusting Tesseract to error when it's missing — some Tesseract builds
silently OCR with only the languages that *are* available and return
plausible-but-wrong text with no warning at all when `tur` is absent. This
check turns that into an explicit `ERROR:` instead.

**Timeout / large documents:** the script tracks wall-clock time across
pages and aborts that file with `ERROR: processing timed out after <N>s ...`
if it exceeds `PDF_TO_MD_TIMEOUT_SECONDS` (default 300 seconds) — this
budget applies **per file**, so one large document timing out doesn't eat
into the budget for the others in the same batch. It also logs
`Processing page X/N...` (and, for a multi-file batch, `File X/N: <path>`)
to stderr, so a long-running conversion is visible rather than looking hung.

## Security note

`pdf_to_md.py` parses arbitrary PDF content and runs OCR over embedded
images. Only run it against PDF files you trust — as with any file parser,
a maliciously crafted PDF is a potential attack surface.

## If the `haiku` model is deprecated

The `pdf-to-md` agent's model is set in the `model:` field of
[`agents/pdf-to-md.md`](agents/pdf-to-md.md). If the `haiku` alias is ever
retired, update that one field to the current low-cost model alias or a full
model ID — see "Choose a model" in the
[Claude Code sub-agents docs](https://code.claude.com/docs/en/sub-agents#choose-a-model).

## Roadmap

This plugin is meant to grow. To add a new agent, drop a `.md` file in
`agents/`. To add a new skill, add a `<skill-name>/SKILL.md` directory under
`skills/`. Both are picked up automatically — nothing else in
`.claude-plugin/plugin.json` or `.claude-plugin/marketplace.json` needs to
change for a new agent or skill to be discovered. If a future agent needs
its own setup, extend `hooks/hooks.json`'s `SessionStart` entry (or add a
second one) rather than asking users to run something manually.

## License

MIT — see [LICENSE](LICENSE).
