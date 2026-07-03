import express, { Request, Response as ExpressResponse } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { mountRoutes, mountErrorHandler } from './routes/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3003

app.use(express.json())

// Health check
app.get('/api/health', (_req: Request, res: ExpressResponse) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Mount all API route routers
mountRoutes(app)

// Mount error handler
mountErrorHandler(app)

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist')
  app.use(express.static(clientDist))

  // Catch-all: serve index.html for SPA routing
  app.get('*', (_req: Request, res: ExpressResponse) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
