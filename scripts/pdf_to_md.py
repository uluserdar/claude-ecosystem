#!/usr/bin/env python3
"""Convert a PDF file to Markdown, OCR'ing any text embedded in images.

Direct text extraction is tried first (fast, exact). If a page's extracted
text looks garbled -- for example a font with a broken character map -- the
page is re-rendered to an image and OCR'd instead. Text found inside
embedded images is OCR'd separately and inserted inline; the images
themselves are never saved and no captions or links are added.

Usage:
    python pdf_to_md.py <path-to-pdf>

On success, prints the full Markdown to stdout and exits 0.
On failure, prints a single line starting with "ERROR: " to stderr and
exits 1. This script never dumps a raw stack trace as its only output.

Two environment variables let a caller point this script at dependencies
that scripts/bootstrap.sh installed automatically (as a plugin SessionStart
hook) instead of the system Python/Tesseract install:
    PDF_TO_MD_PYLIBS_DIR    directory with `pip install --target`-installed
                            packages (PyMuPDF, pytesseract, Pillow), added to
                            sys.path before those modules are imported.
    PDF_TO_MD_TESSDATA_DIR  directory with eng.traineddata/tur.traineddata,
                            passed to Tesseract as --tessdata-dir so OCR
                            works even when the system Tesseract install has
                            no Turkish language pack.
Both are optional; when unset, the system Python packages and the system
Tesseract's own tessdata directory are used.
"""

import io
import os
import shutil
import sys
import time

DEFAULT_TIMEOUT_SECONDS = 300
OCR_LANGUAGES = "eng+tur"
GARBLED_REPLACEMENT_RATIO = 0.05
OCR_RENDER_ZOOM = 2.0  # ~144 DPI when rendering a page for whole-page OCR

# A binary installed by bootstrap.sh moments ago may not be on PATH yet in
# an already-running process: on Windows in particular, an installer's PATH
# update doesn't reach processes started earlier in the same login session
# (Claude Code included), only new ones. Check well-known install locations
# directly rather than making the user restart Claude Code after first use.
KNOWN_TESSERACT_LOCATIONS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "/opt/homebrew/bin/tesseract",
    "/usr/local/bin/tesseract",
]


class ConversionError(Exception):
    """Raised for any condition that should surface as ERROR: <reason>."""


def _log_progress(message):
    print(message, file=sys.stderr, flush=True)


def _locate_tesseract_cmd():
    """Absolute path to a just-installed tesseract binary that isn't on
    PATH yet in this process, or None if PATH resolution already works."""
    if shutil.which("tesseract"):
        return None
    for candidate in KNOWN_TESSERACT_LOCATIONS:
        if os.path.isfile(candidate):
            return candidate
    return None


def _apply_tessdata_override():
    """Point Tesseract at bootstrap.sh's own language-data copy, if present
    and complete, via the TESSDATA_PREFIX environment variable.

    This is set as an env var rather than passed as a `--tessdata-dir "..."`
    string in pytesseract's `config` kwarg because pytesseract splits that
    string on whitespace without shell-style quote handling: a quoted path
    comes out with the literal quote characters still attached (breaking
    the path) rather than being treated as one token. TESSDATA_PREFIX has
    no such issue and needs no quoting.
    """
    tessdata_dir = os.environ.get("PDF_TO_MD_TESSDATA_DIR")
    if not tessdata_dir:
        return
    if not (
        os.path.isfile(os.path.join(tessdata_dir, "eng.traineddata"))
        and os.path.isfile(os.path.join(tessdata_dir, "tur.traineddata"))
    ):
        return
    os.environ["TESSDATA_PREFIX"] = tessdata_dir


def _import_dependencies():
    pylibs_dir = os.environ.get("PDF_TO_MD_PYLIBS_DIR")
    if pylibs_dir and os.path.isdir(pylibs_dir) and pylibs_dir not in sys.path:
        sys.path.insert(0, pylibs_dir)

    setup_hint = (
        "Run scripts/bootstrap.sh, or install manually: pip install -r requirements.txt"
    )

    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise ConversionError(f"PyMuPDF is not installed. {setup_hint}") from exc

    try:
        import pytesseract
    except ImportError as exc:
        raise ConversionError(f"pytesseract is not installed. {setup_hint}") from exc

    tesseract_cmd = _locate_tesseract_cmd()
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    try:
        from PIL import Image
    except ImportError as exc:
        raise ConversionError(f"Pillow is not installed. {setup_hint}") from exc

    return fitz, pytesseract, Image


def _is_garbled(text):
    """Heuristic: a high ratio of replacement/control characters means the
    PDF's font has a broken character map and direct extraction can't be
    trusted for this page."""
    if not text:
        return False
    bad = sum(1 for ch in text if ch == "�" or (ord(ch) < 32 and ch not in "\n\r\t"))
    return bad / len(text) > GARBLED_REPLACEMENT_RATIO


_turkish_availability_checked = False


def _ensure_turkish_language_available(pytesseract):
    """Some Tesseract builds don't error when a requested language's data is
    missing -- they silently OCR with whatever languages ARE available and
    return plausible-looking but wrong text (observed directly: with no
    tur.traineddata anywhere, `lang="eng+tur"` returned English-only text
    misreading every Turkish character, with no error or warning at all).
    Checking language availability ourselves, once, makes a missing Turkish
    pack a clear ERROR instead of silently wrong output the user might not
    notice.
    """
    global _turkish_availability_checked
    if _turkish_availability_checked:
        return
    try:
        available = set(pytesseract.get_languages(config=""))
    except Exception:
        # If Tesseract itself is broken/missing, image_to_string below will
        # raise a clearer, specific error -- nothing more to check here.
        return
    if "tur" not in available:
        raise ConversionError(
            "Tesseract is missing the Turkish (\"tur\") language pack "
            f"(available: {', '.join(sorted(available)) or 'none'}). "
            "Run scripts/bootstrap.sh, or see README.md for manual install "
            "instructions."
        )
    _turkish_availability_checked = True


def _ocr_image_bytes(pytesseract, Image, image_bytes):
    _apply_tessdata_override()
    _ensure_turkish_language_available(pytesseract)
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = img.convert("RGB")
        try:
            text = pytesseract.image_to_string(img, lang=OCR_LANGUAGES)
        except Exception as exc:  # pytesseract wraps Tesseract's own errors
            message = str(exc)
            if "is not installed" in message or "tesseract is not installed" in message.lower():
                raise ConversionError(
                    "Tesseract OCR is not installed or not on PATH. "
                    "It should install automatically the next time the plugin's "
                    "SessionStart hook runs (scripts/bootstrap.sh); if it doesn't, "
                    "see README.md for manual install instructions."
                ) from exc
            if "Failed loading language" in message or "tur.traineddata" in message:
                raise ConversionError(
                    "Tesseract is missing the Turkish (\"tur\") language pack, and "
                    "no PDF_TO_MD_TESSDATA_DIR fallback copy was found either. "
                    "Run scripts/bootstrap.sh, or see README.md for manual install "
                    "instructions."
                ) from exc
            raise ConversionError(f"OCR failed: {message}") from exc
    return text.strip()


def _open_document(fitz, pdf_path):
    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:
        raise ConversionError(f"Could not open PDF (corrupted or unreadable): {exc}") from exc

    if doc.is_encrypted:
        if not doc.authenticate(""):
            raise ConversionError(
                "PDF is password-protected/encrypted and could not be opened with an empty password."
            )

    if doc.page_count == 0:
        raise ConversionError("PDF has no pages.")

    return doc


def convert_pdf_to_markdown(pdf_path, timeout_seconds=DEFAULT_TIMEOUT_SECONDS):
    """Convert pdf_path to a Markdown string. Raises ConversionError on failure."""
    fitz, pytesseract, Image = _import_dependencies()

    if not os.path.isfile(pdf_path):
        raise ConversionError(f"File not found: {pdf_path}")
    if not pdf_path.lower().endswith(".pdf"):
        raise ConversionError(f"Not a .pdf file: {pdf_path}")

    doc = _open_document(fitz, pdf_path)
    start_time = time.monotonic()
    total_pages = doc.page_count
    title = os.path.splitext(os.path.basename(pdf_path))[0]
    sections = [f"# {title}", ""]

    for page_index in range(total_pages):
        elapsed = time.monotonic() - start_time
        if elapsed > timeout_seconds:
            doc.close()
            raise ConversionError(
                f"processing timed out after {timeout_seconds}s "
                f"({page_index} of {total_pages} pages completed)"
            )

        _log_progress(f"Processing page {page_index + 1}/{total_pages}...")
        page = doc.load_page(page_index)
        sections.append(f"## Page {page_index + 1}")
        sections.append("")

        raw_text = page.get_text("text")
        page_was_ocrd = False

        if _is_garbled(raw_text):
            _log_progress(
                f"Page {page_index + 1}: extracted text looks garbled, falling back to OCR"
            )
            pix = page.get_pixmap(matrix=fitz.Matrix(OCR_RENDER_ZOOM, OCR_RENDER_ZOOM))
            ocr_text = _ocr_image_bytes(pytesseract, Image, pix.tobytes("png"))
            sections.append(ocr_text)
            page_was_ocrd = True
        else:
            sections.append(raw_text.strip())

        sections.append("")

        # OCR text embedded in images on this page, unless the whole page
        # was already rendered and OCR'd above (which would duplicate it).
        if not page_was_ocrd:
            for image_info in page.get_images(full=True):
                xref = image_info[0]
                try:
                    extracted = doc.extract_image(xref)
                except Exception:
                    continue
                image_bytes = extracted.get("image")
                if not image_bytes:
                    continue
                try:
                    image_text = _ocr_image_bytes(pytesseract, Image, image_bytes)
                except ConversionError:
                    raise
                if image_text:
                    sections.append(image_text)
                    sections.append("")

    doc.close()
    markdown = "\n".join(sections).rstrip() + "\n"
    return markdown


def main(argv):
    if len(argv) != 2:
        print("ERROR: usage: pdf_to_md.py <path-to-pdf>", file=sys.stderr)
        return 1

    pdf_path = argv[1]
    timeout_seconds = int(os.environ.get("PDF_TO_MD_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))

    try:
        markdown = convert_pdf_to_markdown(pdf_path, timeout_seconds=timeout_seconds)
    except ConversionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # last-resort guard: never let a raw traceback be the only output
        print(f"ERROR: unexpected failure during conversion: {exc}", file=sys.stderr)
        return 1

    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(markdown)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
