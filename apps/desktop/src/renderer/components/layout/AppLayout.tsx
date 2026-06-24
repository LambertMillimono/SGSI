import { Layout, theme } from 'antd'
import { Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'
import { Sidebar } from './Sidebar'
import { AppHeader } from './AppHeader'

export function AppLayout() {
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  const { token } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Sidebar />
      <Layout style={{
        marginLeft: collapsed ? 64 : 216,
        transition: 'margin-left 0.2s ease',
        background: token.colorBgLayout,
      }}>
        <AppHeader />
        <Layout.Content style={{
          margin: 20,
          padding: 24,
          minHeight: 280,
          background: token.colorBgLayout,
          borderRadius: 12,
        }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
