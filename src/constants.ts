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

/** Direct actions in the selection pill. */
export const PILL_COMMANDS: Command[] = [COMMANDS.rewrite, COMMANDS.shorter, COMMANDS.grammar]
export const TONE_COMMANDS: Command[] = [COMMANDS.formal, COMMANDS.warmer, COMMANDS.keep]
