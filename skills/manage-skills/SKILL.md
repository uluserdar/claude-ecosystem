---
name: manage-skills
description: Creates a new skill, or diagnoses and improves an existing skill (including auto-generated domain skills like a ".NET developer" skill that later prove insufficient) in the target project's .claude/skills/ directory as the project evolves. ALWAYS trigger on phrases like "bu skill'i geliştir", "şu skill yetersiz kaldı, kendini geliştirsin", "şu skill'in description'ını netleştir", "yeni bir skill oluştur", "improve this skill", "this skill couldn't handle X, fix it", "bu iş için bir skill yazalım". Do NOT trigger for creating specialized-domain skills already covered by other flows invoking create-skill directly (e.g. plan-writer's on-demand skill creation), and do not trigger for editing agents/subagents (that's a manual task, not this skill's job).
---

# manage-skills

This skill's only job is to hand off to the `skill-writer` subagent, which
creates a new skill or improves an existing one in the target project's
`.claude/skills/` directory. Do not draft the skill content yourself, do not
decide create-vs-improve yourself, and do not write or edit any skill files
yourself.

## Instructions

1. Invoke the `skill-writer` subagent via the `Agent` tool, passing along:
   - Everything relevant discussed in this conversation so far (what the
     skill should do, or what's wrong/missing in an existing skill).
   - Any explicit skill name or file path the user referenced.
2. `skill-writer` owns duplicate-checking, create-vs-improve mode detection,
   interviewing (for new skills), diagnosis and targeted editing (for
   existing skills), and file writing end to end — do not duplicate or
   second-guess its work.
3. Once `skill-writer` finishes, relay its summary (which mode ran, what was
   diagnosed if improving, file path, what changed) back to the user.

<constraints>
- This skill delegates 100% of skill-authoring/refining work to
  `skill-writer`. It has no standalone logic of its own beyond routing.
- This skill only manages skills in the target project's `.claude/skills/`
  — it never touches claude-ecosystem's own `skills/`/`agents/` directories.
- This skill does not decide on its own whether to create or improve, nor
  what's wrong with an existing skill — that diagnosis belongs to
  `skill-writer`, which checks actual repo state and conversation context.
</constraints>
