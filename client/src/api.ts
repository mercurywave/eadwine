import { Project, FileItem } from './types'

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
