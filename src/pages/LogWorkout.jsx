import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import ExercisePicker from '../components/ExercisePicker'
import NumberField from '../components/NumberField'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

let keyCounter = 0
const nextKey = () => `entry-${keyCounter++}`

const blankSet = (modality) =>
  modality === 'cardio'
    ? { distance: '', duration: '' }
    : modality === 'bodyweight'
      ? { reps: '' }
      : { weight: '', reps: '' }

export default function LogWorkout() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [date, setDate] = useState(dayjs())
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [routineId, setRoutineId] = useState('')
  const [entries, setEntries] = useState([])
  const [routines, setRoutines] = useState([])
  const [exercises, setExercises] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [routineList, exerciseList] = await Promise.all([api.routines(), api.exercises()])
        setRoutines(routineList)
        setExercises(exerciseList)

        const routineParam = Number(searchParams.get('routine'))
        if (!workoutId && routineParam) {
          const routine = routineList.find((r) => r.id === routineParam)
          setRoutineId(routineParam)
          if (routine) setName(routine.name)
          setEntries(entriesFromTemplate(await api.prefill(routineParam)))
        }

        if (workoutId) {
          const workout = await api.workout(workoutId)
          setDate(dayjs(workout.date))
          setName(workout.name ?? '')
          setNotes(workout.notes ?? '')
          setRoutineId(workout.routine_id ?? '')
          setEntries(entriesFromWorkout(workout))
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    // Re-running on searchParams identity would clobber in-progress edits.
  }, [workoutId]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyRoutine = async (id) => {
    setRoutineId(id)
    if (!id) return
    const routine = routines.find((r) => r.id === id)
    if (routine && !name) setName(routine.name)
    try {
      const template = await api.prefill(id)
      setEntries(entriesFromTemplate(template))
    } catch (err) {
      setError(err.message)
    }
  }

  const addExercise = (exercise) => {
    setEntries((current) => [
      ...current,
      {
        key: nextKey(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        modality: exercise.modality,
        lastSets: [],
        sets: [blankSet(exercise.modality)],
      },
    ])
  }

  const updateSet = (entryKey, index, field, value) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.key !== entryKey
          ? entry
          : {
              ...entry,
              sets: entry.sets.map((set, i) => (i === index ? { ...set, [field]: value } : set)),
            },
      ),
    )
  }

  const addSet = (entryKey) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.key !== entryKey
          ? entry
          : {
              ...entry,
              // A new set almost always repeats the previous one.
              sets: [...entry.sets, { ...(entry.sets.at(-1) ?? blankSet(entry.modality)) }],
            },
      ),
    )
  }

  const removeSet = (entryKey, index) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.key !== entryKey
          ? entry
          : { ...entry, sets: entry.sets.filter((_set, i) => i !== index) },
      ),
    )
  }

  const removeEntry = (entryKey) =>
    setEntries((current) => current.filter((entry) => entry.key !== entryKey))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        date: date.format('YYYY-MM-DD'),
        name: name || null,
        routine_id: routineId || null,
        notes: notes || null,
        sets: buildPayloadSets(entries),
      }
      if (payload.sets.length === 0) {
        setError('Add at least one set with numbers in it.')
        setSaving(false)
        return
      }
      if (workoutId) await api.updateWorkout(workoutId, payload)
      else await api.createWorkout(payload)
      setToast('Workout saved')
      navigate('/history')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!workoutId) return
    await api.deleteWorkout(workoutId)
    navigate('/history')
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

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <DatePicker
                label="Date"
                value={date}
                onChange={(value) => value && setDate(value)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
              <TextField
                label="Name"
                placeholder="Push day"
                value={name}
                onChange={(event) => setName(event.target.value)}
                fullWidth
              />
            </Stack>

            {!workoutId && (
              <TextField
                select
                label="Start from routine"
                value={routineId}
                onChange={(event) => applyRoutine(event.target.value)}
                fullWidth
                helperText={
                  routines.length ? 'Fills in exercises and last session’s numbers' : 'No routines yet'
                }
                disabled={routines.length === 0}
              >
                <MenuItem value="">None</MenuItem>
                {routines.map((routine) => (
                  <MenuItem key={routine.id} value={routine.id}>
                    {routine.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </CardContent>
      </Card>

      {entries.map((entry) => (
        <Card key={entry.key}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">{entry.exerciseName}</Typography>
              <IconButton
                size="small"
                aria-label={`Remove ${entry.exerciseName}`}
                onClick={() => removeEntry(entry.key)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
            {entry.lastSets?.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Last time: {summariseLast(entry.lastSets, entry.modality, user.unit)}
              </Typography>
            )}

            <Stack spacing={1.5} divider={<Divider flexItem />} sx={{ mt: 1.5 }}>
              {entry.sets.map((set, index) => (
                <Stack
                  key={index}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="caption" color="text.secondary" sx={{ width: 24 }}>
                    {index + 1}
                  </Typography>

                  {entry.modality === 'cardio' ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <NumberField
                        label={user.unit === 'lb' ? 'Miles' : 'Km'}
                        value={set.distance}
                        step={0.25}
                        onChange={(value) => updateSet(entry.key, index, 'distance', value)}
                      />
                      <TextField
                        label="Time"
                        placeholder="28:30"
                        value={set.duration}
                        onChange={(event) =>
                          updateSet(entry.key, index, 'duration', event.target.value)
                        }
                        inputProps={{ inputMode: 'numeric', style: { textAlign: 'center' } }}
                        sx={{ width: 92 }}
                      />
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {entry.modality === 'strength' && (
                        <NumberField
                          label={user.unit}
                          value={set.weight}
                          step={5}
                          onChange={(value) => updateSet(entry.key, index, 'weight', value)}
                        />
                      )}
                      <NumberField
                        label="Reps"
                        value={set.reps}
                        step={1}
                        onChange={(value) => updateSet(entry.key, index, 'reps', value)}
                      />
                    </Stack>
                  )}

                  <IconButton
                    size="small"
                    aria-label={`Remove set ${index + 1}`}
                    onClick={() => removeSet(entry.key, index)}
                    disabled={entry.sets.length === 1}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>

            <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => addSet(entry.key)}>
              Add set
            </Button>
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
        <Button variant="contained" size="large" fullWidth onClick={save} disabled={saving}>
          {workoutId ? 'Save changes' : 'Save workout'}
        </Button>
        {workoutId && (
          <Button color="error" variant="outlined" size="large" onClick={remove}>
            Delete
          </Button>
        )}
      </Stack>

      <ExercisePicker
        open={pickerOpen}
        exercises={exercises}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        onCreated={(exercise) => setExercises((current) => [...current, exercise])}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Stack>
  )
}

function entriesFromWorkout(workout) {
  const byExercise = new Map()
  for (const set of workout.sets) {
    if (!byExercise.has(set.exercise_id)) {
      byExercise.set(set.exercise_id, {
        key: nextKey(),
        exerciseId: set.exercise_id,
        exerciseName: set.exercise_name,
        modality: set.modality,
        lastSets: [],
        sets: [],
      })
    }
    byExercise.get(set.exercise_id).sets.push({
      weight: set.weight ?? '',
      reps: set.reps ?? '',
      distance: set.distance ?? '',
      duration: secondsToClock(set.duration_s),
    })
  }
  return [...byExercise.values()]
}

function entriesFromTemplate(template) {
  return template.map((item) => ({
    key: nextKey(),
    exerciseId: item.exercise_id,
    exerciseName: item.exercise_name,
    modality: item.modality,
    lastSets: item.last_sets,
    // Start from last session's numbers — most sets repeat, and the ones that
    // change are a tap away.
    sets: buildSetsFromLast(item),
  }))
}

function buildSetsFromLast(item) {
  const count = item.target_sets || item.last_sets.length || 1
  return Array.from({ length: count }, (_unused, index) => {
    const previous = item.last_sets[index] ?? item.last_sets.at(-1)
    if (item.modality === 'cardio') {
      return {
        distance: previous?.distance ?? '',
        duration: secondsToClock(previous?.duration_s),
      }
    }
    const reps = previous?.reps ?? item.target_reps ?? ''
    if (item.modality === 'bodyweight') return { reps: String(reps ?? '') }
    return { weight: previous?.weight ?? '', reps: String(reps ?? '') }
  })
}

function buildPayloadSets(entries) {
  const payload = []
  for (const entry of entries) {
    entry.sets.forEach((set, index) => {
      const weight = toNumber(set.weight)
      const reps = toNumber(set.reps)
      const distance = toNumber(set.distance)
      const duration = clockToSeconds(set.duration)

      const hasData =
        entry.modality === 'cardio' ? distance !== null || duration !== null : reps !== null
      if (!hasData) return

      payload.push({
        exercise_id: entry.exerciseId,
        set_number: index + 1,
        weight: entry.modality === 'strength' ? weight : null,
        reps: entry.modality === 'cardio' ? null : reps,
        distance: entry.modality === 'cardio' ? distance : null,
        duration_s: entry.modality === 'cardio' ? duration : null,
      })
    })
  }
  return payload
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function clockToSeconds(value) {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const parts = trimmed.split(':').map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 1) return Math.round(parts[0] * 60) // bare minutes
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

export function secondsToClock(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return ''
  const total = Number(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}

function summariseLast(sets, modality, unit) {
  return sets
    .map((set) =>
      modality === 'cardio'
        ? `${set.distance ?? '—'} × ${secondsToClock(set.duration_s)}`
        : modality === 'bodyweight'
          ? `${set.reps}`
          : `${set.weight}${unit} × ${set.reps}`,
    )
    .join(', ')
}
