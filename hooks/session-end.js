const { isTrackingEnabled } = require("./lib/settings");
const { loadState, deleteState } = require("./lib/state");
const { appendLogEntry } = require("./lib/log");
const { tokensForToolUse } = require("./lib/transcript");
const { generateReport } = require("./lib/report");
const { readStdinJson } = require("./lib/io");
const { logHookError } = require("./lib/debug-log");

async function main() {
  const payload = await readStdinJson();
  const { session_id: sessionId, cwd } = payload;
  if (!sessionId) return;

  const state = loadState(sessionId);
  for (const [toolUseId, call] of Object.entries(state.calls || {})) {
    if (call.status !== "pending" || !call.cwd) continue;
    try {
      const tokens = await tokensForToolUse(call.transcript_path, toolUseId);
      appendLogEntry(call.cwd, {
        time: new Date().toISOString(),
        session_id: sessionId,
        type: call.type,
        name: call.name,
        parent: call.parent,
        duration_ms: Date.now() - call.start_time_ms,
        tokens,
        status: "interrupted",
      });
    } catch (err) {
      // best effort
      logHookError("session-end:flush", err);
    }
  }
  deleteState(sessionId);

  if (cwd && isTrackingEnabled(cwd)) {
    try {
      await generateReport(cwd);
    } catch (err) {
      // best effort — don't block session shutdown on report generation
      logHookError("session-end:report", err);
    }
  }
}

main().catch((err) => logHookError("session-end", err));
