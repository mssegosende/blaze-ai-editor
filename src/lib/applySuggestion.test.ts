// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { afterEach, describe, expect, it } from 'vitest'
import { applyMarkdown, mapPlace } from './applySuggestion'
import { applyDecisions, computeDiff, keepAll } from './diff'
import { EDITOR_EXTENSIONS, normalizeMarkdown, placeFromSection, placeFromSelection } from './editorDocument'
import type { SuggestionPlace } from './editorDocument'
import { setTargetHighlight } from './targetHighlight'

const editors: Editor[] = []

function editorWith(markdown: string): Editor {
  const editor = new Editor({ extensions: EDITOR_EXTENSIONS, content: markdown, contentType: 'markdown' })
  editors.push(editor)
  return editor
}

function range(editor: Editor, text: string): { from: number; to: number } {
  let found: { from: number; to: number } | null = null
  editor.state.doc.descendants((node, position) => {
    if (found || !node.isTextblock) return true
    const index = node.textContent.indexOf(text)
    if (index >= 0) found = { from: position + 1 + index, to: position + 1 + index + text.length }
    return false
  })
  if (!found) throw new Error(`Text not found: ${text}`)
  return found
}

function selection(editor: Editor, text: string): SuggestionPlace {
  editor.commands.setTextSelection(range(editor, text))
  const place = placeFromSelection(editor)
  if (!place) throw new Error('No place')
  return place
}

function section(editor: Editor, text: string): SuggestionPlace {
  const place = placeFromSection(editor, range(editor, text).from)
  if (!place) throw new Error('No section')
  return place
}

/** Inserts text the way typing does, with time passing so history groups stay apart. */
function typeAt(editor: Editor, position: number, text: string): void {
  editor.view.dispatch(editor.state.tr.insertText(text, position).setTime(Date.now() + 10_000))
}

function countDocChanges(editor: Editor): () => number {
  let count = 0
  editor.on('transaction', ({ transaction }: { transaction: Transaction }) => {
    if (transaction.docChanged) count += 1
  })
  return () => count
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
})

const RICH = `# Title

## Plans

Intro with **bold** and [a link](https://example.com/a).

- First *item*
- Second item

### Details

More **detail** here, see [the docs](https://example.com/b).

## Later

Other section.
`

describe('before accept', () => {
  it('the document does not change until accept', () => {
    const editor = editorWith(RICH)
    const before = editor.getJSON()
    const place = selection(editor, 'Intro with')
    setTargetHighlight(editor, place)
    computeDiff(place.markdown, normalizeMarkdown(editor, 'Opening with'))
    setTargetHighlight(editor, null)
    expect(editor.getJSON()).toEqual(before)
  })
})

describe('applyMarkdown', () => {
  it('an inline selection does not split its paragraph', () => {
    const editor = editorWith('Keep these words together in one paragraph.')
    applyMarkdown(editor, selection(editor, 'these words'), 'those terms')
    expect(editor.getMarkdown().trim()).toBe('Keep those terms together in one paragraph.')
    expect(editor.state.doc.childCount).toBe(1)
  })

  it('an inline selection inside a list item stays in that item', () => {
    const editor = editorWith('- First item\n- Second item')
    applyMarkdown(editor, selection(editor, 'Second'), 'Another')
    expect(editor.getMarkdown().trim()).toBe('- First item\n- Another item')
  })

  it('bold and links in an accepted rewrite become real marks', () => {
    const editor = editorWith('Plain words here.')
    applyMarkdown(editor, selection(editor, 'words'), '**bold** and [linked](https://example.com/x)')
    expect(editor.getMarkdown().trim()).toBe('Plain **bold** and [linked](https://example.com/x) here.')
  })

  it('a selection inside bold keeps the bold on accept', () => {
    const editor = editorWith('Some **very bold words** here.')
    const place = selection(editor, 'bold')
    expect(place.markdown).toBe('**bold**')
    applyMarkdown(editor, place, '**strong**')
    expect(editor.getMarkdown().trim()).toBe('Some **very strong words** here.')
  })

  it('a placeholder from the model lands as plain text', () => {
    const editor = editorWith('It drops by some amount.')
    const rewrite = normalizeMarkdown(editor, 'by [X]%')
    applyMarkdown(editor, selection(editor, 'by some amount'), rewrite)
    expect(editor.state.doc.textContent).toBe('It drops by [X]%.')
  })

  it('one undo restores the whole accepted suggestion', () => {
    const editor = editorWith(RICH)
    const before = editor.getJSON()
    const place = section(editor, 'Intro with')
    applyMarkdown(editor, place, 'Completely **new** text.\n\nAnd a second paragraph.')
    expect(editor.getMarkdown()).toContain('Completely **new** text.')

    editor.commands.undo()
    expect(editor.getJSON()).toEqual(before)
  })

  it('accepting makes one document change', () => {
    const editor = editorWith(RICH)
    const changes = countDocChanges(editor)
    applyMarkdown(editor, section(editor, 'Intro with'), 'New text.\n\nMore new text.\n\n- A list')
    expect(changes()).toBe(1)
  })

  it('undo does not take the typing before the accept with it', () => {
    const editor = editorWith('First paragraph.\n\nSecond paragraph.')
    editor.commands.insertContentAt(range(editor, 'First').from, 'Typed ')
    const typed = editor.getMarkdown()
    applyMarkdown(editor, selection(editor, 'Second'), 'Other')
    editor.commands.undo()
    expect(editor.getMarkdown()).toBe(typed)
  })

  it('typing after the accept undoes separately from it', () => {
    const editor = editorWith('First paragraph.\n\nSecond paragraph.')
    applyMarkdown(editor, selection(editor, 'Second'), 'Other')
    const accepted = editor.getMarkdown()
    editor.commands.insertContentAt(range(editor, 'First').from, 'Typed ')
    editor.commands.undo()
    expect(editor.getMarkdown()).toBe(accepted)
  })

  it('partial accept applies only the kept changes, in one undo', () => {
    const editor = editorWith('The quick fox jumps over a lazy dog today.')
    const before = editor.getJSON()
    const place = selection(editor, 'The quick fox jumps over a lazy dog')
    const diff = computeDiff(place.markdown, 'The slow fox jumps over a happy dog')
    expect(diff.changeCount).toBe(2)

    applyMarkdown(editor, place, applyDecisions(diff, new Map([[1, 'keep']])))
    expect(editor.getMarkdown().trim()).toBe('The quick fox jumps over a happy dog today.')

    editor.commands.undo()
    expect(editor.getJSON()).toEqual(before)
  })

  it('accepting everything leaves bold and links as the rewrite has them', () => {
    const editor = editorWith('Read **the plan** at [the site](https://a.io/x) soon.')
    const place = selection(editor, 'Read the plan at the site')
    const rewrite = 'Study **the plan** at [the site](https://b.io/y)'
    const diff = computeDiff(place.markdown, rewrite)
    applyMarkdown(editor, place, applyDecisions(diff, keepAll(diff)))
    expect(editor.getMarkdown().trim()).toBe('Study **the plan** at [the site](https://b.io/y) soon.')
  })
})

describe('restructuring a section', () => {
  const REORDERED = `Second item first, with **bold** and [a link](https://example.com/a).

- Second item
- First *item*

### Details

More **detail** here, see [the docs](https://example.com/b).`

  it('accepting a restructured section is one transaction', () => {
    const editor = editorWith(RICH)
    const before = editor.getJSON()
    const changes = countDocChanges(editor)

    applyMarkdown(editor, section(editor, 'Intro with'), REORDERED)
    expect(changes()).toBe(1)

    editor.commands.undo()
    expect(editor.getJSON()).toEqual(before)
  })

  it('a restructured section keeps headings, lists, bold and links', () => {
    const editor = editorWith(RICH)
    applyMarkdown(editor, section(editor, 'Intro with'), REORDERED)
    const output = editor.getMarkdown()

    expect(output).toContain('## Plans')
    expect(output).toContain('### Details')
    expect(output).toContain('## Later')
    expect(output).toContain('- Second item\n- First *item*')
    expect(output).toContain('**bold**')
    expect(output).toContain('[a link](https://example.com/a)')
    expect(output).toContain('[the docs](https://example.com/b)')
    expect(output).toContain('Other section.')
    expect(output.indexOf('- Second item')).toBeLessThan(output.indexOf('### Details'))
  })

  it('merging paragraphs and splitting list items both land correctly', () => {
    const editor = editorWith('## Head\n\nOne paragraph.\n\nTwo paragraph.\n\n- Combined item\n\n## Next\n\nAfter.')
    applyMarkdown(editor, section(editor, 'One paragraph'), 'One and two paragraph together.\n\n- Combined\n- Item')
    const output = editor.getMarkdown()
    expect(output).toContain('## Head\n\nOne and two paragraph together.\n\n- Combined\n- Item')
    expect(output).toContain('## Next\n\nAfter.')
  })

  it('a restructure only replaces its own section', () => {
    const editor = editorWith(RICH)
    applyMarkdown(editor, section(editor, 'Other section'), 'Replaced.')
    const output = editor.getMarkdown()
    expect(output).toContain('Replaced.')
    expect(output).toContain('[a link](https://example.com/a)')
    expect(output).not.toContain('Other section.')
  })
})

describe('text the user just typed', () => {
  it('a suggestion on freshly typed text can be accepted', () => {
    const editor = editorWith('')
    typeAt(editor, 1, 'I wrote this sentence myself just now.')
    const place = selection(editor, 'I wrote this sentence myself')
    const diff = computeDiff(place.markdown, 'I authored this sentence')
    applyMarkdown(editor, place, applyDecisions(diff, keepAll(diff)))
    expect(editor.getMarkdown().trim()).toBe('I authored this sentence just now.')
  })
})

describe('mapPlace', () => {
  function capture(editor: Editor, edit: () => void): Transaction {
    let captured: Transaction | null = null
    const listener = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged) captured = transaction
    }
    editor.on('transaction', listener)
    edit()
    editor.off('transaction', listener)
    if (!captured) throw new Error('No document change')
    return captured
  }

  it('editing inside the paragraph discards the suggestion', () => {
    const editor = editorWith('## Head\n\nFirst sentence here. Second sentence here.\n\nOther paragraph.')
    const place = selection(editor, 'First sentence')
    const tr = capture(editor, () => typeAt(editor, range(editor, 'Second').from, 'New '))
    // The edit is outside the selected words but inside their paragraph.
    expect(mapPlace(place, tr).touched).toBe(true)
  })

  it('editing inside the selected words discards the suggestion', () => {
    const editor = editorWith('First sentence here.')
    const place = selection(editor, 'First sentence')
    const tr = capture(editor, () => typeAt(editor, place.from + 2, 'x'))
    expect(mapPlace(place, tr).touched).toBe(true)
  })

  it('editing elsewhere keeps the suggestion and moves its range', () => {
    const editor = editorWith('Earlier paragraph.\n\nTarget sentence here.\n\nLater paragraph.')
    const place = selection(editor, 'Target sentence')
    const tr = capture(editor, () => typeAt(editor, 1, 'Added '))
    const mapped = mapPlace(place, tr)

    expect(mapped.touched).toBe(false)
    expect(mapped.place.from).toBe(place.from + 6)
    expect(mapped.place.to).toBe(place.to + 6)
    expect(editor.state.doc.textBetween(mapped.place.from, mapped.place.to)).toBe('Target sentence')
  })

  it('editing after the paragraph leaves the range where it was', () => {
    const editor = editorWith('Target sentence here.\n\nLater paragraph.')
    const place = selection(editor, 'Target sentence')
    const tr = capture(editor, () => typeAt(editor, range(editor, 'Later').from, 'Added '))
    const mapped = mapPlace(place, tr)
    expect(mapped.touched).toBe(false)
    expect(mapped.place.from).toBe(place.from)
  })

  it('a paste over the paragraph discards the suggestion', () => {
    const editor = editorWith('Target sentence here.\n\nLater paragraph.')
    const place = selection(editor, 'Target sentence')
    const tr = capture(editor, () => {
      editor.commands.insertContentAt(range(editor, 'sentence here'), 'pasted text')
    })
    expect(mapPlace(place, tr).touched).toBe(true)
  })

  it('an undo that reaches the paragraph discards the suggestion', () => {
    const editor = editorWith('Target sentence here.')
    typeAt(editor, 1, 'Typed ')
    const place = selection(editor, 'Target sentence')
    const tr = capture(editor, () => editor.commands.undo())
    expect(mapPlace(place, tr).touched).toBe(true)
  })

  it('a section is guarded across all its blocks', () => {
    const editor = editorWith('## Head\n\nOne.\n\nTwo.\n\n## Next\n\nThree.')
    const place = section(editor, 'One.')
    expect(mapPlace(place, capture(editor, () => typeAt(editor, range(editor, 'Two.').from, 'x'))).touched).toBe(true)
  })
})
