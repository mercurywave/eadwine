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
  selectedModel: string
  defaultModel: string
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments: string // JSON string of arguments
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: string
  tool_calls?: ToolCallInfo[]
  tool_call_id?: string
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
