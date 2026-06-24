import { Layout, theme } from 'antd'
import { Outlet } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useEffect, useRef } from 'react'
import type { RootState, AppDispatch } from '../../store'
import { toggleSidebar } from '../../store/uiSlice'
import { Sidebar } from './Sidebar'
import { AppHeader } from './AppHeader'

/* ── Breakpoints (window total width) ─────────────────────────
   < 860px  → sidebar auto-collapsed (60px)
   860-1100 → sidebar may stay collapsed
   > 1100   → sidebar expanded (228px)
   ────────────────────────────────────────────────────────────── */
const COLLAPSE_AT  = 860
const EXPAND_AT    = 1100

export function AppLayout() {
  const dispatch  = useDispatch<AppDispatch>()
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  const { token } = theme.useToken()

  // Track whether the user manually toggled the sidebar
  const userToggled = useRef(false)

  // Auto-collapse / auto-expand based on window width
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth

      if (w < COLLAPSE_AT && !collapsed) {
        userToggled.current = false
        dispatch(toggleSidebar())
      } else if (w >= EXPAND_AT && collapsed && !userToggled.current) {
        dispatch(toggleSidebar())
      }
    }

    handleResize() // run on mount
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed])

  const sidebarW = collapsed ? 60 : 228

  return (
    <Layout style={{
      minHeight: '100vh',
      background: token.colorBgLayout,
      overflow: 'hidden',
    }}>
      <Sidebar onManualToggle={() => { userToggled.current = true }} />

      <Layout style={{
        marginLeft: sidebarW,
        transition: 'margin-left 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        background: token.colorBgLayout,
        minHeight: '100vh',
        /* Prevent horizontal overflow at the layout level */
        overflow: 'hidden',
      }}>
        <AppHeader />

        <Layout.Content style={{
          background: token.colorBgLayout,
          minHeight: 'calc(100vh - 60px)',
          /* Prevent content from causing horizontal scroll */
          overflowX: 'hidden',
          overflowY: 'auto',
        }}>
          {/* Max-width content wrapper — prevents over-stretching on ultra-wide screens */}
          <div style={{
            maxWidth: 1680,
            margin: '0 auto',
            padding: 'clamp(16px, 2vw, 32px) clamp(16px, 2.5vw, 36px) 40px',
            width: '100%',
          }}>
            <Outlet />
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
