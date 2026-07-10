import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export function parseSummaryMd(content: string): { title: string; summary: string; tags: string[] } {
  const result = matter(content)
  const data = result.data as { title?: string; summary?: string; tags?: string[] }

  let title: string
  let summary: string
  if (data.title) {
    title = data.title
  } else {
    const lines = result.content.split('\n').filter(l => l.trim())
    title = lines.length > 0 ? lines[0].replace(/^#\s+/, '') : 'Untitled Project'
  }
  if (data.summary) {
    summary = data.summary
  } else {
    const lines = result.content.split('\n').filter(l => l.trim())
    summary = lines.length > 1 ? lines[1].trim() : ''
  }

  const tags = Array.isArray(data?.tags) ? data.tags : []
  return { title, summary, tags }
}

export function createSummaryMd(title: string, summary: string, tags: string[] = []): string {
  const frontmatter: Record<string, unknown> = { title, summary }
  if (tags.length > 0) {
    frontmatter.tags = tags
  }
  const body = title ? `# ${title}\n${summary ? `\n${summary}\n` : ''}` : summary ? `\n${summary}\n` : '\n'
  const fmString = matter.stringify(body, frontmatter)
  return fmString
}

export function readSummaryMd(projectPath: string): { title: string; summary: string; tags: string[] } {
  const summaryPath = path.join(projectPath, 'SUMMARY.md')
  try {
    const content = fs.readFileSync(summaryPath, 'utf-8')
    return parseSummaryMd(content)
  } catch {
    return { title: 'Untitled Project', summary: '', tags: [] }
  }
}

export function writeSummaryMd(projectPath: string, title: string, summary: string, tags: string[] = []): void {
  const summaryPath = path.join(projectPath, 'SUMMARY.md')
  fs.writeFileSync(summaryPath, createSummaryMd(title, summary, tags), 'utf-8')
}

export function stripFrontmatter(content: string): string {
  const result = matter(content)
  return result.content
}

export function validateSummaryMdContent(content: string): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = []

  // Must start and end with frontmatter delimiters
  const trimmed = content.trim()
  if (!trimmed.startsWith('---')) {
    errors.push('Missing YAML frontmatter: content must start with "---"')
  }

  // Parse with gray-matter
  const result = matter(content)
  const data = result.data as Record<string, unknown>

  // Allowed frontmatter keys
  const allowedKeys = new Set(['title', 'tags'])

  // Check for unexpected attributes
  const keys = Object.keys(data)
  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unexpected frontmatter attribute "${key}". Only "${[...allowedKeys].join('", "')}" are allowed.`)
    }
  }

  // Check for title field
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('Missing or empty "title" field in YAML frontmatter')
  }

  // Validate tags if provided
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      errors.push('"tags" must be an array')
    } else {
      for (let i = 0; i < data.tags.length; i++) {
        const tag = data.tags[i]
        if (typeof tag !== 'string' || !tag.trim()) {
          errors.push(`Tag at index ${i} must be a non-empty string`)
        }
      }
    }
  }

  // Check for body text
  const body = result.content.trim()
  if (!body) {
    errors.push('No body text found after frontmatter')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true }
}
