const { isTrackingEnabled } = require("./lib/settings");
const { pushCall } = require("./lib/state");
const { readStdinJson, TRACKED_TOOLS, skillOrAgentName } = require("./lib/io");
const { logHookError } = require("./lib/debug-log");

async function main() {
  const payload = await readStdinJson();
  const { tool_name: toolName, tool_use_id: toolUseId, session_id: sessionId, cwd, transcript_path: transcriptPath } = payload;

  if (!TRACKED_TOOLS.has(toolName) || !toolUseId || !sessionId || !cwd) return;
  if (!isTrackingEnabled(cwd)) return;

  const name = skillOrAgentName(payload);
  if (!name) return;

  pushCall(sessionId, {
    type: toolName === "Skill" ? "skill" : "agent",
    name,
    model: payload.tool_input?.model || null,
    toolUseId,
    cwd,
    transcriptPath,
    startTimeMs: Date.now(),
  });
}

main().catch((err) => logHookError("track-start", err));
