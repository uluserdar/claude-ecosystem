const { isTrackingEnabled } = require("./lib/settings");
const { loadState, deleteState } = require("./lib/state");
const { appendLogEntry } = require("./lib/log");
const { tokensForToolUse, wholeTranscriptTokens, lastSeenModel, sessionLabel } = require("./lib/transcript");
const { generateReport } = require("./lib/report");
const { readStdinJson } = require("./lib/io");
const { logHookError } = require("./lib/debug-log");

async function main() {
  const payload = await readStdinJson();
  const { session_id: sessionId, cwd, transcript_path: transcriptPath } = payload;
  if (!sessionId) return;

  const state = loadState(sessionId);
  const sessionStartTimeMs = state.session_start_time_ms || null;
  for (const [toolUseId, call] of Object.entries(state.calls || {})) {
    if (call.status !== "pending" || !call.cwd || call.type === "skill") continue;
    try {
      const tokens = await tokensForToolUse(call.transcript_path, toolUseId);
      const sessionName = await sessionLabel(call.transcript_path);
      appendLogEntry(call.cwd, {
        time: new Date().toISOString(),
        session_id: sessionId,
        session_label: sessionName,
        type: call.type,
        name: call.name,
        model: call.model || null,
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
      const tokens = await wholeTranscriptTokens(transcriptPath);
      const sessionName = await sessionLabel(transcriptPath);
      const model = await lastSeenModel(transcriptPath);
      const durationMs = sessionStartTimeMs ? Date.now() - sessionStartTimeMs : 0;
      appendLogEntry(cwd, {
        time: new Date().toISOString(),
        session_id: sessionId,
        session_label: sessionName,
        type: "session",
        name: sessionName || "conversation",
        model,
        parent: null,
        duration_ms: durationMs,
        tokens,
        status: "completed",
      });
    } catch (err) {
      // best effort — a missing/failed session-self entry shouldn't block the report
      logHookError("session-end:session-entry", err);
    }

    try {
      await generateReport(cwd);
    } catch (err) {
      // best effort — don't block session shutdown on report generation
      logHookError("session-end:report", err);
    }
  }
}

main().catch((err) => logHookError("session-end", err));
