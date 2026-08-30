import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'

import { api } from '../api/client'

const MODALITIES = [
  { value: 'strength', label: 'Weight & reps' },
  { value: 'bodyweight', label: 'Reps only' },
  { value: 'cardio', label: 'Distance & time' },
]

export default function ExercisePicker({ open, exercises, onClose, onPick, onCreated }) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: '', modality: 'strength', muscle_group: '' })
  const [error, setError] = useState(null)

  const grouped = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = exercises.filter((exercise) => exercise.name.toLowerCase().includes(query))
    return matches.reduce((groups, exercise) => {
      const key = exercise.muscle_group || 'Other'
      groups[key] = groups[key] ? [...groups[key], exercise] : [exercise]
      return groups
    }, {})
  }, [exercises, search])

  const close = () => {
    setSearch('')
    setCreating(false)
    setDraft({ name: '', modality: 'strength', muscle_group: '' })
    setError(null)
    onClose()
  }

  const create = async () => {
    setError(null)
    try {
      const created = await api.createExercise({
        name: draft.name,
        modality: draft.modality,
        muscle_group: draft.muscle_group || null,
      })
      onCreated(created)
      onPick(created)
      close()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>{creating ? 'New exercise' : 'Add exercise'}</DialogTitle>

      {creating ? (
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              autoFocus
              fullWidth
            />
            <TextField
              select
              label="Tracks"
              value={draft.modality}
              onChange={(event) => setDraft({ ...draft, modality: event.target.value })}
              fullWidth
            >
              {MODALITIES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Muscle group (optional)"
              value={draft.muscle_group}
              onChange={(event) => setDraft({ ...draft, muscle_group: event.target.value })}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
      ) : (
        <DialogContent dividers sx={{ p: 0 }}>
          <TextField
            placeholder="Search exercises"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
            sx={{ p: 2, pb: 1 }}
            autoFocus
          />
          <List dense sx={{ pt: 0 }}>
            {Object.entries(grouped).map(([group, items]) => [
              <ListSubheader key={`${group}-header`}>{group}</ListSubheader>,
              ...items.map((exercise) => (
                <ListItemButton
                  key={exercise.id}
                  onClick={() => {
                    onPick(exercise)
                    close()
                  }}
                >
                  <ListItemText primary={exercise.name} secondary={modalityLabel(exercise.modality)} />
                </ListItemButton>
              )),
            ])}
          </List>
        </DialogContent>
      )}

      <DialogActions>
        {creating ? (
          <>
            <Button onClick={() => setCreating(false)}>Back</Button>
            <Button variant="contained" onClick={create} disabled={!draft.name.trim()}>
              Create
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button onClick={() => setCreating(true)}>New exercise</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

function modalityLabel(modality) {
  if (modality === 'cardio') return 'Distance & time'
  if (modality === 'bodyweight') return 'Reps only'
  return 'Weight & reps'
}
