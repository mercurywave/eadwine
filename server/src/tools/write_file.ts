import fs from 'fs'
import { resolveFilePath } from '../helpers.js'
import { readSettings } from '../routes/settings.js'

export function writeFileHandler(
  args: Record<string, unknown>,
  _projectId: string,
  projectPath: string,
  emit?: (event: Record<string, unknown>) => void,
): { success: true; content: string } | { success: false; error: string } {
  const filename = args.filename
  const content = args.content

  if (typeof filename !== 'string' || !filename.trim()) {
    return { success: false, error: 'The "filename" argument is required and must be a non-empty string.' }
  }
  if (typeof content !== 'string') {
    return { success: false, error: 'The "content" argument is required and must be a string.' }
  }

  // Only allow .md files
  if (!filename.toLowerCase().endsWith('.md')) {
    return { success: false, error: `The file "${filename}" is not a .md file. The write_file tool only supports Markdown files.` }
  }

  // File size limits
  const settings = readSettings()
  const filenameUpper = filename.toUpperCase()
  let maxLength: number | undefined

  if (filenameUpper === 'SUMMARY.MD') {
    maxLength = settings.summaryMaxLength ?? 1000
  } else if (filenameUpper === 'MEMORY.MD') {
    maxLength = settings.memoryMaxLength ?? 5000
  } else {
    maxLength = settings.otherMaxLength
  }

  if (maxLength !== undefined && maxLength > 0 && content.length > maxLength) {
    return {
      success: false,
      error: `The file "${filename}" content exceeds the limit of ${maxLength} characters. Please write a shorter file.`,
    }
  }

  const filePath = resolveFilePath(projectPath, filename)

  // Path traversal protection
  if (!filePath.startsWith(projectPath)) {
    return { success: false, error: `Access denied: the file "${filename}" is outside the project directory.` }
  }

  try {
    fs.writeFileSync(filePath, content, 'utf-8')

    // Emit file change event
    if (typeof emit === 'function') {
      emit({
        type: 'file_changed',
        files: [{ filename: filename.trim(), operation: 'created' }],
      })
    }

    return { success: true, content: `File "${filename}" written successfully.` }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to write file "${filename}": ${message}` }
  }
}

export const writeFileDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    description:
      'Write the complete contents of a Markdown file in the project folder. Use this to create new files or overwrite existing ones. The file must be a .md file within the project.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description:
            'The name of the .md file to write (e.g., "architecture.md", "new-feature.md"). Do not include the path or directory — just the filename.',
        },
        content: {
          type: 'string',
          description:
            'The full content to write to the file.',
        },
      },
      required: ['filename', 'content'],
    },
  },
}
