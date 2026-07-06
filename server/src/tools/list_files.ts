import fs from 'fs'
import path from 'path'

export function listFilesHandler(
  _args: Record<string, unknown>,
  _projectId: string,
  projectPath: string,
  _emit?: (event: Record<string, unknown>) => void,
): { success: true; content: string } | { success: false; error: string } {
  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true })
    const mdFiles = entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map(e => {
        const filePath = path.join(projectPath, e.name)
        const stats = fs.statSync(filePath)
        return { name: e.name, sizeBytes: stats.size }
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    if (mdFiles.length === 0) {
      return {
        success: true,
        content: 'No Markdown files found in the project directory.',
      }
    }

    const header = `Files in project (${mdFiles.length} Markdown file${mdFiles.length === 1 ? '' : 's'}):\n`
    const separator = '-'.repeat(60)

    const lines = [header, separator]
    for (const f of mdFiles) {
      const sizeStr = formatSize(f.sizeBytes)
      lines.push(`  ${f.name}  (${sizeStr})`)
    }
    lines.push(separator)

    return {
      success: true,
      content: lines.join('\n'),
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to list files: ${message}` }
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export const listFilesDefinition = {
  type: 'function',
  function: {
    name: 'list_files',
    description:
      'List all Markdown files in the project folder. Use this to discover what files exist before reading or editing them.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
}
