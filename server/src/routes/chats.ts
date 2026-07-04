import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { param } from '../helpers.js'
import { resolveProjectPath } from '../helpers.js'
import { readChatSession, readChatMessages, buildSystemPrompt, persistSession, persistPartialSession, persistUserMessage } from '../services/chat.js'
import { proxyStream } from '../services/llm.js'
import { runToolCallLoop } from '../services/agent.js'
import { ChatMessageEntry, ToolCallEntry } from '../types.js'

const router = Router()

// GET /api/projects/:id/chats
router.get('/:id/chats', (req: Request, res: Response) => {
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
          const aData = JSON.parse(fs.readFileSync(path.join(chatsDir, a), 'utf-8'))
          const bData = JSON.parse(fs.readFileSync(path.join(chatsDir, b), 'utf-8'))
          return new Date(bData.updatedAt).getTime() - new Date(bData.updatedAt).getTime()
        } catch {
          return 0
        }
      })

    const summaries = jsonFiles.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(chatsDir, f), 'utf-8'))
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
router.get('/:id/chats/:sessionId', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const sessionId = param(req, 'sessionId')
    const chatsDir = path.join(resolveProjectPath(id), 'chats')
    const sessionFile = path.join(chatsDir, `${sessionId}.json`)
    const logFile = path.join(chatsDir, 'logs', `${sessionId}.jsonl`)

    if (!fs.existsSync(sessionFile)) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'))
    const messages = readChatMessages(id, sessionId)

    res.json({ ...session, messages })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load chat session' })
  }
})

// POST /api/projects/:id/chats
router.post('/:id/chats', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const { title } = req.body
    const sessionId = uuidv4()
    const now = new Date().toISOString()

    const chatsDir = path.join(resolveProjectPath(id), 'chats')
    const logsDir = path.join(chatsDir, 'logs')

    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

    const session = {
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
router.delete('/:id/chats/:sessionId', (req: Request, res: Response) => {
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

// POST /api/projects/:id/chats/stream — Combined session creation + message submission
router.post('/:id/chats/stream', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const { message, sessionId: clientSessionId, endpoint: clientEndpoint } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' })
    }

    const endpointToUse = clientEndpoint || ''
    if (!endpointToUse) {
      return res.status(400).json({ error: 'OpenAI endpoint not configured' })
    }

    // Auto-create a session if none provided
    let sessionId: string
    let session = clientSessionId ? readChatSession(id, clientSessionId) : null

    if (!session) {
      const now = new Date().toISOString()
      const chatsDir = path.join(resolveProjectPath(id), 'chats')
      const logsDir = path.join(chatsDir, 'logs')

      if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

      sessionId = uuidv4()
      const newSession = {
        id: sessionId,
        projectId: id,
        title: 'Untitled Chat',
        createdAt: now,
        updatedAt: now,
      }

      fs.writeFileSync(path.join(chatsDir, `${sessionId}.json`), JSON.stringify(newSession, null, 2), 'utf-8')
      fs.writeFileSync(path.join(logsDir, `${sessionId}.jsonl`), '', 'utf-8')
      session = newSession
    } else {
      sessionId = session.id
    }

    // Persist the user message FIRST, before any other messages are written
    persistUserMessage(id, sessionId, message)

    const projectPath = resolveProjectPath(id)
    const messages = readChatMessages(id, sessionId)
    const projectTitle = session.title

    const apiMessages: Array<{
      role: string
      content: string
      tool_calls?: ToolCallEntry[]
      tool_call_id?: string
    }> = [
      {
        role: 'system',
        content: buildSystemPrompt(projectTitle, id),
      },
      ...messages.map((m: ChatMessageEntry) => ({
        role: m.role,
        content: m.content,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      })),
      { role: 'user', content: message },
    ]

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    runToolCallLoop({
      openAiEndpoint: endpointToUse,
      sessionId,
      projectId: id,
      projectPath: resolveProjectPath(id),
      projectTitle,
      systemPrompt: apiMessages[0].content,
      conversationHistory: messages.map(m => ({
        role: m.role,
        content: m.content,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      })),
      userMessage: message,
      expressRes: res,
      maxIterations: 50,
    }).catch((err: unknown) => {
      console.error('Agent stream error:', err)
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

// POST /api/projects/:id/chats/:sessionId/stream — Legacy endpoint, kept for backwards compatibility
router.post('/:id/chats/:sessionId/stream', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const sessionId = param(req, 'sessionId')
    const { message, endpoint: clientEndpoint } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' })
    }

    const endpointToUse = clientEndpoint || ''
    if (!endpointToUse) {
      return res.status(400).json({ error: 'OpenAI endpoint not configured' })
    }

    const session = readChatSession(id, sessionId)
    if (!session) {
      return res.status(404).json({ error: 'Chat session not found' })
    }

    const projectPath = resolveProjectPath(id)
    const messages = readChatMessages(id, sessionId)
    const projectTitle = session.title

    const apiMessages: Array<{
      role: string
      content: string
      tool_calls?: ToolCallEntry[]
      tool_call_id?: string
    }> = [
      {
        role: 'system',
        content: buildSystemPrompt(projectTitle, id),
      },
      ...messages.map((m: ChatMessageEntry) => ({
        role: m.role,
        content: m.content,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      })),
      { role: 'user', content: message },
    ]

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    runToolCallLoop({
      openAiEndpoint: endpointToUse,
      sessionId,
      projectId: id,
      projectPath: resolveProjectPath(id),
      projectTitle,
      systemPrompt: apiMessages[0].content,
      conversationHistory: messages.map(m => ({
        role: m.role,
        content: m.content,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      })),
      userMessage: message,
      expressRes: res,
      maxIterations: 50,
    }).catch((err: unknown) => {
      console.error('Agent stream error:', err)
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

export const chatsRouter = router
