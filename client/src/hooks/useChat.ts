import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage, ChatSession, ChatSessionSummary, Persona, FileChange } from '../types'
import {
  fetchChatSessions,
  fetchChatSession,
  streamChatMessage,
  updateChatSessionTitle,
} from '../api'
import { useToasts } from '../components/Toast'

interface UseChatOptions {
  onFilesChanged?: (files: FileChange[]) => void
}

interface ChatState {
  sessions: ChatSessionSummary[]
  currentSession: ChatSession | null
  messages: ChatMessage[]
  isStreaming: boolean
  isLoading: boolean
  isLoadingSessions: boolean
  error: string | null
  selectedPersona: Persona | null

  loadSessions: () => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  sendMessage: (message: string, endpoint: string, selectedModel: string, personaId?: string) => Promise<void>
  stopStreaming: () => void
  newChat: () => void
  setSelectedPersona: (persona: Persona | null) => void
}

export function useChat(projectId: string, options?: UseChatOptions): ChatState {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const { addToast } = useToasts()

  const abortControllerRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const latestMessagesRef = useRef<ChatMessage[]>([])

  // Keep ref in sync with state
  useEffect(() => {
    latestMessagesRef.current = messages
  }, [messages])

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true)
    setError(null)
    try {
      const data = await fetchChatSessions(projectId)
      setSessions(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load chat history'
      setError(message)
      addToast(message, 'error')
    } finally {
      setIsLoadingSessions(false)
    }
  }, [projectId, addToast])

  const selectSession = useCallback(
    async (sessionId: string) => {
      setIsLoading(true)
      setError(null)
      try {
        // Abort any active streaming
        abortControllerRef.current?.abort()
        setIsStreaming(false)

        const data = await fetchChatSession(projectId, sessionId)
        setCurrentSession(data)
        setMessages(data.messages)
        sessionIdRef.current = sessionId
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load chat session'
        setError(message)
        addToast(message, 'error')
      } finally {
        setIsLoading(false)
      }
    },
    [projectId, addToast],
  )

  const sendMessage = useCallback(
    async (message: string, endpoint: string, selectedModel: string, personaId?: string) => {
      setIsStreaming(true)
      setError(null)

      // Abort any previous streaming request
      abortControllerRef.current?.abort()

      // Send message without sessionId — server will auto-create a session if needed
      // The server handles session creation, message persistence, and agent execution
      // in a single request. We pass the current sessionIdRef to continue an existing session.
      const sessionId = sessionIdRef.current

      // Add user message immediately so it appears in the chat panel during streaming
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg])

      // Create assistant placeholder for streaming display
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      try {
        const controller = new AbortController()
        abortControllerRef.current = controller

        const generator = streamChatMessage(projectId, sessionId!, message, endpoint, selectedModel, personaId, controller.signal)

        let fullContent = ''
        let hasError = false

        for await (const event of generator) {
          if (event.type === 'content') {
            fullContent += event.content
            setMessages((prev) => {
              const updated = [...prev]
              const idx = updated.length - 1
              if (updated[idx]?.role === 'assistant') {
                updated[idx] = { ...updated[idx], content: fullContent }
              }
              return updated
            })
          } else if (event.type === 'tool_call') {
            setMessages((prev) => {
              const updated = [...prev]
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i]?.role === 'assistant' && !updated[i].tool_calls) {
                  updated[i] = {
                    ...updated[i],
                    tool_calls: event.toolCalls,
                  }
                  return updated
                }
              }
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
            setMessages((prev) => {
              const updated = [...prev]
              const idx = updated.length - 1
              if (updated[idx]?.role === 'assistant') {
                updated[idx] = { ...updated[idx], content: `Error: ${event.message}` }
              }
              return updated
            })
            addToast(event.message, 'error')
            break
          } else if (event.type === 'session_id') {
            // Server created a new session — update our tracking
            sessionIdRef.current = event.sessionId
            // If personaId is returned, lock it in
            if (event.personaId) {
              setSelectedPersona(null) // Clear selection after first message
            }
          } else if (event.type === 'title') {
            // Server generated a title for the new session — update locally
            if (currentSession) {
              const updatedSession = { ...currentSession, title: event.title }
              setCurrentSession(updatedSession)

              // Update the session in the sessions list
              setSessions((prev) =>
                prev.map((s) => (s.id === currentSession.id ? { ...s, title: event.title } : s)),
              )

              // Also update on the server
              try {
                await updateChatSessionTitle(projectId, currentSession.id, event.title)
              } catch {
                // Non-fatal: title update failure
              }
            }
          } else if (event.type === 'file_changed') {
            if (options?.onFilesChanged) {
              options.onFilesChanged(event.files)
            }
          } else if (event.type === 'done') {
            fullContent = event.fullContent
            break
          }
        }

        // Re-fetch the session from the server to get authoritative state
        if (!hasError) {
          const activeSessionId = sessionIdRef.current
          if (activeSessionId) {
            try {
              const refreshedSession = await fetchChatSession(projectId, activeSessionId)
              setCurrentSession(refreshedSession)
              setMessages(refreshedSession.messages)
            } catch {
              // If re-fetch fails, keep the streamed state as-is
              // The streaming content is already displayed
            }

            // Refresh session list
            try {
              const updatedSessions = await fetchChatSessions(projectId)
              setSessions(updatedSessions)
            } catch {
              // Non-fatal
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setMessages((prev) => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (updated[lastIdx]?.role === 'assistant') {
              const currentContent = updated[lastIdx].content
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: currentContent + ' [stopped]',
              }
            }
            return updated
          })
        } else {
          const msg = err instanceof Error ? err.message : 'Failed to get response'
          setError(msg)
          addToast(msg, 'error')
        }
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [projectId, addToast],
  )

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const newChat = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    setCurrentSession(null)
    setMessages([])
    sessionIdRef.current = null
    setSelectedPersona(null)
  }, [])

  return {
    sessions,
    currentSession,
    messages,
    isStreaming,
    isLoading,
    isLoadingSessions,
    error,
    selectedPersona,
    loadSessions,
    selectSession,
    sendMessage,
    stopStreaming,
    newChat,
    setSelectedPersona,
  }
}
