// Keep in sync with SESSION_IDLE_MINUTES on the backend
export const IDLE_MINUTES = Number(import.meta.env.VITE_IDLE_MINUTES) || 5

// 0.5 -> "30 seconds", 5 -> "5 minutes"
export function idleLabel() {
  const seconds = Math.round(IDLE_MINUTES * 60)
  if (seconds < 60) return `${seconds} seconds`
  const minutes = Math.round(IDLE_MINUTES)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}
