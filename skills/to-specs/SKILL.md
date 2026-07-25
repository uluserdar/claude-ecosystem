---
name: to-specs
description: Turns the current conversation (and, if relevant, an existing release-plan step) into a full spec/PRD — no interview, just synthesis of what's already been discussed — and offers to publish it as a GitHub issue. ALWAYS trigger on explicit phrases like "turn this into a spec", "write a spec for this", "spec this out", "convert this step into a spec", "make this a PRD", "spec out what we just discussed". Do NOT trigger for creating a brand-new release plan from scratch (that's create-plan), for marking an existing step's progress status (Done/In Progress/etc.), or when the user just wants a quick summary rather than a structured spec document.
---

# to-specs

This skill's only job is to hand off to the `spec-writer` subagent, which
synthesizes a spec from the current conversation and codebase context and
writes it to disk. Do not draft the spec yourself, do not interview the
user for spec content, and do not write any files yourself.

## Instructions

1. Invoke the `spec-writer` subagent via the `Agent` tool, passing along:
   - Everything relevant that's been discussed in this conversation so far
     (the spec is synthesized from this — never re-ask the user to restate
     it).
   - Any explicit reference the user made to a release-plan plan/phase/step
     this spec is for, if mentioned.
2. `spec-writer` owns target-file detection, codebase exploration, seam
   sketching, spec synthesis, file writing, and the optional GitHub-publish
   step end to end — do not duplicate or second-guess its work.
3. Once `spec-writer` finishes, relay its summary (file path, and issue URL
   if one was created) back to the user.

<constraints>
- This skill delegates 100% of spec synthesis and generation work to
  `spec-writer`. It has no standalone spec-writing logic of its own beyond
  routing.
- This skill runs standalone only — it is never invoked by, and never
  invokes, `create-plan` or `plan-writer`. Creating a new release plan is
  entirely out of scope here.
- This skill does not interview the user for spec content — it only
  synthesizes from what's already in the conversation.
</constraints>
</content>
