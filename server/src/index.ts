import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

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
    .replace(/[\/\\]/g, '')     // strip slashes
    .replace(/[^a-z0-9\-_ .]/gi, '') // strip anything not alphanumeric/hyphen/underscore/space
    .replace(/\s+/g, ' ')       // collapse spaces
    .trim()
    .toLowerCase()
  return cleaned.slice(0, 100)
}

function validateFilename(name: string): string | null {
  if (!name || !name.trim()) return 'Filename is required'
  const sanitized = sanitizeFilename(name)
  if (!sanitized) return 'Invalid filename'
  if (sanitized === 'summary.md') return 'Cannot use reserved filename "summary.md"'
  return null
}

function resolveProjectPath(id: string): string {
  return path.join(PROJECTS_ROOT, id)
}

function resolveFilePath(projectPath: string, filename: string): string {
  return path.join(projectPath, filename)
}

function parseSummaryMd(content: string): { title: string; summary: string } {
  const lines = content.split('\n').filter(l => l.trim())
  let title = 'Untitled Project'
  let summary = ''
  if (lines.length > 0) {
    title = lines[0].replace(/^#\s+/, '')
  }
  if (lines.length > 1) {
    summary = lines[1].trim()
  }
  return { title, summary }
}

function createSummaryMd(title: string, summary: string): string {
  let content = `# ${title}\n`
  if (summary) {
    content += `\n${summary}\n`
  }
  return content
}

function readSummaryMd(projectPath: string): { title: string; summary: string } {
  const summaryPath = path.join(projectPath, 'SUMMARY.md')
  try {
    const content = fs.readFileSync(summaryPath, 'utf-8')
    return parseSummaryMd(content)
  } catch {
    return { title: 'Untitled Project', summary: '' }
  }
}

function writeSummaryMd(projectPath: string, title: string, summary: string): void {
  const summaryPath = path.join(projectPath, 'SUMMARY.md')
  fs.writeFileSync(summaryPath, createSummaryMd(title, summary), 'utf-8')
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
        const { title, summary } = readSummaryMd(projectPath)
        return { id: dir.name, title, summary }
      })
      .sort((a, b) => a.title.localeCompare(b.title))
    res.json(projects)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list projects' })
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
    writeSummaryMd(projectPath, '', '')

    res.status(201).json({ id, title: 'Untitled Project', summary: '' })
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
      .filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'SUMMARY.md')
      .map(e => ({ name: e.name, path: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name))

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

    const content = fs.readFileSync(filePath, 'utf-8')
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
