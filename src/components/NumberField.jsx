import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

/**
 * Number entry sized for thumbs: steppers flank the field so a small weight or
 * rep change never needs the on-screen keyboard.
 */
export default function NumberField({ label, value, onChange, step = 1, min = 0, max, ...props }) {
  const current = value === '' || value === null || value === undefined ? null : Number(value)

  const bump = (delta) => {
    const base = current ?? 0
    let next = Math.round((base + delta) * 100) / 100
    if (min !== undefined && next < min) next = min
    if (max !== undefined && next > max) next = max
    onChange(String(next))
  }

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <IconButton size="small" aria-label={`Decrease ${label}`} onClick={() => bump(-step)}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <TextField
        label={label}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ''))}
        inputProps={{ inputMode: 'decimal', style: { textAlign: 'center' } }}
        sx={{ width: 92 }}
        {...props}
      />
      <IconButton size="small" aria-label={`Increase ${label}`} onClick={() => bump(step)}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}
