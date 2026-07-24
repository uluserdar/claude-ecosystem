#!/usr/bin/env bash
# Installs Python dependencies for the pdf-to-md agent and checks that
# Tesseract OCR (with the Turkish language pack) is available on PATH.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Installing Python dependencies from requirements.txt"
python3 -m pip install -r "${SCRIPT_DIR}/requirements.txt" || \
  python -m pip install -r "${SCRIPT_DIR}/requirements.txt"

echo "==> Checking for Tesseract OCR"
if ! command -v tesseract >/dev/null 2>&1; then
  cat <<'EOF'

ERROR: Tesseract OCR was not found on your PATH.
pdf-to-md needs it to read text embedded in images.

Install it, then re-run this script:
  macOS:            brew install tesseract tesseract-lang
  Debian/Ubuntu:     sudo apt-get install tesseract-ocr tesseract-ocr-tur
  Fedora:            sudo dnf install tesseract tesseract-langpack-tur
  Windows:           winget install --id UB-Mannheim.TesseractOCR
                      (or download the installer from
                      https://github.com/UB-Mannheim/tesseract/wiki and
                      add its install directory to PATH)

EOF
  exit 1
fi

echo "==> Checking for the Turkish ('tur') language pack"
if ! tesseract --list-langs 2>&1 | grep -qx "tur"; then
  cat <<'EOF'

ERROR: Tesseract is installed, but the Turkish ("tur") language pack is
missing. Install it, then re-run this script:
  macOS:            brew install tesseract-lang
  Debian/Ubuntu:     sudo apt-get install tesseract-ocr-tur
  Fedora:            sudo dnf install tesseract-langpack-tur
  Windows:           re-run the Tesseract installer and select the
                      Turkish language component, or copy tur.traineddata
                      into the tessdata/ folder of your Tesseract install.

EOF
  exit 1
fi

echo "==> All dependencies are installed."
echo "==> Try it: python3 scripts/pdf_to_md.py examples/sample-turkish.pdf"
