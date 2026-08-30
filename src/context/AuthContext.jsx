import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { api, setToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const finishAuth = useCallback((response) => {
    setToken(response.access_token)
    setUser(response.user)
    return response.user
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (email, password) => finishAuth(await api.login({ email, password })),
      register: async (payload) => finishAuth(await api.register(payload)),
      logout: () => {
        setToken(null)
        setUser(null)
      },
      refresh: async () => setUser(await api.me()),
      updateUser: setUser,
    }),
    [user, loading, finishAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
