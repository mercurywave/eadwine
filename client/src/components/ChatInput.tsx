import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'
import { Macro } from '../types'
import { MacroPicker } from './MacroPicker'
import './ChatInput.css'

interface ChatInputProps {
  onSend: (message: string) => void
  onMacroSelect: (prompt: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  macros?: Macro[]
  draftText?: string
  onDraftChange?: (text: string) => void
  onDraftClear?: () => void
}

export function ChatInput({ onSend, onMacroSelect, onStop, isStreaming, disabled = false, macros = [], draftText = '', onDraftChange, onDraftClear }: ChatInputProps) {
  const [text, setText] = useState(draftText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current && !disabled && !isStreaming) {
      textareaRef.current.focus()
    }
  }, [disabled, isStreaming])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    if (onDraftClear) {
      onDraftClear()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)
    if (onDraftChange) {
      onDraftChange(value)
    }
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }

  return (
    <div className="chat-input-area">
      <div className="chat-input-wrapper">
        <MacroPicker macros={macros} onSelect={onMacroSelect} />
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Chat requires an OpenAI endpoint configured in Settings' : 'Type a message...'}
          disabled={disabled || isStreaming}
          aria-label="Type a message"
          rows={1}
        />
        {isStreaming ? (
          <button
            className="chat-send-btn btn-danger"
            onClick={onStop}
            aria-label="Stop streaming response"
          >
            <Square className="btn-icon" />
          </button>
        ) : (
          <button
            className="chat-send-btn btn-primary"
            onClick={handleSubmit}
            disabled={!text.trim() || disabled}
            aria-label="Send message"
          >
            <Send className="btn-icon" />
          </button>
        )}
      </div>
    </div>
  )
}
