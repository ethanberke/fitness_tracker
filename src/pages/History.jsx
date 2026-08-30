import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'

import EmptyState from '../components/EmptyState'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function History() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [workouts, setWorkouts] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .workouts({ limit: 100 })
      .then(setWorkouts)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!workouts) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (workouts.length === 0) {
    return (
      <EmptyState
        title="No workouts logged"
        description="Everything you log shows up here, newest first."
        actionLabel="Log a workout"
        onAction={() => navigate('/log')}
      />
    )
  }

  return (
    <Stack spacing={1.5}>
      {workouts.map((workout) => (
        <Card key={workout.id}>
          <CardActionArea onClick={() => navigate(`/log/${workout.id}`)}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="subtitle2">
                  {workout.name || dayjs(workout.date).format('dddd')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(workout.date).format('MMM D, YYYY')}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {workout.set_count} sets · {workout.total_volume.toLocaleString()} {user.unit} volume
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {workout.exercise_names.slice(0, 5).map((name) => (
                  <Chip key={name} size="small" label={name} variant="outlined" />
                ))}
                {workout.exercise_names.length > 5 && (
                  <Chip size="small" variant="outlined" label={`+${workout.exercise_names.length - 5}`} />
                )}
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  )
}
