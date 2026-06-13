import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  TeamOutlined,
  ReadOutlined,
  DollarOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'
import { useAuth } from '../../hooks/useAuth'

const NAV_ITEMS = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/students', icon: <TeamOutlined />, label: 'Élèves' },
  { key: '/grades', icon: <ReadOutlined />, label: 'Notes' },
  { key: '/payments', icon: <DollarOutlined />, label: 'Paiements' },
]

const BOTTOM_ITEMS = [
  { key: '/settings', icon: <SettingOutlined />, label: 'Paramètres' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  const { logout } = useAuth()

  const selectedKey = NAV_ITEMS.find(i => location.pathname.startsWith(i.key))?.key ?? '/dashboard'

  return (
    <Layout.Sider
      collapsed={collapsed}
      width={200}
      collapsedWidth={64}
      style={{
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        overflow: 'auto',
      }}
      theme="dark"
    >
      {/* Logo / Brand */}
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        marginBottom: 8,
      }}>
        <span style={{
          color: '#fff',
          fontWeight: 700,
          fontSize: collapsed ? 18 : 22,
          letterSpacing: collapsed ? 0 : 2,
          transition: 'all 0.2s',
        }}>
          {collapsed ? 'S' : 'SGSI'}
        </span>
      </div>

      {/* Main nav */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={NAV_ITEMS.map(item => ({
          key: item.key,
          icon: item.icon,
          label: item.label,
          onClick: () => navigate(item.key),
        }))}
        style={{ border: 'none', flex: 1 }}
      />

      {/* Bottom nav */}
      <div style={{ position: 'absolute', bottom: 0, width: '100%' }}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname.startsWith('/settings') ? '/settings' : '']}
          items={[
            ...BOTTOM_ITEMS.map(item => ({
              key: item.key,
              icon: item.icon,
              label: item.label,
              onClick: () => navigate(item.key),
            })),
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: 'Déconnexion',
              onClick: logout,
              danger: true,
            },
          ]}
          style={{ border: 'none' }}
        />
      </div>
    </Layout.Sider>
  )
}
