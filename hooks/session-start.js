const { listOtherSessionStateFiles, loadState, deleteState } = require("./lib/state");
const { appendLogEntry } = require("./lib/log");
const { tokensForToolUse } = require("./lib/transcript");
const { readStdinJson } = require("./lib/io");
const { ensureSettingsScaffold } = require("./lib/settings");
const { ensureGitignoreEntries } = require("./lib/gitignore");

// Recovers state files orphaned by a session that never reached SessionEnd
// (crash, force-quit). Any call still marked pending is flushed to that
// call's own project log as "interrupted" so the data isn't silently lost,
// then the stale temp file is removed.
async function flushOrphan(sessionId, fullPath) {
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
    } catch {
      // best effort; skip this call rather than aborting the whole cleanup
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

  if (payload.cwd) {
    try {
      // Scaffolds the settings file OFF (opt-in stays opt-in) and makes
      // sure this project's own .gitignore won't accidentally track
      // generated usage-tracking/tickets output.
      ensureSettingsScaffold(payload.cwd);
      ensureGitignoreEntries(payload.cwd);
    } catch {
      // best effort — never block session start on this
    }
  }
}

main().catch(() => {});
