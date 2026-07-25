---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Explicit-invoke only (run via /handoff) — does not auto-trigger from conversation.
disable-model-invocation: true
---

# handoff

Write a handoff document that summarizes the current conversation so a
fresh agent can pick up the work with no other context.

## Instructions

1. Compact the conversation into why we got here, what's been
   learned/tried so far, the current state, and the next step(s) —
   written for an agent that has none of this conversation's context.
2. Save the document to the user's OS temp directory (`$TMPDIR`/`/tmp` on
   macOS), never to the current project workspace.
3. Include a **"Suggested skills"** section recommending which of this
   plugin's skills (`ask-me`, `create-plan`, `project-analyze`, `to-specs`,
   `to-tickets`, `implement`, `manage-skills`) the next agent should invoke,
   based on where the conversation left off.
4. Don't duplicate content already captured in another artifact (specs,
   plans, ADRs, issues, commits, diffs) — reference it by file path or URL
   instead.
5. Redact sensitive information — API keys, passwords, personally
   identifiable information — before writing anything to disk.
6. If the user passed arguments, treat them as a description of what the
   next session will focus on and tailor the document accordingly.
7. Once written, tell the user the saved file path.

<constraints>
- Always save to the OS temp directory — never to the project workspace or
  any path under version control.
- Never auto-triggers from conversation (`disable-model-invocation: true`,
  ported as-is from its source) — only runs via explicit `/handoff`.
- Never re-author content that already lives in another artifact — link to
  it instead of copying it.
- Never skip the sensitive-data redaction step.
</constraints>
