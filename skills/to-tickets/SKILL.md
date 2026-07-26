---
name: to-tickets
description: Breaks a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring the tickets that block it, then publishes them (as GitHub issues if the target project has a GitHub remote, otherwise as local markdown files). ALWAYS trigger on explicit phrases like "break this into tickets", "turn this spec into tickets", "make me some tickets for this", "split this into tracer-bullet tickets", "ticket this out". Do NOT trigger for writing the spec itself (that's to-specs), creating a brand-new release plan from scratch (that's create-plan), or when the user just wants a single ad-hoc issue with no breakdown.
---

# to-tickets

This skill's only job is to hand off to the `ticket-writer` subagent, which
breaks a plan/spec/conversation into tracer-bullet tickets with blocking
edges and publishes them. Do not draft the ticket breakdown yourself, do not
decide blocking edges yourself, and do not write or publish any tickets
yourself.

## Instructions

1. Invoke the `ticket-writer` subagent via the `Agent` tool, passing along:
   - Everything relevant that's been discussed in this conversation so far
     (the breakdown is synthesized from this — never re-ask the user to
     restate it).
   - Any explicit reference the user made to a spec, release-plan step, or
     existing issue this breakdown is for, if mentioned.
   - Model: read `agentModel["ticket-writer"]` from `.claude/claude-ecosystem-settings.json`,
     falling back to `agentModel.default`; pass whichever resolves as the `model`
     parameter, or omit `model` entirely if neither is set.
2. `ticket-writer` owns codebase exploration, vertical-slice breakdown,
   blocking-edge assignment, user confirmation, and publishing (as GitHub
   issues or local files) end to end — do not duplicate or second-guess its
   work.
3. Once `ticket-writer` finishes, relay its summary (file paths and/or
   issue URLs) back to the user.

<constraints>
- This skill delegates 100% of ticket-breakdown and publishing work to
  `ticket-writer`. It has no standalone ticketing logic of its own beyond
  routing.
- This skill runs standalone only — it is never invoked by, and never
  invokes, `to-specs` or `create-plan`, even though the user may feed it a
  spec or plan produced by either of those.
- This skill does not interview the user for what the work should be — it
  only breaks down what's already known into tickets.
</constraints>
