import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const highlightKey = new PluginKey<DecorationSet>('targetHighlight')

export interface HighlightRange {
  from: number
  to: number
}

/**
 * Marks what a suggestion is about without touching the document: decorations
 * are drawn over the text and never saved in it.
 */
export const TargetHighlight = Extension.create({
  name: 'targetHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: highlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, current) {
            const next = tr.getMeta(highlightKey) as DecorationSet | undefined
            return next ?? current.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations: (state) => highlightKey.getState(state),
        },
      }),
    ]
  },
})

export function setTargetHighlight(editor: Editor, range: HighlightRange | null, thinking = false): void {
  const { doc, tr } = editor.state
  const decorations: Decoration[] = []

  if (range) {
    decorations.push(Decoration.inline(range.from, range.to, { class: 'blaze-target' }))
    const blockClass = thinking ? 'blaze-target-block blaze-thinking' : 'blaze-target-block'
    doc.forEach((node, offset) => {
      const end = offset + node.nodeSize
      if (offset < range.to && end > range.from) {
        decorations.push(Decoration.node(offset, end, { class: blockClass }))
      }
    })
  }

  editor.view.dispatch(tr.setMeta(highlightKey, DecorationSet.create(doc, decorations)))
}
