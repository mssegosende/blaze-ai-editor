import type { Suggestion } from '../shared/contract.ts'

export type ParseResult =
  | { ok: true; suggestion: Suggestion }
  | { ok: false; reason: string }

const CODE_FENCE = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/

/**
 * The server's last check on what the model sent. Schema enforcement upstream
 * should make this redundant, but a bad reply must never reach the UI as a
 * suggestion, so this holds even if a provider ignores the schema.
 */
export function parseModelOutput(raw: string): ParseResult {
  const trimmed = raw.trim()
  const unfenced = CODE_FENCE.exec(trimmed)?.[1] ?? trimmed

  let parsed: unknown
  try {
    parsed = JSON.parse(unfenced)
  } catch {
    return { ok: false, reason: 'not valid JSON' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'not a JSON object' }
  }

  const { rewrite, rationale } = parsed as Record<string, unknown>
  if (typeof rewrite !== 'string' || rewrite.trim() === '') {
    return { ok: false, reason: 'rewrite is missing or empty' }
  }
  if (typeof rationale !== 'string' || rationale.trim() === '') {
    return { ok: false, reason: 'rationale is missing or empty' }
  }

  return { ok: true, suggestion: { rewrite, rationale: rationale.trim() } }
}
