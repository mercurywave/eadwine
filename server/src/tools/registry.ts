import fs from 'fs'
import path from 'path'
import { resolveFilePath } from '../helpers.js'

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
) => { success: true; content: string } | { success: false; error: string }

interface RegisteredTool {
  definition: ToolDefinition
  handler: ToolHandler
}

// ── Built-in: read_file ──────────────────────────────────────────────

const MAX_FILE_SIZE = 100 * 1024 // 100KB

function readFileHandler(
  args: Record<string, unknown>,
  _projectId: string,
  projectPath: string,
): { success: true; content: string } | { success: false; error: string } {
  const filename = args.filename
  if (typeof filename !== 'string' || !filename.trim()) {
    return { success: false, error: 'The "filename" argument is required and must be a non-empty string.' }
  }

  // Only allow .md files
  if (!filename.toLowerCase().endsWith('.md')) {
    return { success: false, error: `The file "${filename}" is not a .md file. The read_file tool only supports Markdown files.` }
  }

  const filePath = resolveFilePath(projectPath, filename)

  // Path traversal protection
  if (!filePath.startsWith(projectPath)) {
    return { success: false, error: `Access denied: the file "${filename}" is outside the project directory.` }
  }

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File "${filename}" not found in the project.` }
  }

  try {
    const stats = fs.statSync(filePath)
    if (stats.size > MAX_FILE_SIZE) {
      const content = fs.readFileSync(filePath, 'utf-8').slice(0, MAX_FILE_SIZE)
      return {
        success: true,
        content: `⚠️ File "${filename}" exceeds the ${MAX_FILE_SIZE / 1024}KB size limit. Showing first ${MAX_FILE_SIZE / 1024}KB:\n\n${content}\n\n(Note: the file was truncated.)`,
      }
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to read file "${filename}": ${message}` }
  }
}

const readFileTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the contents of a specific Markdown file from the project folder. Use this when you need to see the full content of a project file to answer a question or reference it. The file must be a .md file within the project.',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description:
              'The name of the .md file to read (e.g., "architecture.md", "api-design.md"). Do not include the path or directory — just the filename.',
          },
        },
        required: ['filename'],
      },
    },
  },
  handler: readFileHandler,
}

// ── Registry ─────────────────────────────────────────────────────────

const tools = new Map<string, RegisteredTool>()

function init(): void {
  tools.set(readFileTool.definition.function.name, readFileTool)
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
): { success: true; content: string } | { success: false; error: string } {
  const registered = tools.get(toolName)
  if (!registered) {
    return { success: false, error: `Unknown tool: "${toolName}"` }
  }
  return registered.handler(args, projectId, projectPath)
}

export function registerTool(tool: ToolDefinition, handler: ToolHandler): void {
  tools.set(tool.function.name, { definition: tool, handler })
}
