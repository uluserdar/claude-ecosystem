---
name: plugin-usage
description: Regenerate and show the plugin usage report — which skills triggered which agents, call counts, durations, and token usage, recorded by this plugin's usage-tracking hooks. Use when the user asks for a usage report, wants to know which skill uses which agent, asks about token/time spent per skill or agent, or says things like "kullanım raporu" / "plugin usage". Explicit-invoke only (run via /plugin-usage) — does not auto-trigger from conversation.
disable-model-invocation: true
---

# plugin-usage

Regenerate the usage report from this project's recorded logs and present
it to the user.

## Instructions

1. Check whether `.claude/claude-ecosystem-settings.json` exists and has
   `usageTracking.enabled: true`. If not, tell the user tracking is
   currently disabled for this project and stop — do not fabricate or
   estimate any numbers, and do not enable tracking yourself without being
   asked.
2. Check whether `docs/usage-logs/` contains any `*.jsonl` files. If none
   exist yet, tell the user there's no recorded usage yet and stop.
3. Otherwise, run:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/report.js" "$(pwd)"
   ```
   via Bash. This is a deterministic script — it reads the raw JSONL logs
   and writes `docs/usage-logs/plugin-usage-report.md`. Do not compute the
   totals yourself from the raw logs; always let the script do it.
4. Read the generated `docs/usage-logs/plugin-usage-report.md` and show its
   contents (or a faithful summary of it) to the user in chat, plus the
   file path.

<constraints>
- Never auto-triggers from conversation (`disable-model-invocation: true`)
  — only runs via explicit `/plugin-usage`.
- Never compute or estimate usage numbers yourself — always delegate to
  `hooks/lib/report.js`, which reads the raw logs deterministically.
- Never enable usage tracking on the user's behalf; only report on it.
</constraints>
