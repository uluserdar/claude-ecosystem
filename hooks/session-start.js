const { listOtherSessionStateFiles, loadState, saveState, deleteState } = require("./lib/state");
const { appendLogEntry } = require("./lib/log");
const { tokensForToolUse, sessionLabel } = require("./lib/transcript");
const { readStdinJson } = require("./lib/io");
const { isTrackingEnabled, ensureSettingsScaffold, ensureAgentModelKeys } = require("./lib/settings");
const { ensureGitignoreEntries } = require("./lib/gitignore");
const { logHookError } = require("./lib/debug-log");

// Recovers state files orphaned by a session that never reached SessionEnd
// (crash, force-quit). Any call still marked pending is flushed to that
// call's own project log as "interrupted" so the data isn't silently lost,
// then the stale temp file is removed.
async function flushOrphan(sessionId, fullPath) {
  const state = loadState(sessionId);
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
      // best effort; skip this call rather than aborting the whole cleanup
      logHookError("session-start:flushOrphan", err);
    }
  }
  deleteState(sessionId);
  void fullPath;
}

async function main() {
  const payload = await readStdinJson();
  const currentSessionId = payload.session_id;
  if (!currentSessionId) return;

  const orphans = listOtherSessionStateFiles(currentSessionId);
  for (const { sessionId, fullPath } of orphans) {
    await flushOrphan(sessionId, fullPath);
  }

  if (payload.cwd && isTrackingEnabled(payload.cwd)) {
    const state = loadState(currentSessionId);
    state.session_start_time_ms = Date.now();
    saveState(currentSessionId, state);
  }

  if (payload.cwd) {
    try {
      // Scaffolds the settings file OFF (opt-in stays opt-in), fills in
      // any missing agentModel keys so the user only has to edit values,
      // and makes sure this project's own .gitignore won't accidentally
      // track generated usage-tracking/tickets output.
      ensureSettingsScaffold(payload.cwd);
      ensureAgentModelKeys(payload.cwd);
      ensureGitignoreEntries(payload.cwd);
    } catch (err) {
      // best effort — never block session start on this
      logHookError("session-start:scaffold", err);
    }
  }
}

main().catch((err) => logHookError("session-start", err));
