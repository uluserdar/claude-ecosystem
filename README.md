# claude-ecosystem

A personal, growing collection of [Claude Code](https://code.claude.com) agents and skills, distributed as a plugin/marketplace.

## What's in here right now

**`pdf-to-md`** — a subagent that converts a PDF file to Markdown:

- Extracts real text directly from the PDF when possible.
- Falls back to OCR (per page) when a page's extracted text looks corrupted
  or garbled, e.g. because of a broken font character map.
- Runs OCR on any text embedded inside images in the PDF and inlines that
  text into the Markdown output. Images themselves are never saved, and no
  captions or links are added — only the recognized text.
- Fully supports Turkish characters (`ı ğ ü ş ö ç İ`) end to end: UTF-8
  throughout, and OCR runs with both English and Turkish language data
  (`eng+tur`).
- Returns the **complete** Markdown text to the calling agent — never
  summarized or truncated.
- Runs on the `haiku` model, since it only orchestrates a deterministic
  Python script (`scripts/pdf_to_md.py`) rather than doing the text
  understanding itself.

## Prerequisites

- **Python 3.9+** (developed and tested against 3.11).
- **Tesseract OCR**, with the Turkish (`tur`) language pack, on your `PATH`.
  Only needed for the OCR fallback path — plain text-layer PDFs work without
  it.

Install Tesseract + the Turkish language pack:

| Platform | Command |
| --- | --- |
| macOS (Homebrew) | `brew install tesseract tesseract-lang` |
| Debian / Ubuntu | `sudo apt-get install tesseract-ocr tesseract-ocr-tur` |
| Fedora | `sudo dnf install tesseract tesseract-langpack-tur` |
| Windows | `winget install --id UB-Mannheim.TesseractOCR`, or download the installer from the [UB-Mannheim Tesseract wiki](https://github.com/UB-Mannheim/tesseract/wiki) and select the Turkish language component during setup |

Package names occasionally change between distro versions — if a command
above fails, search your package manager for `tesseract` and the language
pack separately (e.g. `apt search tesseract-ocr-tur`).

Then install the pinned Python dependencies and verify the Tesseract setup:

```bash
./install.sh
```

`install.sh` installs `requirements.txt` and checks that `tesseract` and its
Turkish language data are on `PATH`, printing platform-specific install
instructions if either is missing.

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
page 2.

You can also run the conversion script directly, without Claude Code, and
run the Turkish round-trip check:

```bash
python scripts/pdf_to_md.py examples/sample-turkish.pdf
python scripts/test_turkish_roundtrip.py
```

## How it works

`agents/pdf-to-md.md` defines the subagent: it validates the input path,
shells out to `scripts/pdf_to_md.py`, and passes the script's output straight
through (or forwards an `ERROR: ...` message on failure). All the actual PDF
parsing, text-extraction, garbled-text detection, and OCR logic lives in the
Python script, not in the model — this keeps conversion deterministic and
keeps a cheap model (`haiku`) sufficient for the agent itself.

`scripts/pdf_to_md.py` uses [PyMuPDF](https://pymupdf.readthedocs.io/) for
both text extraction and page rendering (no separate Poppler/`pdf2image`
dependency is needed), and [pytesseract](https://github.com/madmaze/pytesseract)
for OCR.

**Timeout / large documents:** the script tracks wall-clock time across
pages and aborts with `ERROR: processing timed out after <N>s ...` if a
conversion exceeds `PDF_TO_MD_TIMEOUT_SECONDS` (default 300 seconds). It also
logs `Processing page X/N...` to stderr for each page, so a long-running
conversion is visible rather than looking hung.

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
change for a new agent or skill to be discovered.

## License

MIT — see [LICENSE](LICENSE).
