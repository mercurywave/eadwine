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
