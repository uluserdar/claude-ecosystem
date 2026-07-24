# claude-ecosystem

A personal, growing collection of [Claude Code](https://code.claude.com) agents and skills, distributed as a plugin/marketplace.

## What's in here right now

Nothing yet — this is a clean plugin/marketplace shell, ready for the first
agent or skill to be added.

A PDF-to-Markdown subagent (`pdf-to-md`) was built and tested here first,
but was removed: forcing every PDF interaction through a subagent (via a
`PreToolUse` hook blocking direct reads) added latency and failure modes
without a clear enough win over Claude's own native PDF reading, and a
chat-attached PDF (via the VS Code extension's attach/drag-and-drop) turns
out to bypass tool-based hooks entirely — it's embedded directly as
multimodal message content, so there was no reliable way to route it
through a subagent anyway. Letting the main agent handle PDFs directly,
with no plugin involvement, works better in practice.

## Repository structure

```
claude-ecosystem/
├── .claude-plugin/
│   ├── plugin.json          # plugin metadata
│   └── marketplace.json     # marketplace catalog listing this plugin
├── skills/                  # reserved for future skills — currently empty
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
