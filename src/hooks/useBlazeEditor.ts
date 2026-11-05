import { useEditor } from '@tiptap/react'
import { EDITOR_EXTENSIONS } from '../lib/editorDocument'
import { SAMPLE_DOCUMENT } from '../sampleDocument'

export function useBlazeEditor() {
  return useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: SAMPLE_DOCUMENT,
    contentType: 'markdown',
    editorProps: {
      attributes: { 'aria-label': 'Document', spellcheck: 'true' },
    },
  })
}
