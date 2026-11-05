/** Chosen by the comparison logged in NOTES.md. */
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5'

/** OPENROUTER_MODEL, if set. An empty value means the default, not a model named "". */
export function modelFrom(value: string | undefined): string {
  const model = value?.trim() ?? ''
  return model === '' ? DEFAULT_MODEL : model
}
