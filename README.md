# claude-ecosystem

A personal, growing collection of [Claude Code](https://code.claude.com) agents and skills, distributed as a plugin/marketplace.

## What's in here right now

Nine skills — [`ask-me`, `create-plan`, `project-analyze`, `to-specs`,
`to-tickets`, `implement`, `manage-skills`, `handoff`, and
`plugin-usage`](#skills), see below — plus 12 subagents: 5 that back
ask-me's optional critique-panel step, 2 that back create-plan, 2 that back
project-analyze, 1 that backs to-specs, 1 that backs to-tickets, and 1 that
backs manage-skills (see [Agents](#agents)). `handoff`, `implement`, and
`plugin-usage` are self-contained and don't add a subagent of their own.
This started as a clean plugin/marketplace shell, ready for the first agent
or skill to be added.

A PDF-to-Markdown subagent (`pdf-to-md`) was built and tested here first,
but was removed: forcing every PDF interaction through a subagent (via a
`PreToolUse` hook blocking direct reads) added latency and failure modes
without a clear enough win over Claude's own native PDF reading, and a
chat-attached PDF (via the VS Code extension's attach/drag-and-drop) turns
out to bypass tool-based hooks entirely — it's embedded directly as
multimodal message content, so there was no reliable way to route it
through a subagent anyway. Letting the main agent handle PDFs directly,
with no plugin involvement, works better in practice.

## Skills

### `ask-me`

Turns a question into a deeply researched, contradiction-checked, sourced
final answer instead of a quick reply. It's an evolved version of a
prompt-generator pattern — but instead of outputting a prompt, it outputs
the actual answer.

It works through a structured, multi-round interview (free-text discovery,
then multiple-choice scoping, then a dedicated contradiction check and a
source-preference step) before it writes anything, then runs an internal
divide-and-verify analysis pass, and finally delivers the answer both in
chat and as a downloadable `.md` file.

Use it for questions that are complex, multi-part, research-heavy, or
where the answer could easily contain internal contradictions — not for
things with a quick, direct answer.

[![Learn more](https://img.shields.io/badge/Learn%20more-how%20ask--me%20works-blue)](docs/ask-me.md)

### `create-plan`

Turns a goal or release idea into a structured, phase/step release plan
under `docs/release-plans/` in the current project, with per-step
reference docs and progress tracking (Not Started / In Progress / Done /
Postponed). It's a pure router: it delegates the entire interactive
interview and file generation to the `plan-writer` subagent, which can
also detect steps needing specialized domain knowledge (e.g. a specific
developer role) and delegate creating that project-specific skill to the
`create-skill` subagent. Before interviewing, `plan-writer` also checks
whether the project already has `project-analyze` documentation and, with
user confirmation, can invoke `analyzer` to fill any missing coverage
first.

Use it for planning multi-step work you want to track over time — not for
marking existing plan steps as done, which is out of scope for this skill.

### `project-analyze`

Generates a structured set of project analysis/documentation files under
`docs/analyze/<category>/` in the current project, covering system,
database, backend, frontend, and test aspects — technology stack,
architecture diagrams (Mermaid), folder structure, workflows, UML, API
documentation and containerization notes (when applicable), data
dictionary, ER diagram, naming conventions, and checkbox-tracked
improvement/refactor/normalization suggestions. For a new/empty project it
interviews the user about their intended design; for an existing project
it reads and reports what's actually there. It's a pure router: it
delegates the entire flow to the `analyzer` subagent, which processes
categories sequentially (system → database → backend → frontend → test),
delegates file writing to `create-analyze` per category, and can invoke
`create-skill` when analysis surfaces a technology with no matching skill
in the target project yet.

Analysis docs are always referenced from the target project's `CLAUDE.md`
and must be committed to git (never gitignored), unlike `docs/release-plans/`.

### `to-specs`

Turns the current conversation — plus, if relevant, an existing
`create-plan` release-plan step — into a full spec/PRD, with no interview:
it's pure synthesis of what's already been discussed. It's a pure router:
it delegates entirely to the `spec-writer` subagent, which figures out
whether the spec belongs in an existing
`docs/release-plans/references/{plan}/{phase}/{step}.md` step doc (enriching
it in place) or in a standalone `docs/specs/` file, sketches the test seams,
writes the spec using a fixed template (Problem Statement, Solution, User
Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further
Notes), and — after explicit confirmation — can publish it as a GitHub issue
tagged `ready-for-agent`.

Runs standalone only: it's never chained into or invoked from `plan-writer`,
and it never creates a new release plan itself — that stays `create-plan`'s
job.

### `to-tickets`

Turns a plan, spec, or the current conversation into a set of **tickets** —
tracer-bullet vertical slices, each cutting a narrow but complete path
through every layer, each declaring the other tickets that **block** it.
It's a pure router: it delegates entirely to the `ticket-writer` subagent,
which drafts the breakdown (including the expand-contract exception for
wide mechanical refactors), quizzes the user on granularity and blocking
edges until approved, then publishes — as GitHub issues labeled
`ready-for-agent` if the target project has a GitHub remote, otherwise as
one markdown file per ticket under `docs/tickets/<feature-slug>/` in the
target project.

Runs standalone only: it never chains into or is invoked from `to-specs` or
`plan-writer`, even though the user may feed it a spec or plan either of
those produced.

### `implement`

Implements a piece of work from an existing spec (`docs/specs/` or a
release-plan step) or set of tickets (`docs/tickets/` or GitHub issues
labeled `ready-for-agent`). It never commits directly to `master`: it opens
a task branch from `master` before touching any code, and uses `/tdd`
where reasonable test seams exist, regular type-checking and test runs, a
`/code-review` pass, and a commit — only after explicit confirmation — to
that branch. It also documents this git workflow policy in the target
project's `CLAUDE.md` under a `## Git Workflow (implement skill)` marker
(added once, idempotently, the same way `create-analyze` maintains its own
marker).

It also closes gaps the other skills here explicitly leave open: if the
spec traces back to a `docs/release-plans/references/` step, it flips that
step's status to `In Progress` on start and `Done`/`Postponed` on finish —
the one status word only, never the plan's structure. If the target
project's `CLAUDE.md` has a `## Project Analysis` marker, it checks the
files touched against `project-analyze`'s categories and, when any look
stale, invokes `analyzer` directly (scoped to just those categories,
bypassing the `project-analyze` skill) to refresh them. And — always with
a **separate** explicit confirmation per action — it can push the branch,
open a PR (auto-linking a `Closes #<n>` issue), and once merged, close that
issue and delete the branch both locally and on the remote.

Unlike the other skills here, it does not auto-trigger from conversation
(`disable-model-invocation: true`, ported as-is from its source) — it must
be run explicitly with `/implement`. Adapted from
[mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/implement).

### `manage-skills`

Creates a new skill, or diagnoses and improves an existing one, in the
target project's `.claude/skills/` directory as the project evolves — e.g.
an auto-generated ".NET developer" domain skill that later proves
insufficient. It's a pure router: it delegates entirely to the
`skill-writer` subagent, which checks whether a matching skill already
exists to decide create vs. improve mode. In improve mode it diagnoses the
gap first — from a concrete complaint, or by searching the conversation for
where the skill fell short and asking the user for a scenario if there
isn't enough signal — classifies the root cause (narrow trigger phrases,
missing instructions, or stale constraints), and applies a targeted edit
rather than rewriting the file.

Unlike `create-skill` (which only creates, and is invoked internally by
`plan-writer`/`analyzer`), `skill-writer` also improves existing skills and
is reachable directly by the user through this skill.

### `handoff`

Compacts the current conversation into a handoff document for a fresh
agent to pick up — why we got here, what's been learned/tried, current
state, and next steps — saved to the OS temp directory, never the project
workspace. It includes a "Suggested skills" section pointing the next
agent at whichever of this plugin's skills fit where the conversation left
off, links out to existing artifacts (specs, plans, issues, commits)
instead of duplicating them, and redacts sensitive information before
writing anything to disk.

Like `implement`, it does not auto-trigger from conversation
(`disable-model-invocation: true`, ported as-is from its source) — it must
be run explicitly with `/handoff`. Adapted from
[mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff).

### `plugin-usage`

Regenerates and shows the plugin usage report for the current project —
which skills triggered which agents, call counts, durations, and token
usage (input/output/cache-create/cache-read), recorded by this plugin's
opt-in usage-tracking hooks (see [Usage tracking](#usage-tracking) below).
It's self-contained: it only shells out to the deterministic
`hooks/lib/report.js` script to recompute the report from the raw JSONL
logs — it never estimates or computes the numbers itself.

Like `handoff` and `implement`, it does not auto-trigger from conversation
(`disable-model-invocation: true`) — it must be run explicitly with
`/plugin-usage`.

## Usage tracking

Off by default. On session start, `.claude/claude-ecosystem-settings.json`
is auto-scaffolded (tracking `false`) if missing, and `docs/usage-logs/` +
`docs/tickets/` are added to the project's `.gitignore` if it's a git
repo — so the on-switch and the gitignore hygiene are one less manual
step. Flip `usageTracking.enabled` to `true` to turn tracking on for that
project. Once on, Node.js hooks in `hooks/` record every skill/agent
call — including which one triggered which — to `docs/usage-logs/`,
gitignored so nothing leaves your machine. See
[docs/plugin-usage.md](docs/plugin-usage.md) for the exact log schema and
how the hooks handle background agents and crashed sessions.

## Agents

Five subagents (`ask-me-devils-advocate`, `ask-me-first-principles-thinker`,
`ask-me-opportunity-hunter`, `ask-me-outside-eye`, `ask-me-practitioner`)
in `agents/`. They're not general-purpose — each is a fixed critique role
that `ask-me` spawns in parallel, only when its optional critique-panel
preference is turned on, to review the drafted final answer before it's
delivered. See [docs/ask-me.md](docs/ask-me.md) for how the panel fits
into the flow.

Two more subagents back `create-plan`: `plan-writer` runs its interview and
generates/extends release-plan files in the target project, and
`create-skill` is an independently reusable subagent that interviews the
user to design and generate a specialized-domain skill on demand (e.g. a
"SQL developer" skill) into the target project's `.claude/skills/`. Unlike
the ask-me-* roles, these two aren't fixed critique roles — they run real
interactive interviews and write files.

Two more subagents back `project-analyze`: `analyzer` owns mode detection,
the interview or codebase analysis, technology-skill gap detection (calling
`create-skill` when needed), and orchestrates document generation category
by category; `create-analyze` is invoked once per category to write that
category's Markdown files under `docs/analyze/` and idempotently reference
them from the target project's `CLAUDE.md`.

One more subagent backs `to-specs`: `spec-writer` determines the right
target file, explores the codebase, sketches test seams, synthesizes the
spec, writes it, and — with confirmation — publishes it to GitHub as an
issue labeled `ready-for-agent`.

One more subagent backs `to-tickets`: `ticket-writer` drafts the
tracer-bullet ticket breakdown with blocking edges, confirms it with the
user, and — with confirmation — publishes it either as GitHub issues
labeled `ready-for-agent` or as local markdown files under
`docs/tickets/`.

One more subagent backs `manage-skills`: `skill-writer` detects whether a
matching skill already exists in the target project to decide create vs.
improve mode; in create mode it runs the same interview/generation flow as
`create-skill`, and in improve mode it diagnoses why an existing skill fell
short (narrow triggers, missing instructions, or stale constraints) before
applying a targeted edit.

## Repository structure

```
claude-ecosystem/
├── .claude-plugin/
│   ├── plugin.json          # plugin metadata
│   └── marketplace.json     # marketplace catalog listing this plugin
├── agents/
│   ├── ask-me-*.md          # ask-me's 5 critique-panel subagent roles
│   ├── plan-writer.md       # create-plan's interview + generation subagent
│   ├── create-skill.md      # reusable specialized-skill creation subagent
│   ├── analyzer.md          # project-analyze's analysis + orchestration subagent
│   ├── create-analyze.md    # project-analyze's per-category doc-writing subagent
│   ├── spec-writer.md       # to-specs's synthesis + generation subagent
│   ├── ticket-writer.md     # to-tickets's breakdown + publishing subagent
│   └── skill-writer.md      # manage-skills's create/diagnose/improve subagent
├── skills/
│   ├── ask-me/
│   │   └── SKILL.md         # ask-me skill definition
│   ├── create-plan/
│   │   └── SKILL.md         # create-plan skill definition
│   ├── project-analyze/
│   │   └── SKILL.md         # project-analyze skill definition
│   ├── to-specs/
│   │   └── SKILL.md         # to-specs skill definition
│   ├── to-tickets/
│   │   └── SKILL.md         # to-tickets skill definition
│   ├── implement/
│   │   └── SKILL.md         # implement skill definition
│   ├── manage-skills/
│   │   └── SKILL.md         # manage-skills skill definition
│   ├── handoff/
│   │   └── SKILL.md         # handoff skill definition
│   └── plugin-usage/
│       └── SKILL.md         # plugin-usage skill definition
├── hooks/
│   ├── hooks.json           # registers the usage-tracking hooks below
│   ├── track-start.js       # PreToolUse(Skill|Agent): starts tracking a call
│   ├── track-end.js         # PostToolUse(Skill|Agent): unwinds the call stack, logs Skill completions
│   ├── track-subagent-stop.js # SubagentStop: logs Agent completions (background-safe)
│   ├── session-start.js     # SessionStart: recovers state orphaned by a crashed session
│   ├── session-end.js       # SessionEnd: flushes state, regenerates the usage report
│   └── lib/                 # shared helpers (settings, state, log, transcript, report)
├── docs/
│   ├── ask-me.md            # how ask-me works, in plain terms
│   └── plugin-usage.md      # how usage tracking works, in plain terms
├── LICENSE                  # MIT
└── README.md
```

## Install this plugin in Claude Code

```
/plugin marketplace add <your-github-username>/claude-ecosystem
/plugin install claude-ecosystem@claude-ecosystem
/reload-plugins
```

Or from the CLI, non-interactively:

```bash
claude plugin marketplace add <your-github-username>/claude-ecosystem
claude plugin install claude-ecosystem@claude-ecosystem
```

To test locally before pushing anywhere, point at the folder directly:

```
/plugin marketplace add ./claude-ecosystem
/plugin install claude-ecosystem@claude-ecosystem
```

To verify it loaded, ask a complex, multi-part question — `ask-me` should
trigger and start its interview. Or say "let's plan this release" —
`create-plan` should trigger and hand off to `plan-writer`. Or say "spec
this out" — `to-specs` should trigger and hand off to `spec-writer`. Or say
"break this into tickets" — `to-tickets` should trigger and hand off to
`ticket-writer`. Or say "bu skill'i geliştir" about an existing skill —
`manage-skills` should trigger and hand off to `skill-writer`.

## Roadmap

To add a new agent, drop a `.md` file in `agents/`. To add a new skill, add a
`<skill-name>/SKILL.md` directory under `skills/`. Both are picked up
automatically — nothing in `.claude-plugin/plugin.json` or
`.claude-plugin/marketplace.json` needs to change for a new agent or skill
to be discovered. `hooks/hooks.json` is discovered the same way.

## License

MIT — see [LICENSE](LICENSE).
