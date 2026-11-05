# Blaze

A Markdown editor in the browser where an AI works as a co-author. See `NOTES.md` for the requirement matrix and the decisions.

## Stack

- React + TypeScript (strict) with Vite, pnpm, ESLint.
- Tiptap with a Markdown extension.
- CSS modules + design tokens (colors, fonts, spacing, radii) as CSS variables in one file. No hardcoded colors in components. No Tailwind.
- The `diff` library to compute the diff in the browser: `diffWordsWithSpace`, merging changes separated only by whitespace, with links and bold/italic pairs treated as atomic changes. Not `diffWords`, which loses whitespace (see `NOTES.md`).
- A minimal server in `server/` (Hono or Express) only to call OpenRouter without exposing the key. A single `pnpm dev` must start everything.
- The app name lives in one constant: `APP_NAME = "Blaze"`.

## Standards

- Folders in `src/`: `api/`, `hooks/`, `components/`, `styles/`, `lib/` (pure logic). One folder per component with its CSS module.
- Outside `src/`: `server/` (the OpenRouter proxy), `shared/` (the contract used by both sides), `scripts/` (one-off tools such as the model comparison).
- Presentational components that only receive props; state lives in hooks.
- The AI request state is a reducer (idle | loading | success | error).
- The UI never calls fetch directly: a client in `api/` does. No mock adapter (no time); it goes in the README as "with more time".
- Accessibility: real buttons, labels on inputs, aria attributes where state changes (pressed, expanded), 44px targets, AA contrast.
- Out of scope: routing, global state libraries, UI kits, animation libraries.
- UI copy and code in English.
- Before every commit, `pnpm lint` and `pnpm build` must pass, and the `.env` rules below apply.
- Design reference: `docs/design/`, described in its README. Where the mockup conflicts with the accessibility rules above, the rules win.

- Wording: the brief calls it an "AI agent". In the README, `NOTES.md` and the UI, describe it as a deliberately single-step agent: one action, one model call, the human approves every change. Never deny that it's an agent.

### `.env` rules

- Never read, print, open, cat, grep or search `.env`, not even to check it, and never copy its value anywhere. Only use `Test-Path .env` to know whether it exists.
- Never stage or commit `.env`. Never use `git add -f`.
- Before every commit, run `git status` and confirm `.env` is not listed.

### Naming rule

- Don't name the company that issued the brief in any repo file (code, `NOTES.md`, README, `CLAUDE.md`, commits). The one exception is the raw session files, committed unedited at delivery with only secrets masked.

## How to work with me

- Build the core flow end to end first (select → suggestion → accept/reject → refine), and only then polish.
- Commits are numbered "NN: Message" (e.g. "02: Add Tiptap editor").
- For git, only the steps needed right now. No branches, commits or pushes I didn't ask for.
- Before writing the code for each part, tell me in a few lines what you'll do and why.
- Keep the diff logic in its own file, pure and tested with Vitest. Every warning or requirement in the brief becomes a named test, with invented cases (bold, links, a full rewrite, partial accept), not only the sample document.
