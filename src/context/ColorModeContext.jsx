import { createContext, useContext, useMemo, useState } from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import useMediaQuery from '@mui/material/useMediaQuery'
import { ThemeProvider } from '@mui/material/styles'

import { buildTheme } from '../theme'

const ColorModeContext = createContext(null)
const STORAGE_KEY = 'ft.colorMode'

export function ColorModeProvider({ children }) {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [preference, setPreference] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system'
    } catch {
      return 'system'
    }
  })

  const mode = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
  const theme = useMemo(() => buildTheme(mode), [mode])

  const value = useMemo(
    () => ({
      preference,
      mode,
      setPreference: (next) => {
        setPreference(next)
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          /* private mode: the choice just won't persist */
        }
      },
    }),
    [preference, mode],
  )

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

export const useColorMode = () => useContext(ColorModeContext)
