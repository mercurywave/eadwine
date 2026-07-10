import fs from 'fs'
import path from 'path'
import { resolveFilePath } from '../helpers.js'
import { validateSummaryMdContent } from '../summary.js'

export function editFileHandler(
  args: Record<string, unknown>,
  _projectId: string,
  projectPath: string,
  emit?: (event: Record<string, unknown>) => void,
): { success: true; content: string } | { success: false; error: string } {
  const filename = args.filename
  const oldText = args.oldText
  const newText = args.newText

  if (typeof filename !== 'string' || !filename.trim()) {
    return { success: false, error: 'The "filename" argument is required and must be a non-empty string.' }
  }
  if (typeof oldText !== 'string' || !oldText.trim()) {
    return { success: false, error: 'The "oldText" argument is required and must be a non-empty string.' }
  }
  if (typeof newText !== 'string') {
    return { success: false, error: 'The "newText" argument is required and must be a string.' }
  }

  // Only allow .md files
  if (!filename.toLowerCase().endsWith('.md')) {
    return { success: false, error: `The file "${filename}" is not a .md file. The edit_file tool only supports Markdown files.` }
  }

  const filePath = resolveFilePath(projectPath, filename)
  const filenameUpper = filename.toUpperCase()

  // Path traversal protection
  if (!filePath.startsWith(projectPath)) {
    return { success: false, error: `Access denied: the file "${filename}" is outside the project directory.` }
  }

  if (!fs.existsSync(filePath)) {
    return { success: false, error: `File "${filename}" not found in the project.` }
  }

  try {
    const existingContent = fs.readFileSync(filePath, 'utf-8')

    if (!existingContent.includes(oldText)) {
      return { success: false, error: `The text "${oldText}" was not found in file "${filename}". No edits were made.` }
    }

    const updatedContent = existingContent.replace(oldText, newText)

    // SUMMARY.md specific validation after edit
    if (filenameUpper === 'SUMMARY.MD') {
      const validation = validateSummaryMdContent(updatedContent)
      if (!validation.valid) {
        const errorMessages = validation.errors.join('. ')
        return {
          success: false,
          error: `The edit would result in invalid SUMMARY.md content: ${errorMessages}.`,
        }
      }
    }

    fs.writeFileSync(filePath, updatedContent, 'utf-8')

    // Emit file change event
    if (typeof emit === 'function') {
      emit({
        type: 'file_changed',
        files: [{ filename: filename.trim(), operation: 'edited' }],
      })
    }

    return { success: true, content: `File "${filename}" edited successfully.` }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to edit file "${filename}": ${message}` }
  }
}

export const editFileDefinition = {
  type: 'function',
  function: {
    name: 'edit_file',
    description:
      'Edit a single Markdown file in the project folder using text replacement. Finds the exact text specified by oldText and replaces it with newText. The file must be a .md file within the project.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description:
            'The name of the .md file to edit (e.g., "architecture.md"). Do not include the path or directory — just the filename.',
        },
        oldText: {
          type: 'string',
          description:
            'The exact text to find in the file for replacement.',
        },
        newText: {
          type: 'string',
          description:
            'The text to replace oldText with.',
        },
      },
      required: ['filename', 'oldText', 'newText'],
    },
  },
}
