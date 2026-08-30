import { Navigate, Route, Routes } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

import AppShell from './components/AppShell'
import { useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import LogWorkout from './pages/LogWorkout'
import Login from './pages/Login'
import Progress from './pages/Progress'
import RoutineEditor from './pages/RoutineEditor'
import Routines from './pages/Routines'
import Settings from './pages/Settings'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/log" element={<LogWorkout />} />
        <Route path="/log/:workoutId" element={<LogWorkout />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/routines" element={<Routines />} />
        <Route path="/routines/new" element={<RoutineEditor />} />
        <Route path="/routines/:routineId" element={<RoutineEditor />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
