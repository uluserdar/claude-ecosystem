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

function formatTokens(t) {
  return `${t.input.toLocaleString()} / ${t.output.toLocaleString()} / ${t.cache_creation.toLocaleString()} / ${t.cache_read.toLocaleString()}`;
}

function buildFlatTable(entries) {
  const flat = new Map();
  for (const entry of entries) {
    const k = key(entry.type, entry.name);
    if (!flat.has(k)) flat.set(k, { type: entry.type, name: entry.name, ...emptyTotals() });
    addTotals(flat.get(k), entry);
  }
  const rows = [...flat.values()].sort((a, b) => b.count - a.count);

  const lines = [
    "| Type | Name | Calls | Total Duration | Tokens (in/out/cache-create/cache-read) | Status |",
    "|---|---|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.type} | ${row.name} | ${row.count} | ${formatDuration(row.duration_ms)} | ${formatTokens(row.tokens)} | |`
    );
  }
  return lines.join("\n");
}

function buildHierarchy(entries) {
  const edges = new Map(); // parentKey|"root" -> Map(childKey -> totals)
  for (const entry of entries) {
    const parentKey = entry.parent ? key(entry.parent.type, entry.parent.name) : "root";
    const childKey = key(entry.type, entry.name);
    if (!edges.has(parentKey)) edges.set(parentKey, new Map());
    const children = edges.get(parentKey);
    if (!children.has(childKey)) children.set(childKey, emptyTotals());
    addTotals(children.get(childKey), entry);
  }

  const lines = [];
  function render(parentKey, depth) {
    const children = edges.get(parentKey);
    if (!children) return;
    for (const [childKey, totals] of [...children.entries()].sort((a, b) => b[1].count - a[1].count)) {
      const [type, ...nameParts] = childKey.split(":");
      const name = nameParts.join(":");
      const indent = "  ".repeat(depth);
      lines.push(
        `${indent}- **${name}** (${type}) — ${totals.count} calls, ${formatDuration(totals.duration_ms)}, tokens ${formatTokens(totals.tokens)}`
      );
      render(childKey, depth + 1);
    }
  }
  render("root", 0);
  return lines.length ? lines.join("\n") : "_No data yet._";
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

## Totals

${buildFlatTable(entries)}

## Call tree

${buildHierarchy(entries)}
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
