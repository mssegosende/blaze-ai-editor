import type { Editor } from '@tiptap/core'
import styles from './App.module.css'
import { CoAuthorCard } from './components/CoAuthorCard/CoAuthorCard'
import { EditorPane } from './components/EditorPane/EditorPane'
import { SelectionPill } from './components/SelectionPill/SelectionPill'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Toast } from './components/Toast/Toast'
import {
  APP_NAME,
  DOCUMENT_FILE_NAME,
  DOCUMENT_SUBTITLE,
  DOCUMENT_TITLE,
  PILL_COMMANDS,
  REFINE_COMMANDS,
  TONE_COMMANDS,
} from './constants'
import type { Command } from './constants'
import { useBlazeEditor } from './hooks/useBlazeEditor'
import { useNotice } from './hooks/useNotice'
import { useSelectionPill } from './hooks/useSelectionPill'
import { askCommand, useSuggestion } from './hooks/useSuggestion'
import { useTryPrompts } from './hooks/useTryPrompts'

function Workspace({ editor }: { editor: Editor }) {
  const { notice, show: showNotice, dismiss: dismissNotice } = useNotice()
  const suggestion = useSuggestion(editor, showNotice)
  const pill = useSelectionPill(editor)
  const tryPrompts = useTryPrompts(editor)

  const runCommand = (command: Command) => {
    suggestion.askAboutSelection(command)
    pill.close()
  }

  const undo = () => {
    editor.commands.undo()
    dismissNotice()
  }

  return (
    <div className={styles.app}>
      <Sidebar appName={APP_NAME} documentTitle={DOCUMENT_TITLE} documentSubtitle={DOCUMENT_SUBTITLE} />
      <EditorPane editor={editor} fileName={DOCUMENT_FILE_NAME} showHint={!suggestion.hasAsked} />
      <CoAuthorCard
        appName={APP_NAME}
        view={suggestion.cardView}
        actions={suggestion.review}
        refineCommands={REFINE_COMMANDS}
        refineText={suggestion.refineText}
        onSubmitRefineText={() => suggestion.review.refine(askCommand(suggestion.refineText))}
        tryPrompts={tryPrompts}
        onTry={(prompt) => suggestion.askAboutHeading(prompt.heading, prompt.command)}
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
      <Toast notice={notice} onUndo={undo} />
    </div>
  )
}

export default function App() {
  const editor = useBlazeEditor()
  return <Workspace editor={editor} />
}
