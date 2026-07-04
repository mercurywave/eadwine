import { Router, Request, Response } from 'express'
import { readSettings } from './settings.js'

const router = Router()

interface OpenAiModel {
  id: string
  object: string
  created: number
  owned_by: string
}

interface OpenAiModelsResponse {
  object: string
  data: OpenAiModel[]
}

// GET /api/models
router.get('/models', async (req: Request, res: Response) => {
  try {
    const settings = readSettings()
    const endpoint = settings.openAiEndpoint

    if (!endpoint) {
      return res.status(400).json({ error: 'OpenAI endpoint not configured' })
    }

    const apiUrl = `${endpoint}/v1/models`
    const fetchResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.text().catch(() => '')
      return res.status(fetchResponse.status).json({
        error: `Failed to fetch models from LLM server: ${fetchResponse.status} - ${errorBody}`,
      })
    }

    const data: OpenAiModelsResponse = await fetchResponse.json()
    // Return just the model IDs as a simple string array
    const modelIds = data.data.map((m) => m.id)
    res.json(modelIds)
  } catch (err: any) {
    console.error('Failed to fetch models:', err)
    res.status(500).json({ error: 'Failed to fetch models from LLM server' })
  }
})

export const modelsRouter = router
