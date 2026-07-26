const { isTrackingEnabled } = require("./lib/settings");
const { popStack, takeCall } = require("./lib/state");
const { readStdinJson, TRACKED_TOOLS } = require("./lib/io");
const { logHookError } = require("./lib/debug-log");

// PostToolUse fires at dispatch return, which for a Skill is basically
// instantaneous (it just loads instructions into context). Skill tool_use
// tracking turned out to be unreliable besides (the same slash-command
// invocation of the same skill produced one in some sessions and none in
// others), and its tokens would double-count against the whole-session
// entry logged in session-end.js (Skill calls run inline in the main
// transcript, unlike Agent calls which run in a fully separate one). So
// this hook now only unwinds the call stack for both Skill and Agent —
// completion is logged for Agent by SubagentStop, and for Skill nowhere
// (superseded by the session-level entry).
async function main() {
  const payload = await readStdinJson();
  const { tool_name: toolName, tool_use_id: toolUseId, session_id: sessionId, cwd } = payload;

  if (!TRACKED_TOOLS.has(toolName) || !toolUseId || !sessionId || !cwd) return;
  if (!isTrackingEnabled(cwd)) return;

  popStack(sessionId, toolUseId);

  if (toolName === "Skill") takeCall(sessionId, toolUseId);
}

main().catch((err) => logHookError("track-end", err));
