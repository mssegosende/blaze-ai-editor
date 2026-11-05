# Blaze notes

What the brief asks for, what proves it, and why each key decision was made. Checked against the code on 2026-11-05, as of commit 23.

## Requirement matrix

Status: `done` means the named file or test exists and passes. `planned` means it happens at delivery.

### From the brief, in its exact words

| # | Brief | Proof | Status |
|---|---|---|---|
| C1 | "Don't build a full markdown editor from scratch, a prebuilt like tiptap or similar is fine." | `@tiptap/*` in `package.json` | done |
| C2 | "The user is always in control" | "the document does not change until accept"; decision 5 | done |
| C3 | "rewrite paragraphs" | Rewrite in `src/constants.ts`; "accepting every change reproduces the rewrite exactly" | done |
| C4 | "fix tone" | More formal and Warmer in `src/constants.ts`, as commands and as refines | done |
| C5 | "restructure sections" | "only a section target is allowed to restructure"; "accepting a restructured section is one transaction"; decision 15 | done |
| C6 | "follow specific instructions" | Free text in the pill, the palette and refine; "free text works on the first request, and only the selection is sent" | done |
| B0 | "A single page web app, no auth required" | `src/App.tsx`: no router, no login | done |
| B1 | "The user can write and edit Markdown in a browser-based editor" | `src/components/EditorPane/`; "markdown round trip keeps headings, lists, bold and links" | done |
| B2 | "An AI agent can suggest changes to the document (or a selection)" | `placeFromSelection` and `placeFromSection` in `src/lib/editorDocument.ts`; "a selection request sends only the selected Markdown", "a section command sends only that section"; decision 14 | done |
| B3 | "Suggestions appear as visible diffs — the user can see exactly what the AI wants to change before accepting" | `src/lib/diff.ts`, `src/components/DiffView/`; "a paragraph split shows up as a visible change"; decision 1 | done |
| B4 | "The user can accept, reject, or refine the AI's suggestions" | "partial accept keeps only the chosen changes"; "a refine request sends the original, the current suggestion and the instruction" | done |
| B5 | "The experience feels collaborative — like working with a smart co-author, not a chatbot in a sidebar and not something that completes the whole document" | No chat anywhere; "it never hands over the whole document"; walked through by hand with the real model: Try one, keep and discard per change, apply, Ctrl+Z, refine (Shorter, Keep my wording, More formal, free text), Ask on my own paragraph, and commands on a section with nothing selected all work | done |
| D1 | "Host your code on GitHub or GitLab and send us the link" | Repository link at submission | planned |
| D2 | "Include a README with: how to run it, what you built, and what you'd do differently with more time" | `README.md` | done |
| D3 | "Save your AI session(s)", "raw, unedited session files exactly as your tool saved them", "The only change allowed is to mask secrets", "commit the files to the git repository along with the project code" | Committed at delivery, unedited, with only secrets masked | planned |
| E1 | The experience: "Is it intuitive? Can we open it, write something, and get useful AI suggestions without reading docs?" | S11, S12 | done |
| E2 | AI integration quality: "Does the agent feel like a collaborator or a gimmick? Are diffs clear and useful?" | Decisions 1, 9, 17 and 18; the rationale in the card | done |
| E3 | How you used AI to build it: "Did you use AI tools effectively to ship faster? Can you explain the choices made?" | These decisions; `CLAUDE.md`; the session files (D3) | planned |
| E4 | Code quality: "Is the code organized, readable, and something a teammate could pick up?" | `CLAUDE.md`; `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` | done |
| E5 | Taste & judgment: "What did you prioritize? What did you intentionally leave out? Trade-offs matter more than features." | `README.md`; these decisions | done |
| N1 | "Docker, databases, auth systems — don't add infrastructure you don't need" | None in the repository | done |
| N2 | "Visual perfection — but it should be usable and not broken" | `e2e/`; S15; walked through by hand with the real model: the notice on editing a paragraph with a pending suggestion, Cancel while thinking, Ctrl+Enter, Esc and ?, and the missing-key message with Retry and Close all work. Narrow windows were not walked through by hand: they rest on `e2e/responsive.spec.ts` and the screenshots | done |
| N3 | "Using a specific framework — React, Vue, Svelte, vanilla JS, whatever you're fast with" | React | done |

### From the project spec

Quoted names are test names. Unit tests sit next to the file they test, and browser tests are in `e2e/`.

| # | Requirement | Proof | Status |
|---|---|---|---|
| S1 | Each change can be kept or discarded, stepped through with the arrows or by clicking, or all accepted or rejected at once | "partial accept keeps only the chosen changes", "the arrows reach every change, in both directions", "clicking a change selects it"; `src/components/ChangeRow/`; decision 10 | done |
| S2 | Bold and links survive, and partial accept never breaks Markdown | "partial accept never leaves unbalanced bold markers", "partial accept only ever produces links that were really written", "a changed URL is one change, never half a link"; decisions 2 and 9 | done |
| S3 | Over 60% changed, or restructured text, is one before/after block | "exactly 60% changed stays word by word", "a restructured section is a single before/after block", "a multi-paragraph selection that is restructured is a single block"; decisions 4 and 15 | done |
| S4 | Accept is one transaction, and one Ctrl+Z undoes it without the user's typing | "one undo restores the whole accepted suggestion", "undo does not take the typing before the accept with it", "after Apply, focus returns to the document and one Ctrl+Z restores it"; decision 5 | done |
| S5 | Editing the target discards the suggestion with a notice, including paste and undo | "a paste over the paragraph discards the suggestion", "an undo that reaches the paragraph discards the suggestion", "editing the paragraph discards the suggestion with a notice"; decision 6 | done |
| S6 | Refine works from the original, and stepping back through its history makes no call | "a refine's diff compares the original with the latest rewrite", "stepping back through the history makes no call"; decision 3 | done |
| S7 | One action makes one call, and only Retry makes another | "a model failure makes no second call", "a failure makes no second call until Retry, which makes exactly one"; decision 7 | done |
| S8 | The request is a reducer (idle, loading, success, error), cancelled through AbortController | `src/hooks/useAiRequest.ts`; "a stale response is ignored", "cancel aborts the request", "Cancel aborts the request and leaves the document unchanged" | done |
| S9 | Clear errors with Retry: no key, no credit, unreachable server, a model OpenRouter can't run, a cut-off reply, an unreadable reply | "a missing key is reported without calling the model", "an exhausted budget is reported as budget_exhausted", "the client reports an unreachable server", "a model OpenRouter cannot run (%s) gets a message naming the model setting", "a reply cut off at the token limit is an error", "malformed model output is an error, not a suggestion", "each failure has its own heading" | done |
| S10 | The key stays on a local server; the model can be changed with `OPENROUTER_MODEL` | "the key goes to OpenRouter and never into a response or a log"; `server/index.ts` binds to `127.0.0.1`; "an %s setting falls back to the default"; decision 8 | done |
| S11 | Every entry point works with nothing selected, and the palette names its target | "every entry point works in one click, with nothing selected", "with no selection and no cursor placed, it targets the section at the top of the viewport", "a document with no text has no target"; decision 14 | done |
| S12 | First open shows the sample document, the hint and "Try one" prompts, and it works on text the user just typed | "a new user sees the hint and prompts, and one click gets a suggestion", "Try one is hidden when its section is gone", "suggestions work on text the user just typed" | done |
| S13 | Shortcuts: `/`, `?`, Ctrl+Enter, Esc, Ctrl+Z, with `/` in a sentence still typing a slash | `src/lib/keyboard.ts`; "typing a slash in a sentence stays text", "Ctrl+Enter accepts all, and Ctrl+Z from outside the editor undoes it", "Esc cancels a request in flight" | done |
| S14 | Responsive, mobile-first, with no sideways scroll; under 1024 px the card stacks and comes into view | "a long unbroken word or link does not push the page sideways", "as soon as a request starts loading, Cancel is in view below the bar", "when a suggestion arrives, the card scrolls into view below the bar", "it sits by the hint and takes you to the prompts", "the document and card stay together and centered"; decision 16 | done |
| S15 | Accessibility: real buttons, labels, aria state, 44px targets, AA contrast | `e2e/safety.spec.ts` and `e2e/responsive.spec.ts` measure every control; "Accessibility" below | done |
| S16 | The section goes along as read-only context | "the section goes along as context, separate from the passage", "a selection request includes its section as context"; decision 11 | done |
| S17 | Requests and model output are validated without zod | "rejects %s", "rejects %s without calling the model"; decision 13 | done |
| S18 | The model is chosen by a comparison, and context kept only if it measurably helps | `scripts/`, `docs/model-comparison.json`, `docs/context-comparison.json`; decisions 17 and 18 | done |
| S19 | Browser tests live in the repo and never call the real API | `pnpm test:e2e`; `e2e/support.ts`, `e2e/globalSetup.ts`; "nothing is allowed to leave the machine"; the three bugs found by hand are in `e2e/regressions.spec.ts` | done |
| S20 | Code rules: no colors outside `tokens.css`, no fetch outside `src/api/`, state in hooks, the app name in one constant, one `pnpm dev` | "Code checks" below; `shared/appName.ts`; `package.json` | done |
| S21 | Described as a deliberately single-step agent, never denied to be one | Decision 7; `CLAUDE.md` | done |

## Decisions

Each decision has an expensive failure (hard to notice, or it costs trust) and a cheap one (visible and easy to recover from).

### 1. The model returns `{ rewrite, rationale }`, and the browser computes the diff

A model's description of its own edits can disagree with its text. The diff shows what would really change.

- **Expensive:** the rationale misdescribes the rewrite ("trimmed filler" when a commitment was cut), and the user accepts on trust.
- **Cheap:** the reply is malformed or cut off at the token limit. The server rejects it, the card shows an error with Retry, and the document is untouched.

### 2. Markdown in and out

Bold and links survive because they're part of the text the model edits.

- **Expensive:** partial accept corrupts Markdown with no visible sign. With `diff` 9, adding bold gives two changes (`**` and `**`), and changing `a.io/x` to `b.io/y` gives two, so keeping one makes a link to `b.io/x` that nobody wrote. Decision 9 is the fix.
- **Cheap:** the model writes equivalent syntax (`*` for `-`) and the diff shows noise. The rewrite goes through the editor's own parse and serialize step before diffing, which removes it.

### 3. Refine sends the original, the current suggestion and the new instruction

The model sees where the text started and where it is now, with no chat history to grow.

- **Expensive:** the diff is computed against the previous suggestion, so what the user reviews isn't what accept applies. It's always original to latest.
- **Cheap:** a refine undoes an earlier instruction ("shorter", then "warmer" gets longer). The user refines again or steps back in the history. Keep and discard marks reset on each refine, because the changes are new.

### 4. Over 60% changed shows one before/after block

A word diff of a near-total rewrite is unreadable. The share is changed non-whitespace characters on both sides over all non-whitespace characters on both sides. Exactly 60% stays word by word.

- **Expensive:** one bad change in a block can't be rejected alone, and a dropped fact is easier to miss.
- **Cheap:** a rewrite near the threshold gets the less useful view. Nothing is lost.

### 5. The document changes only on accept, in one transaction

An abandoned suggestion leaves nothing behind. The accept closes the undo group first, so it never merges with the user's typing.

- **Expensive:** a stale position puts the text in the wrong place, or one Ctrl+Z also removes the user's own words.
- **Cheap:** Ctrl+Z inside an input undoes the input, not the document. Outside the editor it undoes the document, and the toast has an Undo button.

### 6. Editing the target while a suggestion is pending discards it, with a notice

The diff was computed against text that no longer exists. A response still loading is dropped the same way. Detection reads editor transactions, not keystrokes, so paste, undo and drag count.

- **Expensive:** an edit goes undetected and accept overwrites what the user just wrote.
- **Cheap:** fixing a typo discards a suggestion the user wanted. They lose one call, and the notice says why.

### 7. A deliberately single-step agent: one action, one model call, the human approves every change

Predictable cost and behavior, and no edits nobody asked for. A failed call becomes a Retry button, never an automatic second call. Refine is the iteration loop, with the human choosing each step.

- **Expensive:** a reviewer expects a multi-step agent and reads this as under-delivering. The README presents the single step as a decision and refine as the loop.
- **Cheap:** the agent never volunteers anything, so the user clicks more. "Try one" softens this.

### 8. A small local server holds the API key

- **Expensive:** the key leaks through a `VITE_` variable, a log or a commit, or the server listens on the network and someone else spends the credit. It binds to `127.0.0.1` and never logs request headers.
- **Cheap:** `.env` is missing, or `OPENROUTER_MODEL` names a model OpenRouter can't run. The card says which, with Retry.

### 9. `diffWordsWithSpace`, with merged and atomic changes

`diffWords` failed "reject everything gives the original" on added bold (`fast today` became `fasttoday`) and showed no change for a paragraph split. `diffWordsWithSpace` passes both but gives more small changes, so changes separated only by whitespace merge, and every change touching one link, URL, inline code or bold/italic pair merges into one.

- **Expensive:** a Markdown form the span detection doesn't recognize gets split, and partial accept breaks it.
- **Cheap:** a long bold sentence with two word changes is one change, so the user can't take just one.

### 10. Per-change review is one row: "Change 2 of 6 ‹ › Keep Discard"

Inline changes can't be 44px tall without wrecking the text, and a row per change would make the card about 300px taller. Clicking a change selects it, and the row is the 44px, keyboard path to the same actions.

- **Expensive:** a keyboard user can't reach a change. The arrows reach every change.
- **Cheap:** the user steps through changes instead of seeing every control at once.

### 11. The section goes along as read-only context

The prompt tells the model never to edit or repeat it. Kept because it measurably helped (decision 18).

- **Expensive:** the model brings context text into the rewrite. It didn't happen in 9 runs, which is not a guarantee, and the diff would show it.
- **Cheap:** about 2% more cost per call.

### 12. Where the app departs from the mockups

No landing page, no "Up next" queue (it needs extra model calls), no Back button, the diff in the card instead of inline, and colors and sizes raised to AA and 44px. `docs/design/README.md` lists them. `?` works only outside the editor, so it can be typed.

- **Expensive:** `/` or `?` swallows a character the user meant to type. Both have tests.
- **Cheap:** someone comparing with the mockups sees a feature missing.

### 13. JSON is validated by hand, without zod

Two small shapes cross a trust boundary: the browser's request and the model's reply. About 75 lines of checks in `server/parseModelOutput.ts` and `parseSuggestRequest` in `server/app.ts` cover both, and each rejected case is a named test. One less dependency to read.

- **Expensive:** the contract in `shared/contract.ts` and the checks drift apart silently. A field added to the type but not to the check goes unvalidated while everything compiles. If the contract grows beyond a few fields, that's the point to adopt a schema library.
- **Cheap:** a valid reply is rejected too strictly, and the user sees an error with Retry.

### 14. With nothing selected, the palette acts on a section it names

The whole document is ruled out, so "the document" means one section: the blocks under a heading, up to the next heading of the same or higher level. The target, in order: the selection, the section at a cursor the user placed, then the section nearest the top of the viewport. The editor's starting position doesn't count as placed, and a title with no text of its own falls through. The palette header names the target before anything runs, and the list is never shown disabled: a document with no text gets "Write something first, then ask" and Close. `/` in a sentence types a slash; it opens the palette only with text selected, on an empty line or outside the editor.

- **Expensive:** the user thinks they're editing one sentence and a whole section comes back, or a different section than they expected after scrolling. The named target is the guard, and nothing applies without review.
- **Cheap:** the user wanted a smaller scope. They reject it and select the text.

### 15. Only a section may be restructured, and restructured text is all or nothing

When the target is a section, the agent may reorder, merge or split paragraphs and list items. A selection keeps its shape, because the user chose those words. Restructured text is one before/after block whatever share changed: a moved block is a removal plus an addition, so keeping only the addition leaves the text twice. In a real run, moving one bullet and merging two others came in under 60% and showed as 4 separate changes.

`isRestructured` in `src/lib/diff.ts` compares blocks: a different count, or the same blocks out of order. It runs for sections, and for selections spanning more than one block, since the model can still reorder or merge a selection's paragraphs. Splitting a one-paragraph selection stays word by word, because a split can't duplicate anything.

- **Expensive:** detection misses a restructure, for example two blocks swapped and reworded beyond recognition, which then shows word by word and could still duplicate text. Or a heading, list or link is lost when the block goes back into the document; named tests cover that.
- **Cheap:** a false positive shows a reword as a block, so the user loses word-by-word review of one suggestion.

### 16. Responsive, with the card stacked below the document under 1024 px

Mobile-first, with breakpoints around 640 and 1024 px, and the visual design unchanged. From 1024 px the sidebar, document and card sit side by side, with the document and card centered together. Under 1024 px the sidebar is a sticky bar and the card stacks below the document. A bottom sheet was rejected: the diff is complete inside the card, and stacking is simpler to keep unbroken. The card comes into view when a request starts, so Cancel is visible, and again when the answer or an error arrives. After accept or reject, the page scrolls back to the text. A "Try a suggestion" button at the top leads to the prompts.

- **Expensive:** the user misses that a suggestion arrived, or loses their place. Both scrolls are tested.
- **Cheap:** the scroll on loading moves the user away from their text before there's anything to read.

Tested in desktop Chromium at 375 to 2560 px, not on real phones, so touch selection and the on-screen keyboard are untested.

### 17. The model: Claude Sonnet 5.5

`pnpm compare-models` ran three models through the app's real prompt and call: three paragraphs, each with one instruction and one "Make it warmer." refine, 3 times each. That was 54 calls for USD 0.09, all valid JSON. `pnpm score-models` compares runs pair by pair with no calls. Raw replies are in `docs/model-comparison.json`.

| | Claude Haiku 5.5 | GPT-6 Luna | Claude Sonnet 5.5 |
|---|---|---|---|
| Replies adding a claim (read by hand) | 6 of 18 | 1 of 18 | **0 of 18** |
| Replies dropping a claim (read by hand) | 1 of 18 | 6 of 18 | **0 of 18** |
| Checklist facts kept | 82 of 84 | 77 of 84 | **84 of 84** |
| Runs agreeing on the facts kept | 78% | 89% | **100%** |
| Runs agreeing on the number of changes | 44% | 39% | **78%** |
| Median time, first request / refine | 2.1 / 2.4 s | 2.6 / 5.5 s | 2.2 / 4.9 s |
| Average cost per call | $0.00017 | $0.00015 | $0.00461 |

Haiku added commitments when asked to be warmer ("we're glad to have a whole team that cares"). Luna dropped "until the end of the day" in all six "Why now" replies while its rationale said it kept the key points, which is decision 1's expensive failure. Sonnet named what it cut, but its rationales run long.

- **Expensive:** a cheaper model invents a commitment the user doesn't catch. That's why accuracy beat a price about 27 times higher. A USD 5 budget still covers roughly 1,000 calls.
- **Cheap:** Sonnet is slower on refines and its rationales run long, which only affects layout.

**Limits:** three paragraphs and three runs show a pattern, not a rate. The hand-read rows are my judgment, and I wrote the fact checklist after reading the replies. Agreement isn't correctness: Luna agrees on facts partly because it drops the same one every time.

### 18. Section context kept, by measurement

Rule fixed before the run: keep the context only if it improves at least one check and never leaks into a rewrite. `pnpm compare-context` ran Sonnet on three passages, 3 times with and 3 times without: 18 calls, USD 0.05, raw replies in `docs/context-comparison.json`. With context, the model used the real baseline ("9 hours") in 3 of 3 runs and named the knowledge base in 3 of 3, against 0 of 3 for each without. A passage that stands alone was the same either way, and context text appeared in 0 of 9 rewrites, for about 2% more cost.

- **Expensive:** the two helpful passages were chosen because context can help there, so this shows that it helps, not how often.
- **Cheap:** the extra 2% on calls where it changes nothing.

## Accessibility

**Contrast**, computed from `src/styles/tokens.css` on the lightest background each text can reach: the navy card's far corner, where its gradient is half way to `--color-navy-light`, and the palette's lightest corner over a white sheet. Normal text needs 4.5:1 and large text 3:1.

| Text | Ratio | Mockup value |
|---|---|---|
| Section numbers on the sheet | 5.78:1 | 2.51:1 |
| Muted text on the app background | 5.22:1 | same |
| Deleted text on the card | 6.99:1 | 3.62:1 |
| Deleted text on a selected or hovered change | 5.22:1 | none |
| Added text on its tint, selected | 6.07:1 | none |
| Card body text and labels | 8.95:1 and 6.99:1 | same |
| Refine field placeholder | 5.58:1 | same |
| Inactive palette items (large text), darkest and lightest | 3.93:1 and 3.30:1 | 2.28:1 at lightest |
| Apply, ink on sky | 7.65:1 | same |

The grain texture is left out of the ratios. The palette's inactive items have the least margin.

**Targets.** Every control that takes focus measures at least 44px in each state at 375, 768, 1024, 1280 and 1920 px. The clickable changes in the diff are the exception: they're as tall as the text and out of the tab order, and the row below them is the 44px path (decision 10).

**Code checks, by search.** No raw colors outside `tokens.css`. No `fetch` outside `src/api/`. No `useState`, `useReducer`, `useEffect` or `useRef` in `src/components/`. No `VITE_` variables. The built `dist/` contains neither the key's variable name nor an OpenRouter key prefix.

**Not checked:** a screen reader, touch input and real phones.

## Browser tests

They never call the real API, for three separate reasons: they start Vite only, so the server holding the key isn't running; a fixture on every test answers `/api/*` from a stub and fails on any call with no reply queued; and every other host is blocked. So they prove the UI and the contract, not what a real model replies: that's what decisions 17 and 18 are for. `e2e/globalSetup.ts` loads the app once before the workers start, so they don't all wait on Vite's first compile.

Each test in `e2e/regressions.spec.ts` was checked by undoing its fix: all three bugs were caught. `placeCursor` in `e2e/support.ts` pauses because a script's next key can arrive before ProseMirror reads the new cursor position, which a person can't type fast enough to hit.
