---
name: implement
description: Explicit-invoke skill (run via /implement) that implements a piece of work from an existing spec (docs/specs/ or a release-plan step) or set of tickets (docs/tickets/ or GitHub issues labeled ready-for-agent) — using TDD where reasonable seams exist, regular type-checking and test runs, a code-review pass, and a commit. Also tracks progress on the linked release-plan step (Not Started/In Progress/Done/Postponed), refreshes stale docs/analyze/ documentation, and — with confirmation at each step — pushes, opens a PR, and after merge closes the linked issue and cleans up the branch. Does not auto-trigger from conversation; the user must run /implement.
disable-model-invocation: true
---

# implement

Implement the work described by the user, sourced from a spec (`docs/specs/`
or a `docs/release-plans/references/.../*.md` step doc) or a set of tickets
(`docs/tickets/` or GitHub issues labeled `ready-for-agent`).

## Instructions

1. Identify the spec or ticket(s) to implement, and resolve their links:
   - If the user names a file or issue, read it directly.
   - If the user just says "implement this" right after a `to-specs` or
     `to-tickets` run in this conversation, use that output.
   - If nothing is in scope, ask the user which spec or ticket(s) to
     implement rather than guessing.
   - **Release-plan link**: if the spec file lives at
     `docs/release-plans/references/{plan}/{phase}/{step}.md`, capture
     `{plan}`, `{phase}`, and `{step}` from that path. Otherwise, only ask if
     the user implies a plan is involved. If no plan is linked, skip steps 2
     and 7 below silently — do not invent a plan reference.
   - **Issue link**: use a directly given issue URL/number if there is one;
     otherwise, if the ticket looks GitHub-sourced, try
     `gh issue list --search "<title>" --label ready-for-agent` to find it.
     If no issue is found (or the project has no GitHub remote), skip steps
     9 and 10 below silently.
2. If a release-plan step was resolved, mark it in progress: in the main
   plan doc (`docs/release-plans/{plan}.md`), change that step's line to
   `- [ ] [Step {phase}.{step}: {title}](references/{plan}/{phase}/{step}.md) (In Progress)`
   — only the status word changes; leave the checkbox, link, and title
   exactly as they are. Touch no other step.
3. Use the `/tdd` skill where reasonable, pre-agreed test seams exist — don't
   force TDD onto glue code, config, or wiring that has no natural seam.
4. Run type-checking regularly as you go, and run single test files
   regularly rather than waiting until the end.
5. Run the full test suite once, at the end, before considering the work
   done.
6. Once implementation is done, use the `/code-review` skill to review the
   work.
7. Commit the work to the current branch.
8. If a release-plan step was resolved, update its status: `(Done)` if the
   step's acceptance criteria are met by the commit, or `(Postponed)` with a
   stated reason if work stops incomplete. Never touch other steps or the
   plan's phase/step structure — if implementation surfaces new steps or
   scope the plan doesn't cover, tell the user and point them at
   `create-plan`/`plan-writer` to extend it; do not edit structure here.
9. Check whether the target project's `CLAUDE.md` has a `## Project
   Analysis` marker heading (added by `create-analyze`). If it doesn't,
   skip this step silently — there's nothing to refresh. If it does, map
   the files touched by this implementation's commit(s) to
   `project-analyze`'s categories (schema/migration files → database;
   API/route/handler files → backend, and `system/api-documentation.md` if
   present; UI/component files → frontend; test files → test; broad
   structural changes → system). If any category's docs look impacted, tell
   the user which docs look stale and why, then invoke the `analyzer`
   subagent directly via the `Agent` tool — not through the
   `project-analyze` skill wrapper — passing that scoped category list, the
   same way `plan-writer` does when it detects a gap.
10. Ask the user whether to push the branch and open a PR now.
    - If yes: push the current branch, then `gh pr create`, including
      `Closes #<n>` in the body when an issue was linked in step 1 (so
      GitHub auto-closes it on merge). Report the PR URL back to the user.
    - If no: stop here. Tell the user PR/merge is on them, and that
      re-running `/implement` later will pick up post-merge cleanup.
11. If an issue was linked in step 1, check whether the work has been
    merged:
    - Look up the PR for the current branch with
      `gh pr view --json state,mergedAt`. If no PR is found for the branch,
      ask the user directly whether it's already been merged some other
      way.
    - If not merged: skip cleanup and tell the user it's pending a merge.
    - If merged: close the linked issue if it's still open
      (`gh issue close <n> --comment "Implemented and merged in <branch>."`),
      then ask for explicit confirmation to delete the branch. If confirmed,
      delete it both locally (`git branch -d <branch>`) and on the remote if
      it exists (`git push origin --delete <branch>`).

<constraints>
- Do not implement work that has no spec or ticket in scope — ask first
  rather than inventing requirements.
- Do not skip the `/code-review` pass.
- Never restructure the release plan (phases/steps) — only the status word
  of the one step being worked changes here; structural edits belong to
  `plan-writer`.
- Never push, open a PR, merge, close an issue, or delete a branch without
  explicit confirmation for that specific action.
- Never force-delete a branch (no `-D`), and never delete the default/main
  branch.
- Silently skip the release-plan and analysis-doc steps when nothing is
  linked — don't invent a plan or issue reference that wasn't there.
</constraints>
