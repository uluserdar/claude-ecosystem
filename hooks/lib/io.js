function readStdinJson() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", () => resolve({}));
  });
}

const TRACKED_TOOLS = new Set(["Skill", "Agent"]);

function skillOrAgentName(payload) {
  const input = payload.tool_input || {};
  if (payload.tool_name === "Skill") return input.skill;
  if (payload.tool_name === "Agent") return input.description || input.subagent_type;
  return undefined;
}

module.exports = { readStdinJson, TRACKED_TOOLS, skillOrAgentName };
