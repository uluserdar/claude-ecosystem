# How plugin usage tracking works

Opt-in, per-project tracking of which skills trigger which agents, how
long each call takes, and how many tokens it consumes. Off by default —
nothing is recorded unless you turn it on for a given project.

## Enabling it

The first time a session starts in a project with this plugin active,
`SessionStart` scaffolds `.claude/claude-ecosystem-settings.json` if it
doesn't exist yet — always with tracking **off**:

```json
{
  "usageTracking": { "enabled": false }
}
```

To turn tracking on, flip that to `true`. Every tracking hook checks this
file first and no-ops immediately if it's missing or `enabled` isn't
`true` — this is the majority path for most projects, so the hooks add no
overhead when tracking is off. The scaffold step never overwrites an
existing file, so flipping it back off (or deleting it) sticks.

The same `SessionStart` hook also idempotently adds `docs/usage-logs/` and
`docs/tickets/` to the project's `.gitignore` (only inside a git repo,
only if missing, under a `# claude-ecosystem plugin` section) — so
tracking output and `to-tickets` output don't get committed by accident,
without you having to remember to do it yourself.

## What gets recorded, and where

- `docs/usage-logs/YYYY-MM-DD.jsonl` — one JSON line per completed skill or
  agent call: timestamp, type, name, the parent skill/agent it was called
  from (or `null` for a top-level skill), duration, token usage
  (`input`/`output`/`cache_creation`/`cache_read`), and status
  (`completed` or `interrupted`).
- `docs/usage-logs/plugin-usage-report.md` — a generated summary: a flat
  totals table per skill/agent, followed by a hierarchical call tree
  reconstructed from the parent links.

Both live under `docs/usage-logs/`, which is gitignored — this data never
leaves your machine unless you choose to share the file yourself.

## How it's collected

Everything runs through Node.js hook scripts in `hooks/` (no bash, so
behavior is identical on Windows/macOS/Linux):

- `PreToolUse`/`PostToolUse` on the `Skill` and `Agent` tools track
  dispatch — a skill call is synchronous, so it's fully logged at
  `PostToolUse`.
- Agent calls default to running in the background, so `PostToolUse` only
  unwinds the call stack; the actual completion, duration, and tokens are
  recorded by `SubagentStop`, whenever the agent actually finishes.
- Parent attribution (which skill/agent a call came from) is captured the
  moment the call is dispatched, not when it finishes — this keeps
  attribution correct even when multiple background agents are in flight.
- A small per-session state file in the OS temp directory tracks
  in-progress calls. `SessionEnd` flushes and deletes it normally.
  `SessionStart` sweeps for state files orphaned by a crashed or
  force-quit session, logs any call that never finished as `interrupted`,
  and cleans up the temp file — so nothing lingers and nothing is silently
  lost.
- Token counts come from the session transcript's per-message `usage`
  data. Note: if a single assistant turn contains more than one tool call,
  its usage is attributed to each of those calls — Claude Code's
  transcript doesn't break usage down per individual tool call within a
  turn, so this is an approximation in that (uncommon) case.

## Regenerating the report

The summary report is regenerated automatically at the end of every
session, and on demand via `/plugin-usage`. Both paths call the same
deterministic script (`hooks/lib/report.js`) — no model/LLM involvement,
so regenerating it costs no tokens.
