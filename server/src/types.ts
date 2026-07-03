export interface ChatMessageEntry {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
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
}
