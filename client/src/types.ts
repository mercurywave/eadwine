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
  isMemory?: boolean
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface Persona {
  id: string
  name: string
  description: string
  systemPrompt: string
  isDefault?: boolean
}

export interface Macro {
  id: string
  name: string
  prompt: string
}

export interface Settings {
  openAiEndpoint: string
  selectedModel: string
  defaultModel: string
  personas?: Persona[]
  defaultPersonaId?: string
  structureGuidelines?: string
  macros?: Macro[]
  summaryMaxLength?: number
  memoryMaxLength?: number
  otherMaxLength?: number
  backupTime?: string
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
  personaId?: string
}

export interface ChatSessionSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  preview: string
}

export interface FileChange {
  filename: string
  operation: 'edited' | 'created' | 'deleted' | 'renamed'
}

export interface FileChangeEvent {
  type: 'file_changed'
  files: FileChange[]
}

export interface Pins {
  pinnedFiles: string[]
}
