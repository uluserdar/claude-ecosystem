const fs = require("fs");
const os = require("os");
const path = require("path");

const PREFIX = "claude-ecosystem-usage-";

function statePath(sessionId) {
  return path.join(os.tmpdir(), `${PREFIX}${sessionId}.json`);
}

function loadState(sessionId) {
  try {
    const raw = fs.readFileSync(statePath(sessionId), "utf8");
    return JSON.parse(raw);
  } catch {
    return { session_id: sessionId, stack: [], calls: {} };
  }
}

function saveState(sessionId, state) {
  fs.writeFileSync(statePath(sessionId), JSON.stringify(state), "utf8");
}

function deleteState(sessionId) {
  try {
    fs.unlinkSync(statePath(sessionId));
  } catch {
    // already gone
  }
}

// Captures the current top-of-stack as this call's parent at dispatch time,
// then pushes the call. This is what keeps parent attribution correct even
// though background agents complete asynchronously, out of stack order.
function pushCall(sessionId, { type, name, toolUseId, cwd, transcriptPath, startTimeMs }) {
  const state = loadState(sessionId);
  const top = state.stack[state.stack.length - 1] || null;
  const parent = top ? { type: top.type, name: top.name } : null;
  state.stack.push({ type, name, toolUseId });
  state.calls[toolUseId] = {
    type,
    name,
    parent,
    cwd,
    transcript_path: transcriptPath,
    start_time_ms: startTimeMs,
    status: "pending",
  };
  saveState(sessionId, state);
  return state.calls[toolUseId];
}

// Unwinds the stack entry for this call. Does NOT remove the call record
// from `calls` — for Agent calls that's still needed by SubagentStop.
function popStack(sessionId, toolUseId) {
  const state = loadState(sessionId);
  const idx = state.stack.findIndex((entry) => entry.toolUseId === toolUseId);
  if (idx !== -1) state.stack.splice(idx, 1);
  saveState(sessionId, state);
}

// Removes and returns the call record once it's fully logged.
function takeCall(sessionId, toolUseId) {
  const state = loadState(sessionId);
  const call = state.calls[toolUseId] || null;
  if (call) {
    delete state.calls[toolUseId];
    saveState(sessionId, state);
  }
  return call;
}

function listOpenCalls(sessionId) {
  const state = loadState(sessionId);
  return Object.entries(state.calls).map(([toolUseId, call]) => ({ toolUseId, ...call }));
}

function listOtherSessionStateFiles(currentSessionId) {
  const files = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith(PREFIX) && f.endsWith(".json"));
  return files
    .map((f) => {
      const sessionId = f.slice(PREFIX.length, -".json".length);
      return { sessionId, fullPath: path.join(os.tmpdir(), f) };
    })
    .filter((entry) => entry.sessionId !== currentSessionId);
}

module.exports = {
  statePath,
  loadState,
  saveState,
  deleteState,
  pushCall,
  popStack,
  takeCall,
  listOpenCalls,
  listOtherSessionStateFiles,
};
