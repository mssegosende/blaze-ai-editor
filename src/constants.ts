export { APP_NAME } from '../shared/appName'

export const DOCUMENT_FILE_NAME = 'ai-rollout-plan.md'
export const DOCUMENT_TITLE = 'AI rollout plan'
export const DOCUMENT_SUBTITLE = 'Bluefield · draft.md'

export interface Command {
  id: string
  label: string
  /** What the model is told. Free text from the Ask field takes its place. */
  instruction: string
}

export const COMMANDS = {
  rewrite: { id: 'rewrite', label: 'Rewrite', instruction: 'Rewrite this so it reads more clearly.' },
  shorter: { id: 'shorter', label: 'Shorter', instruction: 'Make it shorter.' },
  formal: { id: 'formal', label: 'More formal', instruction: 'Make it more formal.' },
  warmer: { id: 'warmer', label: 'Warmer', instruction: 'Make it warmer.' },
  grammar: { id: 'grammar', label: 'Fix grammar', instruction: 'Fix the grammar and punctuation only.' },
  keep: {
    id: 'keep',
    label: 'Keep my wording',
    instruction: 'Make the smallest possible edit that keeps my wording.',
  },
  measurable: { id: 'measurable', label: 'Make it measurable', instruction: 'Make it measurable.' },
} as const satisfies Record<string, Command>

export interface TryPrompt {
  id: string
  label: string
  /** The section it acts on, found by its heading text. */
  heading: string
  command: Command
}

/** First-open prompts: one click to a useful suggestion, no reading required. */
export const TRY_PROMPTS: TryPrompt[] = [
  { id: 'why', label: 'Make “Why now” shorter', heading: 'Why now', command: COMMANDS.shorter },
  {
    id: 'metrics',
    label: 'Make the success metric measurable',
    heading: 'Success metrics',
    command: COMMANDS.measurable,
  },
  {
    id: 'safety',
    label: 'Make the safety section more formal',
    heading: "How we'll keep it safe",
    command: COMMANDS.formal,
  },
]

/** Direct actions in the selection pill. */
export const PILL_COMMANDS: Command[] = [COMMANDS.rewrite, COMMANDS.shorter, COMMANDS.grammar]
export const TONE_COMMANDS: Command[] = [COMMANDS.formal, COMMANDS.warmer, COMMANDS.keep]
export const REFINE_COMMANDS: Command[] = [COMMANDS.formal, COMMANDS.warmer, COMMANDS.keep, COMMANDS.shorter]
export const PALETTE_COMMANDS: Command[] = [
  COMMANDS.rewrite,
  COMMANDS.shorter,
  COMMANDS.formal,
  COMMANDS.warmer,
  COMMANDS.grammar,
  COMMANDS.keep,
  COMMANDS.measurable,
]

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** The modifier key as this keyboard labels it. */
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl'

export interface ShortcutRow {
  keys: string
  description: string
}

export const SHORTCUTS: ShortcutRow[] = [
  { keys: '/', description: 'Command palette' },
  { keys: `${MOD_KEY} ↵`, description: 'Accept all changes' },
  { keys: 'Esc', description: 'Reject the suggestion' },
  { keys: `${MOD_KEY} Z`, description: 'Undo the last applied suggestion' },
  { keys: '?', description: 'These shortcuts' },
]
