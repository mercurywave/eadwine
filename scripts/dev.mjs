import net from 'node:net'
import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const useElectron = process.argv.includes('--electron')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const processes = []
const execFileAsync = promisify(execFile)

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        if (!address || typeof address === 'string') {
          reject(new Error('Unable to allocate a TCP port.'))
          return
        }

        resolve(address.port)
      })
    })
  })
}

function run(args, environment) {
  const child = spawn(npmCommand, args, {
    env: { ...process.env, ...environment },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  processes.push(child)
  return child
}

async function getDocumentsDirectory() {
  if (process.platform !== 'win32') {
    return path.join(os.homedir(), 'Documents')
  }

  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '[Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments)',
  ])
  return stdout.trim()
}

function stopChildren() {
  for (const child of processes) {
    if (!child.killed) {
      child.kill()
    }
  }
}

async function waitForServer(url) {
  for (;;) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // The Vite server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

async function main() {
  const apiPort = await findAvailablePort()
  let clientPort = await findAvailablePort()
  while (clientPort === apiPort) {
    clientPort = await findAvailablePort()
  }
  const clientUrl = `http://127.0.0.1:${clientPort}`
  const contentDirectory = path.join(await getDocumentsDirectory(), 'Eadwine')

  console.log(`Starting API on port ${apiPort} and Vite on port ${clientPort}.`)
  const server = run(['run', 'dev', '--workspace=server'], {
    PORT: String(apiPort),
    CONTENT_DIR: contentDirectory,
  })
  const client = run(['run', 'dev', '--workspace=client'], {
    VITE_API_PORT: String(apiPort),
    VITE_DEV_PORT: String(clientPort),
  })

  server.once('exit', (code) => {
    if (code !== 0) {
      stopChildren()
      process.exitCode = code ?? 1
    }
  })
  client.once('exit', (code) => {
    if (code !== 0) {
      stopChildren()
      process.exitCode = code ?? 1
    }
  })

  if (useElectron) {
    await waitForServer(clientUrl)
    run(['run', 'electron:dev'], { EADWINE_DEV_SERVER_URL: clientUrl })
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopChildren()
    process.exit()
  })
}

main().catch((error) => {
  console.error(error)
  stopChildren()
  process.exitCode = 1
})