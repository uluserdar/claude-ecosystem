---
name: ask-me
description: Use to produce a deeply analyzed, contradiction-free, sourced final answer to the user's question. This skill is an advanced version of prompt-generator; however, instead of producing a prompt as output, it produces a direct answer to the question. ALWAYS use this skill when the user uses explicit phrases like "ask-me", "answer in depth", "analyze this question", "resolve contradictions and answer". Also ALWAYS trigger this skill when the user asks with indirect phrases like "what do you think about this", "research and tell me", "which one makes more sense", "summarize comprehensively/in depth", "find me the most accurate answer" — or asks a complex, multi-part question that requires research/analysis, or one that potentially contains contradictory information — even if the user never uses the word "ask-me". Do not use it for simple, one-sentence, directly answerable questions.
---

# ask-me

This skill is an analysis process that runs the user's question through a prompt-generator-style interrogation process, breaks it into sub-parts to analyze, resolves contradictions through in-depth questioning, and ultimately produces a detailed, sourced, formatted (markdown) answer both in chat and as a downloadable/copyable `.md` file.

**This skill's only job is to answer the question.** It does not create agents, subagents, or projects; it only analyzes and answers.

Follow the round order below — do not skip rounds or change their order unless the user explicitly asks you to.

## Round 1 — Free-text exploration (one question → one answer)

**Goal:** Analyze the request and identify environmental factors (context, setting, purpose).

Start with the question: **"What do you want to learn/solve?"**

In this round:
- **Never offer options or buttons.** Questions must be entirely free-text and conversational in style (no option-based tools are used in this round).
- **Ask only one question at a time**, wait for the answer, then ask the next question. Don't list multiple questions in a row. This rule applies unconditionally — whether the question is short or long/detailed, it's asked as a single question.
- **Questions should be short and clear by default.** Keep questions short unless the user asks you to elaborate on a topic. If the user requests something like "elaborate on this a bit more," you can ask that single question in a longer/more explanatory way — but it still remains a single question, not split into multiple.
- **Each question should have a single focus.** Don't combine multiple topics in one question sentence (e.g., don't ask "can you describe the context and the expected scope?" as two different things in one question). Each question should focus on only one of the areas below; clarify that area before moving to the next.
- **Total question limit:** In this round, ask at least 3 and at most 10 questions (except for the minimum-3 exception below). You can finish earlier if the topic is sufficiently clarified before reaching 10 questions (subject to the minimum-3 requirement, except in the exception case). Exception: if the request is still not clear once 10 questions are reached (ambiguity, contradiction, or missing information persists), you may continue past the limit of 10 — clarity takes priority.
- **Minimum-3-question exception:** If the user has already spontaneously and thoroughly explained most of the 4 areas below in their first message (context, scope, constraints, etc.), the minimum-3-question requirement relaxes — only ask about the area(s) that genuinely remain unclear; if no area remains unclear, you can end this round with 1-2 questions, or even no questions at all.
- Based on the user's initial answer, clarify the following areas one by one — skip points already covered in their answers, you don't have to ask about all of them:
  1. What exactly the question is (what the user actually wants to learn/solve)
  2. Context (for what purpose they're asking, which setting/situation it relates to)
  3. Expected scope of the answer (how much detail, which angles should be covered)
  4. Additional information/constraints they have (things they know or assume, things that should be excluded)
- This round ends once enough information has been gathered to proceed (normally minimum 3, maximum 10 questions; these numbers flex if the minimum-3 exception or maximum-10 exception applies). Don't drag it out unnecessarily.

## Round 2 — Multi-select clarification

**Goal:** Expand the scope and detect conflicting requests.

Based on what was gathered in Round 1, prepare clarifying questions and ask them using the **`ask_user_input_v0`** tool with type `multi_select` (the user should be able to check more than one option).

- Questions should arise from Round 1's answers — e.g., if the user said "I want a comparison for an investment decision," this round could ask a concrete, multi-selectable question like "Which criteria should the comparison be based on? (risk / return / liquidity / tax...)"
- Goal: turn Round 1's broad answers into concrete analysis decisions (which sub-topics will be covered, which assumptions to avoid, etc.), while also expanding the scope as needed.
- Note any combinations among the user's multi-select answers (or against Round 1 answers) that conflict with each other or are nonsensical together — these contradictions will be resolved in Round 3.
- The tool allows at most 3 questions per call; make additional calls if needed.

## Round 3 — Contradiction check (single-select)

**Goal:** Resolve the contradictions detected.

Review the contradictions noted in Round 2, together with the Round 1-2 answers, to check whether there are any other contradictions or nonsensical combinations that may have been missed.

- If there is a contradiction, use the **`ask_user_input_v0`** tool with type `single_select` for each contradiction, presenting clear, mutually exclusive options for the user to choose from.
- If there is no contradiction, skip this round and briefly say "I didn't detect any contradiction in your answers" before moving to the summary.
- This round should always be single-select — the user must make a clear choice here, no multi-select.
- **Never skip this check silently.** Whether a contradiction is found or not, always report the result of the check to the user in at least one sentence before moving to the summary (either "the following contradiction(s) were detected, please choose" or "I didn't detect a contradiction").

## Source preferences (after Round 3)

**Goal:** Determine the type of sources and search depth to use during the analysis process.

After Round 3 is completed, before moving to the summary step, ask the following two questions using the **`ask_user_input_v0`** tool with type `single_select` (only one option can be selected, both are mandatory):

1. **Source type** — "Which type of sources should be used?"
   - Official sources
   - Official sources + trusted community/technical blogs
   - General sources
2. **Search depth** — "How deep should the source research be?"
   - Quick (1-3 sources/search)
   - Medium (4-8 sources/search)
   - In-depth (8-20+ sources/search, comprehensive)

These two questions can be asked together in the same `ask_user_input_v0` call (the tool allows at most 3 questions per call). These two preferences are included in the summary that follows immediately, and the user can also change them while confirming the summary.

## Summary and confirmation

After the three rounds and the Source preferences step are completed:

1. Show a short, bulleted summary of every decision gathered (the actual question, context, scope, constraints, source type and search depth preferences — including everything clarified in Round 2/3 and the Source preferences step).
2. Ask the user: **"Can you review this summary? Is there anything you'd like to change or add?"**
3. If the user requests a correction on an item, don't just accept the new value as-is — do a small in-depth follow-up on that item:
   - Ask one or more free-text follow-up questions to understand exactly what needs to change and why (Round-1 style — one question at a time, no options/buttons).
   - If the change has concrete sub-options (e.g., re-scoping, changing criteria), clarify with an `ask_user_input_v0` multi_select or single_select question as appropriate (Round 2/3 style).
   - Once the item is fully clarified, update it (and re-check for any new contradiction with the other summary items), then show the full summary again.
   - Repeat this in-depth review step for every requested correction until the user is satisfied with the entire summary.
4. Once the user approves the summary, ask for a separate, explicit confirmation: **"Should I start analyzing and producing the answer based on this summary?"**
5. Only proceed once the user has clearly confirmed (yes/I approve/start, etc.). Do not begin the analysis before this confirmation.

## Analysis process (internal — not shown to the user)

After confirmation, apply the following internal analysis process. This process is not shown to the user in raw form; only the final answer is shared.

1. **Decomposition:** Break the approved question/problem into sub-questions/sub-parts that can be analyzed independently. Use step-by-step reasoning based on complexity to decide which sub-parts are necessary.
2. **Sub-part analysis:** Analyze and answer each sub-part separately. Use internal structuring with XML tags if needed (`<subquestion>`, `<analysis>`, `<finding>`, etc.) to keep the process organized. For concrete, verifiable claims, support them by searching for up-to-date sources (web search) according to the **source type** and **search depth** preference in the approved summary:
   - If source type "Official sources" was selected, prioritize only official/institutional/primary sources; if "Official sources + trusted community/technical blogs" was selected, prioritize official sources but you may also use well-known, trusted community/technical blog sources as supporting material; if "General sources" was selected, search without this restriction.
   - If search depth is "Quick," 1-3 searches suffice; if "Medium," do 4-8 searches; if "In-depth" was selected, research comprehensively by scanning a large number of sources with 8-20+ searches.
   - If directly relevant, representative example images (in web_search or image_search results) come up during site/source research, note them — they will be added to the relevant section in the final answer.
3. **Contradiction detection:** Check whether there are contradictions among the sub-part answers (e.g., does the conclusion of one sub-answer contradict the premise of another sub-answer).
4. **Resolution through in-depth questioning:** If a contradiction is detected, re-examine the conflicting points (additional analysis, additional source research, or asking the user a clarifying question if necessary) and resolve the contradiction. If multiple contradictions are detected, handle each one separately and repeat this step for each, up to a maximum of **3 rounds** (3 rounds for one contradiction doesn't affect the limit for another). If a contradiction still isn't resolved after 3 rounds, stop the internal analysis process specifically for that contradiction and ask the user: **"There's still a contradiction at this point: [short summary of the contradiction]. How should we proceed?"** — continue based on the user's direction.
5. **Merging:** Merge the verified sub-answers, with contradictions resolved, into a single, coherent final answer.

## Final answer

Present the final answer to the user with these rules:

- **The answer must be entirely formatted markdown.** Headings (`##`, `###`), bulleted/numbered lists, and tables where needed are used freely. Markdown (bold, italic, links, code blocks, etc.) can be used within the body text.
- **Build the structure around the content.** Organize the answer under headings corresponding to the sub-parts of the question (e.g., each sub-question/analysis topic gets its own heading). Use tables for multi-dimensional information like comparisons, criteria, or numerical data; use bullets/numbering for sequential steps or list-like points.
- **If there's an image, show it under/next to the relevant heading.** If a directly relevant image is found during source research (web_search or image_search), don't put it in a separate section — place it directly under or right next to whichever heading/section/sentence it relates to, using markdown image syntax (`![description](url)`).
- If no image is found, or none is directly relevant/useful, adding an image is not mandatory.
- **Be detailed.** Don't skim the surface; address it at the depth the question requires.
- **Don't rely on assumptions.** Clearly state points you're not sure about; don't fill gaps with assumptions.
- **Sources/references are mandatory.** Cite real, up-to-date sources wherever possible (using web search). If no reliable source can be found for a claim, don't make one up — clearly state "no verifiable source could be found for this."
- Respect copyright restrictions: summarize in your own words when quoting from sources, don't do long direct quotes.
- **The answer must also be produced as a file.** Create the entire final answer, prepared according to the rules above, as a `.md` file (`create_file`) and present it to the user (`present_files`) — so the user can download or easily copy the answer. The file's content must be identical to the text shown in chat; you can give a short summary/intro sentence in chat and then present the file, but the full text of the final answer must also be present in the file.

<constraints>
- Don't change or skip the round order (unless the user explicitly asks).
- Never offer options/buttons in Round 1; ask_user_input_v0 can be used in Round 2, Round 3, the Source preferences step, and the correction loop in the Summary — never in Round 1.
- The minimum-3-question requirement in Round 1 only relaxes if the user has already thoroughly explained the relevant areas in their first message; otherwise the minimum-3-question rule applies.
- Source type and search depth questions are not asked in Round 2; these two questions are asked in a separate step (single_select) after Round 3 is completed, before the summary, and are never skipped.
- Round 3 must always be single-select, and its result (whether a contradiction is found or not) must always be reported to the user in at least one sentence; never skip this step silently.
- Don't start the analysis process until the summary is approved and a separate "should I start?" confirmation is obtained.
- The contradiction-resolution loop in the analysis process is limited to at most 3 rounds; if a contradiction still remains after 3 rounds, ask the user — don't proceed silently.
- Source research is done according to the source type and search depth preference in the approved summary (refer to the summary, not the initial answer in the Source preferences step — the user may have changed these preferences during the summary stage).
- The final answer must be entirely formatted markdown: headings, bullets/numbering used freely, tables where needed. If there's an image, place it under/next to the relevant heading, not in a separate section.
- The final answer is not only shown in chat; it must also be created as a `.md` file (`create_file`) and presented to the user (`present_files`) — so the user can download/copy it. This step is never skipped.
- Don't make unsourced, fabricated claims; if there's no source, say so explicitly.
- This skill only answers questions; it does not create agents, subagents, or projects.
</constraints>
