import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { DATA_DIR } from '../config.js'

/**
 * Check if the `git` CLI is available on the system.
 */
export function gitAvailable(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Initialize a git repository at DATA_DIR if one doesn't already exist.
 * Returns true if a new repo was created, false if one already existed.
 */
export function initGitRepo(): boolean {
  const gitDir = path.join(DATA_DIR, '.git')
  if (fs.existsSync(gitDir)) {
    return false
  }
  execSync('git init', { cwd: DATA_DIR, stdio: 'ignore' })
  // Create a .gitignore to exclude non-essential files
  const gitignorePath = path.join(DATA_DIR, '.gitignore')
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(
      gitignorePath,
      'node_modules/\nprojects/*/chats/\nprojects/*/chats/logs/\n',
      'utf-8'
    )
  }
  return true
}

/**
 * Perform a git commit of all changes in the server data directory.
 * Returns the result object.
 */
export function makeBackup(): {
  success: boolean
  timestamp?: string
  message: string
  error?: string
} {
  if (!gitAvailable()) {
    return { success: false, message: 'Git is not installed', error: 'git-not-found' }
  }

  try {
    // Initialize if needed
    const isNew = initGitRepo()
    if (isNew) {
      // First backup needs an initial commit
      execSync('git add .', { cwd: DATA_DIR, stdio: 'ignore' })
      execSync("git -c user.name='eadwine' -c user.email='eadwine@local' commit -m 'Initial backup'", {
        cwd: DATA_DIR,
        stdio: 'ignore',
      })
      const timestamp = new Date().toISOString()
      return { success: true, timestamp, message: 'Initial backup created' }
    }

    // Check if there are any changes (tracked or untracked)
    const statusResult = execSync('git status --porcelain', {
      cwd: DATA_DIR,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()

    if (!statusResult) {
      return { success: true, message: 'No changes to backup' }
    }

    // Stage and commit
    execSync('git add .', { cwd: DATA_DIR, stdio: 'ignore' })
    const timestamp = new Date().toISOString()
    execSync(
      `git -c user.name='eadwine' -c user.email='eadwine@local' commit -m "Auto-backup: ${timestamp}"`,
      { cwd: DATA_DIR, stdio: 'ignore' }
    )

    return { success: true, timestamp, message: 'Backup created' }
  } catch (err: any) {
    const message = err?.message || 'Backup failed'
    console.error('[Backup] Error:', message)
    return { success: false, message, error: 'backup-failed' }
  }
}

/**
 * Get information about the last git commit.
 * Returns the timestamp and commit message, or null if no commits exist.
 */
export function getLastCommitInfo(): { timestamp: string; message: string } | null {
  if (!gitAvailable()) {
    return null
  }

  try {
    const gitDir = path.join(DATA_DIR, '.git')
    if (!fs.existsSync(gitDir)) {
      return null
    }

    const timestamp = execSync('git log -1 --format=%ci', {
      cwd: DATA_DIR,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()

    const message = execSync('git log -1 --format=%s', {
      cwd: DATA_DIR,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()

    return { timestamp, message }
  } catch {
    return null
  }
}
