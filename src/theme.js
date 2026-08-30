import { createTheme } from '@mui/material/styles'

// Chart tokens validated for CVD separation and >=3:1 contrast against each
// mode's surface (see scripts/validate_palette.js in the dataviz reference).
const CHART = {
  light: {
    series: '#2a78d6',
    accent: '#eb6834',
    trend: '#8f8e8a',
    grid: '#e5e4e0',
    surface: '#ffffff',
  },
  dark: {
    series: '#3987e5',
    accent: '#d95926',
    trend: '#7c7b76',
    grid: '#2a2e33',
    surface: '#1a1d21',
  },
}

export function buildTheme(mode) {
  const chart = CHART[mode]
  return createTheme({
    palette: {
      mode,
      chart,
      primary: { main: chart.series },
      secondary: { main: chart.accent },
      background:
        mode === 'dark'
          ? { default: '#111418', paper: '#1a1d21' }
          : { default: '#f6f6f4', paper: '#ffffff' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h6: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
    },
    components: {
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }),
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiToggleButton: { styleOverrides: { root: { textTransform: 'none' } } },
    },
  })
}

export default buildTheme('light')
