#!/usr/bin/env python3
"""Generates examples/sample-turkish.pdf.

Run this to regenerate the sample fixture used to smoke-test the pdf-to-md
agent. The PDF has two pages:
  1. A real, selectable text layer containing Turkish characters
     (ı, ğ, ü, ş, ö, ç, İ), to exercise direct text extraction.
  2. An embedded PNG image with Turkish text drawn onto it (no selectable
     text layer for that part), to exercise the OCR path.

Usage:
    python examples/generate_sample_pdf.py
"""

import io
import os

import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageFont

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "sample-turkish.pdf")

TEXT_LAYER_SENTENCE = (
    "Turkce karakterler: ıİğĞüÜşŞöÖçÇ - Istanbul'da guzel bir gunbatimi."
)
# Real Turkish sentence with every special character, used as the
# selectable text layer on page 1.
TEXT_LAYER_TURKISH = (
    "Bu bir örnek belgedir. Türkçe karakterleri içerir: ı, İ, ğ, Ğ, ü, Ü, "
    "ş, Ş, ö, Ö, ç, Ç. Yağmur yağıyor ve İstanbul'da hava çok güzel."
)

IMAGE_TEXT = "Görüntü içindeki yazı: çilek, öğrenci, İzmir, şeker, güneş."


def _find_unicode_font():
    """Best-effort search for a TrueType font with Turkish glyph coverage."""
    candidates = [
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def build_image_with_text():
    font_path = _find_unicode_font()
    width, height = 900, 200
    img = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path, 36) if font_path else ImageFont.load_default()
    draw.text((20, 80), IMAGE_TEXT, fill="black", font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main():
    doc = fitz.open()

    # Page 1: real selectable Turkish text. The base-14 Helvetica font
    # ("helv") has no glyphs for ı/İ/ğ/Ğ/ş/Ş, so a Unicode TrueType font
    # must be embedded or those characters get mangled at PDF-creation
    # time, before extraction is even involved.
    font_path = _find_unicode_font()
    if not font_path:
        raise SystemExit(
            "No Unicode TrueType font found (checked Arial/Calibri/DejaVu/"
            "Liberation). Install one or add its path to _find_unicode_font()."
        )
    page1 = doc.new_page()
    page1.insert_text(
        (50, 100),
        TEXT_LAYER_TURKISH,
        fontsize=14,
        fontfile=font_path,
        fontname="F0",
    )

    # Page 2: an embedded image containing Turkish text, no text layer.
    page2 = doc.new_page()
    image_bytes = build_image_with_text()
    rect = fitz.Rect(50, 100, 750, 260)
    page2.insert_image(rect, stream=image_bytes)

    doc.save(OUTPUT_PATH)
    doc.close()
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
