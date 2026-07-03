import type { Response as ExpressResponse } from 'express'
import { persistSession, persistPartialSession } from './chat.js'

export async function proxyStream(
  openAiEndpoint: string,
  sessionId: string,
  projectId: string,
  messages: Array<{ role: string; content: string }>,
  userMessageForPersist: { role: string; content: string },
  expressRes: ExpressResponse
): Promise<void> {
  const abortController = new AbortController()

  expressRes.on('close', () => {
    abortController.abort()
    persistPartialSession(projectId, sessionId, userMessageForPersist, null)
  })

  const apiUrl = `${openAiEndpoint}/v1/chat/completions`
  let fetchResponse: globalThis.Response
  try {
    fetchResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'bartowski/Qwen_Qwen3.6-35B-A3B-GGUF:Q4_K_M',
        stream: true,
        temperature: 0.7,
        messages,
      }),
      signal: abortController.signal,
    })
  } catch {
    expressRes.write(`data: ${JSON.stringify({ error: 'Failed to connect to LLM API' })}\n`)
    expressRes.end()
    return
  }

  if (!fetchResponse.ok) {
    const errorBody = await fetchResponse.text().catch(() => '')
    expressRes.write(`data: ${JSON.stringify({ error: `LLM API error: ${fetchResponse.status}` })}\n`)
    expressRes.end()
    return
  }

  const reader = fetchResponse.body?.getReader()
  if (!reader) {
    expressRes.end()
    return
  }

  let fullAssistantContent = ''
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(l => l.trim().startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6) // strip 'data: '
        if (data === '[DONE]') {
          expressRes.write('data: [DONE]\n')
          expressRes.end()
          persistSession(projectId, sessionId, fullAssistantContent)
          return
        }

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullAssistantContent += content
            expressRes.write(`data: ${data}\n`)
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  } catch (err) {
    expressRes.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n`)
    expressRes.end()
    persistPartialSession(projectId, sessionId, userMessageForPersist, fullAssistantContent)
  }
}
