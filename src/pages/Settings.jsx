import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import DownloadIcon from '@mui/icons-material/Download'

import { api, getToken } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useColorMode } from '../context/ColorModeContext'

export default function Settings() {
  const { user, updateUser, logout } = useAuth()
  const { preference, setPreference } = useColorMode()
  const [displayName, setDisplayName] = useState(user.display_name)
  const [unit, setUnit] = useState(user.unit)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const saveProfile = async () => {
    setError(null)
    setMessage(null)
    try {
      const updated = await api.updateMe({
        display_name: displayName,
        unit,
        ...(password ? { password } : {}),
      })
      updateUser(updated)
      setPassword('')
      setMessage('Saved')
    } catch (err) {
      setError(err.message)
    }
  }

  const exportCsv = async () => {
    const response = await fetch('/api/progress/export.csv', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fitness-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Profile
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              fullWidth
            />
            <TextField label="Email" value={user.email} disabled fullWidth />
            <TextField
              select
              label="Units"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              helperText="Existing workouts are converted, not rewritten"
              fullWidth
            >
              <MenuItem value="lb">Pounds / miles</MenuItem>
              <MenuItem value="kg">Kilograms / kilometers</MenuItem>
            </TextField>
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText="Leave blank to keep your current password"
              fullWidth
            />
            <Button variant="contained" onClick={saveProfile}>
              Save
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Appearance
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={preference}
            onChange={(_event, value) => value && setPreference(value)}
          >
            <ToggleButton value="light">Light</ToggleButton>
            <ToggleButton value="system">System</ToggleButton>
            <ToggleButton value="dark">Dark</ToggleButton>
          </ToggleButtonGroup>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Your data
          </Typography>
          <Stack spacing={1}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>
              Export all sets as CSV
            </Button>
            <Button color="error" onClick={logout}>
              Sign out
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
