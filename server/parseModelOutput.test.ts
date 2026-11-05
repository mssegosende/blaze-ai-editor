import { describe, expect, it } from 'vitest'
import { parseModelOutput } from './parseModelOutput.ts'

describe('parseModelOutput', () => {
  it('accepts the exact JSON format', () => {
    expect(parseModelOutput('{"rewrite":"Short.","rationale":"Cut filler."}')).toEqual({
      ok: true,
      suggestion: { rewrite: 'Short.', rationale: 'Cut filler.' },
    })
  })

  it('accepts JSON wrapped in a code fence', () => {
    const raw = '```json\n{"rewrite":"Short.","rationale":"Cut filler."}\n```'
    expect(parseModelOutput(raw).ok).toBe(true)
  })

  it('keeps Markdown inside the rewrite untouched', () => {
    const rewrite = 'See **the** [docs](https://example.com/a).'
    const result = parseModelOutput(JSON.stringify({ rewrite, rationale: 'Kept the link.' }))
    expect(result).toEqual({ ok: true, suggestion: { rewrite, rationale: 'Kept the link.' } })
  })

  it.each([
    ['plain text', 'Here is your rewrite: Short.'],
    ['an empty reply', ''],
    ['a JSON array', '["Short."]'],
    ['JSON null', 'null'],
    ['a missing rationale', '{"rewrite":"Short."}'],
    ['a missing rewrite', '{"rationale":"Cut filler."}'],
    ['an empty rewrite', '{"rewrite":"   ","rationale":"Cut filler."}'],
    ['an empty rationale', '{"rewrite":"Short.","rationale":""}'],
    ['a non-string rewrite', '{"rewrite":42,"rationale":"Cut filler."}'],
  ])('rejects %s', (_label, raw) => {
    expect(parseModelOutput(raw).ok).toBe(false)
  })
})
