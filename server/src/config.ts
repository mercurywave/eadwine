import path from 'path'
import fs from 'fs'

const DATA_DIR = (() => {
  const env = process.env.DATA_DIR
  if (!env) {
    return path.resolve(process.cwd(), 'server-data')
  }
  if (/^[A-Z]:/i.test(env) || env.startsWith('\\\\')) {
    return env
  }
  return path.resolve(process.cwd(), env)
})()

const PROJECTS_ROOT = path.join(DATA_DIR, 'projects')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

if (!fs.existsSync(PROJECTS_ROOT)) {
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true })
}

export { DATA_DIR, PROJECTS_ROOT, SETTINGS_FILE }
