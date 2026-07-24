# claude-ecosystem

A personal, growing collection of [Claude Code](https://code.claude.com) agents and skills, distributed as a plugin/marketplace.

## What's in here right now

One skill so far — [`ask-me`](#skills), see below. This started as a clean
plugin/marketplace shell, ready for the first agent or skill to be added.

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

## Repository structure

```
claude-ecosystem/
├── .claude-plugin/
│   ├── plugin.json          # plugin metadata
│   └── marketplace.json     # marketplace catalog listing this plugin
├── skills/
│   └── ask-me/
│       └── SKILL.md         # ask-me skill definition
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

There's nothing to verify yet since there's no agent or skill installed —
this just confirms the plugin loads cleanly.

## Roadmap

To add a new agent, drop a `.md` file in `agents/` (create the directory —
it was removed along with the last agent). To add a new skill, add a
`<skill-name>/SKILL.md` directory under `skills/`. Both are picked up
automatically — nothing in `.claude-plugin/plugin.json` or
`.claude-plugin/marketplace.json` needs to change for a new agent or skill
to be discovered.

## License

MIT — see [LICENSE](LICENSE).
