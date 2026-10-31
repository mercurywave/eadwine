import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { PROJECTS_ROOT } from '../config.js'
import { param, resolveProjectPath, resolveProjectMetadataPath, readProjectJson, writeProjectJson, ensureProjectId, generateProjectFolderName, sanitizeProjectName, validateProjectName } from '../helpers.js'
import { readSummaryMd, writeSummaryMd } from '../summary.js'

const router = Router()

// GET /api/projects
router.get('/', (_req: Request, res: Response) => {
  try {
    const entries = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    const projects = entries
      .filter(e => e.isDirectory())
      .map(dir => {
        const projectPath = path.join(PROJECTS_ROOT, dir.name)
        const { summary, tags } = readSummaryMd(projectPath)
        const projectJson = readProjectJson(projectPath)
        return { id: ensureProjectId(projectPath), title: dir.name, summary, tags, lastUpdated: projectJson.lastUpdated }
      })
      .sort((a, b) => {
        const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0
        const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0
        return bTime - aTime
      })
    res.json(projects)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list projects' })
  }
})

// GET /api/projects/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!projectPath || !fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const { summary, tags } = readSummaryMd(projectPath)
    const projectJson = readProjectJson(projectPath)
    res.json({ id, title: path.basename(projectPath), summary, tags, lastUpdated: projectJson.lastUpdated })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read project' })
  }
})

// POST /api/projects
router.post('/', (_req: Request, res: Response) => {
  try {
    const id = uuidv4()
    const folderName = generateProjectFolderName()
    const projectPath = path.join(PROJECTS_ROOT, folderName)

    if (fs.existsSync(projectPath)) {
      return res.status(409).json({ error: 'Project already exists' })
    }

    fs.mkdirSync(projectPath, { recursive: true })
    fs.writeFileSync(path.join(projectPath, '.eadwine.json'), JSON.stringify({ id }, null, 2) + '\n', 'utf-8')
    writeSummaryMd(projectPath, '', '', [])
    const now = new Date().toISOString()
    writeProjectJson(projectPath, { pinnedFiles: [], lastUpdated: now })

    res.status(201).json({ id, title: folderName, summary: '', tags: [], lastUpdated: now })
  } catch (err: any) {
    console.error(err)
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: 'Project already exists' })
    }
    res.status(500).json({ error: 'Failed to create project' })
  }
})

// PUT /api/projects/:id/name
router.put('/:id/name', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)
    if (!projectPath || !fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const { name } = req.body
    if (typeof name !== 'string') {
      return res.status(400).json({ error: 'Project name is required' })
    }
    const validationError = validateProjectName(name)
    if (validationError) return res.status(400).json({ error: validationError })

    const folderName = sanitizeProjectName(name)
    const destinationPath = path.join(PROJECTS_ROOT, folderName)
    const sameWindowsFolder = process.platform === 'win32' &&
      folderName.toLowerCase() === path.basename(projectPath).toLowerCase()
    const hasConflictingFolder = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true })
      .some(entry => entry.isDirectory() && entry.name.localeCompare(folderName, undefined, { sensitivity: 'accent' }) === 0 && path.join(PROJECTS_ROOT, entry.name) !== projectPath)
    if (hasConflictingFolder || fs.existsSync(destinationPath) && destinationPath !== projectPath && !sameWindowsFolder) {
      return res.status(409).json({ error: 'A project with that folder name already exists' })
    }

    if (destinationPath !== projectPath) fs.renameSync(projectPath, destinationPath)
    const { summary, tags } = readSummaryMd(destinationPath)
    const projectJson = readProjectJson(destinationPath)
    res.json({ id, title: folderName, summary, tags, lastUpdated: projectJson.lastUpdated })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to rename project folder' })
  }
})

// DELETE /api/projects/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!projectPath || !fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    fs.rmSync(projectPath, { recursive: true, force: true })
    fs.rmSync(resolveProjectMetadataPath(id), { recursive: true, force: true })
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

export const projectsRouter = router
