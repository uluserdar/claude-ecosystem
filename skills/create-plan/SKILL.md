---
name: create-plan
description: Use to turn a goal, feature request, or release idea into a structured, multi-phase implementation plan with progress tracking, saved to docs/release-plans/ in the current project. ALWAYS trigger this skill on explicit phrases like "create a plan", "make a release plan", "plan this out", "let's plan this release", "break this into phases", "write a project plan", "draft a roadmap for this", "plan the steps", "add a phase/step to the plan", "extend the release plan", "update our plan doc". Also trigger on indirect planning language such as "how should we sequence this work", "let's structure this feature into stages", "turn this into a step-by-step plan we can track", or when the user names an existing plan file and asks to add work to it. Do NOT trigger for simple to-do lists with no phase/step structure, for one-off task requests, or for updating the status of an existing step (marking something Done/In Progress) — this skill only creates or extends plan structure, it does not manage progress state.
---

# create-plan

This skill's only job is to hand off to the `plan-writer` subagent, which runs the full interactive planning interview and generates the plan files. Do not run the interview yourself, do not draft phases/steps yourself, and do not write any files yourself.

## Instructions

1. Determine whether this is a **new plan** or an **extension of an existing plan**:
   - If the user references an existing plan document (by name, or by pointing at a file under `docs/release-plans/`), this is an extension.
   - Otherwise, this is a new plan.
2. Invoke the `plan-writer` subagent via the `Agent` tool, passing along:
   - The user's stated goal or request, verbatim.
   - Whether this is a new plan or an extension, and if extension, which file.
   - Any relevant project context already established in the conversation.
3. `plan-writer` owns the entire interview, drafting, generation, and any specialized-skill delegation end to end — do not duplicate or second-guess its work.
4. Once `plan-writer` finishes, relay its summary and output paths back to the user.

<constraints>
- This skill delegates 100% of interview and generation work to `plan-writer`. It has no standalone planning logic of its own beyond routing.
- This skill does not update progress status on existing steps (e.g., marking a step Done) — that is explicitly out of scope for both this skill and `plan-writer`.
</constraints>
