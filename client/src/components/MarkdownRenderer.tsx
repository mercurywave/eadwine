import { useEffect, useState, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import './MarkdownRenderer.css'

interface MarkdownRendererProps {
  content: string
  filename?: string
}

export function MarkdownRenderer({ content, filename }: MarkdownRendererProps) {
  const [html, setHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const rawHtml = marked.parse(content, { async: false }) as string
      const sanitized = DOMPurify.sanitize(rawHtml)
      setHtml(sanitized)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Markdown')
    }
  }, [content])

  if (error) {
    return (
      <div className="md-error" role="alert">
        ⚠️ Failed to render {filename || 'file'}: {error}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
