import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { useNavigate } from 'react-router-dom'

import EmptyState from '../components/EmptyState'
import { api } from '../api/client'

export default function Routines() {
  const navigate = useNavigate()
  const [routines, setRoutines] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.routines().then(setRoutines).catch((err) => setError(err.message))
  }, [])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!routines) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (routines.length === 0) {
    return (
      <EmptyState
        title="No routines yet"
        description="Save your usual push and pull days so logging is just numbers."
        actionLabel="Create a routine"
        onAction={() => navigate('/routines/new')}
      />
    )
  }

  return (
    <Stack spacing={2}>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/routines/new')}>
        New routine
      </Button>

      {routines.map((routine) => (
        <Card key={routine.id}>
          <CardActionArea onClick={() => navigate(`/routines/${routine.id}`)}>
            <CardContent>
              <Typography variant="subtitle2">{routine.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {routine.items.length} exercises ·{' '}
                {routine.items.reduce((total, item) => total + item.target_sets, 0)} sets
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {routine.items.slice(0, 6).map((item) => (
                  <Chip key={item.id} size="small" label={item.exercise.name} variant="outlined" />
                ))}
                {routine.items.length > 6 && (
                  <Chip size="small" label={`+${routine.items.length - 6}`} variant="outlined" />
                )}
              </Stack>
            </CardContent>
          </CardActionArea>
          <Box sx={{ px: 2, pb: 2 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate(`/log?routine=${routine.id}`)}
            >
              Start this workout
            </Button>
          </Box>
        </Card>
      ))}
    </Stack>
  )
}
