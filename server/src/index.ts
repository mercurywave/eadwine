import express, { Request, Response as ExpressResponse } from 'express'
import type { Server } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { mountRoutes, mountErrorHandler } from './routes/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = Number(process.env.PORT ?? 0)

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
  const clientDist = process.env.CLIENT_DIST_DIR || path.resolve(__dirname, '../../client/dist')
  app.use(express.static(clientDist))

  // Catch-all: serve index.html for SPA routing
  app.get('*', (_req: Request, res: ExpressResponse) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

export function startServer(port = Number(PORT)): Server {
  const server = app.listen(port, '127.0.0.1', () => {
    const address = server.address()
    if (address && typeof address !== 'string') {
      console.log(`Server running on http://127.0.0.1:${address.port}`)
    }
  })

  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer()
}
