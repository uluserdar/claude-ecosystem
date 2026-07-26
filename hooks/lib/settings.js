const fs = require("fs");
const path = require("path");

function isTrackingEnabled(cwd) {
  const settingsPath = path.join(cwd, ".claude", "claude-ecosystem-settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.usageTracking?.enabled === true;
  } catch {
    return false;
  }
}

module.exports = { isTrackingEnabled };
