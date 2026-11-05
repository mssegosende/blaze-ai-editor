import type { Editor } from '@tiptap/core'
import { useCallback, useState } from 'react'
import styles from './App.module.css'
import { CoAuthorCard } from './components/CoAuthorCard/CoAuthorCard'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { EditorPane } from './components/EditorPane/EditorPane'
import { SelectionPill } from './components/SelectionPill/SelectionPill'
import { ShortcutsDialog } from './components/ShortcutsDialog/ShortcutsDialog'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Toast } from './components/Toast/Toast'
import {
  APP_NAME,
  DOCUMENT_FILE_NAME,
  DOCUMENT_SUBTITLE,
  DOCUMENT_TITLE,
  PALETTE_COMMANDS,
  PILL_COMMANDS,
  REFINE_COMMANDS,
  SHORTCUTS,
  TONE_COMMANDS,
} from './constants'
import type { Command } from './constants'
import { useBlazeEditor } from './hooks/useBlazeEditor'
import { useNotice } from './hooks/useNotice'
import { usePalette } from './hooks/usePalette'
import { useSelectionPill } from './hooks/useSelectionPill'
import { useShortcuts } from './hooks/useShortcuts'
import { askCommand, useSuggestion } from './hooks/useSuggestion'
import { useTryPrompts } from './hooks/useTryPrompts'
import type { KeyAction } from './lib/keyboard'

function Workspace({ editor }: { editor: Editor }) {
  const { notice, show: showNotice, dismiss: dismissNotice } = useNotice()
  const suggestion = useSuggestion(editor, showNotice)
  const pill = useSelectionPill(editor)
  const tryPrompts = useTryPrompts(editor)
  const palette = usePalette(editor, PALETTE_COMMANDS.length, suggestion.reviewingPlace)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const { cardView, review } = suggestion

  const runCommand = (command: Command) => {
    suggestion.askAboutSelection(command)
    pill.close()
  }

  const undo = useCallback(() => {
    editor.commands.undo()
    dismissNotice()
  }, [dismissNotice, editor])

  const closePalette = () => {
    palette.close()
    editor.commands.focus(undefined, { scrollIntoView: false })
  }

  const runPaletteCommand = (command: Command) => {
    const state = palette.state
    palette.close()
    pill.close()
    if (!state?.place) return
    if (state.refining) review.refine(command)
    else suggestion.askAbout(state.place, command)
  }

  const closeShortcuts = () => {
    setShortcutsOpen(false)
    editor.commands.focus(undefined, { scrollIntoView: false })
  }

  const onKeyAction = (action: Exclude<KeyAction, null>) => {
    switch (action) {
      case 'palette':
        pill.close()
        palette.open()
        break
      case 'shortcuts':
        setShortcutsOpen(true)
        break
      case 'acceptAll':
        review.acceptAll()
        break
      case 'undo':
        undo()
        break
      case 'leaveInput':
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        pill.close()
        break
      case 'dismiss':
        if (pill.position) pill.close()
        else if (cardView.kind === 'loading') review.cancel()
        else if (cardView.kind === 'review' && cardView.refining !== null) review.cancel()
        else if (cardView.kind === 'review') review.rejectAll()
        else if (cardView.kind === 'error') review.close()
        break
    }
  }

  useShortcuts(editor, {
    overlayOpen: palette.state !== null || shortcutsOpen,
    reviewing: cardView.kind === 'review' && cardView.refining === null,
    onAction: onKeyAction,
  })

  return (
    <div className={styles.app}>
      <Sidebar
        appName={APP_NAME}
        documentTitle={DOCUMENT_TITLE}
        documentSubtitle={DOCUMENT_SUBTITLE}
        onCommands={palette.open}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <EditorPane editor={editor} fileName={DOCUMENT_FILE_NAME} showHint={!suggestion.hasAsked} />
      <CoAuthorCard
        appName={APP_NAME}
        view={cardView}
        actions={review}
        refineCommands={REFINE_COMMANDS}
        refineText={suggestion.refineText}
        onSubmitRefineText={() => review.refine(askCommand(suggestion.refineText))}
        tryPrompts={tryPrompts}
        onTry={(prompt) => suggestion.askAboutHeading(prompt.heading, prompt.command)}
        shortcuts={SHORTCUTS}
      />
      {pill.position && (
        <SelectionPill
          appName={APP_NAME}
          position={pill.position}
          view={pill.view}
          commands={PILL_COMMANDS}
          toneCommands={TONE_COMMANDS}
          askText={pill.askText}
          onViewChange={pill.setView}
          onAskTextChange={pill.setAskText}
          onCommand={runCommand}
          onAsk={() => runCommand(askCommand(pill.askText))}
        />
      )}
      {palette.state && (
        <CommandPalette
          appName={APP_NAME}
          targetTitle={palette.state.place?.title ?? null}
          commands={PALETTE_COMMANDS}
          index={palette.state.index}
          askText={palette.state.askText}
          onAskTextChange={palette.setAskText}
          onMove={palette.moveWithKey}
          onHover={palette.setIndex}
          onRun={runPaletteCommand}
          onAsk={() => runPaletteCommand(askCommand(palette.state?.askText ?? ''))}
          onClose={closePalette}
        />
      )}
      {shortcutsOpen && <ShortcutsDialog rows={SHORTCUTS} onClose={closeShortcuts} />}
      <Toast notice={notice} onUndo={undo} />
    </div>
  )
}

export default function App() {
  const editor = useBlazeEditor()
  return <Workspace editor={editor} />
}
