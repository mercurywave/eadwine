import { useState, useEffect, useRef } from 'react'
import { MessageSquare, AlertTriangle } from 'lucide-react'
import { ChatMessage, ChatSession, ChatSessionSummary } from '../types'
import {
  fetchChatSessions,
  fetchChatSession,
  createChatSession,
  persistChatMessage,
  streamChatMessage,
} from '../api'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'
import { ChatHistoryList } from './ChatHistoryList'
import { ConfirmDialog } from './ConfirmDialog'
import { useToasts } from './Toast'
import './ChatPanel.css'

interface ChatPanelProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  endpoint: string | undefined
  width?: number
}

export function ChatPanel({ projectId, isOpen, onClose, endpoint, width }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [showSettingsConfirm, setShowSettingsConfirm] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const { addToast } = useToasts()
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load history when panel opens
  useEffect(() => {
    if (isOpen && !currentSession) {
      loadHistory()
    }
  }, [isOpen, currentSession])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadHistory = async () => {
    try {
      const data = await fetchChatSessions(projectId)
      setSessions(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load chat history'
      addToast(message, 'error')
    }
  }

  const handleSelectSession = async (sessionId: string) => {
    try {
      setLoadingSession(true)
      const data = await fetchChatSession(projectId, sessionId)
      setCurrentSession(data)
      setMessages(data.messages)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load chat session'
      addToast(message, 'error')
    } finally {
      setLoadingSession(false)
    }
  }

  const handleNewChat = async () => {
    try {
      // Check if there's an active streaming request to finish first
      abortControllerRef.current?.abort()
      setIsStreaming(false)
      setCurrentSession(null)
      setMessages([])
    } catch {
      // Ignore abort errors
    }
  }

  const handleSend = async (userMessage: string) => {
    if (!endpoint) {
      setShowSettingsConfirm(true)
      return
    }

    let sessionId = currentSession?.id

    // If no session, create one
    if (!sessionId) {
      try {
        const title = userMessage.replace(/\.md$/, '')
        const session = await createChatSession(projectId, title)
        sessionId = session.id
        setCurrentSession(session)
        setSessions(prev => [{ ...session, preview: userMessage.slice(0, 80) }, ...prev])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create chat session'
        addToast(message, 'error')
        return
      }
    }

    // Add user message locally
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    // Persist user message to disk before streaming, so it's saved even if the stream fails
    persistChatMessage(projectId, sessionId, userMessage).catch(() => {
      // Non-fatal: continue with streaming even if persistence fails
    })

    setIsStreaming(true)

    // Create assistant placeholder
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const generator = streamChatMessage(
        projectId,
        sessionId,
        userMessage,
        endpoint,
        // Abort signal will be set below
      )

      // Create a new AbortController for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      let fullContent = ''
      for await (const chunk of generator) {
        fullContent += chunk
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: fullContent }
          }
          return updated
        })
      }

      // Update the session with the full message
      if (fullContent) {
        const updatedMsg: ChatMessage = { ...assistantMsg, content: fullContent }
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = updatedMsg
          return updated
        })

        // Update current session
        setCurrentSession(prev => {
          if (!prev) return prev
          return {
            ...prev,
            messages: [...(prev.messages || []), userMsg, updatedMsg],
            updatedAt: new Date().toISOString(),
          }
        })

        // Update session in history list
        setSessions(prev =>
          prev.map(s =>
            s.id === sessionId ? { ...s, updatedAt: new Date().toISOString() } : s
          )
        )
      } else {
        // Empty response
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: 'The agent returned an empty response.' }
          }
          return updated
        })
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User stopped the stream - update the partial message
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (updated[lastIdx]?.role === 'assistant') {
            const currentContent = updated[lastIdx].content
            updated[lastIdx] = { ...updated[lastIdx], content: currentContent + ' [stopped]' }
          }
          return updated
        })
      } else {
        const message = err instanceof Error ? err.message : 'Failed to get response'
        // Replace last assistant message with error
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: `Failed to get response: ${message}`,
            }
          }
          return updated
        })
        addToast(message, 'error')
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
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
        {loadingSession ? (
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
                role={msg.role as 'user' | 'assistant'}
                content={msg.content}
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
