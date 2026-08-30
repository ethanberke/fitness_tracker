import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useNavigate, useParams } from 'react-router-dom'

import ExercisePicker from '../components/ExercisePicker'
import NumberField from '../components/NumberField'
import { api } from '../api/client'

export default function RoutineEditor() {
  const { routineId } = useParams()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [exercises, setExercises] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setExercises(await api.exercises())
        if (routineId) {
          const routine = await api.routine(routineId)
          setName(routine.name)
          setNotes(routine.notes ?? '')
          setItems(
            routine.items.map((item) => ({
              exercise_id: item.exercise_id,
              name: item.exercise.name,
              target_sets: item.target_sets,
              target_reps: item.target_reps ?? '',
            })),
          )
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [routineId])

  const move = (index, direction) => {
    setItems((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const save = async () => {
    setError(null)
    try {
      const payload = {
        name,
        notes: notes || null,
        items: items.map((item) => ({
          exercise_id: item.exercise_id,
          target_sets: Number(item.target_sets) || 3,
          target_reps: item.target_reps === '' ? null : Number(item.target_reps),
        })),
      }
      if (routineId) await api.updateRoutine(routineId, payload)
      else await api.createRoutine(payload)
      navigate('/routines')
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async () => {
    await api.deleteRoutine(routineId)
    navigate('/routines')
  }

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="Routine name"
        placeholder="Pull day"
        value={name}
        onChange={(event) => setName(event.target.value)}
        fullWidth
      />

      {items.map((item, index) => (
        <Card key={`${item.exercise_id}-${index}`}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">{item.name}</Typography>
              <Stack direction="row">
                <IconButton size="small" aria-label="Move up" onClick={() => move(index, -1)}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label="Move down" onClick={() => move(index, 1)}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => setItems(items.filter((_entry, i) => i !== index))}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
              <NumberField
                label="Sets"
                value={item.target_sets}
                min={1}
                onChange={(value) =>
                  setItems(items.map((entry, i) => (i === index ? { ...entry, target_sets: value } : entry)))
                }
              />
              <NumberField
                label="Reps"
                value={item.target_reps}
                onChange={(value) =>
                  setItems(items.map((entry, i) => (i === index ? { ...entry, target_reps: value } : entry)))
                }
              />
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setPickerOpen(true)}>
        Add exercise
      </Button>

      <TextField
        label="Notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        multiline
        minRows={2}
        fullWidth
      />

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={save}
          disabled={!name.trim() || items.length === 0}
        >
          Save routine
        </Button>
        {routineId && (
          <Button color="error" variant="outlined" size="large" onClick={remove}>
            Delete
          </Button>
        )}
      </Stack>

      <ExercisePicker
        open={pickerOpen}
        exercises={exercises}
        onClose={() => setPickerOpen(false)}
        onPick={(exercise) =>
          setItems((current) => [
            ...current,
            { exercise_id: exercise.id, name: exercise.name, target_sets: 3, target_reps: '' },
          ])
        }
        onCreated={(exercise) => setExercises((current) => [...current, exercise])}
      />
    </Stack>
  )
}
