import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import matter from 'gray-matter'

// Express 5 type guard for req.params values
function param(req: Request, key: string): string {
  const val = req.params[key]
  return typeof val === 'string' ? val : String(val ?? '')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3003
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || './projects'
const SETTINGS_FILE = path.join(PROJECTS_ROOT, '..', 'settings.json')

// Ensure projects directory exists
if (!fs.existsSync(PROJECTS_ROOT)) {
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true })
}

// Middleware
app.use(express.json())

// ── Helpers ──────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  // Remove path traversal and dangerous characters
  // Allow: lowercase letters, numbers, hyphens, underscores, spaces
  const cleaned = name
    .replace(/[\\/\\\\]/g, '')     // strip slashes
    .replace(/[^a-z0-9\\-_ .]/gi, '') // strip anything not alphanumeric/hyphen/underscore/space
    .replace(/\s+/g, ' ')       // collapse spaces
    .trim()
    .toLowerCase()
  return cleaned.slice(0, 100)
}

function validateFilename(name: string): string | null {
  if (!name || !name.trim()) return 'Filename is required'
  const sanitized = sanitizeFilename(name)
  if (!sanitized) return 'Invalid filename'
  return null
}

function resolveProjectPath(id: string): string {
  return path.join(PROJECTS_ROOT, id)
}

function resolveFilePath(projectPath: string, filename: string): string {
  return path.join(projectPath, filename)
}

function parseSummaryMd(content: string): { title: string; summary: string; tags: string[] } {
  const result = matter(content)
  const data = result.data as { title?: string; summary?: string; tags?: string[] }

  // Read title and summary from frontmatter if present,
  // otherwise fall back to the body content (original behavior)
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

function createSummaryMd(title: string, summary: string, tags: string[] = []): string {
  const frontmatter: Record<string, unknown> = { title, summary }
  if (tags.length > 0) {
    frontmatter.tags = tags
  }
  const body = title ? `# ${title}\n${summary ? `\n${summary}\n` : ''}` : summary ? `\n${summary}\n` : '\n'
  const fmString = matter.stringify(body, frontmatter)
  return fmString
}

function readSummaryMd(projectPath: string): { title: string; summary: string; tags: string[] } {
  const summaryPath = path.join(projectPath, 'SUMMARY.md')
  try {
    const content = fs.readFileSync(summaryPath, 'utf-8')
    return parseSummaryMd(content)
  } catch {
    return { title: 'Untitled Project', summary: '', tags: [] }
  }
}

function writeSummaryMd(projectPath: string, title: string, summary: string, tags: string[] = []): void {
  const summaryPath = path.join(projectPath, 'SUMMARY.md')
  fs.writeFileSync(summaryPath, createSummaryMd(title, summary, tags), 'utf-8')
}

function stripFrontmatter(content: string): string {
  const result = matter(content)
  return result.content
}

// ── Error handler ────────────────────────────────────────────────────

function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  if (err.code === 'EACCES' || err.code === 'EPERM') {
    res.status(500).json({ error: 'Permission denied' })
  } else {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Health check ─────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Projects API ─────────────────────────────────────────────────────

// GET /api/projects
app.get('/api/projects', (_req: Request, res: Response) => {
  try {
    const entries = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    const projects = entries
      .filter(e => e.isDirectory())
      .map(dir => {
        const projectPath = path.join(PROJECTS_ROOT, dir.name)
        const { title, summary, tags } = readSummaryMd(projectPath)
        return { id: dir.name, title, summary, tags }
      })
      .sort((a, b) => a.title.localeCompare(b.title))
    res.json(projects)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list projects' })
  }
})

// GET /api/projects/:id
app.get('/api/projects/:id', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const { title, summary, tags } = readSummaryMd(projectPath)
    res.json({ id, title, summary, tags })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read project' })
  }
})

// POST /api/projects
app.post('/api/projects', (_req: Request, res: Response) => {
  try {
    const id = uuidv4()
    const projectPath = resolveProjectPath(id)

    if (fs.existsSync(projectPath)) {
      return res.status(409).json({ error: 'Project already exists' })
    }

    fs.mkdirSync(projectPath, { recursive: true })
    writeSummaryMd(projectPath, '', '', [])

    res.status(201).json({ id, title: 'Untitled Project', summary: '', tags: [] })
  } catch (err: any) {
    console.error(err)
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: 'Project already exists' })
    }
    res.status(500).json({ error: 'Failed to create project' })
  }
})

// DELETE /api/projects/:id
app.delete('/api/projects/:id', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    fs.rmSync(projectPath, { recursive: true, force: true })
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

// ── Files API ────────────────────────────────────────────────────────

// GET /api/projects/:id/files
app.get('/api/projects/:id/files', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const entries = fs.readdirSync(projectPath, { withFileTypes: true })
    const files = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => ({
        name: e.name,
        path: e.name,
        isSummary: e.name.toLowerCase() === 'summary.md',
      }))
      .sort((a, b) => {
        // Summary file first
        if (a.isSummary) return -1
        if (b.isSummary) return 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })

    res.json(files)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list files' })
  }
})

// GET /api/projects/:id/files/:filename
app.get('/api/projects/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const filename = param(req, 'filename')
    const projectPath = resolveProjectPath(id)
    const filePath = resolveFilePath(projectPath, filename)

    // Security: ensure the resolved path is within the project directory
    if (!filePath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const rawContent = fs.readFileSync(filePath, 'utf-8')
    // Strip frontmatter from SUMMARY.md so the renderer doesn't display it
    const content = filePath.toLowerCase().endsWith('summary.md')
      ? stripFrontmatter(rawContent)
      : rawContent
    res.json({ content })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read file' })
  }
})

// PUT /api/projects/:id/files/:filename
app.put('/api/projects/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const filename = param(req, 'filename')
    const projectPath = resolveProjectPath(id)
    const filePath = resolveFilePath(projectPath, filename)

    // Security: ensure the resolved path is within the project directory
    if (!filePath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    const { content } = req.body
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' })
    }

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    fs.writeFileSync(filePath, content, 'utf-8')
    res.json({ message: 'File saved' })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save file' })
  }
})

// POST /api/projects/:id/files
app.post('/api/projects/:id/files', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)
    const { name } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Filename is required' })
    }

    const validationError = validateFilename(name)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    const finalName = name.endsWith('.md') ? name : `${name}.md`
    const filePath = resolveFilePath(projectPath, finalName)

    // Security: ensure the resolved path is within the project directory
    if (!filePath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'File already exists' })
    }

    fs.writeFileSync(filePath, '', 'utf-8')
    res.status(201).json({ name: finalName, path: finalName })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create file' })
  }
})

// DELETE /api/projects/:id/files/:filename
app.delete('/api/projects/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const filename = param(req, 'filename')
    const projectPath = resolveProjectPath(id)
    const filePath = resolveFilePath(projectPath, filename)

    // Security: ensure the resolved path is within the project directory
    if (!filePath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    // Protect the summary file from being deleted
    if (filename.toLowerCase() === 'summary.md') {
      return res.status(403).json({ error: 'Summary file cannot be deleted' })
    }

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    fs.unlinkSync(filePath)
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// PUT /api/projects/:id/files/rename
app.put('/api/projects/:id/files/rename', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)
    const { from, to } = req.body

    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'from and to are required' })
    }

    // Protect the summary file from being renamed
    if (from.toLowerCase() === 'summary.md') {
      return res.status(403).json({ error: 'Summary file cannot be renamed' })
    }

    const validationError = validateFilename(to)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    const finalTo = to.endsWith('.md') ? to : `${to}.md`
    const srcPath = resolveFilePath(projectPath, from)
    const destPath = resolveFilePath(projectPath, finalTo)

    // Security: ensure paths are within the project directory
    if (!srcPath.startsWith(projectPath) || !destPath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: 'Source file not found' })
    }

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (fs.existsSync(destPath)) {
      return res.status(409).json({ error: 'Destination file already exists' })
    }

    fs.renameSync(srcPath, destPath)
    res.json({ name: finalTo, path: finalTo })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to rename file' })
  }
})

// ── Error handler ────────────────────────────────────────────────────

app.use(errorHandler)

// ── Settings API ─────────────────────────────────────────────────────

interface SettingsData {
  openAiEndpoint?: string
}

function readSettings(): SettingsData {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8')
    return JSON.parse(raw) as SettingsData
  } catch {
    return {}
  }
}

function writeSettings(data: SettingsData): void {
  const dir = path.dirname(SETTINGS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// GET /api/settings
app.get('/api/settings', (_req: Request, res: Response) => {
  try {
    const settings = readSettings()
    res.json(settings)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read settings' })
  }
})

// PUT /api/settings
app.put('/api/settings', (req: Request, res: Response) => {
  try {
    const { openAiEndpoint } = req.body
    const settings: SettingsData = {}
    if (typeof openAiEndpoint === 'string') {
      settings.openAiEndpoint = openAiEndpoint
    }
    writeSettings(settings)
    res.json(settings)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// ── Serve static files in production ─────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist')
  app.use(express.static(clientDist))

  // Catch-all: serve index.html for SPA routing
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Projects root: ${path.resolve(PROJECTS_ROOT)}`)
})
