const { isTrackingEnabled } = require("./lib/settings");
const { listOpenCalls, takeCall, popStack } = require("./lib/state");
const { appendLogEntry } = require("./lib/log");
const {
  tokensForToolUse,
  tokensForAgentTranscript,
  lastCompletedToolUseId,
  sessionLabel,
  isEmptyTokens,
} = require("./lib/transcript");
const { readStdinJson } = require("./lib/io");
const { logHookError } = require("./lib/debug-log");

// SubagentStop payloads aren't guaranteed to carry the originating
// PreToolUse tool_use_id under a single stable field name, so: try the
// payload field guesses first (cheap); then use the transcript itself as
// ground truth — a SubagentStop event means some tool_result for one of our
// still-pending Agent calls was just appended, so the candidate whose result
// appears LAST in the transcript is almost certainly the one that just
// completed. Only when neither signal resolves anything (e.g. a race before
// the transcript write lands) do we fall back to "oldest still-pending" —
// an arbitrary guess, but strictly the last resort now rather than the
// primary mechanism.
async function resolveToolUseId(payload, openAgentCalls, transcriptPath) {
  const candidates = [payload.tool_use_id, payload.agent_id, payload.subagent_tool_use_id, payload.id];
  const direct = candidates.find((c) => c && openAgentCalls.some((call) => call.toolUseId === c));
  if (direct) return direct;

  const evidence = await lastCompletedToolUseId(
    transcriptPath,
    openAgentCalls.map((call) => call.toolUseId)
  );
  if (evidence) return evidence;

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

  const toolUseId = await resolveToolUseId(payload, openAgentCalls, transcriptPath);
  if (!toolUseId) return;

  popStack(sessionId, toolUseId);
  const call = takeCall(sessionId, toolUseId);
  if (!call) return;

  const resolvedTranscriptPath = transcriptPath || call.transcript_path;
  // Newer CLI versions attach the subagent's OWN transcript on SubagentStop,
  // separate from the parent's transcript_path — that's exact, un-shared
  // usage, so prefer it over the parent-turn-averaged fallback whenever
  // present (older CLI versions or non-Agent tools won't have it). Its
  // internal retry already covers a normal flush race; if it's still empty
  // after that, fall back to the shared-turn estimate rather than logging a
  // false zero.
  let tokens = payload.agent_transcript_path
    ? await tokensForAgentTranscript(payload.agent_transcript_path)
    : await tokensForToolUse(resolvedTranscriptPath, toolUseId);
  if (payload.agent_transcript_path && isEmptyTokens(tokens)) {
    tokens = await tokensForToolUse(resolvedTranscriptPath, toolUseId);
  }
  const sessionName = await sessionLabel(resolvedTranscriptPath);
  appendLogEntry(call.cwd || cwd, {
    time: new Date().toISOString(),
    session_id: sessionId,
    session_label: sessionName,
    type: call.type,
    name: call.name,
    model: call.model || null,
    parent: call.parent,
    duration_ms: Date.now() - call.start_time_ms,
    tokens,
    status: "completed",
  });
}

main().catch((err) => logHookError("track-subagent-stop", err));
