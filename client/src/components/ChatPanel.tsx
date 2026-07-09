import { useState, useEffect, useRef } from 'react'
import { MessageSquare, AlertTriangle } from 'lucide-react'
import { useChat } from '../hooks/useChat'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'
import { ChatHistoryList } from './ChatHistoryList'
import { ConfirmDialog } from './ConfirmDialog'
import { PersonaSelector } from './PersonaSelector'
import { FileChange, Persona, Macro } from '../types'
import './ChatPanel.css'

interface ChatPanelProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  endpoint: string | undefined
  selectedModel: string | undefined
  personas: Persona[]
  defaultPersonaId: string | undefined
  macros: Macro[]
  width?: number
  onFilesChanged?: () => void
  onAgentFileChanges?: (files: FileChange[]) => void
}

export function ChatPanel({ projectId, isOpen, onClose, endpoint, selectedModel, personas, defaultPersonaId, macros, width, onAgentFileChanges }: ChatPanelProps) {
  const {
    sessions,
    currentSession,
    messages,
    isStreaming,
    isLoading,
    isLoadingSessions,
    loadSessions,
    selectSession,
    sendMessage,
    stopStreaming,
    newChat,
    selectedPersona,
    setSelectedPersona,
    draftText,
    setDraftText,
    clearDraft,
  } = useChat(projectId, { onFilesChanged: onAgentFileChanges })

  const [showSettingsConfirm, setShowSettingsConfirm] = useState<'endpoint' | 'model' | false>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load history when panel opens
  useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen, loadSessions])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSelectSession = (sessionId: string) => {
    selectSession(sessionId)
  }

  const handleNewChat = () => {
    newChat()
  }

  const handlePersonaSelect = (persona: Persona) => {
    setSelectedPersona(persona)
  }

  const handleSend = (userMessage: string) => {
    if (!endpoint) {
      setShowSettingsConfirm('endpoint')
      return
    }
    if (!selectedModel) {
      setShowSettingsConfirm('model')
      return
    }
    sendMessage(userMessage, endpoint, selectedModel, selectedPersona?.id)
  }

  const handleMacroSelect = (prompt: string) => {
    handleSend(prompt)
  }

  const handleStop = () => {
    stopStreaming()
  }

  const openSettings = () => {
    window.location.href = '/settings'
  }

  const isDisabled = !endpoint || !selectedModel
  const hasMessages = messages.length > 0
  const hasSession = !!currentSession

  return (
    <div className="chat-panel" style={{ width: width ? `${width}px` : undefined }} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="chat-panel-header">
        <div className="chat-panel-header-left">
          <h2 className="chat-panel-title">
            <MessageSquare className="chat-panel-title-icon" />
            Chat
          </h2>
          {hasSession && (
            <span className="chat-panel-subtitle">{"— " + currentSession.title}</span>
          )}
        </div>
        <button
          className="chat-panel-close"
          onClick={onClose}
          aria-label="Close chat"
        >
          ×
        </button>
      </div>

      {/* Chat History */}
      <ChatHistoryList
        projectId={projectId}
        sessions={sessions}
        onSelect={handleSelectSession}
        onNewChat={handleNewChat}
        currentSessionId={currentSession?.id}
      />

      {/* Messages */}
      <div className="chat-panel-messages" role="log" aria-label="Chat messages">
        {isLoadingSessions || isLoading ? (
          <div className="loading">Loading chat...</div>
        ) : isDisabled ? (
          <div className="chat-empty-state">
            <div className="chat-config-warning">
              {!endpoint && (
                <p>
                  <AlertTriangle className="config-warning-icon" />
                  Chat requires an{' '}
                  <a href="/settings" onClick={e => { e.preventDefault(); openSettings(); }}>
                    OpenAI endpoint
                  </a>{' '}
                  configured in Settings.
                </p>
              )}
              {!selectedModel && endpoint && (
                <p>
                  <AlertTriangle className="config-warning-icon" />
                  Chat requires a{' '}
                  <a href="/settings" onClick={e => { e.preventDefault(); openSettings(); }}>
                    model
                  </a>{' '}
                  selected in Settings.
                </p>
              )}
            </div>
          </div>
        ) : hasMessages || hasSession ? (
          <>
            {messages.map((msg, idx) => (
              <ChatBubble
                key={msg.id}
                role={msg.role as 'user' | 'assistant' | 'tool'}
                content={msg.content}
                tool_calls={msg.tool_calls}
                isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : personas.length > 0 ? (
          <PersonaSelector
            personas={personas}
            defaultPersonaId={defaultPersonaId}
            onSelect={handlePersonaSelect}
          />
        ) : (
          <div className="chat-empty-state">
            <p>No chat sessions yet</p>
            <p>Start a conversation with the AI agent to explore your project.</p>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onMacroSelect={handleMacroSelect}
        onStop={handleStop}
        isStreaming={isStreaming}
        disabled={isDisabled}
        macros={macros}
        draftText={draftText}
        onDraftChange={setDraftText}
        onDraftClear={clearDraft}
      />

      {/* Settings confirmation */}
      {showSettingsConfirm === 'endpoint' && (
        <ConfirmDialog
          title="Endpoint Not Configured"
          message="Chat requires an OpenAI endpoint configured in Settings."
          onConfirm={openSettings}
          onCancel={() => setShowSettingsConfirm(false)}
          confirmLabel="Open Settings"
        />
      )}
      {showSettingsConfirm === 'model' && (
        <ConfirmDialog
          title="Model Not Selected"
          message="Chat requires a model selected in Settings."
          onConfirm={openSettings}
          onCancel={() => setShowSettingsConfirm(false)}
          confirmLabel="Open Settings"
        />
      )}
    </div>
  )
}
