import { makeBackup } from './backups.js'
import { readSettings } from '../routes/settings.js'

let scheduledTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Parse a "HH:MM" time string into hours and minutes.
 */
function parseTime(time: string): { hour: number; minute: number } | null {
  const match = time.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null
  const hour = parseInt(match[1], 10)
  const minute = parseInt(match[2], 10)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

/**
 * Calculate the ms until the next occurrence of the given time today or tomorrow.
 */
function msUntilTarget(parsed: { hour: number; minute: number }): number {
  const now = new Date()
  const target = new Date(now)
  target.setHours(parsed.hour, parsed.minute, 0, 0)

  // If the target time today has already passed, schedule for tomorrow
  if (now >= target) {
    target.setDate(target.getDate() + 1)
  }

  return target.getTime() - now.getTime()
}

/**
 * Check if today's backup was supposed to run but was missed (e.g. server was down).
 * If so, run it once immediately.
 */
function checkMissedBackup(parsed: { hour: number; minute: number }): void {
  const now = new Date()
  const target = new Date(now)
  target.setHours(parsed.hour, parsed.minute, 0, 0)

  // If target is today and hasn't passed yet, nothing to catch up on
  if (now < target) return

  // If target is in the future (already scheduled for tomorrow), nothing to catch up on
  // (this shouldn't happen given the caller logic, but be safe)
  if (target > now) return

  console.log(`[Backup Scheduler] Missed backup for ${target.toLocaleString()}, running now`)
  runBackup(parsed)
}

/**
 * Run a backup and log the result.
 */
function runBackup(parsed: { hour: number; minute: number }): void {
  console.log(`[Backup Scheduler] Running scheduled backup at ${parsed.hour}:${String(parsed.minute).padStart(2, '0')}`)
  const result = makeBackup()
  if (result.success) {
    console.log(`[Backup Scheduler] Backup completed: ${result.message}`)
  } else {
    console.error(`[Backup Scheduler] Backup failed: ${result.message}`)
  }
}

/**
 * Schedule the next backup. This is the core loop:
 * 1. Read settings for the backup time
 * 2. Check for any missed backup (server was down)
 * 3. Sleep until the next target time
 * 4. Run the backup
 * 5. Repeat
 */
export function scheduleNextBackup(): void {
  const settings = readSettings()
  const time = settings.backupTime

  // If no backup time is set, do nothing
  if (!time) return

  const parsed = parseTime(time)
  if (!parsed) return

  // Check for a missed backup (e.g. server was down and missed today's time)
  checkMissedBackup(parsed)

  const delay = msUntilTarget(parsed)

  console.log(`[Backup Scheduler] Next backup scheduled in ${Math.round(delay / 60000)} minutes`)

  const timeout = setTimeout(() => {
    runBackup(parsed)
    scheduleNextBackup() // Reschedule for the next day
  }, delay)

  // Allow the process to exit without waiting for this timer
  if (typeof (timeout as any).unref === 'function') {
    (timeout as any).unref()
  }

  scheduledTimeout = timeout
}

/**
 * Stop any currently scheduled backup. Called when settings change
 * or when the server is shutting down.
 */
export function stopBackupScheduler(): void {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout)
    scheduledTimeout = null
  }
}

/**
 * Start the backup scheduler. Reads the current backup time from settings
 * and begins scheduling.
 */
export function startBackupScheduler(): void {
  stopBackupScheduler() // Clean up any existing scheduler
  scheduleNextBackup()
}
