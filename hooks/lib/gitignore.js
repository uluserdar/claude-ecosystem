const fs = require("fs");
const path = require("path");

const SECTION_HEADER = "# claude-ecosystem plugin";
const MANAGED_ENTRIES = ["docs/usage-logs/", "docs/tickets/"];

function isGitRepo(cwd) {
  return fs.existsSync(path.join(cwd, ".git"));
}

// Idempotently appends any of MANAGED_ENTRIES missing from the project's
// .gitignore, under a single shared section header. Never touches
// unrelated lines. No-ops outside a git repo.
function ensureGitignoreEntries(cwd) {
  if (!isGitRepo(cwd)) return;

  const gitignorePath = path.join(cwd, ".gitignore");
  let existing = "";
  try {
    existing = fs.readFileSync(gitignorePath, "utf8");
  } catch {
    existing = "";
  }

  const existingLines = new Set(existing.split("\n").map((l) => l.trim()));
  const missing = MANAGED_ENTRIES.filter((entry) => !existingLines.has(entry));
  if (missing.length === 0) return;

  const hasHeader = existingLines.has(SECTION_HEADER);
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  const block = `${hasHeader ? "" : `${SECTION_HEADER}\n`}${missing.join("\n")}\n`;
  fs.appendFileSync(gitignorePath, `${prefix}${existing.length > 0 ? "\n" : ""}${block}`, "utf8");
}

module.exports = { ensureGitignoreEntries, MANAGED_ENTRIES };
