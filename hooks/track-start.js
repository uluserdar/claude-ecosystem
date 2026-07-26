const { isTrackingEnabled, resolveAgentModel } = require("./lib/settings");
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

  // The orchestrating skill is *supposed* to read agentModel and pass it as
  // tool_input.model itself, but that's a prose instruction with no
  // enforcement — if that turn skips it, fall back to resolving it here in
  // code so the settings file is authoritative either way.
  const model =
    payload.tool_input?.model ||
    (toolName === "Agent" ? resolveAgentModel(cwd, payload.tool_input?.subagent_type) : null);

  pushCall(sessionId, {
    type: toolName === "Skill" ? "skill" : "agent",
    name,
    model,
    toolUseId,
    cwd,
    transcriptPath,
    startTimeMs: Date.now(),
  });
}

main().catch((err) => logHookError("track-start", err));
