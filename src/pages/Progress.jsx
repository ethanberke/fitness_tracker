import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'

import EmptyState from '../components/EmptyState'
import ProgressChart from '../components/ProgressChart'
import { api } from '../api/client'

const METRIC_LABELS = {
  est_1rm: 'Est. 1RM',
  top_weight: 'Top weight',
  volume: 'Volume',
  total_reps: 'Total reps',
  max_reps: 'Best set',
  pace: 'Pace',
  distance: 'Distance',
  duration: 'Duration',
  avg_speed: 'Speed',
}

const RANGES = [
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
]

export default function Progress() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [exercises, setExercises] = useState(null)
  const [selected, setSelected] = useState(null)
  const [metric, setMetric] = useState(null)
  const [rangeDays, setRangeDays] = useState(180)
  const [series, setSeries] = useState(null)
  const [showTable, setShowTable] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .loggedExercises()
      .then((list) => {
        setExercises(list)
        const requested = Number(searchParams.get('exercise'))
        const initial = list.find((e) => e.id === requested) || list[0] || null
        setSelected(initial)
        setMetric(initial?.metrics[0] ?? null)
      })
      .catch((err) => setError(err.message))
    // Only resolves the initial selection; later changes come from the picker.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected || !metric) return
    setSeries(null)
    const start = rangeDays ? dayjs().subtract(rangeDays, 'day').format('YYYY-MM-DD') : undefined
    api
      .series({ exercise_id: selected.id, metric, start })
      .then(setSeries)
      .catch((err) => setError(err.message))
  }, [selected, metric, rangeDays])

  const changeCopy = useMemo(() => {
    if (!series?.change_pct && series?.change_pct !== 0) return null
    const improving = series.change_pct >= 0
    return {
      improving,
      text: `${improving ? '+' : ''}${series.change_pct}% over this range`,
    }
  }, [series])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!exercises) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (exercises.length === 0) {
    return (
      <EmptyState
        title="No data to chart yet"
        description="Log a workout or two and your progress lines show up here."
        actionLabel="Log a workout"
        onAction={() => navigate('/log')}
      />
    )
  }

  return (
    <Stack spacing={2}>
      <Autocomplete
        options={exercises}
        value={selected}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_event, value) => {
          if (!value) return
          setSelected(value)
          setMetric(value.metrics[0])
          setSearchParams({ exercise: String(value.id) }, { replace: true })
        }}
        renderInput={(params) => <TextField {...params} label="Exercise" />}
        disableClearable
      />

      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={metric}
          onChange={(_event, value) => value && setMetric(value)}
        >
          {(selected?.metrics ?? []).map((option) => (
            <ToggleButton key={option} value={option}>
              {METRIC_LABELS[option] ?? option}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={rangeDays}
        onChange={(_event, value) => value !== null && setRangeDays(value)}
        fullWidth
      >
        {RANGES.map((range) => (
          <ToggleButton key={range.label} value={range.days}>
            {range.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Card>
        <CardContent>
          <Typography variant="subtitle2">
            {selected?.name} · {series?.metric_label ?? METRIC_LABELS[metric]}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {series?.unit ? `Measured in ${series.unit}` : 'Loading…'}
          </Typography>

          {!series ? (
            <Box sx={{ display: 'grid', placeItems: 'center', height: 280 }}>
              <CircularProgress size={28} />
            </Box>
          ) : series.points.length === 0 ? (
            <Box sx={{ display: 'grid', placeItems: 'center', height: 200 }}>
              <Typography variant="body2" color="text.secondary">
                Nothing logged in this range.
              </Typography>
            </Box>
          ) : (
            <>
              <ProgressChart series={series} />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {series.best && (
                  <Chip
                    size="small"
                    color="secondary"
                    variant="outlined"
                    label={`Best: ${series.best.label} · ${dayjs(series.best.date).format('MMM D')}`}
                  />
                )}
                {changeCopy && (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={changeCopy.improving ? <TrendingUpIcon /> : <TrendingDownIcon />}
                    label={changeCopy.text}
                  />
                )}
                <Chip size="small" variant="outlined" label={`${series.points.length} sessions`} />
              </Stack>

              <Link
                component="button"
                variant="caption"
                underline="hover"
                sx={{ mt: 1.5, display: 'block' }}
                onClick={() => setShowTable((open) => !open)}
              >
                {showTable ? 'Hide data table' : 'Show data table'}
              </Link>
              <Collapse in={showTable}>
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">{series.metric_label}</TableCell>
                      <TableCell align="right">Detail</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...series.points].reverse().map((point) => (
                      <TableRow key={point.date}>
                        <TableCell>{dayjs(point.date).format('MMM D, YYYY')}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {point.value} {series.unit}
                        </TableCell>
                        <TableCell align="right">{point.label}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Collapse>
            </>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}
