/** mm:ss / h:mm:ss ↔ seconds, for cardio duration entry. */

export function clockToSeconds(value) {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const parts = trimmed.split(':').map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 1) return Math.round(parts[0] * 60) // bare minutes
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

export function secondsToClock(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return ''
  const total = Number(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}
