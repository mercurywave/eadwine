import fs from 'fs'
import path from 'path'
import { resolveProjectPath } from '../helpers.js'
import { ChatMessageEntry, ChatSessionData } from '../types.js'
import { stripFrontmatter } from '../summary.js'

export interface ToolCallPersist {
  toolCalls: Array<{
    id: string
    name: string
    args: Record<string, unknown>
  }>
}

export interface ToolResultPersist {
  toolCallId: string
  content: string
}

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

export function buildSystemPrompt(projectId: string, personaPrompt?: string): string {
  const projectPath = resolveProjectPath(projectId)
  const summaryPath = path.join(projectPath, 'SUMMARY.md')
  let summaryContent = ''
  try {
    const rawContent = fs.readFileSync(summaryPath, 'utf-8')
    summaryContent = stripFrontmatter(rawContent)
  } catch {
    // No summary file
  }

  const memoryPath = path.join(projectPath, 'MEMORY.md')
  let memoryContent = ''
  try {
    memoryContent = fs.readFileSync(memoryPath, 'utf-8')
  } catch {
    // No memory file
  }

  let basePrompt = `You are a helpful assistant, responsible for cataloguing and maintaining design documents.

# Project Summary
${summaryContent}

# General Folder Strucuture
The folder should only consist of md files which help to describe this project. 

The project has some reserved file names which have special meaning:
- SUMMARY.md - Very brief executive description of the project. Max 30 words.
- MEMORY.md - (Optional) Notes about decisions, and user preferences to always keep in mind. Keep notes extremely brief for handoff to future assistants. Max 1000 words.

Additional md files should use Title Case file names. If a file grows to more than 1000 words, it should be split into multiple files.
${memoryContent ? `# Long-term Memory\n${memoryContent}\n` : ''}

# Your Objective
You can help answer questions about the project's content, suggest improvements, explain concepts, or assist with writing new Markdown files. Be concise and reference specific files when relevant.`

  if (personaPrompt) {
    basePrompt = `${personaPrompt}\n\n${basePrompt}`
  }

  return basePrompt
}

export function persistUserMessage(projectId: string, sessionId: string, userMessage: string): void {
  try {
    const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
    const logsDir = path.join(chatsDir, 'logs')
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

    const logFile = path.join(logsDir, `${sessionId}.jsonl`)

    // Only write if this user message isn't already in the log
    const existingMessages = readChatMessages(projectId, sessionId)
    const existingContentHashes = new Set(existingMessages.map(m => m.content))

    if (!existingContentHashes.has(userMessage)) {
      const msgWithId: ChatMessageEntry = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date().toISOString(),
      }
      fs.appendFileSync(logFile, JSON.stringify(msgWithId) + '\n', 'utf-8')
    }
  } catch {
    // Non-fatal
  }
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
  assistantContent: string | null,
  toolCalls?: Array<{
    id: string
    name: string
    args: Record<string, unknown>
  }>,
  toolResults?: Array<{ tool_call_id: string; content: string }>
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

    // Note: user message is now persisted separately via persistUserMessage() at the start of the stream
    // This function only handles assistant content and tool calls for partial/error recovery

    if (assistantContent !== null && !existingContentHashes.has(assistantContent)) {
      const msgWithId: ChatMessageEntry = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      }
      fs.appendFileSync(logFile, JSON.stringify(msgWithId) + '\n', 'utf-8')
    }

    // Persist any tool calls that were accumulated but not yet finalized
    if (toolCalls && toolCalls.length > 0) {
      // Guard: skip if these tool calls already exist in the log
      const existingToolCallIds = new Set(
        existingMessages
          .filter(m => m.role === 'assistant' && m.tool_calls)
          .flatMap(m => m.tool_calls!.map(tc => tc.id))
      )
      const toolCallIds = new Set(toolCalls.map(tc => tc.id))
      const alreadyPersisted = [...toolCallIds].some(id => existingToolCallIds.has(id))
      if (alreadyPersisted) {
        // Some tool calls already written — skip to avoid duplicates
        return
      }

      const toolCallEntries = toolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
        },
      }))

      const assistantMsg: ChatMessageEntry = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        tool_calls: toolCallEntries,
        timestamp: new Date().toISOString(),
      }
      fs.appendFileSync(logFile, JSON.stringify(assistantMsg) + '\n', 'utf-8')

      // Also persist the tool results
      if (toolResults) {
        for (const result of toolResults) {
          const toolResultMsg: ChatMessageEntry = {
            id: crypto.randomUUID(),
            role: 'tool',
            content: result.content,
            tool_call_id: result.tool_call_id,
            timestamp: new Date().toISOString(),
          }
          fs.appendFileSync(logFile, JSON.stringify(toolResultMsg) + '\n', 'utf-8')
        }
      }
    }

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
    session.updatedAt = new Date().toISOString()
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8')
  } catch {
    // Non-fatal: partial persistence failure
  }
}

// ── Tool call persistence ────────────────────────────────────────────

export function persistToolCalls(
  projectId: string,
  sessionId: string,
  toolCalls: Array<{
    id: string
    name: string
    args: Record<string, unknown>
  }>
): void {
  try {
    const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
    const logsDir = path.join(chatsDir, 'logs')
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

    const logFile = path.join(logsDir, `${sessionId}.jsonl`)
    const sessionFile = path.join(chatsDir, `${sessionId}.json`)

    // Write assistant message with tool_calls — use the LLM's original IDs
    const toolCallEntries = toolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.args),
      },
    }))

    const assistantMsg: ChatMessageEntry = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      tool_calls: toolCallEntries,
      timestamp: new Date().toISOString(),
    }
    fs.appendFileSync(logFile, JSON.stringify(assistantMsg) + '\n', 'utf-8')

    // Update session
    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
    session.updatedAt = new Date().toISOString()
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8')
  } catch {
    // Non-fatal
  }
}

export function persistToolResult(
  projectId: string,
  sessionId: string,
  toolCallId: string,
  content: string
): void {
  try {
    const chatsDir = path.join(resolveProjectPath(projectId), 'chats')
    const logsDir = path.join(chatsDir, 'logs')
    if (!fs.existsSync(chatsDir)) fs.mkdirSync(chatsDir, { recursive: true })
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

    const logFile = path.join(logsDir, `${sessionId}.jsonl`)
    const sessionFile = path.join(chatsDir, `${sessionId}.json`)

    const toolResultMsg: ChatMessageEntry = {
      id: crypto.randomUUID(),
      role: 'tool',
      content,
      tool_call_id: toolCallId,
      timestamp: new Date().toISOString(),
    }
    fs.appendFileSync(logFile, JSON.stringify(toolResultMsg) + '\n', 'utf-8')

    const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8')) as ChatSessionData
    session.updatedAt = new Date().toISOString()
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), 'utf-8')
  } catch {
    // Non-fatal
  }
}
