import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { fetchSettings, fetchPersonas, fetchMacros } from '../api'
import { ProjectReader } from './ProjectReader'
import { ProjectEditor } from './ProjectEditor'
import { ChatPanel } from './ChatPanel'
import { Splitter } from './Splitter'
import { FileChange, Persona, Macro } from '../types'
import styles from './ProjectDetail.module.css'

interface ProjectDetailProps {
  projectId: string
  filename?: string
}

export function ProjectDetail({ projectId, filename }: ProjectDetailProps) {
  const navigate = useNavigate()
  const editFilename = filename
  const [chatOpen, setChatOpen] = useState(true)
  const [endpoint, setEndpoint] = useState<string | undefined>(undefined)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [defaultPersonaId, setDefaultPersonaId] = useState<string | undefined>(undefined)
  const [macros, setMacros] = useState<Macro[]>([])
  const projectReaderRef = useRef<{ refreshFiles: () => void; refreshFileContent: (filename: string) => void } | null>(null)

  // Split position state with localStorage persistence
  const [splitPosition, setSplitPosition] = useState<number>(() => {
    const saved = localStorage.getItem('chatSplitPosition')
    return saved ? Number(saved) : 380 // default 380px for chat panel
  })

  const loadSettings = useCallback(async () => {
    try {
      const settings = await fetchSettings()
      setEndpoint(settings.openAiEndpoint || undefined)
      setSelectedModel(settings.selectedModel || undefined)
      setDefaultPersonaId(settings.defaultPersonaId)
    } catch {
      setEndpoint(undefined)
      setSelectedModel(undefined)
      setDefaultPersonaId(undefined)
    }
  }, [])

  const loadPersonas = useCallback(async () => {
    try {
      const data = await fetchPersonas()
      setPersonas(data)
    } catch {
      setPersonas([])
    }
  }, [])

  const loadMacros = useCallback(async () => {
    try {
      const data = await fetchMacros()
      setMacros(data)
    } catch {
      setMacros([])
    }
  }, [])

  useEffect(() => {
    loadSettings()
    loadPersonas()
    loadMacros()
  }, [loadSettings, loadPersonas, loadMacros])

  // Persist split position
  useEffect(() => {
    localStorage.setItem('chatSplitPosition', String(splitPosition))
  }, [splitPosition])

  const handleSplitResize = useCallback((chatWidth: number) => {
    setSplitPosition(chatWidth)
  }, [])

  const handleFilesChanged = useCallback(() => {
    projectReaderRef.current?.refreshFiles()
  }, [])

  const handleAgentFileChanges = useCallback((files: FileChange[]) => {
    // Refresh the file list
    projectReaderRef.current?.refreshFiles()
    // Refresh content for each modified file
    for (const file of files) {
      projectReaderRef.current?.refreshFileContent(file.filename)
    }
  }, [])

  // If we have an edit filename in the URL, render the editor
  if (editFilename) {
    return (
      <div className={styles['project-detail-layout']}>
        <div className={styles['project-detail-content']}>
          <ProjectEditor projectId={projectId} />
        </div>
        {chatOpen && (
          <>
            <Splitter
              orientation="vertical"
              onResize={handleSplitResize}
              minLeftWidth={300}
              minRightWidth={250}
              initialRightWidth={splitPosition}
            />
            <ChatPanel
              projectId={projectId}
              isOpen={chatOpen}
              onClose={() => setChatOpen(false)}
              endpoint={endpoint}
              selectedModel={selectedModel}
              personas={personas}
              defaultPersonaId={defaultPersonaId}
              macros={macros}
              width={splitPosition}
              onFilesChanged={handleFilesChanged}
              onAgentFileChanges={handleAgentFileChanges}
            />
          </>
        )}
      </div>
    )
  }

  // Otherwise render the reader view
  return (
    <div className={styles['project-detail-layout']}>
      <div className={`${styles['project-detail-content']} ${chatOpen ? '' : styles['full-width']}`}>
        <ProjectReader
          ref={projectReaderRef}
          projectId={projectId}
          onEdit={(filename) => navigate(`/project/${projectId}/edit/${encodeURIComponent(filename)}`)}
        />
      </div>
      {chatOpen && (
        <>
          <Splitter
            orientation="vertical"
            onResize={handleSplitResize}
            minLeftWidth={300}
            minRightWidth={250}
            initialRightWidth={splitPosition}
          />
          <ChatPanel
            projectId={projectId}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            endpoint={endpoint}
            selectedModel={selectedModel}
            personas={personas}
            defaultPersonaId={defaultPersonaId}
            macros={macros}
            width={splitPosition}
            onFilesChanged={handleFilesChanged}
            onAgentFileChanges={handleAgentFileChanges}
          />
        </>
      )}
      {!chatOpen && (
        <button
          className={styles['chat-fab']}
          onClick={() => setChatOpen(true)}
          aria-label="Open chat"
          title="Open chat"
        >
          <MessageSquare className={styles['chat-fab-icon']} />
        </button>
      )}
    </div>
  )
}
