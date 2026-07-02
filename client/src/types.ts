export interface Project {
  id: string
  title: string
  summary: string
  tags: string[]
}

export interface FileItem {
  name: string
  path: string
  isSummary?: boolean
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface Settings {
  openAiEndpoint: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface ChatSession {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export interface ChatSessionSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  preview: string
}
