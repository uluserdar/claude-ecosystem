# claude-ecosystem

A personal, growing collection of [Claude Code](https://code.claude.com) agents and skills, distributed as a plugin/marketplace.

## What's in here right now

Three skills — [`ask-me`, `create-plan`, and `project-analyze`](#skills),
see below — plus 9 subagents: 5 that back ask-me's optional critique-panel
step, 2 that back create-plan, and 2 that back project-analyze (see
[Agents](#agents)). This started as a clean plugin/marketplace shell, ready
for the first agent or skill to be added.

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
`create-skill` subagent.

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
│   └── create-analyze.md    # project-analyze's per-category doc-writing subagent
├── skills/
│   ├── ask-me/
│   │   └── SKILL.md         # ask-me skill definition
│   ├── create-plan/
│   │   └── SKILL.md         # create-plan skill definition
│   └── project-analyze/
│       └── SKILL.md         # project-analyze skill definition
├── docs/
│   └── ask-me.md            # how ask-me works, in plain terms
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
`create-plan` should trigger and hand off to `plan-writer`.

## Roadmap

To add a new agent, drop a `.md` file in `agents/`. To add a new skill, add a
`<skill-name>/SKILL.md` directory under `skills/`. Both are picked up
automatically — nothing in `.claude-plugin/plugin.json` or
`.claude-plugin/marketplace.json` needs to change for a new agent or skill
to be discovered.

## License

MIT — see [LICENSE](LICENSE).
