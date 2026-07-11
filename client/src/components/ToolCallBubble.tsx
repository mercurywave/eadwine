import { useState } from 'react'
import { Wrench, ChevronDown, ChevronUp } from 'lucide-react'
import styles from './ToolCallBubble.module.css'

interface ToolCallBubbleProps {
  toolCalls: Array<{
    id: string
    name: string
    arguments: string
  }>
  isStreaming?: boolean
}

export function ToolCallBubble({ toolCalls, isStreaming = false }: ToolCallBubbleProps) {
  const [expanded, setExpanded] = useState(false)

  const formatArgSummary = (args: string): string => {
    try {
      const parsed = JSON.parse(args)
      const entries = Object.entries(parsed)
      if (entries.length === 0) return ''
      return entries
        .map(([key, value]) => {
          const strValue = typeof value === 'string' ? `"${value}"` : JSON.stringify(value)
          return `${key}: ${strValue}`
        })
        .join(', ')
    } catch {
      return args
    }
  }

  return (
    <div className={`${styles['tool-call-bubble']} ${isStreaming ? styles['streaming'] : ''}`} role="region" aria-label="Tool call">
      <button
        className={styles['tool-call-header']}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${toolCalls.length} tool call${toolCalls.length > 1 ? 's' : ''}`}
      >
        <Wrench className={styles['tool-call-icon']} />
        <span className={styles['tool-call-summary']}>
          {toolCalls.length === 1 ? (
            <>
              <span className={styles['tool-call-name']}>{toolCalls[0].name}</span>
              <span className={styles['tool-call-args']}>({formatArgSummary(toolCalls[0].arguments)})</span>
            </>
          ) : (
            <>
              <span className={styles['tool-call-name']}>{toolCalls[0].name}</span>
              <span className={styles['tool-call-more']}>+{toolCalls.length - 1} more</span>
            </>
          )}
        </span>
        {isStreaming ? (
          <span className={styles['tool-call-status']}>Running...</span>
        ) : (
          expanded ? <ChevronUp className={styles['tool-call-chevron']} /> : <ChevronDown className={styles['tool-call-chevron']} />
        )}
      </button>

      {expanded && (
        <div className={styles['tool-call-details']}>
          {toolCalls.map(tc => (
            <div key={tc.id} className={styles['tool-call-detail-item']}>
              <div className={styles['tool-call-detail-header']}>
                <Wrench className={styles['tool-call-detail-icon']} />
                <span className={styles['tool-call-detail-name']}>{tc.name}</span>
              </div>
              <pre className={styles['tool-call-detail-args']}>
                <code>{tc.arguments}</code>
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
