import { makeBackup } from './backups.js'
import { readSettings } from '../routes/settings.js'

let scheduledBackupTime: string | null = null
let lastCheckedAt: number = 0
const CHECK_INTERVAL_MS = 3_600_000 // 1 hour
const MAX_SKIP_MS = 28 * 60 * 60 * 1000 // 28 hours — if we haven't checked in this long, force a check

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
 * Check if the scheduled backup time has passed today.
 * Returns true if the backup time for today has passed.
 */
function hasBackupTimePassedToday(parsed: { hour: number; minute: number }): boolean {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const backupTimeToday = new Date(
    todayStart.getTime() + parsed.hour * 60 * 60 * 1000 + parsed.minute * 60 * 1000
  )
  return now >= backupTimeToday
}

/**
 * Start the backup scheduler. This reads the backup time from settings
 * and sets up an hourly check.
 */
export function startBackupScheduler(): void {
  // Load the current backup time from settings
  const settings = readSettings()
  scheduledBackupTime = settings.backupTime || null

  // If no backup time is set, nothing to schedule
  if (!scheduledBackupTime) return

  const parsed = parseTime(scheduledBackupTime)
  if (!parsed) return

  // Check every hour
  const interval = setInterval(() => {
    const now = Date.now()

    // If it's been too long since we last checked (e.g. server was down),
    // always run to avoid skipping the backup entirely
    if (now - lastCheckedAt > MAX_SKIP_MS) {
      console.log(`[Backup Scheduler] Long gap since last check (${Math.round((now - lastCheckedAt) / 3600000)}h), running backup`)
      runBackup(parsed)
      lastCheckedAt = now
      return
    }

    // If the backup time for today has already passed and we've already
    // checked since then, skip — the backup already ran
    if (hasBackupTimePassedToday(parsed) && now - lastCheckedAt > 60 * 60 * 1000) {
      // More than an hour has passed since last check and backup time has
      // passed — we've already run today, skip
      return
    }

    // If the backup time has passed (within the last hour window), run it
    if (hasBackupTimePassedToday(parsed)) {
      runBackup(parsed)
    }

    lastCheckedAt = now
  }, CHECK_INTERVAL_MS)

  // Prevent the scheduler from keeping the process alive
  if (unref) {
    unref(interval)
  }
}

function runBackup(parsed: { hour: number; minute: number }): void {
  console.log(`[Backup Scheduler] Running scheduled backup at ${scheduledBackupTime}`)
  const result = makeBackup()
  if (result.success) {
    console.log(`[Backup Scheduler] Backup completed: ${result.message}`)
  } else {
    console.error(`[Backup Scheduler] Backup failed: ${result.message}`)
  }
}

// Cross-platform unref for timers
const unref = (timer: NodeJS.Timer) => {
  if (typeof (timer as any).unref === 'function') {
    ;(timer as any).unref()
  }
}
