import fs from 'fs'
import path from 'path'
import { Request } from 'express'
import { PROJECTS_ROOT } from './config.js'

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

export function resolveFilePath(projectPath: string, filename: string): string {
  return path.join(projectPath, filename)
}

export interface ProjectJsonData {
  pinnedFiles?: string[]
  lastUpdated?: string
}

export function readProjectJson(projectPath: string): ProjectJsonData {
  const jsonPath = path.join(projectPath, 'project.json')
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
  const jsonPath = path.join(projectPath, 'project.json')
  const existing = readProjectJson(projectPath)
  fs.writeFileSync(jsonPath, JSON.stringify({ ...existing, ...data }, null, 2), 'utf-8')
}

export function touchProjectLastUpdated(projectPath: string): void {
  writeProjectJson(projectPath, { lastUpdated: new Date().toISOString() })
}
