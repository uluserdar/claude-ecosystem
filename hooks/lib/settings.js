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

// Every subagent this plugin ships, keyed exactly by its own `name:`
// frontmatter — the same keys the skill/agent instructions read from
// `agentModel` when resolving which model to pass to the `Agent` tool.
const AGENT_NAMES = [
  "analyzer",
  "create-skill",
  "create-analyze",
  "plan-writer",
  "spec-writer",
  "ticket-writer",
  "skill-writer",
  "ask-me-devils-advocate",
  "ask-me-first-principles-thinker",
  "ask-me-opportunity-hunter",
  "ask-me-outside-eye",
  "ask-me-practitioner",
];

// Adds any missing `agentModel` keys (the "default" fallback plus one per
// known agent) so the user only ever has to fill in a value, never type out
// the key names themselves. Idempotent and additive only — never touches an
// existing key's value, never removes a key for an agent that no longer
// exists. Runs after ensureSettingsScaffold, so it works whether the file
// was just created or already existed.
function ensureAgentModelKeys(cwd) {
  const file = settingsPath(cwd);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return;
  }

  if (!parsed.agentModel || typeof parsed.agentModel !== "object") parsed.agentModel = {};
  let changed = false;
  if (!("default" in parsed.agentModel)) {
    parsed.agentModel.default = null;
    changed = true;
  }
  for (const name of AGENT_NAMES) {
    if (!(name in parsed.agentModel)) {
      parsed.agentModel[name] = null;
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

module.exports = { isTrackingEnabled, ensureSettingsScaffold, ensureAgentModelKeys };
