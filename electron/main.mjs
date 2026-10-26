import { app, BrowserWindow, Menu, globalShortcut } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const iconPath = path.join(appRoot, 'client', 'public', 'eadwine.svg')
const isDevelopment = process.env.EADWINE_ELECTRON_DEV === '1'
const developmentServerUrl = process.env.EADWINE_DEV_SERVER_URL

let mainWindow
let backendServer
let apiPort

async function startBackend() {
  if (isDevelopment) {
    return
  }

  process.env.CONTENT_DIR = path.join(app.getPath('documents'), 'Eadwine')
  process.env.APP_DATA_DIR = path.join(app.getPath('appData'), 'Eadwine')
  process.env.PORT = '0'
  process.env.NODE_ENV = isDevelopment ? 'development' : 'production'

  if (!isDevelopment) {
    process.env.CLIENT_DIST_DIR = path.join(appRoot, 'client', 'dist')
  }

  const serverModulePath = path.join(appRoot, 'server', 'dist', 'index.js')
  const { startServer } = await import(pathToFileURL(serverModulePath).href)
  backendServer = startServer()

  await new Promise((resolve, reject) => {
    backendServer.once('listening', resolve)
    backendServer.once('error', reject)
  })

  const address = backendServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('The embedded API server did not expose a TCP port.')
  }

  apiPort = address.port
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  // Open DevTools automatically in development mode
  if (isDevelopment) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.openDevTools()
    })
  }

  mainWindow.loadURL(isDevelopment
    ? developmentServerUrl
    : `http://127.0.0.1:${apiPort}`)
}

app.whenReady().then(async () => {
  try {
    Menu.setApplicationMenu(null)
    if (isDevelopment && !developmentServerUrl) {
      throw new Error('EADWINE_DEV_SERVER_URL is required in development mode.')
    }
    await startBackend()
    await createWindow()

    // Register F12 to toggle DevTools
    globalShortcut.register('F12', () => {
      console.log('F12 pressed, toggling DevTools')
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.toggleDevTools()
      }
    })
  } catch (error) {
    console.error('Unable to start Eadwine:', error)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})

app.on('before-quit', () => {
  backendServer?.close()
})
