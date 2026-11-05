import type { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import { MAX_CONTEXT_CHARS } from '../../shared/contract'
import type { SuggestContext, SuggestTarget } from '../../shared/contract'
import { TargetHighlight } from './targetHighlight'

export const EDITOR_EXTENSIONS = [
  StarterKit.configure({ link: { openOnClick: false } }),
  Markdown,
  TargetHighlight,
]

/** What a suggestion is about: a place in the document and its text. */
export interface SuggestionPlace {
  kind: SuggestTarget
  /** The range the suggestion would replace. */
  from: number
  to: number
  /** The block or blocks an edit would make the suggestion stale. */
  guardFrom: number
  guardTo: number
  /** True when the range sits inside one block rather than covering whole blocks. */
  inline: boolean
  markdown: string
  /** Shown in the card, such as "Why now". */
  title: string
  context: SuggestContext | null
}

/**
 * The serializer writes "[X]" as "\[X\]", which would show in the diff. Brackets
 * are safe to unescape unless a "(" follows, because then they'd become a link.
 */
function unescapeBrackets(markdown: string): string {
  return markdown.replace(/\\\[([^\]\\\n]*)\\\](?!\()/g, '[$1]')
}

function serialize(editor: Editor, content: unknown[]): string {
  const markdown = editor.markdown
  if (!markdown) throw new Error('The Markdown extension is not loaded')
  return unescapeBrackets(markdown.serialize({ type: 'doc', content: content as never[] })).trim()
}

/** Rewrites Markdown through the editor, so syntax choices don't show as changes. */
export function normalizeMarkdown(editor: Editor, text: string): string {
  const markdown = editor.markdown
  if (!markdown) throw new Error('The Markdown extension is not loaded')
  return unescapeBrackets(markdown.serialize(markdown.parse(text))).trim()
}

function blocksToMarkdown(editor: Editor, blocks: ProseMirrorNode[]): string {
  return serialize(editor, blocks.map((block) => block.toJSON()))
}

interface TopLevelBlock {
  node: ProseMirrorNode
  from: number
  to: number
}

function topLevelBlocks(doc: ProseMirrorNode): TopLevelBlock[] {
  const blocks: TopLevelBlock[] = []
  doc.forEach((node, offset) => blocks.push({ node, from: offset, to: offset + node.nodeSize }))
  return blocks
}

function isHeading(block: TopLevelBlock | undefined): boolean {
  return block?.node.type.name === 'heading'
}

function headingLevel(block: TopLevelBlock): number {
  return Number(block.node.attrs.level)
}

/**
 * The blocks a heading owns. A title (level 1) owns only the text before the
 * next heading, otherwise it would own the whole document.
 */
function sectionEnd(blocks: TopLevelBlock[], headingIndex: number): number {
  const heading = blocks[headingIndex]
  if (!heading) return headingIndex + 1
  const level = headingLevel(heading)
  for (let i = headingIndex + 1; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block && isHeading(block) && (level === 1 || headingLevel(block) <= level)) return i
  }
  return blocks.length
}

function headingIndexAt(blocks: TopLevelBlock[], blockIndex: number): number {
  for (let i = blockIndex; i >= 0; i -= 1) {
    if (isHeading(blocks[i])) return i
  }
  return -1
}

function truncate(text: string, keep: 'start' | 'end'): string | null {
  if (text === '') return null
  if (text.length <= MAX_CONTEXT_CHARS) return text
  return keep === 'start' ? text.slice(0, MAX_CONTEXT_CHARS) : text.slice(-MAX_CONTEXT_CHARS)
}

/**
 * The section around a selection, read-only for the model. When the document
 * has no heading, the neighbouring blocks stand in for it.
 */
function contextAround(
  editor: Editor,
  blocks: TopLevelBlock[],
  firstIndex: number,
  lastIndex: number,
): SuggestContext {
  const headingIndex = headingIndexAt(blocks, firstIndex)
  const heading = blocks[headingIndex]
  const start = headingIndex === -1 ? Math.max(0, firstIndex - 1) : headingIndex + 1
  const end =
    headingIndex === -1 ? Math.min(blocks.length, lastIndex + 2) : sectionEnd(blocks, headingIndex)

  const toText = (from: number, to: number) =>
    blocksToMarkdown(editor, blocks.slice(from, to).map((block) => block.node))

  return {
    heading: heading ? heading.node.textContent : null,
    before: truncate(toText(start, firstIndex), 'end'),
    after: truncate(toText(lastIndex + 1, end), 'start'),
  }
}

function blockIndexAt(blocks: TopLevelBlock[], position: number): number {
  return blocks.findIndex((block) => position >= block.from && position < block.to)
}

/** The user's selection, or null if there's nothing to work on. */
export function placeFromSelection(editor: Editor): SuggestionPlace | null {
  const { state } = editor
  const { $from, $to, empty } = state.selection
  if (empty) return null

  const blocks = topLevelBlocks(state.doc)
  const firstIndex = blockIndexAt(blocks, state.selection.from)
  const lastIndex = blockIndexAt(blocks, state.selection.to - 1)
  const first = blocks[firstIndex]
  const last = blocks[lastIndex]
  if (!first || !last) return null

  const heading = blocks[headingIndexAt(blocks, firstIndex)]
  const title = heading ? heading.node.textContent : 'Selection'
  const context = contextAround(editor, blocks, firstIndex, lastIndex)

  if ($from.sameParent($to) && $from.parent.isTextblock) {
    // Edge spaces stay out of the range: the model would drop them, and two
    // words would run together on accept.
    const selected = state.doc.textBetween(state.selection.from, state.selection.to)
    if (selected.trim() === '') return null
    const from = state.selection.from + (selected.length - selected.trimStart().length)
    const to = state.selection.to - (selected.length - selected.trimEnd().length)

    const parentStart = $from.start()
    const content = state.doc.slice(from, to).content.toJSON() as unknown[]
    return {
      kind: 'selection',
      from,
      to,
      guardFrom: parentStart,
      guardTo: parentStart + $from.parent.content.size,
      inline: true,
      markdown: serialize(editor, [{ type: 'paragraph', content }]),
      title,
      context,
    }
  }

  // Across blocks, the whole blocks are replaced so their structure stays valid.
  return {
    kind: 'selection',
    from: first.from,
    to: last.to,
    guardFrom: first.from,
    guardTo: last.to,
    inline: false,
    markdown: blocksToMarkdown(editor, blocks.slice(firstIndex, lastIndex + 1).map((block) => block.node)),
    title,
    context,
  }
}

/**
 * The section holding a position, without its heading, or null if it has no
 * text. With no usable heading it falls back to the current block, so this
 * never hands the whole document to the model.
 */
export function placeFromSection(editor: Editor, position: number): SuggestionPlace | null {
  const blocks = topLevelBlocks(editor.state.doc)
  const blockIndex = blockIndexAt(blocks, Math.min(position, editor.state.doc.content.size - 1))
  if (blockIndex === -1) return null

  const headingIndex = headingIndexAt(blocks, blockIndex)
  const heading = blocks[headingIndex]
  const start = headingIndex + 1
  const end = heading ? sectionEnd(blocks, headingIndex) : blocks.length
  const body = blocks.slice(start, end)
  const bodyBlocks = blocks.filter((block) => !isHeading(block))

  const coversWholeDocument = body.length > 1 && body.filter((block) => !isHeading(block)).length === bodyBlocks.length
  const chosen = !heading || coversWholeDocument ? blocks.slice(blockIndex, blockIndex + 1) : body

  const text = chosen.map((block) => block.node.textContent).join('').trim()
  const first = chosen[0]
  const last = chosen.at(-1)
  if (text === '' || !first || !last || chosen.every(isHeading)) return null

  return {
    kind: 'section',
    from: first.from,
    to: last.to,
    guardFrom: first.from,
    guardTo: last.to,
    inline: false,
    markdown: blocksToMarkdown(editor, chosen.map((block) => block.node)),
    title: heading ? heading.node.textContent : 'Paragraph',
    context: { heading: heading ? heading.node.textContent : null, before: null, after: null },
  }
}

export interface PaletteSurroundings {
  /** False until the user has put the cursor in the document themselves. */
  cursorPlaced: boolean
  /** The top-level block nearest the top of the viewport. */
  firstVisibleBlock: number
}

/** The nearest section with text: from this block downward, then back upward. */
function placeNearBlock(editor: Editor, start: number): SuggestionPlace | null {
  const blocks = topLevelBlocks(editor.state.doc)
  const first = Math.min(Math.max(start, 0), blocks.length - 1)
  const below = blocks.slice(first)
  const above = blocks.slice(0, first).reverse()
  for (const block of [...below, ...above]) {
    const place = placeFromSection(editor, block.from)
    if (place) return place
  }
  return null
}

/**
 * What the palette would act on: the selection, then the section at a cursor the
 * user placed, then the section nearest the top of the viewport. Null only when
 * the document has no text at all.
 */
export function placeForPalette(
  editor: Editor,
  { cursorPlaced, firstVisibleBlock }: PaletteSurroundings,
): SuggestionPlace | null {
  const selected = placeFromSelection(editor)
  if (selected) return selected

  const atCursor = cursorPlaced ? placeFromSection(editor, editor.state.selection.from) : null
  return atCursor ?? placeNearBlock(editor, firstVisibleBlock)
}

/** Which top-level block is nearest the top of the viewport. Reads the DOM. */
export function firstVisibleBlockIndex(editor: Editor): number {
  const { doc } = editor.state
  const bar = document.querySelector('[data-app-bar]')?.getBoundingClientRect()
  // The bar is only in the way when it's a thin strip across the top, not the tall sidebar.
  const top = bar && bar.height < window.innerHeight / 2 ? bar.bottom : 0

  let offset = 0
  for (let index = 0; index < doc.childCount; index += 1) {
    const element = editor.view.nodeDOM(offset)
    if (element instanceof HTMLElement && element.getBoundingClientRect().bottom > top) return index
    offset += doc.child(index).nodeSize
  }
  return 0
}

/** The prompts whose section is still there and still has text. */
export function availablePrompts<Prompt extends { heading: string }>(editor: Editor, prompts: Prompt[]): Prompt[] {
  return prompts.filter((prompt) => placeFromHeading(editor, prompt.heading) !== null)
}

/** The section under a heading with this exact text, for "Try one" prompts. */
export function placeFromHeading(editor: Editor, headingText: string): SuggestionPlace | null {
  const heading = topLevelBlocks(editor.state.doc).find(
    (block) => isHeading(block) && block.node.textContent === headingText,
  )
  return heading ? placeFromSection(editor, heading.from) : null
}
