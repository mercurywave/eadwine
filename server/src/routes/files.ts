import fs from 'fs'
import { Router, Request, Response } from 'express'
import { param, resolveProjectPath, resolveFilePath, validateFilename, readProjectJson, writeProjectJson, touchProjectLastUpdated } from '../helpers.js'
import { stripFrontmatter } from '../summary.js'

const router = Router()

function readPins(projectPath: string): string[] {
  const data = readProjectJson(projectPath)
  if (data && Array.isArray(data.pinnedFiles)) {
    return data.pinnedFiles
  }
  return []
}

function writePins(projectPath: string, pinnedFiles: string[]): void {
  writeProjectJson(projectPath, { pinnedFiles })
}

// GET /api/projects/:id/pins
router.get('/:id/pins', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const pinnedFiles = readPins(projectPath)
    res.json({ pinnedFiles })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read pins' })
  }
})

// PUT /api/projects/:id/pins
router.put('/:id/pins', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const { pinnedFiles } = req.body
    if (!Array.isArray(pinnedFiles)) {
      return res.status(400).json({ error: 'pinnedFiles must be an array' })
    }

    // Validate that all pinned files exist in the project
    for (const filename of pinnedFiles) {
      const filePath = resolveFilePath(projectPath, filename)
      if (!filePath.startsWith(projectPath) || !fs.existsSync(filePath)) {
        return res.status(400).json({ error: `File not found: ${filename}` })
      }
    }

    writePins(projectPath, pinnedFiles)
    touchProjectLastUpdated(projectPath)
    res.json({ message: 'Pins updated' })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save pins' })
  }
})

// GET /api/projects/:id/files
router.get('/:id/files', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const pinnedFiles = readPins(projectPath)
    const pinnedSet = new Set(pinnedFiles)

    const entries = fs.readdirSync(projectPath, { withFileTypes: true })
    const allFiles = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => ({
        name: e.name,
        path: e.name,
        isSummary: e.name.toLowerCase() === 'summary.md',
        isMemory: e.name.toLowerCase() === 'memory.md',
      }))

    // Build pinned list in pinnedFiles array order (not directory order)
    const pinned: typeof allFiles = []
    for (const pinName of pinnedFiles) {
      const match = allFiles.find(f => f.name === pinName)
      if (match) {
        pinned.push(match)
      }
    }

    // Unpinned files: summary, memory, then others alphabetically
    const summary = allFiles.find(f => f.isSummary)
    const memory = allFiles.find(f => f.isMemory)
    const unpinnedOther = allFiles.filter(f => !f.isSummary && !f.isMemory && !pinnedSet.has(f.name))
    unpinnedOther.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

    // Final order: summary → pinned (in pinnedFiles order) → unpinned alphabetically → memory
    const sorted = [summary, ...pinned, ...unpinnedOther, memory].filter(Boolean)

    res.json(sorted)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list files' })
  }
})

// GET /api/projects/:id/files/:filename
router.get('/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const filename = param(req, 'filename')
    const projectPath = resolveProjectPath(id)
    const filePath = resolveFilePath(projectPath, filename)

    if (!filePath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const rawContent = fs.readFileSync(filePath, 'utf-8')
    const content = filePath.toLowerCase().endsWith('summary.md')
      ? stripFrontmatter(rawContent)
      : rawContent
    res.json({ content })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read file' })
  }
})

// PUT /api/projects/:id/files/rename
router.put('/:id/files/rename', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)
    const { from, to } = req.body

    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({ error: 'from and to are required' })
    }

    if (from.toLowerCase() === 'summary.md') {
      return res.status(403).json({ error: 'Summary file cannot be renamed' })
    }

    if (from.toLowerCase() === 'memory.md') {
      return res.status(403).json({ error: 'Memory file cannot be renamed' })
    }

    const validationError = validateFilename(to)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    const finalTo = to.endsWith('.md') ? to : `${to}.md`
    const srcPath = resolveFilePath(projectPath, from)
    const destPath = resolveFilePath(projectPath, finalTo)

    if (!srcPath.startsWith(projectPath) || !destPath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    if (!fs.existsSync(srcPath)) {
      return res.status(404).json({ error: 'Source file not found' })
    }

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (fs.existsSync(destPath)) {
      return res.status(409).json({ error: 'Destination file already exists' })
    }

    fs.renameSync(srcPath, destPath)
    touchProjectLastUpdated(projectPath)
    res.json({ name: finalTo, path: finalTo })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to rename file' })
  }
})

// PUT /api/projects/:id/files/:filename
router.put('/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const filename = param(req, 'filename')
    const projectPath = resolveProjectPath(id)
    const filePath = resolveFilePath(projectPath, filename)

    if (!filePath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    const { content } = req.body
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' })
    }

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    fs.writeFileSync(filePath, content, 'utf-8')
    touchProjectLastUpdated(projectPath)
    res.json({ message: 'File saved' })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save file' })
  }
})

// POST /api/projects/:id/files
router.post('/:id/files', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const projectPath = resolveProjectPath(id)
    const { name } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Filename is required' })
    }

    const validationError = validateFilename(name)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    const finalName = name.endsWith('.md') ? name : `${name}.md`
    const filePath = resolveFilePath(projectPath, finalName)

    if (!filePath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'File already exists' })
    }

    fs.writeFileSync(filePath, '', 'utf-8')
    touchProjectLastUpdated(projectPath)
    res.status(201).json({ name: finalName, path: finalName })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create file' })
  }
})

// DELETE /api/projects/:id/files/:filename
router.delete('/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const id = param(req, 'id')
    const filename = param(req, 'filename')
    const projectPath = resolveProjectPath(id)
    const filePath = resolveFilePath(projectPath, filename)

    if (!filePath.startsWith(projectPath)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    if (filename.toLowerCase() === 'summary.md') {
      return res.status(403).json({ error: 'Summary file cannot be deleted' })
    }

    if (filename.toLowerCase() === 'memory.md') {
      return res.status(403).json({ error: 'Memory file cannot be deleted' })
    }

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ error: 'Project not found' })
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    fs.unlinkSync(filePath)
    touchProjectLastUpdated(projectPath)
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

export const filesRouter = router
