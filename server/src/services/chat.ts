import fs from 'fs'
import path from 'path'
import { resolveProjectPath } from '../helpers.js'
import { ChatMessageEntry, ChatSessionData } from '../types.js'
import { stripFrontmatter } from '../summary.js'

export function readChatSession(projectId: string, sessionId: string): ChatSessionData | null {
  const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
  const sessionFile = path.join(chatsDir, `${sessionId}.json`)
  if (!fs.existsSync(sessionFile)) return null
  return JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
}

export function readChatMessages(projectId: string, sessionId: string): ChatMessageEntry[] {
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

export function buildSystemPrompt(projectTitle: string, projectId: string): string {
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

export function persistSession(projectId: string, sessionId: string, assistantContent: string): void {
  const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
  const logsDir = path.join(chatsDir, 'logs')
  if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

  const logFile = path.join(logsDir, `${sessionId}.jsonl`)
  const assistantMsg: ChatMessageEntry = {
    id: crypto.randomUUID(),
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

export function persistPartialSession(
  projectId: string,
  sessionId: string,
  userMessage: { role: string; content: string } | null,
  assistantContent: string | null
): void {
  try {
    const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
    const logsDir = path.join(chatsDir, 'logs')
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

    const logFile = path.join(logsDir, `${sessionId}.jsonl`)
    const sessionFile = path.join(chatsDir, `${sessionId}.json`)

    const existingMessages = readChatMessages(projectId, sessionId)
    const existingContentHashes = new Set(existingMessages.map(m => m.content))

    if (userMessage && !existingContentHashes.has(userMessage.content)) {
      const msgWithId: ChatMessageEntry = {
        id: crypto.randomUUID(),
        role: userMessage.role as 'user' | 'assistant' | 'system',
        content: userMessage.content,
        timestamp: new Date().toISOString(),
      }
      fs.appendFileSync(logFile, JSON.stringify(msgWithId) + '\n', 'utf-8')
    }

    if (assistantContent !== null && !existingContentHashes.has(assistantContent)) {
      const msgWithId: ChatMessageEntry = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      }
      fs.appendFileSync(logFile, JSON.stringify(msgWithId) + '\n', 'utf-8')
    }

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
    session.updatedAt = new Date().toISOString()
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8')
  } catch {
    // Non-fatal: partial persistence failure
  }
}
