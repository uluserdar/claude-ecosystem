const fs = require("fs");
const path = require("path");

function settingsPath(cwd) {
  return path.join(cwd, ".claude", "claude-ecosystem-settings.json");
}

function isTrackingEnabled(cwd) {
  try {
    const raw = fs.readFileSync(settingsPath(cwd), "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.usageTracking?.enabled === true;
  } catch {
    return false;
  }
}

// Scaffolds .claude/claude-ecosystem-settings.json with tracking OFF if it
// doesn't exist yet. Never overwrites an existing file — opt-in stays
// opt-in; this only saves the user from hand-writing the file's shape.
function ensureSettingsScaffold(cwd) {
  const file = settingsPath(cwd);
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ usageTracking: { enabled: false } }, null, 2)}\n`, "utf8");
}

module.exports = { isTrackingEnabled, ensureSettingsScaffold };
