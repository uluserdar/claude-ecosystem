---
name: project-analyze
description: Use to generate a structured set of project analysis/documentation Markdown files under docs/analyze/ in the current project, covering system, database, backend, frontend, and test aspects — either by interviewing the user about a new/empty project's intended design, or by reading an existing codebase and reporting what's actually there. ALWAYS trigger on phrases like "analyze this project", "analyze the codebase", "proje analizi yap", "sistem analizi yap", "generate analysis docs", "document this project's architecture", "create an ER diagram for this project", "bu proje için analiz dokümanı oluştur", "veritabanı analizi yap", "backend/frontend analizi yap", "create API documentation for this project", "document the Docker setup". Also trigger on requests to document technology stack, architecture diagrams, folder structure, naming conventions, or refactor/improvement suggestions for the current project. Do NOT trigger for release/feature planning (use create-plan instead) or for one-off questions about a single file that don't call for generated documentation.
---

# project-analyze

This skill's only job is to hand off to the `analyzer` subagent, which owns the entire mode detection, interview/analysis, and documentation-generation flow. Do not analyze the codebase yourself, do not interview the user yourself, and do not write any files yourself.

## Instructions

1. Invoke the `analyzer` subagent via the `Agent` tool, passing along:
   - The user's stated request, verbatim.
   - Any relevant project context already established in the conversation.
   - Model: read `agentModel["analyzer"]` from `.claude/claude-ecosystem-settings.json`,
     falling back to `agentModel.default`; pass whichever resolves as the `model`
     parameter, or omit `model` entirely if neither is set.
2. `analyzer` owns mode detection (new/empty project vs. existing project), the interview or codebase analysis, technology-skill gap detection and resolution, and delegating document generation to `create-analyze` — do not duplicate or second-guess its work.
3. Once `analyzer` finishes, relay its summary and output paths back to the user.

<constraints>
- This skill delegates 100% of analysis and generation work to `analyzer`. It has no standalone analysis logic of its own beyond routing.
- This skill does not manage or update progress status on existing suggestion/refactor checklists — that is left to manual editing.
</constraints>
