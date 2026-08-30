import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import dayjs from 'dayjs'

/** Weekly training volume. One series, one color — length carries the magnitude. */
export default function VolumeChart({ weeks, unit, height = 200 }) {
  const theme = useTheme()
  const { chart } = theme.palette

  const labels = weeks.map((w) => dayjs(w.week_start).format('MMM D'))
  const values = weeks.map((w) => w.volume)
  const meta = weeks.map((w) => `${w.workouts} workouts · ${w.sets} sets`)

  return (
    <Box sx={{ width: '100%' }}>
      <BarChart
        height={height}
        xAxis={[{ data: labels, scaleType: 'band', categoryGapRatio: 0.45, barGapRatio: 0.1 }]}
        yAxis={[
          {
            valueFormatter: (value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`),
          },
        ]}
        series={[
          {
            data: values,
            color: chart.series,
            valueFormatter: (value, context) =>
              value === null
                ? ''
                : `${value.toLocaleString()} ${unit} · ${meta[context.dataIndex] ?? ''}`,
            label: 'Weekly volume',
          },
        ]}
        borderRadius={4}
        grid={{ horizontal: true }}
        margin={{ left: 46, right: 8, top: 16, bottom: 24 }}
        slotProps={{ legend: { hidden: true } }}
        sx={{
          '& .MuiChartsGrid-line': { stroke: chart.grid, strokeWidth: 1 },
          '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: chart.grid },
          '& .MuiChartsAxis-tickLabel': { fill: theme.palette.text.secondary, fontSize: 11 },
        }}
      />
    </Box>
  )
}
