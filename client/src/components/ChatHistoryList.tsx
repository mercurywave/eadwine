import { useState, useRef, useEffect } from 'react'
import { List, ChevronDown, Trash2 } from 'lucide-react'
import { ChatSessionSummary } from '../types'
import { useToasts } from './Toast'
import { deleteChatSession } from '../api'
import styles from './ChatHistoryList.module.css'

interface ChatHistoryListProps {
  projectId: string
  sessions: ChatSessionSummary[]
  onSelect: (sessionId: string) => void
  onNewChat: () => void
  currentSessionId?: string
}

export function ChatHistoryList({
  projectId,
  sessions,
  onSelect,
  onNewChat,
  currentSessionId,
}: ChatHistoryListProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { addToast } = useToasts()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleDelete = async (sessionId: string) => {
    try {
      await deleteChatSession(projectId, sessionId)
      addToast('Chat deleted', 'success')
      setConfirmDeleteId(null)
      if (currentSessionId === sessionId) {
        onNewChat()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete chat'
      addToast(message, 'error')
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className={styles['chat-history-container']} ref={dropdownRef}>
      <div className={styles['chat-history-header']}>
        <div className={styles['chat-history-toggle']} onClick={() => setIsOpen(!isOpen)}>
          <List className={styles['chat-history-icon']} />
          <span className={styles['chat-history-label']}>Chat History</span>
          <ChevronDown className={`${styles['chat-history-chevron']} ${isOpen ? styles['open'] : ''}`} />
        </div>
        <button className={styles['chat-new-chat-btn']} onClick={onNewChat} aria-label="New chat">
          + New Chat
        </button>
      </div>

      {isOpen && (
        <div className={styles['chat-history-dropdown']}>
          {sessions.length === 0 ? (
            <div className={styles['chat-history-empty']}>
              <p>No chat sessions yet</p>
              <button className="btn-secondary" onClick={() => { onNewChat(); setIsOpen(false); }}>
                + Start New Chat
              </button>
            </div>
          ) : (
            <ul className={styles['chat-history-list']}>
              {sessions.map(session => (
                <li
                  key={session.id}
                  className={`${styles['chat-history-item']} ${session.id === currentSessionId ? styles['active'] : ''}`}
                  onClick={() => { onSelect(session.id); setIsOpen(false); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(session.id)
                      setIsOpen(false)
                    }
                  }}
                >
                  <div className={styles['chat-history-item-content']}>
                    <span className={styles['chat-history-item-title']}>{session.title.replace(/\.md$/, '')}</span>
                    <span className={styles['chat-history-item-preview']}>{session.preview.replace(/\.md$/, '')}</span>
                    <span className={styles['chat-history-item-time']}>{formatTime(session.updatedAt)}</span>
                  </div>
                  <button
                    className={styles['chat-history-delete']}
                    onClick={e => {
                      e.stopPropagation()
                      setConfirmDeleteId(session.id)
                    }}
                    aria-label="Delete chat"
                  >
                    <Trash2 className={styles['chat-history-delete-icon']} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Delete Chat</h2>
            <p>Are you sure you want to delete this chat session?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(confirmDeleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
