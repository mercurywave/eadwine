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
  onFilesChanged?: () => void
}

export function ChatPanel({ projectId, isOpen, onClose, endpoint, width, onFilesChanged }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [showSettingsConfirm, setShowSettingsConfirm] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const { addToast } = useToasts()
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)
  const latestMessagesRef = useRef<ChatMessage[]>([])
  // Keep the ref in sync with state
  useEffect(() => {
    latestMessagesRef.current = messages
  }, [messages])

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

    // Abort any previous streaming request first
    abortControllerRef.current?.abort()

    // Use the session ID from the ref to avoid creating duplicate sessions
    let sessionId = sessionIdRef.current

    // If no session, create one
    if (!sessionId) {
      try {
        const title = userMessage.replace(/\.md$/, '')
        const session = await createChatSession(projectId, title)
        sessionId = session.id
        sessionIdRef.current = sessionId
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
      // Create a new AbortController for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      const generator = streamChatMessage(
        projectId,
        sessionId,
        userMessage,
        endpoint,
        controller.signal,
      )

      let fullContent = ''
      let hasError = false

      for await (const event of generator) {
        if (event.type === 'content') {
          fullContent += event.content
          setMessages(prev => {
            const updated = [...prev]
            const idx = updated.length - 1
            if (updated[idx]?.role === 'assistant') {
              updated[idx] = { ...updated[idx], content: fullContent }
            }
            return updated
          })
        } else if (event.type === 'tool_call') {
          // Accumulate tool calls on the last assistant message (the placeholder)
          // rather than creating separate messages for each tool call event
          setMessages(prev => {
            const updated = [...prev]
            // Find the last assistant message and append tool calls to it
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i]?.role === 'assistant' && !updated[i].tool_calls) {
                updated[i] = {
                  ...updated[i],
                  tool_calls: event.toolCalls,
                }
                return updated
              }
            }
            // Fallback: create a new message (shouldn't happen if placeholder exists)
            const toolCallMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: '',
              tool_calls: event.toolCalls,
              timestamp: new Date().toISOString(),
            }
            return [...prev, toolCallMsg]
          })
        } else if (event.type === 'error') {
          hasError = true
          const errorMessage = `Error: ${event.message}`
          setMessages(prev => {
            const updated = [...prev]
            const idx = updated.length - 1
            if (updated[idx]?.role === 'assistant') {
              updated[idx] = { ...updated[idx], content: errorMessage }
            }
            return updated
          })
          addToast(event.message, 'error')
          break
        } else if (event.type === 'done') {
          fullContent = event.fullContent
          break
        }
      }

      // Update the session with the full message
      if (!hasError) {
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0 && updated[lastIdx]?.role === 'assistant') {
            // Update the last assistant message in place (preserves its ID)
            updated[lastIdx] = { ...updated[lastIdx], content: fullContent }
          }
          return updated
        })

        // Update current session using the ref (avoids stale closure)
        const finalMessages = latestMessagesRef.current
        const lastMsg = finalMessages[finalMessages.length - 1]
        if (lastMsg?.role === 'assistant') {
          const sessionMessages = [...finalMessages.slice(0, -1), userMsg, lastMsg]
          setCurrentSession(prev => {
            if (!prev) return prev
            return {
              ...prev,
              messages: sessionMessages,
              updatedAt: new Date().toISOString(),
            }
          })
        }

        // Update session in history list
        setSessions(prev =>
          prev.map(s =>
            s.id === sessionId ? { ...s, updatedAt: new Date().toISOString() } : s
          )
        )

        // Notify parent that files may have changed (tool calls could create/modify files)
        onFilesChanged?.()
      } else if (fullContent) {
        // There was an error but we got some content
        setMessages(prev => {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0 && updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: fullContent }
          }
          return updated
        })
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
