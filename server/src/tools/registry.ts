import { readFileHandler, readFileDefinition } from './read_file.js'
import { writeFileHandler, writeFileDefinition } from './write_file.js'
import { editFileHandler, editFileDefinition } from './edit_file.js'
import { listFilesHandler, listFilesDefinition } from './list_files.js'

// ── Tool Definition ──────────────────────────────────────────────────

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ToolHandler = (
  args: Record<string, unknown>,
  projectId: string,
  projectPath: string,
  emit?: (event: Record<string, unknown>) => void,
) => { success: true; content: string } | { success: false; error: string }

interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

// ── Registry ─────────────────────────────────────────────────────────

const tools = new Map<string, RegisteredTool>()

function init(): void {
  tools.set(readFileDefinition.function.name, { definition: readFileDefinition as ToolDefinition, handler: readFileHandler })
  tools.set(writeFileDefinition.function.name, { definition: writeFileDefinition as ToolDefinition, handler: writeFileHandler })
  tools.set(editFileDefinition.function.name, { definition: editFileDefinition as ToolDefinition, handler: editFileHandler })
  tools.set(listFilesDefinition.function.name, { definition: listFilesDefinition as ToolDefinition, handler: listFilesHandler })
}

init()

export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(tools.values()).map(t => t.definition)
}

export function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  projectId: string,
  projectPath: string,
  emit?: (event: Record<string, unknown>) => void,
): { success: true; content: string } | { success: false; error: string } {
  const registered = tools.get(toolName)
  if (!registered) {
    return { success: false, error: `Unknown tool: "${toolName}"` }
  }
  return registered.handler(args, projectId, projectPath, emit)
}

export function registerTool(tool: ToolDefinition, handler: ToolHandler): void {
  tools.set(tool.function.name, { definition: tool, handler })
}
