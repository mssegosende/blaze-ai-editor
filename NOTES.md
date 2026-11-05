# Blaze notes

Working notes: what the brief asks for, what proves it, and why each key decision was made.

Status values: `planned` (nothing exists yet), `done` (the named file or test exists and passes), `manual` (checked by hand, no automated test possible).

## Requirement matrix

Test names are the names the tests will have. Update the status when a row is proven.

### From the brief, in its exact words

**The Challenge**

| # | Brief | Proof (file or test) | Status |
|---|---|---|---|
| C1 | "Don't build a full markdown editor from scratch, a prebuilt like tiptap or similar is fine." | `package.json` (`@tiptap/*`) | done |
| C2 | "The user is always in control" | test "the document does not change until accept" | done |
| C3 | "rewrite paragraphs" | Rewrite command in `src/constants.ts`; test "accepting every change reproduces the rewrite exactly" | done |
| C4 | "fix tone" | More formal and Warmer commands in `src/constants.ts`; `server/prompt.test.ts` | done |
| C5 | "restructure sections" | `server/prompt.test.ts`: "only a section target is allowed to restructure"; tests "accepting a restructured section is one transaction", "a restructured section keeps headings, lists, bold and links"; decision 15 | done |
| C6 | "follow specific instructions" | Ask field in `src/components/SelectionPill/` and `src/components/CommandPalette/`; `server/prompt.test.ts`: "a free-text instruction on a first request reaches the model unchanged"; a free-text first request was run in a browser against the real model | done |

**What to Build**

| # | Brief | Proof (file or test) | Status |
|---|---|---|---|
| B0 | "A single page web app, no auth required" | `src/App.tsx` (no router, no login) | done |
| B1 | "The user can write and edit Markdown in a browser-based editor" | `src/components/EditorPane/`; test "markdown round trip keeps headings, lists, bold and links" | done |
| B2 | "An AI agent can suggest changes to the document (or a selection)" | Decisions 7 and 14; `src/lib/sections.ts`; tests "a selection request sends only the selected Markdown", "the current section is the blocks under the cursor's heading", "a section command sends only that section" | done |
| B3 | "Suggestions appear as visible diffs — the user can see exactly what the AI wants to change before accepting" | `src/components/DiffView/`; `src/lib/diff.test.ts`; test "a paragraph split shows up as a visible change" | done |
| B4 | "The user can accept, reject, or refine the AI's suggestions" | tests "accepting every change reproduces the rewrite exactly", "rejecting every change reproduces the original exactly", "partial accept keeps only the chosen changes"; `server/prompt.test.ts`: "a refine request sends the original, the current suggestion and the instruction" | done |
| B5 | "The experience feels collaborative — like working with a smart co-author, not a chatbot in a sidebar and not something that completes the whole document" | No chat history anywhere in the UI; still needs your own walkthrough; `SYSTEM_PROMPT` in `server/prompt.ts`; test "a section command sends only that section" | manual |

**What to Submit**

| # | Brief | Proof (file or test) | Status |
|---|---|---|---|
| D1 | "Host your code on GitHub or GitLab and send us the link" | Repository link at submission | planned |
| D2 | "Include a README with: how to run it, what you built, and what you'd do differently with more time" | `README.md`, with all three headings; the mock adapter under "with more time" | planned |
| D3 | "Save your AI session(s)", "raw, unedited session files exactly as your tool saved them", "The only change allowed is to mask secrets", "commit the files to the git repository along with the project code" | Folder chosen at delivery; see "Delivery checklist" | planned |

**What We Evaluate**

| # | Brief | Proof (file or test) | Status |
|---|---|---|---|
| E1 | The experience: "Is it intuitive? Can we open it, write something, and get useful AI suggestions without reading docs?" | S25 (first-open state); `src/lib/editorDocument.test.ts` and `src/lib/applySuggestion.test.ts`: suggestions on text just typed; a browser run from typing to accept | done |
| E2 | AI integration quality: "Does the agent feel like a collaborator or a gimmick? Are diffs clear and useful?" | "Model comparison" and "Context comparison" below; `src/lib/diff.test.ts`; rationale shown in the card | done |
| E3 | How you used AI to build it: "Did you use AI tools effectively to ship faster? Can you explain the choices made?" | "Decisions" below; session files (D3); `CLAUDE.md` | planned |
| E4 | Code quality: "Is the code organized, readable, and something a teammate could pick up?" | `CLAUDE.md`; `pnpm lint`; `pnpm build`; `pnpm test` | planned |
| E5 | Taste & judgment: "What did you prioritize? What did you intentionally leave out? Trade-offs matter more than features." | `README.md`; "Decisions" below | planned |

**What We Don't Care About**

| # | Brief | Proof (file or test) | Status |
|---|---|---|---|
| N1 | "Docker, databases, auth systems — don't add infrastructure you don't need" | `package.json`; no such files in the repository | done |
| N2 | "Visual perfection — but it should be usable and not broken" | Browser runs of the core flow; S17 for accessibility; still needs your own walkthrough | manual |
| N3 | "Using a specific framework — React, Vue, Svelte, vanilla JS, whatever you're fast with" | React, per the project spec; no framework-specific claim to prove | done |

### From the project spec

| # | Requirement | Proof (file or test) | Status |
|---|---|---|---|
| S1 | Each change can be accepted or rejected separately | test "partial accept keeps only the chosen changes" | done |
| S2 | All changes can be accepted or rejected at once | tests "accepting every change reproduces the rewrite exactly", "rejecting every change reproduces the original exactly" | done |
| S3 | The diff is computed in the browser, not described by the model | `src/lib/diff.ts`; contract in `shared/contract.ts` | done |
| S4 | Bold and links survive a suggestion | tests "partial accept never leaves unbalanced bold markers", "a changed URL is one change, never half a link", "changing link text keeps the URL" | done |
| S5 | Over 60% changed shows one before/after block | tests "a full rewrite is a single before/after block", "exactly 60% changed stays word by word" | done |
| S6 | Accept is a single transaction; Ctrl+Z undoes all of it | test "one undo restores the whole accepted suggestion" | done |
| S7 | Accepting an inline selection keeps its paragraph whole | test "an inline selection does not split its paragraph" | done |
| S8 | Editing the paragraph discards the pending suggestion with a notice | tests "editing inside the paragraph discards the suggestion", "editing elsewhere keeps the suggestion and moves its range" | done |
| S9 | The request state is a reducer: idle, loading, success, error | `src/hooks/useAiRequest.ts`; `src/lib/cardView.test.ts`: "a failed refine keeps the current suggestion"; `src/hooks/useAiRequest.test.ts`: "a stale response is ignored" | done |
| S10 | One action makes one model call | `server/app.test.ts`: "a model failure makes no second call" | done |
| S11 | The API key never reaches the browser | `server/app.test.ts`: "the key goes to OpenRouter and never into a response or a log"; "Accessibility and code audit" below | done |
| S12 | Malformed model output never reaches the UI as a suggestion | `server/parseModelOutput.test.ts`; `server/app.test.ts`: "malformed model output is an error, not a suggestion" | done |
| S13 | One `pnpm dev` starts everything | `package.json` | done |
| S14 | No hardcoded colors in components | `src/styles/tokens.css`; "Accessibility and code audit" below | done |
| S15 | The app name lives in one constant | `shared/appName.ts`, used by the UI and the prompt | done |
| S16 | The UI never calls fetch directly | `src/api/`; "Accessibility and code audit" below | done |
| S17 | Accessibility: real buttons, labels, aria state, 44px targets, AA contrast | "Accessibility and code audit" below | done |
| S18 | Opens straight into the editor with the sample document | `src/sampleDocument.ts`; `src/App.tsx` | done |
| S19 | Models compared 3 times per paragraph and instruction, with agreement next to quality, speed and cost | `scripts/compareModels.ts`, `scripts/scoreComparison.ts`, `docs/model-comparison.json`; "Model comparison" below | done |
| S20 | One model recommended | "Model comparison" below; `MODEL` in `server/index.ts` | done |
| S21 | Section context kept only if it measurably helps | `scripts/compareContext.ts`, `docs/context-comparison.json`; "Context comparison" below | done |
| S22 | The section is sent as read-only context | `server/prompt.test.ts`: "the section goes along as context, separate from the passage"; test "a selection request includes its section as context" | done |
| S23 | JSON is validated without zod | `server/parseModelOutput.ts`, `parseSuggestRequest` in `server/app.ts`; decision 13 | done |
| S24 | `/` with nothing selected acts on the current section and names it | `src/lib/sections.ts`; `src/lib/editorDocument.test.ts`: "the current section is the blocks under the cursor's heading", "a title with no text of its own has no target", "the palette names its target: the section holding the cursor" | done |
| S25 | First-open state: empty co-author card, "Try one" prompts and the hint | `src/components/EmptyState/`, hint in `src/components/EditorPane/`; test "Try one is hidden when its section is gone"; manual walkthrough of a new user | done |
| S26 | Loading state with Cancel, using AbortController | `src/api/suggestClient.test.ts`: "cancel aborts the request"; the document staying unchanged was checked in a browser run | done |
| S27 | Clear error: missing key | `server/app.test.ts`: "a missing key is reported without calling the model"; `src/lib/cardView.test.ts`: "each failure has its own heading" | done |
| S28 | Clear error: budget exhausted | `server/app.test.ts`: "an exhausted budget is reported as budget_exhausted" | done |
| S29 | Clear error: network | tests "a network failure becomes a readable error", "the client reports an unreachable server" | done |
| S30 | Retry button after an error | `src/lib/cardView.test.ts`: "retry sends the same request as one new call"; the single new call was counted in a browser run | done |
| S31 | Keyboard shortcuts | `src/hooks/useShortcuts.ts`; test "typing a slash in a sentence stays text" | done |
| S32 | `/` palette | `src/components/CommandPalette/`; `src/lib/keyboard.test.ts`: "the palette moves with the arrows and wraps around"; running on Enter was checked in a browser run | done |
| S33 | Per-change row: "Change 2 of 6 ‹ › Keep Discard", plus Accept all and Reject all | `src/components/DiffView/`; test "the arrows reach every change, in both directions" | done |
| S34 | Clicking a change selects it | test "clicking a change selects it" | done |
| S35 | Contrast fixes from the mockup audit, with deleted text at least AA on the card | `src/styles/tokens.css`; "Accessibility and code audit" below | done |
| S36 | `.gitattributes` with `* text=auto`; mockup renamed to `mockup.html` | `.gitattributes`; `docs/design/mockup.html` | done |
| S37 | The first request accepts free text, in the selection pill and the palette | See C6 | done |
| S38 | A restructured section is accepted in one transaction and keeps headings, lists, bold and links | tests "accepting a restructured section is one transaction", "a restructured section keeps headings, lists, bold and links" | done |
| S39 | Suggestions work on text the user just typed, not only the sample document | test "suggestions work on text the user just typed" | done |
| S40 | Described as a deliberately single-step agent, and never denied to be one, in the README, `NOTES.md` and UI | Decision 7; `CLAUDE.md`; manual search before delivery | planned |

## Decisions

Each decision lists its expensive failure (hard to notice or damages trust) and its cheap failure (visible and easy to recover from).

### 1. The model returns `{ rewrite, rationale }`, and we compute the diff

We don't ask the model to describe edits, because a model's description of its own edits can disagree with its text. The diff shows what would really change.

- **Expensive:** the rationale misdescribes the rewrite, for example "trimmed filler" when a commitment was deleted, and the user accepts on trust.
- **Cheap:** the model returns malformed JSON. The server rejects it, the UI shows an error with a retry, and the document is untouched.

### 2. Send and receive Markdown

Bold and links survive because they are part of the text the model edits.

- **Expensive:** partial accept corrupts Markdown without any visible sign. Measured with `diff` 9.0.0: adding bold produces two separate changes (`**` and `**`), and changing a URL from `a.io/x` to `b.io/y` also produces two, so keeping one of them yields a link to `b.io/x`, an address nobody wrote.
- **Cheap:** the model writes equivalent syntax (`*` instead of `-`) and the diff shows noise. Running the rewrite through the same parse and serialize step before diffing removes it.

### 3. Refine sends the original, the current suggestion and the new instruction

The model sees where the text started and where it is now, with no chat history to grow.

- **Expensive:** the diff is computed against the previous suggestion instead of the original, so what the user reviews is not what accept would apply. The diff must always be original to latest.
- **Cheap:** a refine drops something an earlier instruction achieved ("shorter" then "warmer" gets longer again). The user sees it and refines again or steps back in the refine history. Keep and discard marks reset on each refine, because the changes themselves are new.

### 4. Over 60% changed shows a single before/after block

A word diff of a near-total rewrite is unreadable confetti. Proposed definition: changed non-whitespace characters on both sides, divided by total non-whitespace characters on both sides, must exceed 0.6. Exactly 0.6 stays word by word.

- **Expensive:** in a block, one bad change can't be rejected on its own, and a dropped fact is easier to miss. The user either takes it all or loses it all.
- **Cheap:** a rewrite near the threshold gets the less useful view. Nothing is lost.

### 5. The document changes only on accept, in a single transaction

Suggestions live outside the document until the user decides, so an abandoned suggestion can't leave anything behind.

- **Expensive:** a stale position puts the text in the wrong place. Or history grouping merges the accept with recent typing, so one Ctrl+Z also removes the user's own words. The accept must close the history group first.
- **Cheap:** Ctrl+Z pressed while focus is in the refine input undoes that input rather than the document. The toast's Undo button still works.

### 6. Editing the paragraph while a suggestion is pending discards it, with a notice

The diff was computed against text that no longer exists. The same rule applies while a request is loading: its response is dropped.

- **Expensive:** an edit goes undetected (paste, undo, drag) and accept overwrites what the user just wrote. Detection must read editor transactions, not keystrokes.
- **Cheap:** a small typo fix discards a suggestion the user wanted. They lose one model call and can ask again. The notice says why it disappeared.

### 7. A deliberately single-step agent: one action, one model call, the human approves every change

Predictable cost, predictable behavior, no chance of unrequested edits. A failed call becomes a retry button, not an automatic second call. Refine is how the work iterates, with the human choosing each step.

- **Expensive:** a reviewer expects a multi-step agent and reads this as under-delivering. The README must present the single step as a deliberate decision and point to refine as the iteration loop.
- **Cheap:** the agent never volunteers anything, so the user makes more clicks. "Try one" softens this.

### 8. A small server holds the API key

The browser never sees the key.

- **Expensive:** the key leaks through a `VITE_` prefix, a log line or a commit. Or the server listens on the network and someone else spends the cap. It must bind to `127.0.0.1`, and it must never log request headers.
- **Cheap:** `.env` is missing or empty. The server reports it and the UI shows a clear message instead of a crash.

### 9. `diffWordsWithSpace` instead of `diffWords`, with merged and atomic changes

Measured: `diffWords` fails "reject everything gives the original" on added bold (`fast today` becomes `fasttoday`) and shows zero changes for a paragraph split. `diffWordsWithSpace` passed both directions on all six test cases, but it produces more small changes, so changes separated only by whitespace get merged afterward. All changes touching one link or bold/italic pair also merge into one.

- **Expensive:** a Markdown form the span detection doesn't recognize gets split, and partial accept produces broken syntax.
- **Cheap:** a long bold sentence with two word changes becomes one change, so the user can't take just one of them.

### 10. Per-change review is one row: "Change 2 of 6 ‹ › Keep Discard"

Inline changes can't be 44px tall without wrecking the text, and one row per change would make the card about 300px taller. Clicking a change in the diff selects it.

- **Expensive:** a keyboard user can't reach a change. The arrows must reach every change without using the mouse.
- **Cheap:** the user steps through changes instead of seeing all the controls at once.

### 11. The section goes along as read-only context

The model sees the section around the selection, capped in length. The prompt tells it never to edit or repeat that text. Kept because it measurably helps: see "Context comparison".

- **Expensive:** the model edits or repeats the context, and the rewrite brings in text from outside the selection. It didn't happen in 9 runs, but 9 runs is not a guarantee, and the diff is what would expose it.
- **Cheap:** about 2% more cost on each call.

### 12. Mockup changes

Removed "Up next" (it needs extra model calls), Back and the logo link (no landing page), and the "Prototype" line. `/` opens the palette only with text selected, on an empty line, or outside the editor, so "and/or" can still be typed. `?` works only outside the editor. Mockup colors and target sizes that miss AA or 44px were changed to meet them.

- **Expensive:** `/` swallows a character the user meant to type.
- **Cheap:** the user has to select text before the palette opens.

### 13. Validate JSON by hand, without zod

Two small shapes cross a trust boundary: the browser's request and the model's reply. About 60 lines of plain checks in `server/parseModelOutput.ts` and `parseSuggestRequest` in `server/app.ts` cover both, and the tests list every rejected case by name. That is one less dependency for a reviewer to read, and the brief rewards leaving out what isn't needed.

- **Expensive:** the contract and the checks drift apart without any error. The types in `shared/contract.ts` and the checks are written separately, and the `as Record<string, unknown>` casts mean the compiler can't connect them. A field added to the contract but not to the check goes unvalidated while everything still compiles, and a bad value could reach the model or the UI. Tests cover the cases we thought of, not a field we forgot.
- **Cheap:** the checks are more verbose than a schema and their errors are less detailed. A valid reply could be rejected too strictly, which the user sees as a normal error with a retry, and the document is untouched.

If the contract grows beyond a few fields, the expensive failure gets more likely, and that is the point to adopt a schema library.

### 14. With nothing selected, `/` acts on the current section

The brief says suggestions apply "to the document or a selection". The whole document is ruled out by design, so the document case means the section holding the cursor: the blocks under its heading, up to the next heading of the same or higher level, not including the heading itself. If focus is outside the editor, the last cursor position counts. The palette header names the target ("on 'Why now'") before anything runs. A title with no text of its own, or an empty section, has no target: the palette says to select text or move the cursor.

- **Expensive:** the user thinks they're editing one sentence and the command rewrites a long section, or targets a different section than the cursor seems to be in. Nothing is applied without review, but it would look like a bug and cost trust. The named target in the header is the guard.
- **Cheap:** the user wanted a smaller scope. They reject it and select the text.

### 15. Only a section may be restructured

The brief asks for "restructure sections". When the target is a section, the agent may reorder, merge or split paragraphs and list items. A selection keeps its shape, because the user chose those exact words.

A restructure doesn't always pass 60% changed. In a real run, moving one bullet and merging two others came out as 4 separate changes, not a block. Accepted whole, it landed correctly and one undo restored it.

- **Expensive:** a reorder is accepted and a heading, list or link is lost in the conversion back to the document, or undo restores only part of it. Named tests cover both.
- **Known gap:** a moved block is one removal and one addition, so keeping only the addition leaves the text in the document twice. It is valid Markdown and visible in the diff before applying, but nothing prevents it.
- **Cheap:** the model restructures when the user only wanted a rewording. The diff shows it plainly, and the user rejects or refines.

## Model comparison

**Choice: `anthropic/claude-sonnet-5.5`.** It was the only model that neither invented commitments nor dropped claims, which are the two failures a user is least likely to catch. It costs about 27 times what Haiku does, but the USD 5 cap still allows roughly 1,000 calls at that price.

**Method.** `pnpm compare-models` uses the app's real prompt and model call. Three models, three paragraphs, each with one instruction and one "Make it warmer." refine, and every one of those run 3 times: 54 calls, all successful, USD 0.0887 in total. Raw replies are in `docs/model-comparison.json`. The candidates were picked from OpenRouter's list for structured output support and price. Run on 2026-11-05.

**Agreement between runs.** `pnpm score-models` compares the three runs of each paragraph and step, pair by pair, with no model calls: 6 groups of 3 runs gives 18 pairs per model. "Same number of changes" counts changes from the app's real diff (`src/lib/diff.ts`), recomputed from the saved replies, so it may differ from the `changes` field stored in the raw file. "Same facts kept" means both replies kept the same items from a fixed checklist per paragraph, defined in `scripts/scoreComparison.ts`.

| Paragraph | Instruction | What it tests |
|---|---|---|
| "Why now" (sample document) | Make it shorter. | Minimal edits and readable diffs |
| "Success metrics" (sample document) | Make it measurable. | Whether it invents numbers |
| Invented, with bold, a link and a figure | Make it more formal. | Whether Markdown and facts survive |

| | Claude Haiku 5.5 | GPT-6 Luna | Claude Sonnet 5.5 |
|---|---|---|---|
| Price per million tokens, input / output | $0.10 / $0.50 | $0.10 / $0.50 | $2 / $10 |
| Agreement: same number of changes | 44% (8 of 18 pairs) | 39% (7 of 18) | **78%** (14 of 18) |
| Agreement: same facts kept | 78% (14 of 18) | 89% (16 of 18) | **100%** (18 of 18) |
| Agreement: identical text | 6% (1 of 18) | 6% (1 of 18) | 17% (3 of 18) |
| Checklist facts kept | 98% (82 of 84) | 92% (77 of 84) | **100%** (84 of 84) |
| Valid JSON | 18 of 18 | 18 of 18 | 18 of 18 |
| Average cost per call | $0.00017 | $0.00015 | $0.00461 |
| Median time, first request | 2.1 s | 2.6 s | 2.2 s |
| Median time, refine | 2.4 s | 5.5 s | 4.9 s |
| Slowest call | 3.6 s | 7.4 s | 5.3 s |
| Invented numbers, lost numbers, lost URLs or bold (automatic check) | 0 of 18 | 0 of 18 | 0 of 18 |
| Replies adding a claim or commitment (read by hand) | **6 of 18** | 1 of 18 | 0 of 18 |
| Replies dropping a claim (read by hand) | 1 of 18 | **6 of 18** | 0 of 18 |
| "Why now" median: changes / percent changed | 7 / 53% | 10 / 52% | 6 / 30% |
| Rationale over the 25-word limit | 5 of 18 | 0 of 18 | 7 of 18 |
| Shown as a before/after block (over 60% changed) | 3 of 18 | 1 of 18 | 6 of 18 |

The two "read by hand" rows are my judgment after reading every reply, so check them against the raw file if they matter.

**What the numbers don't show:**

- **Haiku** adds commitments when asked to be warmer: "We know how much that frustrates people, and we want to fix it", and "we're glad to have a whole team that cares". Its "warmer" refines of the shortened paragraph also came back about as long as the original, undoing the first instruction. Two of its rationales ended with a stray `}`.
- **Luna** dropped "until the end of the day" in all six "Why now" replies, while its rationale said it was "preserving the key points". That is the expensive failure from decision 1. It was the best of the three on the Markdown paragraph, with the smallest edits.
- **Sonnet** named the words it cut in its rationales and kept the shortening through a refine. Its weakness is that its rationales run long, which only affects layout. It also removes hedges such as "a lot of the time", which slightly strengthens a claim, though the rationale says so.

- **Agreement is not correctness.** Luna's 89% on facts is higher than Haiku's partly because it drops "end of the day" every single time. Read the agreement rows together with "Checklist facts kept". For the user, high agreement means asking twice gives a similar diff, so a retry is not a lottery.

**Limits of this comparison:** three paragraphs and three runs each show a pattern, not a rate. Refine pairs start from different first replies, which lowers their agreement for every model. I wrote the fact checklist after reading the replies, and it only detects missing facts, not added ones, which is why the hand-read rows are still there. Its two "about tickets" misses (Haiku and Luna, one each) reworded the idea rather than losing it, so they don't count in the hand-read "dropping a claim" row. Haiku's failures might respond to a stricter prompt, which would be worth trying first if cost ever mattered. Short sentences such as "Success metrics" often pass 60% changed and will show as a before/after block with any of these models.

## Context comparison

**Decision: keep the section context.** Rule fixed before the first run: keep it only if it improves at least one check and never repeats context text in a rewrite. `pnpm compare-context` ran Claude Sonnet 5.5 on three passages, 3 times with context and 3 times without: 18 calls, all successful, USD 0.0511. Raw replies are in `docs/context-comparison.json`. Run on 2026-11-05.

| Passage and question | With context | Without context |
|---|---|---|
| "Make it measurable", with the real baseline only in the context: does it use "9 hours"? | **3 of 3** | 0 of 3 (placeholders) |
| "it's out of date", with the referent only in the context: does it name the knowledge base? | **3 of 3** | 0 of 3 (guessed "The document") |
| "More formal" next to a sentence on the same topic: does it keep to the passage? | 3 of 3 | 3 of 3 |
| Repeated context text in the rewrite | 0 of 9 | not applicable |
| Average cost per call | $0.00287 | $0.00280 |

The cost difference is about 2%, and no latency difference was visible at this sample size.

**Limits:** I chose the first two passages because they are where context can help, so this proves it helps when the surrounding text matters, not how often that happens. On a passage that stands alone (the third row) it changed nothing that matters.

## Accessibility and code audit

Run on 2026-11-05, against the code at commit 09.

**Contrast.** Computed from `src/styles/tokens.css`, on the lightest background each text can sit on. Normal text needs 4.5:1, large text 3:1.

| Text | Ratio | Mockup value |
|---|---|---|
| Section numbers on the sheet | 5.78:1 | 2.51:1 |
| Deleted text on the navy card, at the lightest possible navy | 5.61:1 | 2.73:1 |
| Inactive palette items, large text, darkest and lightest backdrop | 3.94:1 and 3.07:1 | 2.50:1 |
| Muted text on the app background | 5.22:1 | same |
| Card body text at the card's far corner | 8.92:1 | same |
| Card labels at the card's far corner | 6.98:1 | same |
| Added text on its tint | 8.11:1 | changed with the card |
| Refine field placeholder | 4.81:1 | same |
| Apply button, ink on sky | 7.65:1 | same |
| Toast Undo, sky on navy | 7.65:1 | same |

**Limits.** These ratios ignore the grain texture, which adds small white specks to the navy. The inactive palette items at 3.07:1 have the least margin. Nothing here was checked with a screen reader.

**Targets.** Every control that takes keyboard focus measured at least 44px in a browser. The clickable changes inside the diff are the deliberate exception: they are as tall as the text and out of the tab order, and the row below them is the 44px path to the same actions (decision 10).

**Code checks, by search.** No raw colors outside `tokens.css`. No `fetch` outside `src/api/`. No `useState`, `useReducer`, `useEffect` or `useRef` in `src/components/`. No `VITE_` variables. The built `dist/` contains neither the key's variable name nor an OpenRouter key prefix.

**Browser checks.** Each flow was also driven in a real browser (Edge, through Playwright) against `pnpm dev` and the real model. Those scripts lived outside the repo and are not repeatable from it, so where a row cites a browser run, that is evidence from this session, not a test you can rerun. Playwright is not a project dependency.

## Delivery checklist

- Commit the raw session files unedited, masking only secrets. They are the one exception to the naming rule in `CLAUDE.md`, because the brief requires them unedited.
