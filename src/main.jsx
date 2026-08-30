import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ColorModeProvider } from './context/ColorModeContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ColorModeProvider>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </LocalizationProvider>
    </ColorModeProvider>
  </StrictMode>,
)
