import { useState, useEffect, useRef } from 'react'
import { MessageSquare, AlertTriangle } from 'lucide-react'
import { useChat } from '../hooks/useChat'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'
import { ChatHistoryList } from './ChatHistoryList'
import { ConfirmDialog } from './ConfirmDialog'
import './ChatPanel.css'

interface ChatPanelProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  endpoint: string | undefined
  width?: number
  onFilesChanged?: () => void
}

export function ChatPanel({ projectId, isOpen, onClose, endpoint, width }: ChatPanelProps) {
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
  } = useChat(projectId)

  const [showSettingsConfirm, setShowSettingsConfirm] = useState(false)
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
    // Clear current session - the hook manages this
    // We trigger a re-select with no session by just clearing
  }

  const handleSend = (userMessage: string) => {
    if (!endpoint) {
      setShowSettingsConfirm(true)
      return
    }
    sendMessage(userMessage, endpoint)
  }

  const handleStop = () => {
    stopStreaming()
  }

  const openSettings = () => {
    window.location.href = '/settings'
  }

  const isDisabled = !endpoint

  return (
    <div className="chat-panel" style={{ width: width ? `${width}px` : undefined }} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="chat-panel-header">
        <h2 className="chat-panel-title">
          <MessageSquare className="chat-panel-title-icon" />
          Chat
        </h2>
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
              <p>
                <AlertTriangle className="config-warning-icon" />
                Chat requires an{' '}
                <a href="/settings" onClick={e => { e.preventDefault(); openSettings(); }}>
                  OpenAI endpoint
                </a>{' '}
                configured in Settings.
              </p>
            </div>
          </div>
        ) : messages.length === 0 && !currentSession ? (
          <div className="chat-empty-state">
            <p>No chat sessions yet</p>
            <p>Start a conversation with the AI agent to explore your project.</p>
          </div>
        ) : (
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
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={isStreaming}
        disabled={isDisabled}
      />

      {/* Settings confirmation */}
      {showSettingsConfirm && (
        <ConfirmDialog
          title="Endpoint Not Configured"
          message="Chat requires an OpenAI endpoint configured in Settings."
          onConfirm={openSettings}
          onCancel={() => setShowSettingsConfirm(false)}
          confirmLabel="Open Settings"
        />
      )}
    </div>
  )
}
