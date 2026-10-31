import { marked } from 'marked'

export function projectSummaryPreview(summary: string): string {
  const tokens = marked.lexer(summary)
  if (!tokens.some(token => token.type === 'heading')) return summary

  return tokens
    .filter(token => token.type !== 'heading')
    .map(token => token.raw)
    .join('')
    .trim()
}
