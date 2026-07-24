#!/usr/bin/env bash
# Auto-setup for the pdf-to-md agent. Runs automatically as a SessionStart
# hook when the plugin is enabled -- the user never has to run this by hand.
#
# It makes sure three things exist, all inside CLAUDE_PLUGIN_DATA (a
# per-plugin directory the user already owns, so nothing here needs admin
# rights):
#   1. The pinned Python packages (PyMuPDF, pytesseract, Pillow), installed
#      with `pip install --target` rather than into the system Python.
#   2. The Tesseract OCR *binary* on PATH, installed via the platform
#      package manager if missing.
#   3. eng.traineddata and tur.traineddata, downloaded straight from the
#      tessdata_fast project and pointed to with --tessdata-dir at OCR time.
#      This sidesteps a real limitation: the Windows Tesseract installer
#      can't select language components in silent mode (confirmed via
#      https://github.com/UB-Mannheim/tesseract/issues/91), so relying on
#      the package manager for the Turkish language pack is unreliable on
#      Windows. Managing our own copy works identically on every platform.
#
# Every step is idempotent (checked via a cache file or `if already there,
# skip`) and never exits non-zero, so a slow first run doesn't repeat on
# every session and a failed step never blocks Claude Code from starting.
# Failures print a clear one-line message and move on.

set -u

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-${PLUGIN_ROOT}/.plugin-data}"
PYLIBS_DIR="${DATA_DIR}/pylibs"
TESSDATA_DIR="${DATA_DIR}/tessdata"
REQ_FILE="${PLUGIN_ROOT}/requirements.txt"
REQ_CACHE="${DATA_DIR}/requirements.txt"
TESSDATA_BASE_URL="https://github.com/tesseract-ocr/tessdata_fast/raw/main"

mkdir -p "${DATA_DIR}"

log() { echo "pdf-to-md setup: $*"; }

# --- 1. Python dependencies -------------------------------------------------
install_python_deps() {
  if [ -f "${REQ_CACHE}" ] && diff -q "${REQ_FILE}" "${REQ_CACHE}" >/dev/null 2>&1; then
    return 0
  fi
  local python_bin
  python_bin="$(command -v python3 || command -v python || true)"
  if [ -z "${python_bin}" ]; then
    log "WARNING - no python/python3 on PATH. Install Python 3.9+ to use this agent."
    return 1
  fi
  log "installing Python dependencies into ${PYLIBS_DIR} ..."
  # --no-user overrides a global "install.user = yes" pip config, which
  # otherwise conflicts with --target ("Can not combine '--user' and
  # '--target'") regardless of anything this script sets itself.
  if "${python_bin}" -m pip install --quiet --disable-pip-version-check \
      --no-user --target "${PYLIBS_DIR}" -r "${REQ_FILE}"; then
    cp "${REQ_FILE}" "${REQ_CACHE}"
    log "Python dependencies ready."
  else
    log "WARNING - pip install failed. Run manually: ${python_bin} -m pip install -r \"${REQ_FILE}\""
  fi
}

# --- 2. Tesseract binary -----------------------------------------------------
install_tesseract_binary() {
  if command -v tesseract >/dev/null 2>&1; then
    return 0
  fi
  log "Tesseract OCR not found; attempting automatic install..."
  local log_file="${DATA_DIR}/tesseract-install.log"

  case "$(uname -s 2>/dev/null)" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        if brew install tesseract >"${log_file}" 2>&1; then
          log "Tesseract installed via Homebrew."
        else
          log "WARNING - 'brew install tesseract' failed. See ${log_file}, or install manually."
        fi
      else
        log "WARNING - Homebrew not found. Install manually: brew install tesseract"
      fi
      ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        if sudo -n true 2>/dev/null; then
          sudo apt-get install -y tesseract-ocr >"${log_file}" 2>&1 \
            && log "Tesseract installed via apt-get." \
            || log "WARNING - apt-get install failed. See ${log_file}."
        else
          log "WARNING - Tesseract missing and passwordless sudo isn't available. Install manually: sudo apt-get install tesseract-ocr"
        fi
      elif command -v dnf >/dev/null 2>&1; then
        if sudo -n true 2>/dev/null; then
          sudo dnf install -y tesseract >"${log_file}" 2>&1 \
            && log "Tesseract installed via dnf." \
            || log "WARNING - dnf install failed. See ${log_file}."
        else
          log "WARNING - Tesseract missing and passwordless sudo isn't available. Install manually: sudo dnf install tesseract"
        fi
      else
        log "WARNING - no supported package manager (apt-get/dnf) found. Install Tesseract manually."
      fi
      ;;
    *)
      # Git Bash/MSYS on Windows reports MINGW*/MSYS* here, not "Windows".
      local winget_bin
      winget_bin="$(command -v winget.exe || command -v winget || true)"
      if [ -n "${winget_bin}" ]; then
        if "${winget_bin}" install --id UB-Mannheim.TesseractOCR -e --silent \
            --accept-source-agreements --accept-package-agreements >"${log_file}" 2>&1; then
          log "Tesseract installed via winget."
        else
          log "WARNING - winget install failed. See ${log_file}, or install manually: https://github.com/UB-Mannheim/tesseract/wiki"
        fi
      else
        log "WARNING - winget not found. Install manually: https://github.com/UB-Mannheim/tesseract/wiki"
      fi
      ;;
  esac
}

# --- 3. Language data (our own copy, used via --tessdata-dir) --------------
download_traineddata() {
  local lang="$1"
  local dest="${TESSDATA_DIR}/${lang}.traineddata"
  [ -f "${dest}" ] && return 0

  local fetcher=""
  if command -v curl >/dev/null 2>&1; then
    fetcher="curl"
  elif command -v wget >/dev/null 2>&1; then
    fetcher="wget"
  fi

  mkdir -p "${TESSDATA_DIR}"
  local tmp="${dest}.part"
  local ok=1
  if [ "${fetcher}" = "curl" ]; then
    curl -fsSL "${TESSDATA_BASE_URL}/${lang}.traineddata" -o "${tmp}" && ok=0
  elif [ "${fetcher}" = "wget" ]; then
    wget -q "${TESSDATA_BASE_URL}/${lang}.traineddata" -O "${tmp}" && ok=0
  else
    log "WARNING - neither curl nor wget found; can't download ${lang}.traineddata."
    return 1
  fi

  if [ "${ok}" -eq 0 ] && [ -s "${tmp}" ]; then
    mv "${tmp}" "${dest}"
    log "downloaded ${lang}.traineddata."
  else
    rm -f "${tmp}"
    log "WARNING - failed to download ${lang}.traineddata from ${TESSDATA_BASE_URL}."
    return 1
  fi
}

install_python_deps
install_tesseract_binary
download_traineddata "eng"
download_traineddata "tur"

if command -v tesseract >/dev/null 2>&1 && [ -f "${TESSDATA_DIR}/eng.traineddata" ] && [ -f "${TESSDATA_DIR}/tur.traineddata" ]; then
  log "ready (Tesseract + English/Turkish language data)."
else
  log "setup incomplete -- OCR of embedded images may fail until the warnings above are resolved."
fi

exit 0
