import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import { SETTINGS_FILE } from '../config.js'
import { SettingsData } from '../types.js'

function readSettings(): SettingsData {
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
    const { openAiEndpoint } = req.body
    const settings: SettingsData = {}
    if (typeof openAiEndpoint === 'string') {
      settings.openAiEndpoint = openAiEndpoint
    }
    writeSettings(settings)
    res.json(settings)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

export const settingsRouter = router
