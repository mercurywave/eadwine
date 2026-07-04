export interface ToolCallEntry {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatMessageEntry {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: string
  tool_calls?: ToolCallEntry[]
  tool_call_id?: string
}

export interface ChatSessionData {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface SettingsData {
  openAiEndpoint?: string
  selectedModel?: string
  defaultModel?: string
}
