import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send, Square } from 'lucide-react'
import './ChatInput.css'

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('')
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
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }

  return (
    <div className="chat-input-area">
      <div className="chat-input-wrapper">
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
            Stop
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
