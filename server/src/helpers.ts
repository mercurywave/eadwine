import fs from 'fs'
import path from 'path'
import { v4 as uuidv4, validate as isUuid } from 'uuid'
import { Request } from 'express'
import { PROJECTS_ROOT, PROJECT_METADATA_ROOT } from './config.js'

const PROJECT_ID_FILE = '.eadwine.json'
const PROJECT_ADJECTIVES = [
  'amber', 'brisk', 'cobalt', 'curious', 'dapper', 'ember', 'fable', 'gentle',
  'harbor', 'indigo', 'jolly', 'kindred', 'lunar', 'mossy', 'nimble', 'opal',
  'plucky', 'quiet', 'ripple', 'silver', 'tidy', 'velvet', 'willow', 'zesty',
]
const PROJECT_NOUNS = [
  'anchor', 'badger', 'beacon', 'birch', 'cabin', 'comet', 'compass', 'copper',
  'dahlia', 'falcon', 'fern', 'harbor', 'island', 'lantern', 'meadow', 'orbit',
  'panda', 'pebble', 'pine', 'quartz', 'river', 'saffron', 'thistle', 'voyage',
]

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

export function sanitizeProjectName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function validateProjectName(name: string): string | null {
  if (!name || !name.trim()) return 'Project name is required'
  const sanitized = sanitizeProjectName(name)
  if (!sanitized || sanitized === '.' || sanitized === '..') return 'Invalid project name'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(sanitized)) {
    return 'Project name is reserved by Windows'
  }
  return null
}

function projectIdPath(projectPath: string): string {
  return path.join(projectPath, PROJECT_ID_FILE)
}

function readStoredProjectId(projectPath: string): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(projectIdPath(projectPath), 'utf-8')) as { id?: unknown }
    return typeof data.id === 'string' && isUuid(data.id) ? data.id : null
  } catch {
    return null
  }
}

export function ensureProjectId(projectPath: string): string {
  const storedId = readStoredProjectId(projectPath)
  if (storedId) return storedId

  // Existing projects used their UUID directory names as IDs before the marker file existed.
  const legacyId = path.basename(projectPath)
  const id = isUuid(legacyId) ? legacyId : uuidv4()
  fs.writeFileSync(projectIdPath(projectPath), JSON.stringify({ id }, null, 2) + '\n', 'utf-8')
  return id
}

export function generateProjectFolderName(): string {
  const existingNames = new Set(
    fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name.toLocaleLowerCase()),
  )

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const adjective = PROJECT_ADJECTIVES[Math.floor(Math.random() * PROJECT_ADJECTIVES.length)]
    const noun = PROJECT_NOUNS[Math.floor(Math.random() * PROJECT_NOUNS.length)]
    const name = `${adjective}-${noun}`
    if (!existingNames.has(name)) return name
  }

  return `project-${uuidv4().slice(0, 8)}`
}

export function resolveProjectPath(id: string): string | null {
  const entry = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .find(candidate => candidate.isDirectory() && readStoredProjectId(path.join(PROJECTS_ROOT, candidate.name)) === id)
  return entry ? path.join(PROJECTS_ROOT, entry.name) : null
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
  const projectId = ensureProjectId(projectPath)
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
  const projectId = ensureProjectId(projectPath)
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
