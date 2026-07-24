# How `ask-me` works

`ask-me` turns a question into a deeply analyzed, contradiction-checked,
sourced final answer. It's an evolved version of a prompt-generator
pattern — but instead of handing you back a prompt to run elsewhere, it
does the analysis itself and hands you back the answer.

It only answers questions. It never creates agents, subagents, or
projects.

## When it triggers

- Explicitly, when you say things like *"ask-me"*, *"answer this in
  depth"*, *"analyze this question"*, or *"resolve the contradictions and
  answer"*.
- Implicitly, for questions that are complex, multi-part, research-heavy,
  or where the answer could plausibly contain internal contradictions —
  even if you never say "ask-me".
- It does **not** trigger for short, direct questions with an obvious
  one-line answer.

## The flow

The skill always moves through the same sequence of rounds. It won't skip
or reorder them unless you explicitly ask it to.

### Round 1 — Free-text discovery

Starts with: **"What do you want to learn/solve?"**

- One question at a time, plain conversational text — no multiple-choice
  buttons in this round.
- Each question has a single focus: what the question actually is, the
  context behind it, how much depth/scope you expect, and any
  constraints or existing assumptions you want respected.
- Normally asks at least 3 and at most 10 questions, stopping earlier once
  things are clear. If you've already answered most of this in your first
  message, it can skip straight past this round with little or no
  questioning. If things are still unclear after 10 questions, it keeps
  going rather than guessing.

### Round 2 — Multiple-choice scoping

Turns Round 1's answers into concrete, selectable decisions — e.g. "which
criteria should the comparison use? (risk / return / liquidity / tax...)".
These are multi-select: you can pick more than one option. Any
combinations that look contradictory or nonsensical get flagged for
Round 3.

### Round 3 — Contradiction check

Re-reviews everything gathered so far for contradictions or
combinations that don't make sense together. If any are found, you're
asked to pick one option from mutually exclusive choices (single-select
this time). If none are found, it says so explicitly before moving on —
this check is never skipped silently.

### Source preferences

Three quick single-select questions:

1. **Source type** — official sources only / official + trusted
   community & technical blogs / general sources.
2. **Search depth** — quick (1–3 sources per search) / medium (4–8) /
   deep (8–20+, comprehensive).
3. **Critique panel** — whether a 5-agent critique panel should review
   the final answer before it's delivered (yes/no).

### Summary and approval

Everything gathered gets shown back to you as a bulleted summary. You can
request changes to any point — each change gets its own short follow-up
before the summary updates and is re-shown. Only after you give a
separate, explicit "go ahead" does the actual analysis start.

## What happens after approval (internal — not shown to you)

1. **Decomposition** — the approved question is split into independent
   sub-questions.
2. **Sub-answer analysis** — each sub-question is researched and answered
   on its own, using web search at the depth and source type you chose.
   Relevant images found along the way are noted for later.
3. **Contradiction detection** — sub-answers are checked against each
   other.
4. **Resolution** — any contradiction found gets up to 3 rounds of
   re-analysis to resolve. If a specific contradiction still isn't
   resolved after 3 rounds, the skill stops and asks you directly how to
   proceed, rather than picking a side silently.
5. **Synthesis** — the verified, contradiction-free sub-answers are
   merged into one coherent final answer.
6. **Critique panel** *(only if you opted in)* — 5 independent
   subagents, each with a fixed role, review the merged answer in
   parallel without seeing each other's critiques: a **Devil's
   Advocate** (what could go wrong), a **First-Principles Thinker**
   (is this the right problem), an **Opportunity Hunter** (what's being
   overlooked), an **Outside Eye** (a fresh, independent read), and a
   **Practitioner** (how to test this with the lowest risk). The main
   agent then weighs all 5 critiques and revises the answer where
   warranted — a single pass, not a loop. The critiques themselves stay
   internal; at most a short note makes it into the final answer if one
   of them changed something material.

## The final answer

- Fully formatted Markdown — headings, lists, tables where useful.
- Structured around the sub-questions/topics it analyzed, not a single
  wall of text.
- Relevant images (found during source research) are placed inline next
  to the section they relate to, not dumped in a separate section.
- Detailed rather than surface-level, and explicit about anything it
  isn't sure of — it doesn't fill gaps with assumptions.
- Backed by real, current sources wherever possible; if no reliable
  source exists for a claim, it says so rather than inventing one.
- Delivered twice: once in the chat, and once as a standalone
  downloadable/copyable `.md` file with identical content.

## Design constraints worth knowing

- Round order is fixed unless you explicitly ask to skip ahead.
- Multiple-choice tools are never used in Round 1 — only free text.
- Round 3 is always single-select, and always reports its outcome
  (contradiction found or not) — never silent.
- Analysis never starts before you've approved the summary *and* given a
  separate final go-ahead.
- Contradiction resolution during analysis is capped at 3 rounds per
  contradiction before it's escalated back to you.
- The critique panel is opt-in, runs once (no re-review loop), and its
  5 raw critiques are never shown to you — only their effect on the
  final answer, if any.
