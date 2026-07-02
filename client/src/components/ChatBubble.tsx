import { useEffect, useState, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import './ChatBubble.css'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function ChatBubble({ role, content, isStreaming = false }: ChatBubbleProps) {
  const [html, setHtml] = useState<string>('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const rawHtml = marked.parse(content, { async: false }) as string
      const sanitized = DOMPurify.sanitize(rawHtml)
      setHtml(sanitized)
    } catch {
      setHtml(DOMPurify.sanitize(content))
    }
  }, [content])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [html, isStreaming])

  const isUser = role === 'user'

  return (
    <div className={`chat-bubble chat-bubble-${isUser ? 'user' : 'assistant'}`} role="article">
      <div className={`chat-bubble-content ${isUser ? '' : 'markdown-body'}`} ref={containerRef}>
        {isUser ? (
          <p className="chat-bubble-text">{content}</p>
        ) : (
          <>
            <div
              className="chat-bubble-markdown"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {isStreaming && <span className="chat-cursor">▌</span>}
          </>
        )}
      </div>
    </div>
  )
}
