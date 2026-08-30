import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid2'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'

import EmptyState from '../components/EmptyState'
import StatTile from '../components/StatTile'
import VolumeChart from '../components/VolumeChart'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [routines, setRoutines] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api.dashboard(), api.routines()])
      .then(([dashboard, routineList]) => {
        setStats(dashboard)
        setRoutines(routineList)
      })
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!stats) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (stats.workouts_total === 0) {
    return (
      <EmptyState
        title={`Welcome, ${user.display_name}`}
        description="Log your first workout and your progress charts start filling in."
        actionLabel="Log a workout"
        onAction={() => navigate('/log')}
      />
    )
  }

  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        <Grid size={6}>
          <StatTile
            label="This week"
            value={stats.workouts_this_week}
            caption={stats.workouts_this_week === 1 ? 'workout' : 'workouts'}
          />
        </Grid>
        <Grid size={6}>
          <StatTile label="Sets this week" value={stats.sets_this_week} caption="logged sets" />
        </Grid>
        <Grid size={6}>
          <StatTile
            label="Volume this week"
            value={compact(stats.volume_this_week)}
            caption={`${stats.volume_unit} lifted`}
          />
        </Grid>
        <Grid size={6}>
          <StatTile
            label="Streak"
            value={stats.current_streak_weeks}
            caption={stats.current_streak_weeks === 1 ? 'week' : 'weeks in a row'}
          />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1}>
        <Button variant="contained" fullWidth onClick={() => navigate('/log')}>
          Start workout
        </Button>
        {routines.length > 0 && (
          <Button variant="outlined" fullWidth onClick={() => navigate('/routines')}>
            Routines
          </Button>
        )}
      </Stack>

      {stats.weekly_volume.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle2">Weekly volume</Typography>
            <Typography variant="caption" color="text.secondary">
              Total weight moved per week ({stats.volume_unit})
            </Typography>
            <VolumeChart weeks={stats.weekly_volume} unit={stats.volume_unit} />
          </CardContent>
        </Card>
      )}

      {stats.recent_prs.length > 0 && (
        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <EmojiEventsIcon fontSize="small" color="secondary" />
              <Typography variant="subtitle2">Personal records</Typography>
            </Stack>
            <Stack divider={<Divider flexItem />} spacing={1}>
              {stats.recent_prs.map((pr) => (
                <Stack
                  key={`${pr.exercise_id}-${pr.date}`}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ pt: 0.5 }}
                >
                  <Box>
                    <Typography variant="body2">{pr.exercise_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pr.label} · {dayjs(pr.date).format('MMM D, YYYY')}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={`${pr.value} ${pr.unit}`}
                    variant="outlined"
                    onClick={() => navigate(`/progress?exercise=${pr.exercise_id}`)}
                  />
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}

function compact(value) {
  if (value >= 100000) return `${(value / 1000).toFixed(0)}k`
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
