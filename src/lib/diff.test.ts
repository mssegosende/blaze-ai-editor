import { describe, expect, it } from 'vitest'
import { applyDecisions, changesOf, computeDiff, keepAll } from './diff'
import type { ChangeDecision, SuggestionDiff } from './diff'

const WHY_NOW =
  "Right now the support team basically spends most of their day answering the same questions over and over again, which means that a lot of the time they don't actually get to the harder tickets until the end of the day and some customers end up waiting way longer than they should."
const WHY_NOW_SHORTER =
  'Right now the support team spends most of the day answering the same questions, so harder tickets wait until the end of the day and some customers wait far longer than they should.'

/** Invented on purpose: the diff must not depend on the sample document. */
const CASES: [label: string, original: string, rewrite: string][] = [
  ['adding bold', 'The team is fast today', 'The team is **fast** today'],
  ['removing bold', 'The team is **fast** today', 'The team is fast today'],
  ['changing a bold word', 'Answer **fast** now', 'Answer **quickly** now'],
  ['moving a bold boundary', '**Ship it** on Friday', '**Ship it on Friday**'],
  ['bold to italic', 'A **big** deal', 'A *big* deal'],
  ['adding italic', 'A big deal', 'A _big_ deal'],
  ['changing link text', 'See [the docs](https://a.io/x) now', 'See [our guide](https://a.io/x) now'],
  ['changing a link URL', 'See [the docs](https://a.io/x) now', 'See [the docs](https://b.io/y) now'],
  ['changing link text and URL', 'See [the docs](https://a.io/x)', 'See [a guide](https://b.io/y)'],
  ['adding a link', 'Read the guide today', 'Read [the guide](https://a.io) today'],
  ['a bold link', 'Read **[old](https://a.io/1)** now', 'Read **[new](https://b.io/2)** now'],
  ['a bare URL', 'Go to https://a.io/x today', 'Go to https://b.io/y today'],
  ['inline code', 'Run `pnpm dev` first', 'Run `pnpm build` first'],
  ['a paragraph split', 'One sentence. Two sentence.', 'One sentence.\n\nTwo sentence.'],
  ['a list edit', '- item one\n- item two', '- item one\n- item 2\n- item three'],
  ['several edits', 'We kinda think it works and honestly it is fine', 'We think it works and it is fine'],
  ['a full rewrite', 'The cat sat on the mat', 'Felines rest upon woven floor coverings'],
  ['the sample paragraph', WHY_NOW, WHY_NOW_SHORTER],
]

function everyDecisionCombination(diff: SuggestionDiff): Map<number, ChangeDecision>[] {
  const ids = changesOf(diff).map((change) => change.id)
  return Array.from({ length: 2 ** ids.length }, (_, combination) =>
    new Map(
      ids.map((id, position): [number, ChangeDecision] => [
        id,
        combination & (1 << position) ? 'keep' : 'discard',
      ]),
    ),
  )
}

const count = (text: string, marker: string) => text.split(marker).length - 1

describe('computeDiff', () => {
  it.each(CASES)('rejecting every change reproduces the original exactly: %s', (_label, original, rewrite) => {
    expect(applyDecisions(computeDiff(original, rewrite), new Map())).toBe(original)
  })

  it.each(CASES)('accepting every change reproduces the rewrite exactly: %s', (_label, original, rewrite) => {
    const diff = computeDiff(original, rewrite)
    expect(applyDecisions(diff, keepAll(diff))).toBe(rewrite)
  })

  it('partial accept keeps only the chosen changes', () => {
    const diff = computeDiff('The quick fox jumps over a lazy dog', 'The slow fox jumps over a happy dog')
    expect(diff.changeCount).toBe(2)

    const [first, second] = changesOf(diff)
    expect(first).toMatchObject({ removed: 'quick', added: 'slow' })
    expect(second).toMatchObject({ removed: 'lazy', added: 'happy' })
    expect(applyDecisions(diff, new Map([[0, 'keep']]))).toBe('The slow fox jumps over a lazy dog')
    expect(applyDecisions(diff, new Map([[1, 'keep']]))).toBe('The quick fox jumps over a happy dog')
  })

  it('a change with no decision stays as the original', () => {
    const diff = computeDiff('The quick fox jumps over a lazy dog', 'The slow fox jumps over a happy dog')
    expect(applyDecisions(diff, new Map([[0, 'discard']]))).toBe(
      'The quick fox jumps over a lazy dog',
    )
  })

  it.each(CASES)('partial accept never leaves unbalanced bold markers: %s', (_label, original, rewrite) => {
    const diff = computeDiff(original, rewrite)
    for (const decisions of everyDecisionCombination(diff)) {
      expect(count(applyDecisions(diff, decisions), '**') % 2).toBe(0)
    }
  })

  it.each(CASES)('partial accept only ever produces links that were really written: %s', (_label, original, rewrite) => {
    const links = (text: string): string[] => text.match(/\[[^\]]*\]\([^)]*\)/g) ?? []
    const written = new Set([...links(original), ...links(rewrite)])
    const diff = computeDiff(original, rewrite)
    for (const decisions of everyDecisionCombination(diff)) {
      for (const link of links(applyDecisions(diff, decisions))) expect(written).toContain(link)
    }
  })

  it('adding bold is one change, not two', () => {
    const diff = computeDiff('The team is fast today', 'The team is **fast** today')
    expect(diff.changeCount).toBe(1)
  })

  it('adding italic is one change, not two', () => {
    expect(computeDiff('A big deal', 'A _big_ deal').changeCount).toBe(1)
  })

  it('a changed URL is one change, never half a link', () => {
    const diff = computeDiff('See [the docs](https://a.io/x) now', 'See [the docs](https://b.io/y) now')
    expect(diff.changeCount).toBe(1)
    expect(applyDecisions(diff, keepAll(diff))).toContain('https://b.io/y')
  })

  it('a changed bare URL is one change', () => {
    expect(computeDiff('Go to https://a.io/x today', 'Go to https://b.io/y today').changeCount).toBe(1)
  })

  it('changing link text keeps the URL', () => {
    const diff = computeDiff('See [the docs](https://a.io/x) now', 'See [our guide](https://a.io/x) now')
    expect(diff.changeCount).toBe(1)
    const [change] = changesOf(diff)
    expect(change?.removed).not.toContain('https://a.io/x')
    expect(change?.added).not.toContain('https://a.io/x')
  })

  it('changes outside a link stay separate from it', () => {
    const diff = computeDiff('Hello there, see [docs](https://a.io) and goodbye', 'Hi there, see [docs](https://b.io) and goodbye')
    expect(diff.changeCount).toBe(2)
  })

  it('a paragraph split shows up as a visible change', () => {
    const diff = computeDiff('One sentence. Two sentence.', 'One sentence.\n\nTwo sentence.')
    expect(diff.changeCount).toBe(1)
    expect(changesOf(diff)[0]).toMatchObject({ removed: ' ', added: '\n\n' })
  })

  it('changes separated only by whitespace merge into one', () => {
    const diff = computeDiff('Start with old words here end', 'Start with new terms here end')
    expect(diff.changeCount).toBe(1)
    expect(changesOf(diff)[0]).toMatchObject({ removed: 'old words', added: 'new terms' })
  })

  it('changes separated by a word stay separate', () => {
    expect(computeDiff('one alpha two beta three', 'one gamma two delta three').changeCount).toBe(2)
  })

  it('a math asterisk or snake_case name is not treated as a Markdown pair', () => {
    expect(computeDiff('Use 2 * 3 * 4 here', 'Use 5 * 3 * 6 here').changeCount).toBe(2)
    expect(
      computeDiff(
        'Set old_value_one first, then leave every other setting alone until you reach new_value_two',
        'Set old_value_uno first, then leave every other setting alone until you reach new_value_dos',
      ).changeCount,
    ).toBe(2)
  })

  it('a full rewrite is a single before/after block', () => {
    const original = 'The cat sat on the mat'
    const rewrite = 'Felines rest upon woven floor coverings'
    const diff = computeDiff(original, rewrite)
    expect(diff.mode).toBe('block')
    expect(diff.changeCount).toBe(1)
    expect(changesOf(diff)[0]).toMatchObject({ removed: original, added: rewrite })
  })

  it('exactly 60% changed stays word by word', () => {
    const diff = computeDiff('aaaa bbbb cccc dddd eeee', 'aaaa bbbb xxxx yyyy zzzz')
    expect(diff.changedRatio).toBe(0.6)
    expect(diff.mode).toBe('inline')
  })

  it('just over 60% changed becomes a block', () => {
    const diff = computeDiff('aaaa bbbb cccc dddd eeee', 'aaaa bbb xxxx yyyy zzzz')
    expect(diff.changedRatio).toBeGreaterThan(0.6)
    expect(diff.mode).toBe('block')
  })

  it('an identical rewrite has no changes', () => {
    const diff = computeDiff('Nothing to do **here**.', 'Nothing to do **here**.')
    expect(diff).toMatchObject({ mode: 'inline', changeCount: 0, changedRatio: 0 })
  })

  it('the sample paragraph reads as a word-by-word diff, not a block', () => {
    const diff = computeDiff(WHY_NOW, WHY_NOW_SHORTER)
    expect(diff.mode).toBe('inline')
    expect(diff.changeCount).toBeGreaterThan(1)
  })
})
