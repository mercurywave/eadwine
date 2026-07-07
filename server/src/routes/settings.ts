import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import { SETTINGS_FILE } from '../config.js'
import { SettingsData, PersonaData, MacroData } from '../types.js'

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
    const { openAiEndpoint, selectedModel, defaultModel, personas, defaultPersonaId, structureGuidelines, macros } = req.body
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
    if (typeof structureGuidelines === 'string') {
      settings.structureGuidelines = structureGuidelines
    }
    if (Array.isArray(macros)) {
      settings.macros = macros
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

// ── Macros ─────────────────────────────────────────────────────────────

// GET /api/macros
router.get('/macros', (_req: Request, res: Response) => {
  try {
    const settings = readSettings()
    res.json(settings.macros || [])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to read macros' })
  }
})

// POST /api/macros
router.post('/macros', (req: Request, res: Response) => {
  try {
    const { name, prompt } = req.body
    if (!name || !prompt) {
      return res.status(400).json({ error: 'Name and prompt are required' })
    }
    const settings = readSettings()
    const macros: MacroData[] = settings.macros || []
    const newMacro: MacroData = {
      id: crypto.randomUUID(),
      name,
      prompt,
    }
    macros.push(newMacro)
    settings.macros = macros
    writeSettings(settings)
    res.status(201).json(newMacro)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create macro' })
  }
})

// PUT /api/macros/:id
router.put('/macros/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const { name, prompt } = req.body
    if (!name || !prompt) {
      return res.status(400).json({ error: 'Name and prompt are required' })
    }
    const settings = readSettings()
    const macros: MacroData[] = settings.macros || []
    const index = macros.findIndex(m => m.id === id)
    if (index === -1) {
      return res.status(404).json({ error: 'Macro not found' })
    }
    macros[index] = { ...macros[index], name, prompt }
    settings.macros = macros
    writeSettings(settings)
    res.json(macros[index])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update macro' })
  }
})

// DELETE /api/macros/:id
router.delete('/macros/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id
    const settings = readSettings()
    let macros: MacroData[] = settings.macros || []
    const index = macros.findIndex(m => m.id === id)
    if (index === -1) {
      return res.status(404).json({ error: 'Macro not found' })
    }
    const deleted = macros.splice(index, 1)[0]
    settings.macros = macros
    writeSettings(settings)
    res.json(deleted)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete macro' })
  }
})

export const settingsRouter = router
