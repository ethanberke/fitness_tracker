import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import HistoryIcon from '@mui/icons-material/History'
import HomeIcon from '@mui/icons-material/Home'
import ListAltIcon from '@mui/icons-material/ListAlt'
import SettingsIcon from '@mui/icons-material/Settings'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

const TABS = [
  { label: 'Home', value: '/', icon: <HomeIcon /> },
  { label: 'Log', value: '/log', icon: <AddCircleOutlineIcon /> },
  { label: 'Progress', value: '/progress', icon: <ShowChartIcon /> },
  { label: 'Routines', value: '/routines', icon: <ListAltIcon /> },
  { label: 'History', value: '/history', icon: <HistoryIcon /> },
]

const TITLES = {
  '/': 'Fitness Tracker',
  '/log': 'Log workout',
  '/progress': 'Progress',
  '/routines': 'Routines',
  '/history': 'History',
  '/settings': 'Settings',
}

export default function AppShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()

  const activeTab = TABS.map((t) => t.value)
    .filter((value) => (value === '/' ? pathname === '/' : pathname.startsWith(value)))
    .sort((a, b) => b.length - a.length)[0]

  const title =
    TITLES[pathname] ||
    TITLES[Object.keys(TITLES).find((key) => key !== '/' && pathname.startsWith(key))] ||
    'Fitness Tracker'

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense">
          <Box
            component="img"
            src="/running_logo.png"
            alt=""
            sx={{ width: 28, height: 28, mr: 1, display: 'block' }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            {user?.display_name}
          </Typography>
          <IconButton edge="end" aria-label="Settings" onClick={() => navigate('/settings')}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="sm"
        disableGutters
        sx={{ px: 2, pt: 2, pb: 'calc(72px + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </Container>

      <Paper
        elevation={3}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: 1,
          borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom)',
          zIndex: (theme) => theme.zIndex.appBar,
        }}
      >
        <BottomNavigation
          value={activeTab ?? '/'}
          onChange={(_event, value) => navigate(value)}
          showLabels
        >
          {TABS.map((tab) => (
            <BottomNavigationAction key={tab.value} {...tab} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  )
}
