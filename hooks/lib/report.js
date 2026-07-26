const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { listLogFiles, logDir } = require("./log");

function key(type, name) {
  return `${type}:${name}`;
}

function emptyTotals() {
  return { count: 0, duration_ms: 0, tokens: { input: 0, output: 0, cache_creation: 0, cache_read: 0 } };
}

function addTotals(totals, entry) {
  totals.count += 1;
  totals.duration_ms += entry.duration_ms || 0;
  const t = entry.tokens || {};
  totals.tokens.input += t.input || 0;
  totals.tokens.output += t.output || 0;
  totals.tokens.cache_creation += t.cache_creation || 0;
  totals.tokens.cache_read += t.cache_read || 0;
}

function mergeTotals(target, totals) {
  target.count += totals.count;
  target.duration_ms += totals.duration_ms;
  target.tokens.input += totals.tokens.input;
  target.tokens.output += totals.tokens.output;
  target.tokens.cache_creation += totals.tokens.cache_creation;
  target.tokens.cache_read += totals.tokens.cache_read;
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

// parentKey|"root" -> Map(childKey -> totals). Each entry's `parent` only
// records the immediate ancestor's (type, name) — not a full instance path —
// so calls with identical (type, name) but different real ancestors can't be
// told apart. Acceptable for now; would need ancestor-chain ids in the log
// schema to fix properly.
function buildEdges(entries) {
  const edges = new Map();
  for (const entry of entries) {
    const parentKey = entry.parent ? key(entry.parent.type, entry.parent.name) : "root";
    const childKey = key(entry.type, entry.name);
    if (!edges.has(parentKey)) edges.set(parentKey, new Map());
    const children = edges.get(parentKey);
    if (!children.has(childKey)) children.set(childKey, emptyTotals());
    addTotals(children.get(childKey), entry);
  }
  return edges;
}

// Recursively merges every descendant of parentKey into flatMap (keyed by
// childKey, for the per-skill sub-table) and into rollup (single accumulator,
// for replacing the top-level row's own near-zero self stats).
function collectSubtree(edges, parentKey, flatMap, rollup) {
  const children = edges.get(parentKey);
  if (!children) return;
  for (const [childKey, totals] of children) {
    if (!flatMap.has(childKey)) flatMap.set(childKey, emptyTotals());
    mergeTotals(flatMap.get(childKey), totals);
    mergeTotals(rollup, totals);
    collectSubtree(edges, childKey, flatMap, rollup);
  }
}

function buildSkillSections(entries) {
  const edges = buildEdges(entries);
  const topLevel = edges.get("root") || new Map();

  const rows = [...topLevel.entries()]
    .map(([topKey, selfTotals]) => {
      const rollup = { ...emptyTotals(), tokens: { ...emptyTotals().tokens } };
      const subtree = new Map();
      collectSubtree(edges, topKey, subtree, rollup);
      mergeTotals(rollup, selfTotals);
      return { topKey, calls: selfTotals.count, rollup, subtree };
    })
    .sort((a, b) => b.calls - a.calls);

  const grandTotal = emptyTotals();
  for (const row of rows) mergeTotals(grandTotal, { ...row.rollup, count: row.calls });

  const lines = [
    "## Skills",
    "",
    "| Skill | Calls | Total Duration | Input | Output | Cache Create | Cache Read |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const row of rows) {
    const { name } = splitKey(row.topKey);
    lines.push(
      `| ${name} | ${row.calls} | ${formatDuration(row.rollup.duration_ms)} | ${tokenCells(row.rollup.tokens).join(" | ")} |`
    );
  }
  lines.push(
    `| **Total** | ${grandTotal.count} | ${formatDuration(grandTotal.duration_ms)} | ${tokenCells(grandTotal.tokens).join(" | ")} |`
  );

  for (const row of rows) {
    if (row.subtree.size === 0) continue;
    const { name } = splitKey(row.topKey);
    lines.push("", `### ${name}`, "");
    lines.push("| Agent | Calls | Duration | Input | Output | Cache Create | Cache Read |");
    lines.push("|---|---|---|---|---|---|---|");
    const subRows = [...row.subtree.entries()].sort((a, b) => b[1].count - a[1].count);
    for (const [childKey, totals] of subRows) {
      const { name: childName } = splitKey(childKey);
      lines.push(
        `| ${childName} | ${totals.count} | ${formatDuration(totals.duration_ms)} | ${tokenCells(totals.tokens).join(" | ")} |`
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

${buildSkillSections(entries)}
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
