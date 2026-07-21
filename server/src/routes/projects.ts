import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { PROJECTS_ROOT } from '../config.js'
import { param, resolveProjectPath, readProjectJson, writeProjectJson } from '../helpers.js'
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
        const { title, summary, tags } = readSummaryMd(projectPath)
        const projectJson = readProjectJson(projectPath)
        return { id: dir.name, title, summary, tags, lastUpdated: projectJson.lastUpdated }
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

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const { title, summary, tags } = readSummaryMd(projectPath)
    const projectJson = readProjectJson(projectPath)
    res.json({ id, title, summary, tags, lastUpdated: projectJson.lastUpdated })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read project' })
  }
})

// POST /api/projects
router.post('/', (_req: Request, res: Response) => {
  try {
    const id = uuidv4()
    const projectPath = resolveProjectPath(id)

    if (fs.existsSync(projectPath)) {
      return res.status(409).json({ error: 'Project already exists' })
    }

    fs.mkdirSync(projectPath, { recursive: true })
    writeSummaryMd(projectPath, '', '', [])
    const now = new Date().toISOString()
    writeProjectJson(projectPath, { pinnedFiles: [], lastUpdated: now })

    res.status(201).json({ id, title: 'Untitled Project', summary: '', tags: [], lastUpdated: now })
  } catch (err: any) {
    console.error(err)
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: 'Project already exists' })
    }
    res.status(500).json({ error: 'Failed to create project' })
  }
})

// DELETE /api/projects/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    fs.rmSync(projectPath, { recursive: true, force: true })
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

export const projectsRouter = router
