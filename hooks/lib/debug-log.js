const fs = require("fs");
const os = require("os");
const path = require("path");

function debugLogPath() {
  return path.join(os.tmpdir(), "claude-ecosystem-hook-errors.log");
}

// Hooks always swallow errors so a bug here can never block the harness.
// This gives those swallowed errors a trail instead of vanishing silently.
function logHookError(source, err) {
  try {
    const line = `${new Date().toISOString()} [${source}] ${err && err.stack ? err.stack : err}\n`;
    fs.appendFileSync(debugLogPath(), line, "utf8");
  } catch {
    // nothing more we can do
  }
}

module.exports = { logHookError, debugLogPath };
