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
    rl.close();
    stream.close?.();
    return {
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0,
      cache_creation: usage.cache_creation_input_tokens || 0,
      cache_read: usage.cache_read_input_tokens || 0,
    };
  }
  return { ...EMPTY_TOKENS };
}

module.exports = { tokensForToolUse, EMPTY_TOKENS };
