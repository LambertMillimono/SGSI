import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'
import { Sidebar } from './Sidebar'
import { AppHeader } from './AppHeader'

export function AppLayout() {
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{
        marginLeft: collapsed ? 64 : 200,
        transition: 'margin-left 0.2s ease',
      }}>
        <AppHeader />
        <Layout.Content style={{
          margin: 24,
          padding: 24,
          minHeight: 280,
          background: 'var(--content-bg, #fff)',
          borderRadius: 8,
        }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
