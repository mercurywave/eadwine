import { Project, FileItem, Settings, ChatSession, ChatSessionSummary } from './types'

const BASE_URL = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (res.status === 204) {
    return {} as T
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Projects ─────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/projects')
}

export async function createProject(): Promise<Project> {
  return request<Project>('/projects', { method: 'POST' })
}

export async function deleteProject(id: string): Promise<void> {
  return request<void>(`/projects/${id}`, { method: 'DELETE' })
}

export async function fetchProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`)
}

// ── Files ────────────────────────────────────────────────────────────

export async function fetchFiles(projectId: string): Promise<FileItem[]> {
  return request<FileItem[]>(`/projects/${projectId}/files`)
}

export async function fetchFileContent(projectId: string, filename: string): Promise<string> {
  const result = await request<{ content: string }>(`/projects/${projectId}/files/${encodeURIComponent(filename)}`)
  return result.content
}

export async function saveFileContent(projectId: string, filename: string, content: string): Promise<void> {
  await request<void>(`/projects/${projectId}/files/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export async function createFile(projectId: string, name: string): Promise<FileItem> {
  return request<FileItem>(`/projects/${projectId}/files`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function deleteFile(projectId: string, filename: string): Promise<void> {
  return request<void>(`/projects/${projectId}/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  })
}

export async function renameFile(projectId: string, from: string, to: string): Promise<FileItem> {
  return request<FileItem>(`/projects/${projectId}/files/rename`, {
    method: 'PUT',
    body: JSON.stringify({ from, to }),
  })
}

// ── Settings ─────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<Settings> {
  return request<Settings>('/settings')
}

export async function saveSettings(settings: Settings): Promise<void> {
  await request<void>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

// ── Chat ─────────────────────────────────────────────────────────────

export async function fetchChatSessions(projectId: string): Promise<ChatSessionSummary[]> {
  return request<ChatSessionSummary[]>(`/projects/${projectId}/chats`)
}

export async function fetchChatSession(projectId: string, sessionId: string): Promise<ChatSession> {
  return request<ChatSession>(`/projects/${projectId}/chats/${sessionId}`)
}

export async function createChatSession(projectId: string, title: string): Promise<ChatSession> {
  return request<ChatSession>(`/projects/${projectId}/chats`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function deleteChatSession(projectId: string, sessionId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/chats/${sessionId}`, {
    method: 'DELETE',
  })
}

export async function* streamChatMessage(
  projectId: string,
  sessionId: string,
  userMessage: string,
  endpoint: string,
  signal?: AbortSignal
): AsyncGenerator<string, string, unknown> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/chats/${sessionId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage, endpoint }),
    signal,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let fullAssistantContent = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          return fullAssistantContent
        }

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullAssistantContent += content
            yield content
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullAssistantContent
}

export async function persistChatMessage(projectId: string, sessionId: string, message: string): Promise<void> {
  await request<void>(`/projects/${projectId}/chats/${sessionId}/persist-message`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}
