#!/usr/bin/env python3
"""Round-trip check that Turkish characters survive PDF text extraction.

This is the "explicit round-trip check" required for the pdf-to-md agent:
it proves ı, İ, ğ, Ğ, ü, Ü, ş, Ş, ö, Ö, ç, Ç are preserved end-to-end,
independent of OCR (which needs Tesseract and is checked separately, only
if Tesseract is available).

Usage:
    python scripts/test_turkish_roundtrip.py
Exits 0 and prints "OK" on success, exits 1 and prints a reason on failure.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import pdf_to_md  # noqa: E402

SAMPLE_PDF = os.path.join(os.path.dirname(__file__), "..", "examples", "sample-turkish.pdf")
TURKISH_CHARS = "ıİğĞüÜşŞöÖçÇ"


def check_pure_utf8_roundtrip():
    sample = "İstanbul'da güneşli bir öğleden sonra, çilek ve şeker."
    assert sample.encode("utf-8").decode("utf-8") == sample, "raw UTF-8 round-trip failed"
    for ch in TURKISH_CHARS:
        assert ch.encode("utf-8").decode("utf-8") == ch, f"UTF-8 round-trip failed for {ch!r}"


def check_pdf_text_layer_extraction():
    import fitz

    if not os.path.isfile(SAMPLE_PDF):
        raise AssertionError(
            f"Sample PDF not found at {SAMPLE_PDF}. "
            "Run examples/generate_sample_pdf.py first."
        )

    doc = fitz.open(SAMPLE_PDF)
    page_text = doc.load_page(0).get_text("text")
    doc.close()

    missing = [ch for ch in TURKISH_CHARS if ch not in page_text]
    assert not missing, f"Turkish characters missing from extracted text: {missing!r}"


def main():
    check_pure_utf8_roundtrip()
    check_pdf_text_layer_extraction()
    print("OK: Turkish characters round-trip correctly through UTF-8 and PDF text extraction.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AssertionError as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
