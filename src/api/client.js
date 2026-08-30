const TOKEN_KEY = 'ft.token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore: session stays in memory only */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  // An expired or revoked token should drop you at the login screen rather than
  // showing "Not authenticated" on every card.
  if (response.status === 401 && auth && token) {
    setToken(null)
    window.location.reload()
    throw new ApiError('Session expired', 401)
  }

  if (response.status === 204) return null

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const detail = payload?.detail
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(', ')
      : detail || `Request failed (${response.status})`
    throw new ApiError(message, response.status)
  }
  return payload
}

export const api = {
  registrationOpen: () => request('/auth/registration-open', { auth: false }),
  register: (body) => request('/auth/register', { method: 'POST', body, auth: false }),
  login: (body) => request('/auth/login', { method: 'POST', body, auth: false }),
  me: () => request('/auth/me'),
  updateMe: (body) => request('/auth/me', { method: 'PATCH', body }),

  exercises: () => request('/exercises'),
  createExercise: (body) => request('/exercises', { method: 'POST', body }),
  deleteExercise: (id) => request(`/exercises/${id}`, { method: 'DELETE' }),

  routines: () => request('/routines'),
  routine: (id) => request(`/routines/${id}`),
  createRoutine: (body) => request('/routines', { method: 'POST', body }),
  updateRoutine: (id, body) => request(`/routines/${id}`, { method: 'PUT', body }),
  deleteRoutine: (id) => request(`/routines/${id}`, { method: 'DELETE' }),

  workouts: (params = {}) => request(`/workouts${queryString(params)}`),
  workout: (id) => request(`/workouts/${id}`),
  createWorkout: (body) => request('/workouts', { method: 'POST', body }),
  updateWorkout: (id, body) => request(`/workouts/${id}`, { method: 'PUT', body }),
  deleteWorkout: (id) => request(`/workouts/${id}`, { method: 'DELETE' }),
  prefill: (routineId) => request(`/workouts/prefill${queryString({ routine_id: routineId })}`),

  loggedExercises: () => request('/progress/exercises'),
  series: (params) => request(`/progress/series${queryString(params)}`),
  dashboard: () => request('/progress/dashboard'),
  prs: () => request('/progress/prs'),
}

function queryString(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}
