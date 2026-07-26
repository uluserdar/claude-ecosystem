const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { listLogFiles, logDir } = require("./log");

function key(type, name) {
  return `${type}:${name}`;
}

function emptyTotals() {
  return { count: 0, duration_ms: 0, tokens: { input: 0, output: 0, cache_creation: 0, cache_read: 0 }, lastTime: null };
}

function addTotals(totals, entry) {
  totals.count += 1;
  totals.duration_ms += entry.duration_ms || 0;
  const t = entry.tokens || {};
  totals.tokens.input += t.input || 0;
  totals.tokens.output += t.output || 0;
  totals.tokens.cache_creation += t.cache_creation || 0;
  totals.tokens.cache_read += t.cache_read || 0;
  if (entry.time && (!totals.lastTime || entry.time > totals.lastTime)) totals.lastTime = entry.time;
}

function byRecency(a, b) {
  return (b || "").localeCompare(a || "");
}

async function readEntries(filePath) {
  const entries = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip malformed line
    }
  }
  return entries;
}

function formatDuration(ms) {
  if (!ms) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function tokenCells(t) {
  return [t.input, t.output, t.cache_creation, t.cache_read].map((n) => n.toLocaleString());
}

function splitKey(k) {
  const [type, ...nameParts] = k.split(":");
  return { type, name: nameParts.join(":") };
}

function sessionDisplayName(sessionId, label) {
  const shortId = sessionId.slice(0, 8);
  return label ? `${label} (${shortId})` : shortId;
}

// Skill tool_use tracking turned out to be unreliable — the same slash-command
// invocation of the same skill produced a trackable "Skill" tool_use in some
// sessions and none at all in others (harness-level, not something these hooks
// control). session_id, by contrast, is always present on every entry. So
// group by session instead of by (unreliable) skill/parent hierarchy: for each
// session, sum every entry directly by (type, name) — no nesting, no
// fallback heuristics — which makes "sub-table total == session row" a plain
// arithmetic identity rather than something that can drift out of sync.
function buildSessionSections(entries) {
  const sessions = new Map(); // session_id -> { label, totals, byName: Map(key -> totals) }
  for (const entry of entries) {
    const sessionId = entry.session_id || "unknown";
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { label: entry.session_label || null, totals: emptyTotals(), byName: new Map() });
    }
    const session = sessions.get(sessionId);
    if (!session.label && entry.session_label) session.label = entry.session_label;
    addTotals(session.totals, entry);
    const k = key(entry.type, entry.name);
    if (!session.byName.has(k)) session.byName.set(k, emptyTotals());
    addTotals(session.byName.get(k), entry);
  }

  const rows = [...sessions.entries()]
    .map(([sessionId, s]) => ({ sessionId, ...s }))
    .sort((a, b) => byRecency(a.totals.lastTime, b.totals.lastTime));

  const lines = ["## Sessions", ""];
  if (rows.length === 0) {
    lines.push("_No usage recorded yet._");
    return lines.join("\n");
  }

  lines.push("| Session | Calls | Total Duration | Input | Output | Cache Create | Cache Read |");
  lines.push("|---|---|---|---|---|---|---|");
  const grandTotal = emptyTotals();
  for (const row of rows) {
    lines.push(
      `| ${sessionDisplayName(row.sessionId, row.label)} | ${row.totals.count} | ${formatDuration(row.totals.duration_ms)} | ${tokenCells(row.totals.tokens).join(" | ")} |`
    );
    grandTotal.count += row.totals.count;
    grandTotal.duration_ms += row.totals.duration_ms;
    grandTotal.tokens.input += row.totals.tokens.input;
    grandTotal.tokens.output += row.totals.tokens.output;
    grandTotal.tokens.cache_creation += row.totals.tokens.cache_creation;
    grandTotal.tokens.cache_read += row.totals.tokens.cache_read;
  }
  lines.push(
    `| **Total** | ${grandTotal.count} | ${formatDuration(grandTotal.duration_ms)} | ${tokenCells(grandTotal.tokens).join(" | ")} |`
  );

  for (const row of rows) {
    lines.push("", `### ${sessionDisplayName(row.sessionId, row.label)}`, "");
    lines.push("| Type | Name | Calls | Duration | Input | Output | Cache Create | Cache Read |");
    lines.push("|---|---|---|---|---|---|---|---|");
    const subRows = [...row.byName.entries()].sort((a, b) => byRecency(a[1].lastTime, b[1].lastTime));
    for (const [childKey, totals] of subRows) {
      const { type, name } = splitKey(childKey);
      lines.push(
        `| ${type} | ${name} | ${totals.count} | ${formatDuration(totals.duration_ms)} | ${tokenCells(totals.tokens).join(" | ")} |`
      );
    }
  }

  return lines.join("\n");
}

async function generateReport(cwd) {
  const files = listLogFiles(cwd);
  let entries = [];
  for (const file of files) {
    entries = entries.concat(await readEntries(file));
  }

  const generatedAt = new Date().toISOString();
  const reportPath = path.join(logDir(cwd), "plugin-usage-report.md");

  if (entries.length === 0) {
    fs.mkdirSync(logDir(cwd), { recursive: true });
    fs.writeFileSync(
      reportPath,
      `# Plugin Usage Report\n\nGenerated: ${generatedAt}\n\n_No usage data recorded yet._\n`,
      "utf8"
    );
    return reportPath;
  }

  const content = `# Plugin Usage Report

Generated: ${generatedAt}

${buildSessionSections(entries)}
`;

  fs.mkdirSync(logDir(cwd), { recursive: true });
  fs.writeFileSync(reportPath, content, "utf8");
  return reportPath;
}

module.exports = { generateReport };

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  generateReport(cwd)
    .then((reportPath) => {
      process.stdout.write(`${reportPath}\n`);
    })
    .catch((err) => {
      process.stderr.write(`${err?.stack || err}\n`);
      process.exit(1);
    });
}
