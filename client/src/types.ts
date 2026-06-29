export interface Project {
  id: string
  title: string
  summary: string
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
