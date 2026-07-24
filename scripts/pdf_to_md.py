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
"""

import io
import os
import sys
import time

DEFAULT_TIMEOUT_SECONDS = 300
OCR_LANGUAGES = "eng+tur"
GARBLED_REPLACEMENT_RATIO = 0.05
OCR_RENDER_ZOOM = 2.0  # ~144 DPI when rendering a page for whole-page OCR


class ConversionError(Exception):
    """Raised for any condition that should surface as ERROR: <reason>."""


def _log_progress(message):
    print(message, file=sys.stderr, flush=True)


def _import_dependencies():
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise ConversionError(
            "PyMuPDF is not installed. Run: pip install -r requirements.txt"
        ) from exc

    try:
        import pytesseract
    except ImportError as exc:
        raise ConversionError(
            "pytesseract is not installed. Run: pip install -r requirements.txt"
        ) from exc

    try:
        from PIL import Image
    except ImportError as exc:
        raise ConversionError(
            "Pillow is not installed. Run: pip install -r requirements.txt"
        ) from exc

    return fitz, pytesseract, Image


def _is_garbled(text):
    """Heuristic: a high ratio of replacement/control characters means the
    PDF's font has a broken character map and direct extraction can't be
    trusted for this page."""
    if not text:
        return False
    bad = sum(1 for ch in text if ch == "�" or (ord(ch) < 32 and ch not in "\n\r\t"))
    return bad / len(text) > GARBLED_REPLACEMENT_RATIO


def _ocr_image_bytes(pytesseract, Image, image_bytes):
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = img.convert("RGB")
        try:
            text = pytesseract.image_to_string(img, lang=OCR_LANGUAGES)
        except Exception as exc:  # pytesseract wraps Tesseract's own errors
            message = str(exc)
            if "is not installed" in message or "tesseract is not installed" in message.lower():
                raise ConversionError(
                    "Tesseract OCR is not installed or not on PATH. "
                    "See README.md for platform-specific install instructions."
                ) from exc
            if "Failed loading language" in message or "tur.traineddata" in message:
                raise ConversionError(
                    "Tesseract is missing the Turkish (\"tur\") language pack. "
                    "See README.md for how to install it on your platform."
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
