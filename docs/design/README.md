# Design mockups

I made these mockups before building anything. They set the visual design: colors, type and the card's look. They aren't a spec of the finished app, which differs from them on purpose in the places listed below.

| File | What it shows |
|---|---|
| `mockup.html` | The HTML mockup of the landing page and the editor, with pre-written suggestions instead of a model |
| `01-landing-page.png` | The landing page |
| `02-editor-first-open.png` | The editor on first open: an empty co-author card with "Try one" prompts |
| `03-inline-review.png` | Reviewing a "Shorter" suggestion, with the diff inline in the document |
| `04-shortcuts-dialog.png` | The shortcuts dialog, over a suggestion that has been refined several times |
| `05-command-palette.png` | The command palette, acting on the "Why now" section |

## Where the app differs

- **No landing page.** I left it out on purpose: the app opens straight into the editor.
- **The diff moved from inline to the card.** The mockups show tracked changes inside the document. In the app, the card shows the diff and the document only highlights the passage the suggestion is about. The main README explains why, under "The diff is in the card, not inline".
- **No "Up next" queue and no "Back" button.** Each one depends on something that wasn't built, a list of planned suggestions or a landing page.
- **Accessibility wins over the mockup.** Where the mockup misses AA contrast or 44px targets, the app changes the value. Each change is marked in `src/styles/tokens.css`.
