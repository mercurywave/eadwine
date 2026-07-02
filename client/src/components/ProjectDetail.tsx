import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSettings } from '../api'
import { ProjectReader } from './ProjectReader'
import { ProjectEditor } from './ProjectEditor'
import { ChatPanel } from './ChatPanel'
import { Splitter } from './Splitter'
import './ProjectDetail.css'

interface ProjectDetailProps {
  projectId: string
  filename?: string
}

export function ProjectDetail({ projectId, filename }: ProjectDetailProps) {
  const navigate = useNavigate()
  const editFilename = filename
  const [chatOpen, setChatOpen] = useState(true)
  const [endpoint, setEndpoint] = useState<string | undefined>(undefined)

  // Split position state with localStorage persistence
  const [splitPosition, setSplitPosition] = useState<number>(() => {
    const saved = localStorage.getItem('chatSplitPosition')
    return saved ? Number(saved) : 380 // default 380px for chat panel
  })

  const loadEndpoint = useCallback(async () => {
    try {
      const settings = await fetchSettings()
      setEndpoint(settings.openAiEndpoint || undefined)
    } catch {
      setEndpoint(undefined)
    }
  }, [])

  useEffect(() => {
    loadEndpoint()
  }, [loadEndpoint])

  // Persist split position
  useEffect(() => {
    localStorage.setItem('chatSplitPosition', String(splitPosition))
  }, [splitPosition])

  const handleSplitResize = useCallback((chatWidth: number) => {
    setSplitPosition(chatWidth)
  }, [])

  // If we have an edit filename in the URL, render the editor
  if (editFilename) {
    return (
      <div className="project-detail-layout">
        <div className="project-detail-content">
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
              width={splitPosition}
            />
          </>
        )}
      </div>
    )
  }

  // Otherwise render the reader view
  return (
    <div className="project-detail-layout">
      <div className={`project-detail-content ${chatOpen ? '' : 'full-width'}`}>
        <ProjectReader
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
            width={splitPosition}
          />
        </>
      )}
      {!chatOpen && (
        <button
          className="chat-fab"
          onClick={() => setChatOpen(true)}
          aria-label="Open chat"
          title="Open chat"
        >
          💬
        </button>
      )}
    </div>
  )
}
