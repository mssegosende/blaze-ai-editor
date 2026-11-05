// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { SAMPLE_DOCUMENT } from '../sampleDocument'
import {
  EDITOR_EXTENSIONS,
  normalizeMarkdown,
  placeFromHeading,
  placeFromSection,
  placeFromSelection,
} from './editorDocument'

const editors: Editor[] = []

function editorWith(markdown: string): Editor {
  const editor = new Editor({
    extensions: EDITOR_EXTENSIONS,
    content: markdown,
    contentType: 'markdown',
  })
  editors.push(editor)
  return editor
}

/** Selects the first occurrence of some text inside one block. */
function selectText(editor: Editor, text: string): void {
  let found: { from: number; to: number } | null = null
  editor.state.doc.descendants((node, position) => {
    if (found || !node.isTextblock) return true
    const index = node.textContent.indexOf(text)
    if (index >= 0) found = { from: position + 1 + index, to: position + 1 + index + text.length }
    return false
  })
  if (!found) throw new Error(`Text not found: ${text}`)
  editor.commands.setTextSelection(found)
}

function positionOf(editor: Editor, text: string): number {
  selectText(editor, text)
  return editor.state.selection.from
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
})

const RICH = `# Title

## Plans

Read **the plan** and see [the docs](https://example.com/docs) today.

- First *item*
- Second item

## Later

More text.
`

describe('Markdown round trip', () => {
  it('markdown round trip keeps headings, lists, bold and links', () => {
    const output = editorWith(RICH).getMarkdown()
    expect(output).toContain('# Title')
    expect(output).toContain('## Plans')
    expect(output).toContain('**the plan**')
    expect(output).toContain('[the docs](https://example.com/docs)')
    expect(output).toContain('- First *item*')
    expect(output).toContain('- Second item')
  })

  it('the sample document round trips without losing text', () => {
    const output = editorWith(SAMPLE_DOCUMENT).getMarkdown()
    expect(output).toContain('# AI rollout plan — Bluefield support team')
    expect(output).toContain("We'll know it's working when tickets get answered faster.")
    expect(output).toContain('- A shared knowledge base')
  })

  it('a placeholder in square brackets survives normalizing', () => {
    const text = 'Response time drops from [X] hours to [Y]% within [Z] weeks.'
    expect(normalizeMarkdown(editorWith(RICH), text)).toBe(text)
  })

  it('literal brackets before a parenthesis stay escaped, so they never become a link', () => {
    const text = normalizeMarkdown(editorWith(RICH), 'Use \\[X\\](y) literally.')
    expect(text).toBe('Use \\[X\\](y) literally.')
  })

  it('normalizing removes differences in Markdown syntax', () => {
    const editor = editorWith(RICH)
    expect(normalizeMarkdown(editor, '* one\n* two')).toBe(normalizeMarkdown(editor, '- one\n- two'))
    expect(normalizeMarkdown(editor, '__bold__')).toBe(normalizeMarkdown(editor, '**bold**'))
  })
})

describe('placeFromSelection', () => {
  it('a selection request sends only the selected Markdown', () => {
    const editor = editorWith(RICH)
    selectText(editor, 'Read the plan and see')
    const place = placeFromSelection(editor)
    expect(place?.kind).toBe('selection')
    expect(place?.inline).toBe(true)
    expect(place?.markdown).toBe('Read **the plan** and see')
  })

  it('a selected link keeps its URL in the Markdown', () => {
    const editor = editorWith(RICH)
    selectText(editor, 'the docs')
    expect(placeFromSelection(editor)?.markdown).toBe('[the docs](https://example.com/docs)')
  })

  it('a selection request includes its section as context', () => {
    const editor = editorWith(SAMPLE_DOCUMENT)
    selectText(editor, 'We are going to log every suggestion')
    const place = placeFromSelection(editor)
    expect(place?.title).toBe("How we'll keep it safe")
    expect(place?.context?.heading).toBe("How we'll keep it safe")
    // One paragraph holds the whole section, so nothing else is around it.
    expect(place?.context?.before).toBeNull()
  })

  it('context comes from the same section only', () => {
    const editor = editorWith('## One\n\nOther section.\n\n## Two\n\nBefore it.\n\nThe target.\n\nAfter it.\n\n## Three\n\nFar away.')
    selectText(editor, 'The target.')
    const context = placeFromSelection(editor)?.context
    expect(context).toEqual({ heading: 'Two', before: 'Before it.', after: 'After it.' })
  })

  it('edge spaces stay out of the replaced range', () => {
    const editor = editorWith('Keep these words together.')
    selectText(editor, ' these words ')
    const place = placeFromSelection(editor)
    expect(place?.markdown).toBe('these words')
    expect(editor.state.doc.textBetween(place?.from ?? 0, place?.to ?? 0)).toBe('these words')
  })

  it('an empty selection has no place', () => {
    const editor = editorWith(RICH)
    editor.commands.setTextSelection(3)
    expect(placeFromSelection(editor)).toBeNull()
  })

  it('a selection across blocks covers the whole blocks', () => {
    const editor = editorWith('## Head\n\nFirst paragraph.\n\nSecond paragraph.\n\nThird paragraph.')
    selectText(editor, 'paragraph.')
    const from = editor.state.selection.from
    selectText(editor, 'Second')
    editor.commands.setTextSelection({ from, to: editor.state.selection.to })
    const place = placeFromSelection(editor)
    expect(place?.inline).toBe(false)
    expect(place?.markdown).toBe('First paragraph.\n\nSecond paragraph.')
    expect(place?.context?.after).toBe('Third paragraph.')
  })
})

describe('placeFromSection', () => {
  it("the current section is the blocks under the cursor's heading", () => {
    const editor = editorWith(RICH)
    const place = placeFromSection(editor, positionOf(editor, 'Second item'))
    expect(place?.kind).toBe('section')
    expect(place?.title).toBe('Plans')
    expect(place?.markdown).toContain('**the plan**')
    expect(place?.markdown).toContain('- Second item')
  })

  it('a section command sends only that section', () => {
    const editor = editorWith(RICH)
    const markdown = placeFromSection(editor, positionOf(editor, 'the plan'))?.markdown ?? ''
    expect(markdown).not.toContain('Plans')
    expect(markdown).not.toContain('Title')
    expect(markdown).not.toContain('More text')
  })

  it('a cursor on a heading means the section under it', () => {
    const editor = editorWith(RICH)
    expect(placeFromSection(editor, positionOf(editor, 'Later'))?.markdown).toBe('More text.')
  })

  it('a section includes its subheadings', () => {
    const editor = editorWith('## Parent\n\nIntro.\n\n### Child\n\nDetail.\n\n## Next\n\nOther.')
    const markdown = placeFromSection(editor, positionOf(editor, 'Intro'))?.markdown ?? ''
    expect(markdown).toContain('### Child')
    expect(markdown).toContain('Detail.')
    expect(markdown).not.toContain('Other')
  })

  it('a title with no text of its own has no target', () => {
    const editor = editorWith(RICH)
    expect(placeFromSection(editor, positionOf(editor, 'Title'))).toBeNull()
  })

  it('an empty section has no target', () => {
    const editor = editorWith('## Empty\n\n## Next\n\nText.')
    expect(placeFromSection(editor, positionOf(editor, 'Empty'))).toBeNull()
  })

  it('a document with no headings targets the current paragraph, not all of it', () => {
    const editor = editorWith('First paragraph.\n\nSecond paragraph.\n\nThird paragraph.')
    const place = placeFromSection(editor, positionOf(editor, 'Second'))
    expect(place?.markdown).toBe('Second paragraph.')
  })

  it('a document with only a title targets the current paragraph, not all of it', () => {
    const editor = editorWith('# Title\n\nFirst paragraph.\n\nSecond paragraph.')
    expect(placeFromSection(editor, positionOf(editor, 'Second'))?.markdown).toBe('Second paragraph.')
  })
})

describe('placeFromHeading', () => {
  it('finds a section by its heading text', () => {
    const editor = editorWith(SAMPLE_DOCUMENT)
    expect(placeFromHeading(editor, 'Success metrics')?.markdown).toBe(
      "We'll know it's working when tickets get answered faster.",
    )
  })

  it('finds nothing when the heading is gone', () => {
    expect(placeFromHeading(editorWith(RICH), 'Success metrics')).toBeNull()
  })
})

describe('text the user just typed', () => {
  it('suggestions work on text the user just typed', () => {
    const editor = editorWith('')
    editor.commands.insertContent('A sentence I just typed with **bold** words.', { contentType: 'markdown' })
    selectText(editor, 'A sentence I just typed')
    const place = placeFromSelection(editor)
    expect(place?.kind).toBe('selection')
    expect(place?.markdown).toBe('A sentence I just typed')
    expect(placeFromSection(editor, positionOf(editor, 'just typed'))?.markdown).toBe(
      'A sentence I just typed with **bold** words.',
    )
  })
})
