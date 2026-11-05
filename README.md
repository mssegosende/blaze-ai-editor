# Blaze

A Markdown editor in the browser where an AI works as a co-author. You select text and ask for something, the AI proposes a change, and you see it as a diff and decide. Nothing in your document changes until you accept.

## How to run it

You need Node 22.9 or newer, pnpm, and an [OpenRouter](https://openrouter.ai) API key.

```bash
pnpm install
cp .env.example .env      # on Windows cmd: copy .env.example .env
```

Put your key in `.env`, replacing the placeholder:

```
OPENROUTER_API_KEY=your-key-here
```

Then start it:

```bash
pnpm dev
```

Open the URL it prints. That's usually `http://localhost:5173`, but Vite picks another port if that one is taken.

The app opens on a sample document. Click one of the "Try one" prompts in the right-hand card, or select any text.

### Tests

```bash
pnpm test                              # unit tests
pnpm exec playwright install chromium  # once, before the first browser test run
pnpm test:e2e                          # browser tests
```

The browser tests never call the real API. They start only the web app, not the server that holds the key, and answer every request from a stub.

## What I built

- **A Markdown editor**, built on Tiptap, that opens straight into a sample document. You can also write your own text and ask about that.
- **Three ways to ask.** Select text and use the pill that appears, press `/` for the command palette, or click a "Try one" prompt. Each one offers fixed actions, and the pill and palette also take free text, so you can give specific instructions on the first request.
- **Selection or section.** With text selected, the AI works on that text. With nothing selected, the palette works on the section at your cursor or, if you haven't placed one, the section nearest the top of the screen, and it names that section before anything runs. It can restructure a section, but never rewrites the whole document.
- **A word-level diff in the card**, with the AI's one-sentence rationale above it. You can keep or discard each change, step through them with the arrows or by clicking, or accept or reject everything at once.
- **Refine.** Ask for "more formal", "warmer" or anything else on the same suggestion. Earlier answers stay in a history you can step back through.
- **One undo.** An accepted suggestion goes in as a single transaction, so one Ctrl+Z removes all of it and none of your typing.
- **Stale protection.** If you edit a paragraph while a suggestion for it is pending, the suggestion is discarded with a notice. Paste and undo count as edits too.
- **Clear failures.** A request can be cancelled, and a missing key, exhausted credit or unreachable server each get their own message and a Retry button.
- **A responsive layout**, mobile-first, with breakpoints around 640 and 1024 px. On wide screens the document and card stay together, centered. Under 1024 px the sidebar becomes a bar on top and the card stacks below the document, scrolling into view when a suggestion arrives.
- **A small server in `server/`** that exists only to call OpenRouter, so the key never reaches the browser.

## Key decisions and trade-offs

`NOTES.md` has the full list, each decision with its expensive and cheap failure mode, and a matrix from every requirement to the file or test that proves it.

### A deliberately single-step agent

One action, one model call, and the human approves every change. A failed call becomes a Retry button, never an automatic second call. Refine is how the work iterates, with you choosing each step.

**What it gives:** predictable cost, predictable behavior, and no edits you didn't ask for.
**What it costs:** the agent never volunteers anything or plans several steps ahead. A reviewer looking for a multi-step agent won't find one here, and that's on purpose.

### The diff is computed in the browser

The model returns only `{ "rewrite": "...", "rationale": "..." }`. It doesn't describe its edits, because a description can disagree with the text. The browser computes the diff, so what you review is what would really change.

Markdown goes in and out, so bold and links survive. That creates a trap: a changed URL can diff as two separate changes, and keeping only one gives a link nobody wrote. So I use `diffWordsWithSpace` rather than `diffWords`, which loses whitespace and hides paragraph splits. Changes separated only by whitespace merge, and links and bold or italic pairs change as a whole. Every combination of keep and discard is tested on invented cases.

**What it costs:** two kinds of suggestion can't be reviewed word by word. Anything over 60% changed shows as one before/after block, because a word diff of a near-total rewrite is unreadable. Any restructured section does too, all or nothing, because a moved block is a removal plus an addition, and keeping only the addition would leave the text in the document twice.

### The diff is in the card, not inline

The main reason is time. I time-boxed the build, and inline tracked changes were the riskiest part, because they mean mapping diff ranges to Tiptap document positions. The card was the safe path that still shows every change before it's applied. The document only gets a highlight marking what the suggestion is about.

**What else it gives:** the document you're reading is always your real text, so an abandoned suggestion leaves nothing behind. The card also has room for one row of 44px controls, "Change 2 of 6 ‹ › Keep Discard", which inline changes couldn't hold without wrecking the text.
**What it costs:** your eyes move between the document and the card, and you read the change away from its surroundings. Inline tracked changes are the first thing I'd add with more time.

### The model: Claude Sonnet 5.5, chosen by comparison

I ran three models through the app's real prompt: three paragraphs, each with one instruction and one refine, 3 times each. That was 54 calls for USD 0.09.

| | Claude Haiku 5.5 | GPT-6 Luna | Claude Sonnet 5.5 |
|---|---|---|---|
| Replies adding a claim (read by hand) | 6 of 18 | 1 of 18 | **0 of 18** |
| Replies dropping a claim (read by hand) | 1 of 18 | 6 of 18 | **0 of 18** |
| Runs agreeing on the facts kept | 78% | 89% | **100%** |
| Runs agreeing on the number of changes | 44% | 39% | **78%** |
| Median time, first request | 2.1 s | 2.6 s | 2.2 s |
| Median time, refine | 2.4 s | 5.5 s | 4.9 s |
| Average cost per call | $0.00017 | $0.00015 | $0.00461 |

I chose fact accuracy over price. An invented commitment is the failure a user is least likely to catch, and Haiku added some in 6 of 18 replies. Sonnet costs about 27 times as much, but a USD 5 budget still covers roughly 1,000 calls. This is a small sample, so it shows a pattern rather than a rate. Details and limits are in `NOTES.md`.

A separate test kept the section as read-only context only after it proved useful: with it, the model used a real baseline figure in 3 of 3 runs, against 0 of 3 without it, for about 2% more cost.

## What I left out on purpose

- **Auth, a database and saving.** The document lives in the browser tab, so a reload goes back to the sample.
- **Real-time multi-user editing, Docker and settings.** None of them help show the core flow.
- **Full document history.** Refine has its own history, and undo covers the document.
- **A landing page.** The app opens straight into the editor.
- **Routing, global state libraries, UI kits and animation libraries.** State lives in hooks, and styling is CSS modules with design tokens in one file.

## What I'd do with more time

- **Inline tracked changes**, so you can review a suggestion in place, in the middle of the text it changes.
- **A mock adapter** for the API client, so the app could run and be demonstrated without a key.
- **Version history** showing how the document evolved with AI help.
- **Screen-reader testing.** The app uses real buttons, labels and aria state, and contrast and target sizes are measured, but nothing has been tested with an actual screen reader.
