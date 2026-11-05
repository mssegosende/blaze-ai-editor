import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, modelFrom } from './config.ts'

describe('modelFrom', () => {
  it('defaults to the model chosen by the comparison', () => {
    expect(DEFAULT_MODEL).toBe('anthropic/claude-sonnet-5.5')
    expect(modelFrom(undefined)).toBe(DEFAULT_MODEL)
  })

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
  ])('an %s setting falls back to the default', (_label, value) => {
    expect(modelFrom(value)).toBe(DEFAULT_MODEL)
  })

  it('uses OPENROUTER_MODEL when set, without surrounding spaces', () => {
    expect(modelFrom(' openai/gpt-6-luna ')).toBe('openai/gpt-6-luna')
  })
})
