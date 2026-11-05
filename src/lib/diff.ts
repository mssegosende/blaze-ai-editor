import { diffWordsWithSpace } from 'diff'
import type { SuggestTarget } from '../../shared/contract.ts'

/** Above this share of changed text, a word diff stops being readable. */
export const BLOCK_THRESHOLD = 0.6

export type DiffSegment =
  | { kind: 'same'; text: string }
  | { kind: 'change'; id: number; removed: string; added: string }

export type ChangeSegment = Extract<DiffSegment, { kind: 'change' }>

export interface SuggestionDiff {
  /** "block" is one before/after change, used when most of the text changed. */
  mode: 'inline' | 'block'
  segments: DiffSegment[]
  changeCount: number
  /** Share of non-whitespace characters changed, from 0 to 1. */
  changedRatio: number
  /** Blocks were reordered, merged or split: all or nothing. */
  restructured: boolean
}

export type ChangeDecision = 'keep' | 'discard'

/**
 * Markdown that breaks if only part of it changes. Keeping half of a changed
 * URL produces an address nobody wrote, and keeping one of two added `**`
 * markers leaves the rest of the paragraph bold.
 */
const ATOMIC_SPANS = [
  /!?\[[^\]\n]*\]\([^)\n]*\)/g, // [text](url) and images
  /https?:\/\/[^\s)\]]+/g, // bare URLs
  /`[^`\n]+`/g, // inline code
  /\*\*(?=\S).*?\S\*\*/g, // **bold**
  /(?<!\w)__(?=\S).*?\S__(?!\w)/g, // __bold__
  /(?<![*\w])\*(?=[^\s*])[^*\n]*?[^\s*]\*(?!\*)/g, // *italic*, not 2 * 3
  /(?<![\w_])_(?=[^\s_])[^_\n]*?[^\s_]_(?![\w_])/g, // _italic_, not snake_case
]

interface Range {
  start: number
  end: number
}

function findAtomicSpans(text: string): Range[] {
  return ATOMIC_SPANS.flatMap((pattern) =>
    Array.from(text.matchAll(pattern), (match) => ({
      start: match.index,
      end: match.index + match[0].length,
    })),
  )
}

/** An insertion has no width, so it only touches a span from strictly inside it. */
function touches(range: Range, span: Range): boolean {
  if (range.start === range.end) return span.start < range.start && range.start < span.end
  return range.start < span.end && range.end > span.start
}

function countVisible(text: string): number {
  return text.replace(/\s/g, '').length
}

type Draft = { kind: 'same'; text: string } | { kind: 'change'; removed: string; added: string }

function toDrafts(original: string, rewrite: string): { drafts: Draft[]; changedRatio: number } {
  const drafts: Draft[] = []
  let changedChars = 0

  for (const part of diffWordsWithSpace(original, rewrite)) {
    if (!part.added && !part.removed) {
      drafts.push({ kind: 'same', text: part.value })
      continue
    }
    changedChars += countVisible(part.value)
    let change = drafts.at(-1)
    if (change?.kind !== 'change') {
      change = { kind: 'change', removed: '', added: '' }
      drafts.push(change)
    }
    if (part.added) change.added += part.value
    else change.removed += part.value
  }

  const total = countVisible(original) + countVisible(rewrite)
  return { drafts, changedRatio: total === 0 ? 0 : changedChars / total }
}

/** Folds everything from `first` to `last` into one change. */
function mergeRange(drafts: Draft[], first: number, last: number): void {
  let removed = ''
  let added = ''
  for (const draft of drafts.slice(first, last + 1)) {
    removed += draft.kind === 'same' ? draft.text : draft.removed
    added += draft.kind === 'same' ? draft.text : draft.added
  }
  drafts.splice(first, last - first + 1, { kind: 'change', removed, added })
}

function mergeAcrossWhitespace(drafts: Draft[]): void {
  for (let i = drafts.length - 2; i > 0; i -= 1) {
    const draft = drafts[i]
    if (
      draft?.kind === 'same' &&
      draft.text.trim() === '' &&
      drafts[i - 1]?.kind === 'change' &&
      drafts[i + 1]?.kind === 'change'
    ) {
      mergeRange(drafts, i - 1, i + 1)
      i -= 1
    }
  }
}

function changeRanges(drafts: Draft[]) {
  const ranges = new Map<number, { original: Range; rewrite: Range }>()
  let originalAt = 0
  let rewriteAt = 0

  drafts.forEach((draft, index) => {
    if (draft.kind === 'same') {
      originalAt += draft.text.length
      rewriteAt += draft.text.length
      return
    }
    const original = { start: originalAt, end: originalAt + draft.removed.length }
    const rewrite = { start: rewriteAt, end: rewriteAt + draft.added.length }
    ranges.set(index, { original, rewrite })
    originalAt = original.end
    rewriteAt = rewrite.end
  })
  return ranges
}

/** Merges until no Markdown span is touched by more than one change. */
function mergeAtomicSpans(drafts: Draft[], original: string, rewrite: string): void {
  const originalSpans = findAtomicSpans(original)
  const rewriteSpans = findAtomicSpans(rewrite)

  let merged = true
  while (merged) {
    const ranges = [...changeRanges(drafts)]

    const mergeTouching = (spans: Range[], side: 'original' | 'rewrite') => {
      for (const span of spans) {
        const touching = ranges
          .filter(([, range]) => touches(range[side], span))
          .map(([index]) => index)
        const first = touching[0]
        const last = touching.at(-1)
        if (first !== undefined && last !== undefined && first !== last) {
          mergeRange(drafts, first, last)
          return true
        }
      }
      return false
    }

    merged = mergeTouching(originalSpans, 'original') || mergeTouching(rewriteSpans, 'rewrite')
  }
}

/** Paragraphs, list items and headings, one entry each. */
function blocksOf(markdown: string): string[] {
  return markdown
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

function wordsOf(block: string): Set<string> {
  return new Set(block.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [])
}

function similarity(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((word) => b.has(word)).length
  const total = new Set([...a, ...b]).size
  return total === 0 ? 0 : shared / total
}

/** Below this, a rewritten block counts as new rather than as a moved original. */
const SAME_BLOCK_SIMILARITY = 0.3

/**
 * True when blocks were merged, split, removed or reordered. Rewording a block
 * in place isn't restructuring: it keeps its count and its order.
 */
export function isRestructured(original: string, rewrite: string): boolean {
  const before = blocksOf(original).map(wordsOf)
  const after = blocksOf(rewrite).map(wordsOf)
  if (before.length !== after.length) return true

  let previous = -1
  for (const block of after) {
    let best = -1
    let bestScore = SAME_BLOCK_SIMILARITY
    before.forEach((candidate, index) => {
      const score = similarity(block, candidate)
      if (score > bestScore) {
        best = index
        bestScore = score
      }
    })
    if (best === -1) continue
    if (best < previous) return true
    previous = best
  }
  return false
}

/**
 * Whether to look for restructuring. A section always, since it may be
 * restructured on purpose. A selection only when it spans several blocks: the
 * model isn't asked to restructure one, but it can still reorder or merge them.
 * Splitting a one-paragraph selection stays word by word, since a split can't
 * leave anything twice.
 */
function canBeRestructured(original: string, target: SuggestTarget): boolean {
  return target === 'section' || blocksOf(original).length > 1
}

/**
 * Compares a passage with the model's rewrite. Pure: no editor, no DOM.
 *
 * Restructured text is always one block, whatever share of it changed: a moved
 * block is a removal plus an addition, so keeping only the addition would leave
 * the text in the document twice.
 */
export function computeDiff(
  original: string,
  rewrite: string,
  target: SuggestTarget = 'selection',
): SuggestionDiff {
  const { drafts, changedRatio } = toDrafts(original, rewrite)
  const restructured = canBeRestructured(original, target) && isRestructured(original, rewrite)

  if (restructured || changedRatio > BLOCK_THRESHOLD) {
    return {
      mode: 'block',
      segments: [{ kind: 'change', id: 0, removed: original, added: rewrite }],
      changeCount: 1,
      changedRatio,
      restructured,
    }
  }

  mergeAcrossWhitespace(drafts)
  mergeAtomicSpans(drafts, original, rewrite)

  let nextId = 0
  const segments = drafts.map((draft): DiffSegment =>
    draft.kind === 'same' ? draft : { ...draft, id: nextId++ },
  )
  return { mode: 'inline', segments, changeCount: nextId, changedRatio, restructured: false }
}

/** Builds the text to apply. A change with no decision stays as the original. */
export function applyDecisions(
  diff: SuggestionDiff,
  decisions: ReadonlyMap<number, ChangeDecision>,
): string {
  return diff.segments
    .map((segment) => {
      if (segment.kind === 'same') return segment.text
      return decisions.get(segment.id) === 'keep' ? segment.added : segment.removed
    })
    .join('')
}

export function changesOf(diff: SuggestionDiff): ChangeSegment[] {
  return diff.segments.filter((segment) => segment.kind === 'change')
}

export function keepAll(diff: SuggestionDiff): Map<number, ChangeDecision> {
  return new Map(changesOf(diff).map((change) => [change.id, 'keep']))
}
