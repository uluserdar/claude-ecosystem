const fs = require("fs");
const path = require("path");

function logDir(cwd) {
  return path.join(cwd, "docs", "usage-logs");
}

function logFilePath(cwd, date) {
  const isoDate = date.toISOString().slice(0, 10);
  return path.join(logDir(cwd), `${isoDate}.jsonl`);
}

function appendLogEntry(cwd, entry) {
  const dir = logDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const file = logFilePath(cwd, new Date(entry.time));
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
}

function listLogFiles(cwd) {
  const dir = logDir(cwd);
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

module.exports = { logDir, logFilePath, appendLogEntry, listLogFiles };
