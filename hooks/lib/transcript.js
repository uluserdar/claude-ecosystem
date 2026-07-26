const fs = require("fs");
const readline = require("readline");

const EMPTY_TOKENS = { input: 0, output: 0, cache_creation: 0, cache_read: 0 };

// Finds the assistant message that produced the given tool_use_id and
// returns its usage. A single assistant turn can contain more than one
// tool_use block; when that happens the turn's usage is attributed to
// each tool call sharing it (an approximation — Claude Code's transcript
// doesn't break usage down per tool_use within a turn).
async function tokensForToolUse(transcriptPath, toolUseId) {
  if (!transcriptPath || !toolUseId) return { ...EMPTY_TOKENS };
  let stream;
  try {
    stream = fs.createReadStream(transcriptPath, { encoding: "utf8" });
  } catch {
    return { ...EMPTY_TOKENS };
  }

  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry?.message;
    const content = message?.content;
    if (!Array.isArray(content)) continue;
    const hasToolUse = content.some((block) => block?.type === "tool_use" && block?.id === toolUseId);
    if (!hasToolUse) continue;
    const usage = message.usage || {};
    const sharedBy = content.filter((block) => block?.type === "tool_use").length || 1;
    rl.close();
    stream.close?.();
    return {
      input: Math.round((usage.input_tokens || 0) / sharedBy),
      output: Math.round((usage.output_tokens || 0) / sharedBy),
      cache_creation: Math.round((usage.cache_creation_input_tokens || 0) / sharedBy),
      cache_read: Math.round((usage.cache_read_input_tokens || 0) / sharedBy),
    };
  }
  return { ...EMPTY_TOKENS };
}

const AGENT_TRANSCRIPT_RETRY_DELAYS_MS = [100, 250, 500];

function isEmptyTokens(tokens) {
  return !tokens.input && !tokens.output && !tokens.cache_creation && !tokens.cache_read;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Sums usage across every assistant turn in a subagent's OWN transcript
// (SubagentStop payloads carry `agent_transcript_path`, distinct from the
// parent's `transcript_path`). This is the subagent's exclusive, complete
// usage — no averaging/estimation needed, unlike tokensForToolUse which has
// to approximate from the parent's shared dispatch turn.
//
// SubagentStop can fire before the subagent's last assistant-turn line
// (carrying `usage`) has actually been flushed to disk — a real turn always
// has nonzero usage, so an all-zero read is treated as "not flushed yet" and
// retried a few times before giving up.
async function tokensForAgentTranscript(agentTranscriptPath) {
  let tokens = await wholeTranscriptTokens(agentTranscriptPath);
  for (const ms of AGENT_TRANSCRIPT_RETRY_DELAYS_MS) {
    if (!isEmptyTokens(tokens)) break;
    await delay(ms);
    tokens = await wholeTranscriptTokens(agentTranscriptPath);
  }
  return tokens;
}

// Sums usage across every assistant turn in the transcript — the whole main
// conversation's own spend, independent of whether any Skill/Agent tool_use
// ever fired. Distinct from tokensForToolUse, which attributes a single
// turn's usage to one specific tool call.
async function wholeTranscriptTokens(transcriptPath) {
  if (!transcriptPath) return { ...EMPTY_TOKENS };

  const totals = { ...EMPTY_TOKENS };
  try {
    const stream = fs.createReadStream(transcriptPath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry?.type !== "assistant") continue;
      const usage = entry.message?.usage;
      if (!usage) continue;
      totals.input += usage.input_tokens || 0;
      totals.output += usage.output_tokens || 0;
      totals.cache_creation += usage.cache_creation_input_tokens || 0;
      totals.cache_read += usage.cache_read_input_tokens || 0;
    }
  } catch {
    // Missing/unreadable file (e.g. not created yet) — treat as empty so
    // callers like tokensForAgentTranscript can retry or fall back.
    return { ...EMPTY_TOKENS };
  }
  return totals;
}

// Among candidateIds, finds whichever one's tool_result appears LAST in the
// transcript (append-only log, so the last-seen match is almost certainly
// the one that just triggered the current SubagentStop event). Used to
// disambiguate which pending Agent call a SubagentStop event belongs to when
// several were dispatched together in the same turn — evidence from the
// transcript itself instead of guessing at SubagentStop payload field names.
async function lastCompletedToolUseId(transcriptPath, candidateIds) {
  if (!transcriptPath || !candidateIds || candidateIds.length === 0) return null;
  let stream;
  try {
    stream = fs.createReadStream(transcriptPath, { encoding: "utf8" });
  } catch {
    return null;
  }

  const candidates = new Set(candidateIds);
  let lastMatch = null;
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === "tool_result" && candidates.has(block.tool_use_id)) {
        lastMatch = block.tool_use_id;
      }
    }
  }
  return lastMatch;
}

// Which model actually produced the conversation's turns — the LAST assistant
// turn's model field, since that reflects the currently-active model (a
// session can switch models mid-conversation, e.g. via /model). Returns null
// if the transcript has no assistant turns yet or is unreadable.
async function lastSeenModel(transcriptPath) {
  if (!transcriptPath) return null;
  let stream;
  try {
    stream = fs.createReadStream(transcriptPath, { encoding: "utf8" });
  } catch {
    return null;
  }

  let last = null;
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "assistant") continue;
    const model = entry.message?.model;
    if (model) last = model;
  }
  return last;
}

// Best-effort human-readable label for a session, read from its first user
// message: the slash-command name if this was a command invocation,
// otherwise the message text truncated. Falls back to null (caller uses the
// session id instead) if the transcript is missing or has no user message.
async function sessionLabel(transcriptPath) {
  if (!transcriptPath) return null;
  let stream;
  try {
    stream = fs.createReadStream(transcriptPath, { encoding: "utf8" });
  } catch {
    return null;
  }

  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== "user") continue;
    const content = entry.message?.content;
    let text = null;
    if (typeof content === "string") text = content;
    else if (Array.isArray(content)) {
      const block = content.find((b) => b?.type === "text");
      text = block?.text || null;
    }
    if (!text) continue;
    rl.close();
    stream.close?.();
    const commandMatch = text.match(/<command-name>\/?([^<]+)<\/command-name>/);
    if (commandMatch) return commandMatch[1].trim();
    return text.replace(/\s+/g, " ").trim().slice(0, 80);
  }
  return null;
}

module.exports = {
  tokensForToolUse,
  tokensForAgentTranscript,
  wholeTranscriptTokens,
  lastCompletedToolUseId,
  lastSeenModel,
  sessionLabel,
  isEmptyTokens,
  EMPTY_TOKENS,
};
