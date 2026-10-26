import os from 'os'
import path from 'path'
import fs from 'fs'

const homeDir = process.env.USERPROFILE || os.homedir()
const documentsDir = process.platform === 'win32'
  ? path.join(homeDir, 'Documents')
  : path.join(homeDir, 'Documents')
const appDataDir = process.env.APPDATA || (process.platform === 'darwin'
  ? path.join(homeDir, 'Library', 'Application Support')
  : path.join(homeDir, '.config'))

const CONTENT_DIR = process.env.CONTENT_DIR || path.join(documentsDir, 'Eadwine')
const APP_DATA_DIR = process.env.APP_DATA_DIR || path.join(appDataDir, 'Eadwine')
const PROJECTS_ROOT = CONTENT_DIR
const PROJECT_METADATA_ROOT = path.join(APP_DATA_DIR, 'projects')
const SETTINGS_FILE = path.join(APP_DATA_DIR, 'settings.json')

if (!fs.existsSync(PROJECTS_ROOT)) {
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true })
}

if (!fs.existsSync(PROJECT_METADATA_ROOT)) {
  fs.mkdirSync(PROJECT_METADATA_ROOT, { recursive: true })
}

export { CONTENT_DIR, APP_DATA_DIR, PROJECTS_ROOT, PROJECT_METADATA_ROOT, SETTINGS_FILE }
