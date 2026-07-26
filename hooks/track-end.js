const { isTrackingEnabled } = require("./lib/settings");
const { popStack, takeCall } = require("./lib/state");
const { appendLogEntry } = require("./lib/log");
const { tokensForToolUse } = require("./lib/transcript");
const { readStdinJson, TRACKED_TOOLS } = require("./lib/io");
const { logHookError } = require("./lib/debug-log");

// PostToolUse fires at dispatch return. For Skill (synchronous) that's also
// completion, so we log here. For Agent (usually backgrounded) this only
// unwinds the call stack — real completion is logged by SubagentStop.
async function main() {
  const payload = await readStdinJson();
  const { tool_name: toolName, tool_use_id: toolUseId, session_id: sessionId, cwd, transcript_path: transcriptPath } = payload;

  if (!TRACKED_TOOLS.has(toolName) || !toolUseId || !sessionId || !cwd) return;
  if (!isTrackingEnabled(cwd)) return;

  popStack(sessionId, toolUseId);

  if (toolName !== "Skill") return;

  const call = takeCall(sessionId, toolUseId);
  if (!call) return;

  const tokens = await tokensForToolUse(transcriptPath || call.transcript_path, toolUseId);
  appendLogEntry(cwd, {
    time: new Date().toISOString(),
    session_id: sessionId,
    type: call.type,
    name: call.name,
    parent: call.parent,
    duration_ms: Date.now() - call.start_time_ms,
    tokens,
    status: "completed",
  });
}

main().catch((err) => logHookError("track-end", err));
