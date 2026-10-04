// Where the team server lives and how often everything runs. Task 12 sets the deployed URL.
export const DEFAULT_SERVER = 'https://team-pulse.astrovinh.workers.dev'

export const HEARTBEAT_MS = 60_000
export const READ_MS = 30_000
export const OFFLINE_AFTER_MS = 150_000
export const IDLE_AFTER_MS = 10 * 60_000
export const LINE_EVERY_MS = 10 * 60_000
export const WINDOW_MS = 12 * 3_600_000
export const TIMEOUT_MS = 5_000
export const MAX_BACKOFF_MS = 5 * 60_000
export const PANE = 'team'
export const COMMAND = 'team'
