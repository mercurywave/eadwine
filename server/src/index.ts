import express, { Request, Response as ExpressResponse, NextFunction } from 'express'
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
// ── Data directory resolution ──────────────────────────────────────
// Priority: env var > default (relative to project root)
const DATA_DIR = (() => {
  const env = process.env.DATA_DIR
  if (!env) {
    // Default: server-data/ relative to project root (process.cwd)
    return path.resolve(process.cwd(), 'server-data')
  }
  // Only treat paths with an explicit Windows drive letter (C:\) or
  // UNC path (\\server\share) as absolute. Everything else is
  // resolved relative to the project root (process.cwd).
  if (/^[A-Z]:/i.test(env) || env.startsWith('\\\\')) {
    return env
  }
  // Relative path (including leading / which is common from Linux/Docker)
  return path.resolve(process.cwd(), env)
})()
const PROJECTS_ROOT = path.join(DATA_DIR, 'projects')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

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

// ── Chat Types ─────────────────────────────────────────────────────

interface ChatMessageEntry {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface ChatSessionData {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

// ── Error handler ────────────────────────────────────────────────────

function errorHandler(err: any, _req: Request, res: ExpressResponse, _next: NextFunction) {
  console.error(err)
  if (err.code === 'EACCES' || err.code === 'EPERM') {
    res.status(500).json({ error: 'Permission denied' })
  } else {
    res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Health check ─────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: ExpressResponse) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Projects API ─────────────────────────────────────────────────────

// GET /api/projects
app.get('/api/projects', (_req: Request, res: ExpressResponse) => {
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
app.get('/api/projects/:id', (req: Request, res: ExpressResponse) => {
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
app.post('/api/projects', (_req: Request, res: ExpressResponse) => {
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
app.delete('/api/projects/:id', (req: Request, res: ExpressResponse) => {
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
app.get('/api/projects/:id/files', (req: Request, res: ExpressResponse) => {
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
app.get('/api/projects/:id/files/:filename', (req: Request, res: ExpressResponse) => {
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
app.put('/api/projects/:id/files/:filename', (req: Request, res: ExpressResponse) => {
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
app.post('/api/projects/:id/files', (req: Request, res: ExpressResponse) => {
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
app.delete('/api/projects/:id/files/:filename', (req: Request, res: ExpressResponse) => {
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
app.put('/api/projects/:id/files/rename', (req: Request, res: ExpressResponse) => {
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
app.get('/api/settings', (_req: Request, res: ExpressResponse) => {
  try {
    const settings = readSettings()
    res.json(settings)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read settings' })
  }
})

// PUT /api/settings
app.put('/api/settings', (req: Request, res: ExpressResponse) => {
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

// ── Chat API ────────────────────────────────────────────────────────

function readChatSession(projectId: string, sessionId: string): ChatSessionData | null {
  const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
  const sessionFile = path.join(chatsDir, `${sessionId}.json`)
  if (!fs.existsSync(sessionFile)) return null
  return JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
}

function readChatMessages(projectId: string, sessionId: string): ChatMessageEntry[] {
  const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
  const logFile = path.join(chatsDir, 'logs', `${sessionId}.jsonl`)
  const messages: ChatMessageEntry[] = []
  if (!fs.existsSync(logFile)) return messages
  const content = fs.readFileSync(logFile, 'utf-8').trim()
  if (!content) return messages
  const lines = content.split('\n')
  for (const line of lines) {
    if (line.trim()) {
      messages.push(JSON.parse(line) as ChatMessageEntry)
    }
  }
  return messages
}

function buildSystemPrompt(projectTitle: string, projectId: string): string {
  const projectPath = resolveProjectPath(projectId)
  const summaryPath = path.join(projectPath, 'SUMMARY.md')
  let summaryContent = ''
  try {
    const rawContent = fs.readFileSync(summaryPath, 'utf-8')
    summaryContent = stripFrontmatter(rawContent)
  } catch {
    // No summary file
  }

  let fileList = ''
  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true })
    const mdFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name)
      .sort()
    fileList = mdFiles.join(', ')
  } catch {
    // No files
  }

  return `You are a helpful assistant for the "${projectTitle}" project.

Project Summary:
${summaryContent}

Project Files:
${fileList}

You can help answer questions about the project's content, suggest improvements, explain concepts, or assist with writing new Markdown files. Be concise and reference specific files when relevant.`
}

function persistSession(projectId: string, sessionId: string, messages: Array<{ role: string; content: string }>, assistantContent: string): void {
  const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
  const logsDir = path.join(chatsDir, 'logs')
  if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

  const logFile = path.join(logsDir, `${sessionId}.jsonl`)
  const assistantMsg: ChatMessageEntry = {
    id: uuidv4(),
    role: 'assistant',
    content: assistantContent,
    timestamp: new Date().toISOString(),
  }
  fs.appendFileSync(logFile, JSON.stringify(assistantMsg) + '\n', 'utf-8')

  const sessionFile = path.join(chatsDir, `${sessionId}.json`)
  const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
  session.updatedAt = new Date().toISOString()
  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8')
}

function persistPartialSession(projectId: string, sessionId: string, messages: Array<{ role: string; content: string }>): void {
  try {
    const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
    const logsDir = path.join(chatsDir, 'logs')
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

    const logFile = path.join(logsDir, `${sessionId}.jsonl`)
    const sessionFile = path.join(chatsDir, `${sessionId}.json`)

    // Read existing messages to avoid duplicates
    const existingMessages = readChatMessages(projectId, sessionId)
    const existingContentHashes = new Set(existingMessages.map(m => m.content))

    // Append messages not already in the log
    for (const msg of messages) {
      if (!existingContentHashes.has(msg.content)) {
        const msgWithId: ChatMessageEntry = {
          id: uuidv4(),
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: new Date().toISOString(),
        }
        fs.appendFileSync(logFile, JSON.stringify(msgWithId) + '\n', 'utf-8')
      }
    }

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
    session.updatedAt = new Date().toISOString()
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8')
  } catch {
    // Non-fatal: partial persistence failure
  }
}

async function proxyStream(
  openAiEndpoint: string,
  sessionId: string,
  projectId: string,
  messages: Array<{ role: string; content: string }>,
  expressRes: ExpressResponse
): Promise<void> {
  const abortController = new AbortController()

  expressRes.on('close', () => {
    abortController.abort()
    persistPartialSession(projectId, sessionId, messages)
  })

  const apiUrl = `${openAiEndpoint}/v1/chat/completions`
  let fetchResponse: globalThis.Response
  try {
    fetchResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'bartowski/Qwen_Qwen3.6-35B-A3B-GGUF:Q4_K_M',
        stream: true,
        temperature: 0.7,
        messages,
      }),
      signal: abortController.signal,
    })
  } catch {
    expressRes.write(`data: ${JSON.stringify({ error: 'Failed to connect to LLM API' })}\n`)
    expressRes.end()
    return
  }

  if (!fetchResponse.ok) {
    const errorBody = await fetchResponse.text().catch(() => '')
    expressRes.write(`data: ${JSON.stringify({ error: `LLM API error: ${fetchResponse.status}` })}\n`)
    expressRes.end()
    return
  }

  const reader = fetchResponse.body?.getReader()
  if (!reader) {
    expressRes.end()
    return
  }

  let fullAssistantContent = ''
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(l => l.trim().startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6) // strip 'data: '
        if (data === '[DONE]') {
          expressRes.write('data: [DONE]\n')
          expressRes.end()
          persistSession(projectId, sessionId, messages, fullAssistantContent)
          return
        }

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullAssistantContent += content
            expressRes.write(`data: ${data}\n`)
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  } catch (err) {
    expressRes.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n`)
    expressRes.end()
    persistPartialSession(projectId, sessionId, messages)
  }
}

// GET /api/projects/:id/chats
app.get('/api/projects/:id/chats', (req: Request, res: ExpressResponse) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)
    const chatsDir = path.join(projectPath, 'chats')

    if (!fs.existsSync(chatsDir)) {
      return res.json([])
    }

    const entries = fs.readdirSync(chatsDir, { withFileTypes: true })
    const jsonFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.json'))
      .map(e => e.name)
      .sort((a, b) => {
        try {
          const aData = JSON.parse(fs.readFileSync(path.join(chatsDir, a), 'utf-8')) as ChatSessionData
          const bData = JSON.parse(fs.readFileSync(path.join(chatsDir, b), 'utf-8')) as ChatSessionData
          return new Date(bData.updatedAt).getTime() - new Date(aData.updatedAt).getTime()
        } catch {
          return 0
        }
      })

    const summaries = jsonFiles.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(chatsDir, f), 'utf-8')) as ChatSessionData
        const logFile = path.join(chatsDir, 'logs', `${data.id}.jsonl`)
        let preview = ''
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf-8').trim()
          if (content) {
            const firstLine = content.split('\n')[0]
            if (firstLine) {
              const firstMsg = JSON.parse(firstLine) as ChatMessageEntry
              preview = firstMsg.content.slice(0, 80)
            }
          }
        }
        return { ...data, preview }
      } catch {
        return null
      }
    }).filter((s): s is NonNullable<typeof s> => s !== null)

    res.json(summaries)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list chat sessions' })
  }
})

// GET /api/projects/:id/chats/:sessionId
app.get('/api/projects/:id/chats/:sessionId', (req: Request, res: ExpressResponse) => {
  try {
    const id = param(req, 'id')
    const sessionId = param(req, 'sessionId')
    const chatsDir = path.join(resolveProjectPath(id), 'chats')
    const sessionFile = path.join(chatsDir, `${sessionId}.json`)
    const logFile = path.join(chatsDir, 'logs', `${sessionId}.jsonl`)

    if (!fs.existsSync(sessionFile)) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
    const messages = readChatMessages(id, sessionId)

    res.json({ ...session, messages })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load chat session' })
  }
})

// POST /api/projects/:id/chats
app.post('/api/projects/:id/chats', (req: Request, res: ExpressResponse) => {
  try {
    const id = param(req, 'id')
    const { title } = req.body
    const sessionId = uuidv4()
    const now = new Date().toISOString()

    const chatsDir = path.join(resolveProjectPath(id), 'chats')
    const logsDir = path.join(chatsDir, 'logs')

    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

    const session: ChatSessionData = {
      id: sessionId,
      projectId: id,
      title: title || 'Untitled Chat',
      createdAt: now,
      updatedAt: now,
    }

    fs.writeFileSync(path.join(chatsDir, `${sessionId}.json`), JSON.stringify(session, null, 2), 'utf-8')
    fs.writeFileSync(path.join(logsDir, `${sessionId}.jsonl`), '', 'utf-8')

    res.status(201).json(session)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create chat session' })
  }
})

// DELETE /api/projects/:id/chats/:sessionId
app.delete('/api/projects/:id/chats/:sessionId', (req: Request, res: ExpressResponse) => {
  try {
    const id = param(req, 'id')
    const sessionId = param(req, 'sessionId')
    const chatsDir = path.join(resolveProjectPath(id), 'chats')

    const sessionFile = path.join(chatsDir, `${sessionId}.json`)
    const logFile = path.join(chatsDir, 'logs', `${sessionId}.jsonl`)

    if (!fs.existsSync(sessionFile)) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    fs.unlinkSync(sessionFile)
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile)

    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete chat session' })
  }
})

// POST /api/projects/:id/chats/:sessionId/stream
app.post('/api/projects/:id/chats/:sessionId/stream', (req: Request, res: ExpressResponse) => {
  try {
    const id = param(req, 'id')
    const sessionId = param(req, 'sessionId')
    const { message, endpoint: clientEndpoint } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Use the endpoint from the client (passed securely from the frontend)
    const endpointToUse = clientEndpoint || ''
    if (!endpointToUse) {
      return res.status(400).json({ error: 'OpenAI endpoint not configured' })
    }

    // Load session from disk
    const session = readChatSession(id, sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    // Build the request to the LLM
    const projectPath = resolveProjectPath(id)
    const messages = readChatMessages(id, sessionId)
    const projectTitle = session.title

    const apiMessages = [
      {
        role: 'system',
        content: buildSystemPrompt(projectTitle, id),
      },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    // Set streaming headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Proxy the streaming request to the OpenAI-compatible endpoint
    proxyStream(endpointToUse, sessionId, id, apiMessages, res).catch(err => {
      console.error('Stream proxy error:', err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to process chat request' })
      }
    })
  } catch (err: any) {
    console.error(err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat request' })
    }
  }
})

// ── Serve static files in production ─────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist')
  app.use(express.static(clientDist))

  // Catch-all: serve index.html for SPA routing
  app.get('*', (_req: Request, res: ExpressResponse) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Projects root: ${path.resolve(PROJECTS_ROOT)}`)
})
