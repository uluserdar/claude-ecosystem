const { isTrackingEnabled } = require("./lib/settings");
const { listOpenCalls, takeCall, popStack } = require("./lib/state");
const { appendLogEntry } = require("./lib/log");
const { tokensForToolUse } = require("./lib/transcript");
const { readStdinJson } = require("./lib/io");

// SubagentStop payloads aren't guaranteed to carry the originating
// PreToolUse tool_use_id under a single stable field name, so we try the
// candidates we know of and fall back to the oldest still-pending agent
// call in this session (best effort for setups with a single in-flight
// background agent at a time).
function resolveToolUseId(payload, openAgentCalls) {
  const candidates = [payload.tool_use_id, payload.agent_id, payload.subagent_tool_use_id, payload.id];
  const direct = candidates.find((c) => c && openAgentCalls.some((call) => call.toolUseId === c));
  if (direct) return direct;
  const oldest = [...openAgentCalls].sort((a, b) => a.start_time_ms - b.start_time_ms)[0];
  return oldest ? oldest.toolUseId : null;
}

async function main() {
  const payload = await readStdinJson();
  const { session_id: sessionId, cwd, transcript_path: transcriptPath } = payload;
  if (!sessionId || !cwd) return;
  if (!isTrackingEnabled(cwd)) return;

  const openAgentCalls = listOpenCalls(sessionId).filter((call) => call.type === "agent");
  if (openAgentCalls.length === 0) return;

  const toolUseId = resolveToolUseId(payload, openAgentCalls);
  if (!toolUseId) return;

  popStack(sessionId, toolUseId);
  const call = takeCall(sessionId, toolUseId);
  if (!call) return;

  const tokens = await tokensForToolUse(transcriptPath || call.transcript_path, toolUseId);
  appendLogEntry(call.cwd || cwd, {
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

main().catch(() => {});
