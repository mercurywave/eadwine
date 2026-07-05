import { executeTool } from './registry.js'

export interface ParsedToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  tool_call_id: string
  content: string
}

/**
 * Parse a tool call delta from an LLM streaming response.
 * The OpenAI API returns tool_calls as an array in the delta when present.
 */
export function parseToolCallDelta(
  delta: Record<string, unknown>,
): ParsedToolCall | null {
  const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined
  if (!toolCalls || toolCalls.length === 0) {
    return null
  }

  const tc = toolCalls[0]
  const id = tc.id as string | undefined
  const fn = tc.function as Record<string, unknown> | undefined
  const name = fn?.name as string | undefined
  const argumentsRaw = fn?.arguments as string | undefined

  if (!id || !name || !argumentsRaw) {
    return null
  }

  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(argumentsRaw)
  } catch {
    // Invalid JSON — pass raw string
    args = { _raw: argumentsRaw }
  }

  return { id, name, args }
}

/**
 * Execute a list of parsed tool calls and return results.
 * Passes the emit callback to each tool so tools can raise their own events.
 */
export function executeToolCalls(
  toolCalls: ParsedToolCall[],
  projectId: string,
  projectPath: string,
  emit?: (event: Record<string, unknown>) => void,
): ToolResult[] {
  const results: ToolResult[] = []

  for (const tc of toolCalls) {
    console.log(`[tool_call] ${tc.name}(${JSON.stringify(tc.args)})`)
    const result = executeTool(tc.name, tc.args, projectId, projectPath, emit)
    results.push({
      tool_call_id: tc.id,
      content: result.success ? result.content : result.error,
    })
  }

  return results
}
