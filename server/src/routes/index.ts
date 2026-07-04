import { Express, Request, Response, NextFunction } from 'express'
import { projectsRouter } from './projects.js'
import { filesRouter } from './files.js'
import { settingsRouter } from './settings.js'
import { chatsRouter } from './chats.js'
import { modelsRouter } from './models.js'

export function mountRoutes(app: Express): void {
  app.use('/api/projects', projectsRouter)
  app.use('/api/projects', filesRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/projects', chatsRouter)
  app.use('/api', modelsRouter)
}

export function mountErrorHandler(app: Express): void {
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err)
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      res.status(500).json({ error: 'Permission denied' })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
}
