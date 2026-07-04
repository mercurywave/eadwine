import { useEffect, useState, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { ToolCallBubble } from './ToolCallBubble'
import './ChatBubble.css'

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    name: string
    arguments: string
  }>
  isStreaming?: boolean
}

export function ChatBubble({ role, content, tool_calls, isStreaming = false }: ChatBubbleProps) {
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
  const isTool = role === 'tool'
  const hasToolCalls = tool_calls && tool_calls.length > 0

  if (isTool) {
    // Tool result messages — render as a subtle info block
    return (
      <div className="chat-bubble chat-bubble-tool" role="article">
        <div className="chat-bubble-content markdown-body" ref={containerRef}>
          <div className="tool-result">
            <p className="tool-result-text">{content}</p>
          </div>
        </div>
      </div>
    )
  }

  const hasContent = isUser || (content && content.trim().length > 0)

  return (
    <div className={`chat-bubble chat-bubble-${isUser ? 'user' : 'assistant'}`} role="article">
      {hasToolCalls && (
        <ToolCallBubble toolCalls={tool_calls!} isStreaming={isStreaming && content === ''} />
      )}
      {hasContent && (
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
      )}
    </div>
  )
}
