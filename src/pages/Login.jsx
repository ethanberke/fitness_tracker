import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'

import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [canRegister, setCanRegister] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', display_name: '', unit: 'lb' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .registrationOpen()
      .then((result) => setCanRegister(result.open))
      .catch(() => setCanRegister(false))
  }, [])

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <FitnessCenterIcon color="primary" />
            <Typography variant="h6">Fitness Tracker</Typography>
          </Stack>

          <form onSubmit={submit}>
            <Stack spacing={2}>
              {mode === 'register' && (
                <TextField
                  label="Name"
                  value={form.display_name}
                  onChange={update('display_name')}
                  required
                  fullWidth
                />
              )}
              <TextField
                label="Email"
                type="email"
                autoComplete="username"
                value={form.email}
                onChange={update('email')}
                required
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={update('password')}
                required
                fullWidth
                helperText={mode === 'register' ? 'At least 8 characters' : undefined}
              />
              {mode === 'register' && (
                <TextField select label="Units" value={form.unit} onChange={update('unit')} fullWidth>
                  <MenuItem value="lb">Pounds / miles</MenuItem>
                  <MenuItem value="kg">Kilograms / kilometers</MenuItem>
                </TextField>
              )}

              {error && <Alert severity="error">{error}</Alert>}

              <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth>
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>

              {canRegister && (
                <Button
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login')
                    setError(null)
                  }}
                  size="small"
                >
                  {mode === 'login' ? 'Create an account' : 'I already have an account'}
                </Button>
              )}
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
