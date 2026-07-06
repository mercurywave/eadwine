import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import { SETTINGS_FILE } from '../config.js'
import { SettingsData, PersonaData } from '../types.js'

export function readSettings(): SettingsData {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8')
    return JSON.parse(raw) as SettingsData
  } catch {
    return {}
  }
}

function writeSettings(data: SettingsData): void {
  const dir = path.dirname(SETTINGS_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

const router = Router()

// GET /api/settings
router.get('/', (_req: Request, res: Response) => {
  try {
    const settings = readSettings()
    res.json(settings)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read settings' })
  }
})

// PUT /api/settings
router.put('/', (req: Request, res: Response) => {
  try {
    const { openAiEndpoint, selectedModel, defaultModel, personas, defaultPersonaId } = req.body
    const settings: SettingsData = {}
    if (typeof openAiEndpoint === 'string') {
      settings.openAiEndpoint = openAiEndpoint
    }
    if (typeof selectedModel === 'string') {
      settings.selectedModel = selectedModel
    }
    if (typeof defaultModel === 'string') {
      settings.defaultModel = defaultModel
    }
    if (Array.isArray(personas)) {
      settings.personas = personas
    }
    if (typeof defaultPersonaId === 'string') {
      settings.defaultPersonaId = defaultPersonaId
    }
    writeSettings(settings)
    res.json(settings)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// GET /api/personas
router.get('/personas', (_req: Request, res: Response) => {
  try {
    const settings = readSettings()
    res.json(settings.personas || [])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read personas' })
  }
})

// POST /api/personas
router.post('/personas', (req: Request, res: Response) => {
  try {
    const { name, description, systemPrompt } = req.body
    if (!name || !systemPrompt) {
      return res.status(400).json({ error: 'Name and system prompt are required' })
    }
    const settings = readSettings()
    const personas: PersonaData[] = settings.personas || []
    const newPersona: PersonaData = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      systemPrompt,
    }
    personas.push(newPersona)
    settings.personas = personas
    writeSettings(settings)
    res.status(201).json(newPersona)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create persona' })
  }
})

// PUT /api/personas/:id
router.put('/personas/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const { name, description, systemPrompt } = req.body
    if (!name || !systemPrompt) {
      return res.status(400).json({ error: 'Name and system prompt are required' })
    }
    const settings = readSettings()
    const personas: PersonaData[] = settings.personas || []
    const index = personas.findIndex(p => p.id === id)
    if (index === -1) {
      return res.status(404).json({ error: 'Persona not found' })
    }
    personas[index] = { ...personas[index], name, description: description || '', systemPrompt }
    settings.personas = personas
    writeSettings(settings)
    res.json(personas[index])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update persona' })
  }
})

// DELETE /api/personas/:id
router.delete('/personas/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const settings = readSettings()
    let personas: PersonaData[] = settings.personas || []
    const index = personas.findIndex(p => p.id === id)
    if (index === -1) {
      return res.status(404).json({ error: 'Persona not found' })
    }
    const deleted = personas.splice(index, 1)[0]
    settings.personas = personas
    if (settings.defaultPersonaId === id) {
      settings.defaultPersonaId = undefined
    }
    writeSettings(settings)
    res.json(deleted)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete persona' })
  }
})

// POST /api/personas/:id/set-default
router.post('/personas/:id/set-default', (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const settings = readSettings()
    const personas: PersonaData[] = settings.personas || []
    const found = personas.find(p => p.id === id)
    if (!found) {
      return res.status(404).json({ error: 'Persona not found' })
    }
    settings.defaultPersonaId = id as string
    writeSettings(settings)
    res.json({ defaultPersonaId: id })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to set default persona' })
  }
})

// DELETE /api/personas/:id/reset-default
router.delete('/personas/:id/reset-default', (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const settings = readSettings()
    if (settings.defaultPersonaId === id) {
      settings.defaultPersonaId = undefined
      writeSettings(settings)
    }
    res.json({ defaultPersonaId: undefined })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to reset default persona' })
  }
})

export const settingsRouter = router
