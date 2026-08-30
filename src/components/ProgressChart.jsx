import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { LineChart } from '@mui/x-charts/LineChart'
import dayjs from 'dayjs'

/**
 * One exercise, one metric, over time. Single series by design: the title names
 * what is plotted, so no legend box is needed and the line stays the only ink
 * with any weight.
 */
export default function ProgressChart({ series, height = 280 }) {
  const theme = useTheme()
  const { chart } = theme.palette
  const points = series?.points ?? []

  const dates = points.map((p) => dayjs(p.date).toDate())
  const values = points.map((p) => p.value)
  const labels = points.map((p) => p.label)

  const isPace = series?.metric === 'pace'

  return (
    <Box sx={{ width: '100%' }}>
      <LineChart
        height={height}
        xAxis={[
          {
            data: dates,
            scaleType: 'time',
            valueFormatter: (value, context) =>
              context?.location === 'tooltip'
                ? dayjs(value).format('ddd, MMM D, YYYY')
                : dayjs(value).format('MMM D'),
            tickNumber: Math.min(5, Math.max(2, points.length)),
          },
        ]}
        yAxis={[
          {
            // Pace reads better inverted: a faster (lower) time sits higher.
            reverse: isPace,
            valueFormatter: (value) => formatTick(value, series),
          },
        ]}
        series={[
          {
            data: values,
            color: chart.series,
            showMark: true,
            curve: 'linear',
            area: true,
            valueFormatter: (value, context) =>
              value === null ? '' : labels[context.dataIndex] || `${value}`,
            label: series?.metric_label,
          },
        ]}
        grid={{ horizontal: true }}
        margin={{ left: 52, right: 16, top: 16, bottom: 24 }}
        slotProps={{ legend: { hidden: true } }}
        sx={{
          '& .MuiLineElement-root': { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
          '& .MuiAreaElement-root': { fill: chart.series, opacity: 0.1 },
          '& .MuiMarkElement-root': {
            r: 4.5,
            fill: chart.series,
            stroke: chart.surface,
            strokeWidth: 2,
          },
          '& .MuiChartsGrid-line': { stroke: chart.grid, strokeWidth: 1 },
          '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: chart.grid },
          '& .MuiChartsAxis-tickLabel': { fill: theme.palette.text.secondary, fontSize: 11 },
        }}
      />
    </Box>
  )
}

function formatTick(value, series) {
  if (value === null || value === undefined) return ''
  if (series?.metric === 'pace') {
    const minutes = Math.floor(value)
    const seconds = Math.round((value - minutes) * 60)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value * 10) / 10}`
}
