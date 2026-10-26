import fs from 'fs'
import path from 'path'
import { Request } from 'express'
import { PROJECTS_ROOT, PROJECT_METADATA_ROOT } from './config.js'

// Express 5 type guard for req.params values
export function param(req: Request, key: string): string {
  const val = req.params[key]
  return typeof val === 'string' ? val : String(val ?? '')
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/\\\\]/g, '')
    .replace(/[^a-z0-9\\-_ .]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return cleaned.slice(0, 100)
}

export function validateFilename(name: string): string | null {
  if (!name || !name.trim()) return 'Filename is required'
  const sanitized = sanitizeFilename(name)
  if (!sanitized) return 'Invalid filename'
  return null
}

export function resolveProjectPath(id: string): string {
  return path.join(PROJECTS_ROOT, id)
}

export function resolveProjectMetadataPath(id: string): string {
  return path.join(PROJECT_METADATA_ROOT, id)
}

export function resolveChatProjectPath(id: string): string {
  return resolveProjectMetadataPath(id)
}

export function resolveChatsDir(id: string): string {
  return path.join(resolveChatProjectPath(id), 'chats')
}

export function resolveFilePath(projectPath: string, filename: string): string {
  return path.join(projectPath, filename)
}

export interface ProjectJsonData {
  pinnedFiles?: string[]
  lastUpdated?: string
}

export function readProjectJson(projectPath: string): ProjectJsonData {
  const projectId = path.basename(projectPath)
  const jsonPath = path.join(resolveProjectMetadataPath(projectId), 'project.json')
  if (!fs.existsSync(jsonPath)) {
    return {}
  }
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as ProjectJsonData
    return data || {}
  } catch {
    return {}
  }
}

export function writeProjectJson(projectPath: string, data: ProjectJsonData): void {
  const projectId = path.basename(projectPath)
  const metadataPath = resolveProjectMetadataPath(projectId)
  if (!fs.existsSync(metadataPath)) {
    fs.mkdirSync(metadataPath, { recursive: true })
  }
  const jsonPath = path.join(metadataPath, 'project.json')
  const existing = readProjectJson(projectPath)
  fs.writeFileSync(jsonPath, JSON.stringify({ ...existing, ...data }, null, 2), 'utf-8')
}

export function touchProjectLastUpdated(projectPath: string): void {
  writeProjectJson(projectPath, { lastUpdated: new Date().toISOString() })
}
