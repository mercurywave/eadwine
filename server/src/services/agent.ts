import type { Response as ExpressResponse } from 'express'
import { getToolDefinitions, executeTool } from '../tools/registry.js'
import { parseToolCallDelta, executeToolCalls } from '../tools/executor.js'
import { persistSession, persistPartialSession, persistToolCalls, persistToolResult } from './chat.js'

export interface ToolCallEntry {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolCallLoopOptions {
  openAiEndpoint: string
  sessionId: string
  projectId: string
  projectPath: string
  projectTitle: string
  systemPrompt: string
  conversationHistory: Array<{ role: string; content: string; tool_calls?: ToolCallEntry[]; tool_call_id?: string }>
  userMessage: string
  expressRes: ExpressResponse
  maxIterations?: number
  selectedModel?: string
}

const DEFAULT_MAX_ITERATIONS = 50

export async function runToolCallLoop(options: ToolCallLoopOptions): Promise<void> {
  const {
    openAiEndpoint,
    sessionId,
    projectId,
    projectPath,
    systemPrompt,
    conversationHistory,
    userMessage,
    expressRes,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    selectedModel,
  } = options

  const toolDefinitions = getToolDefinitions()

  // Build initial message array
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content }
      if (m.tool_calls) {
        msg.tool_calls = m.tool_calls
      }
      if (m.tool_call_id) {
        msg.tool_call_id = m.tool_call_id
      }
      return msg
    }),
    { role: 'user', content: userMessage },
  ];

  let iteration = 0
  let fullAssistantContent = ''
  let abortController: AbortController | null = null
  // Track accumulated tool calls and results for partial persistence
  let accumulatedToolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
  let accumulatedToolResults: Array<{ tool_call_id: string; content: string }> = []

  // Guard to ensure end() is called exactly once, preventing race conditions
  // between normal completion paths and the async 'close' event handler.
  let responseEnded = false

  const endResponse = (finalContent: string): void => {
    if (responseEnded) return
    responseEnded = true
    persistPartialSession(
      projectId, sessionId, { role: 'user', content: userMessage }, finalContent,
      accumulatedToolCalls, accumulatedToolResults
    )
    // Emit session ID event for client to track the session
    expressRes.write(`data: ${JSON.stringify({ type: 'session_id', sessionId })}\n`)
    expressRes.write('data: [DONE]\n')
    expressRes.end()
  }

  // Handle client disconnect — only persists partial state; does NOT call end()
  // since the response may already be closed by a normal completion path.
  expressRes.on('close', () => {
    abortController?.abort()
    if (!responseEnded) {
      persistPartialSession(
        projectId, sessionId, { role: 'user', content: userMessage }, fullAssistantContent,
        accumulatedToolCalls, accumulatedToolResults
      )
    }
  })

  while (iteration < maxIterations) {
    iteration++

    // Create abort controller for this LLM call
    abortController = new AbortController()

    const apiUrl = `${openAiEndpoint}/v1/chat/completions`
    const abortSignal = abortController.signal

    if (!selectedModel) {
      expressRes.write(`data: ${JSON.stringify({ error: 'No model selected. Please configure a model in Settings.' })}\n`)
      endResponse(fullAssistantContent)
      return
    }

    const model = selectedModel
    let fetchResponse: globalThis.Response
    try {
      fetchResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: true,
          temperature: 0.7,
          messages,
          tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
          parallel_tool_calls: false,
        }),
        signal: abortSignal,
      })
    } catch {
      expressRes.write(`data: ${JSON.stringify({ error: 'Failed to connect to LLM API' })}\n`)
      endResponse(fullAssistantContent)
      return
    }

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text().catch(() => '')
      expressRes.write(`data: ${JSON.stringify({ error: `LLM API error: ${fetchResponse.status} - ${errorBody}` })}\n`)
      endResponse(fullAssistantContent)
      return
    }

    const reader = fetchResponse.body?.getReader()
    if (!reader) {
      endResponse(fullAssistantContent)
      return
    }

    // Accumulate tool call info across chunks
    // Track by index since id/name/arguments arrive in separate delta chunks
    let toolCallIndexMap = new Map<number, { id: string; name: string; argumentsRaw: string }>()
    let currentContent = ''
    let hasContentDelta = false
    let hasToolCallDelta = false

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(l => l.trim().startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            // Check for tool calls first (before returning)
            if (hasToolCallDelta && !hasContentDelta && toolCallIndexMap.size > 0) {
              // Sort by index to maintain call order, skip the -1 fallback key
              const entries = Array.from(toolCallIndexMap.entries())
                .filter(([key]) => key >= 0)
                .sort(([a], [b]) => a - b)
                .map(([, val]) => ({
                  id: val.id,
                  name: val.name,
                  args: parseArgs(val.argumentsRaw),
                }))

              // Persist tool calls
              persistToolCalls(projectId, sessionId, entries)

              // Emit tool call summary events
              for (const tc of entries) {
                const argsStr = JSON.stringify(tc.args, null, 2)
                expressRes.write(
                  `data: ${JSON.stringify({
                    type: 'tool_call',
                    toolCalls: [{ id: tc.id, name: tc.name, arguments: argsStr }],
                  })}\n`,
                )
              }

              const results = executeToolCalls(entries, projectId, projectPath)

              // Persist tool results and append to messages
              for (const result of results) {
                persistToolResult(projectId, sessionId, result.tool_call_id, result.content)
                messages.push({
                  role: 'tool',
                  tool_call_id: result.tool_call_id,
                  content: result.content,
                })
              }

              // Clear accumulated tool calls/results since they are now persisted
              accumulatedToolCalls = []
              accumulatedToolResults = []

              // Continue loop — LLM will decide next action
              currentContent = ''
              hasContentDelta = false
              hasToolCallDelta = false
              toolCallIndexMap = new Map()
              continue
            }

            // Final content response
            if (fullAssistantContent || currentContent) {
              persistSession(projectId, sessionId, fullAssistantContent)
            }
            reader.releaseLock()
            endResponse(fullAssistantContent)
            return
          }

          try {
            const parsed = JSON.parse(data)
            const choice = parsed.choices?.[0]
            if (!choice) continue

            const delta = choice.delta as Record<string, unknown> | undefined
            if (!delta) continue

            // Check for content delta
            const content = delta.content as string | undefined
            if (content) {
              hasContentDelta = true
              currentContent += content
              fullAssistantContent += content
              expressRes.write(`data: ${data}\n`)
            }

            // Check for tool call delta
            const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined
            if (toolCalls && toolCalls.length > 0) {
              hasToolCallDelta = true
              const tc = toolCalls[0]
              const idx = tc.index as number | undefined
              const id = tc.id as string
              const fn = tc.function as Record<string, unknown>
              const name = fn.name as string
              const argsRaw = fn.arguments as string

              if (idx !== undefined) {
                // Track by index — id/name/arguments arrive in separate chunks
                const existing = toolCallIndexMap.get(idx)
                if (existing) {
                  // Merge into existing entry
                  if (id && !existing.id) existing.id = id
                  if (name && !existing.name) existing.name = name
                  if (argsRaw) existing.argumentsRaw += argsRaw
                } else {
                  toolCallIndexMap.set(idx, { id: id || '', name: name || '', argumentsRaw: argsRaw || '' })
                }
              } else {
                // No index — treat as a single call, accumulate by id
                if (!id) continue
                if (!toolCallIndexMap.has(-1)) {
                  toolCallIndexMap.set(-1, { id, name: name || '', argumentsRaw: argsRaw || '' })
                } else {
                  const existing = toolCallIndexMap.get(-1)!
                  if (name && !existing.name) existing.name = name
                  if (argsRaw) existing.argumentsRaw += argsRaw
                }
              }
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    } catch {
      // Stream interrupted
      expressRes.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n`)
      reader.releaseLock()
      endResponse(fullAssistantContent)
      return
    }

    reader.releaseLock()

    // If we finished the stream with tool calls but no content, process them
    if (hasToolCallDelta && !hasContentDelta && toolCallIndexMap.size > 0) {
      // Sort by index to maintain call order, skip the -1 fallback key
      const entries = Array.from(toolCallIndexMap.entries())
        .filter(([key]) => key >= 0)
        .sort(([a], [b]) => a - b)
        .map(([, val]) => ({
          id: val.id,
          name: val.name,
          args: parseArgs(val.argumentsRaw),
        }))

      // Persist tool calls
      persistToolCalls(projectId, sessionId, entries)

      // Emit tool call summary events
      for (const tc of entries) {
        const argsStr = JSON.stringify(tc.args, null, 2)
        expressRes.write(
          `data: ${JSON.stringify({
            type: 'tool_call',
            toolCalls: [{ id: tc.id, name: tc.name, arguments: argsStr }],
          })}\n`,
        )
      }

      const results = executeToolCalls(entries, projectId, projectPath)

      // Persist tool results and append to messages
      for (const result of results) {
        persistToolResult(projectId, sessionId, result.tool_call_id, result.content)
        messages.push({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.content,
        })
      }

      // Clear accumulated tool calls/results since they are now persisted
      accumulatedToolCalls = []
      accumulatedToolResults = []

      // Continue loop — LLM will decide next action
      continue
    }
  }

  // Max iterations reached
  expressRes.write(`data: ${JSON.stringify({ error: 'Max tool call iterations reached' })}\n`)
  endResponse(fullAssistantContent)
}

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return { _raw: raw }
  }
}
