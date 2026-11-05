/**
 * The contract between the browser and the server. Both sides import it, so a
 * change here is a compile error on whichever side falls behind.
 */

export const SUGGEST_PATH = '/api/suggest'

export const MAX_SELECTION_CHARS = 8000
export const MAX_INSTRUCTION_CHARS = 500
export const MAX_CONTEXT_CHARS = 2000

/** Text around the selection. The model reads it for tone but never edits it. */
export interface SuggestContext {
  heading: string | null
  before: string | null
  after: string | null
}

/**
 * What the user pointed at. Only a section may be restructured: a selection
 * keeps its shape, because the user chose those exact words.
 */
export type SuggestTarget = 'selection' | 'section'

export interface SuggestRequest {
  /** The Markdown being edited. On a refine, this is still the original text. */
  selection: string
  target: SuggestTarget
  instruction: string
  /** The rewrite being refined, or null on the first request. */
  currentSuggestion: string | null
  context: SuggestContext | null
}

export interface Suggestion {
  rewrite: string
  rationale: string
}

export type SuggestErrorCode =
  | 'bad_request'
  | 'missing_api_key'
  | 'upstream_error'
  | 'invalid_model_output'

export interface SuggestErrorBody {
  error: {
    code: SuggestErrorCode
    /** Written for the user: the UI shows it as is. */
    message: string
  }
}
