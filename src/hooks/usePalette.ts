import type { Editor } from '@tiptap/core'
import { useCallback, useState } from 'react'
import { placeForPalette } from '../lib/editorDocument'
import type { SuggestionPlace } from '../lib/editorDocument'
import { movePaletteIndex } from '../lib/keyboard'

interface PaletteState {
  /** What a command would act on, fixed when the palette opens. */
  place: SuggestionPlace | null
  /** True during a review: commands refine it rather than start a new one. */
  refining: boolean
  index: number
  askText: string
}

export function usePalette(editor: Editor, total: number, reviewingPlace: SuggestionPlace | null) {
  const [state, setState] = useState<PaletteState | null>(null)

  const open = useCallback(() => {
    setState({
      place: reviewingPlace ?? placeForPalette(editor),
      refining: reviewingPlace !== null,
      index: 0,
      askText: '',
    })
  }, [editor, reviewingPlace])

  const close = useCallback(() => setState(null), [])

  const moveWithKey = useCallback(
    (key: string) => {
      setState((current) => current && { ...current, index: movePaletteIndex(current.index, total, key) })
    },
    [total],
  )

  const setIndex = useCallback((index: number) => {
    setState((current) => current && { ...current, index })
  }, [])

  const setAskText = useCallback((askText: string) => {
    setState((current) => current && { ...current, askText })
  }, [])

  return { state, open, close, moveWithKey, setIndex, setAskText }
}
