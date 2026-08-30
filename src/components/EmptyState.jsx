import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

export default function EmptyState({ title, description, actionLabel, onAction, icon }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 3, color: 'text.secondary' }}>
      {icon}
      <Typography variant="subtitle1" color="text.primary" sx={{ mt: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
      {actionLabel && (
        <Button variant="contained" sx={{ mt: 2 }} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}
