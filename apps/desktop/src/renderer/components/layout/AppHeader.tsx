import { Layout, Button, Dropdown, Avatar, Space, Typography, Tooltip } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '../../store'
import { toggleSidebar, setTheme } from '../../store/uiSlice'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export function AppHeader() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { sidebarCollapsed, theme } = useSelector((s: RootState) => s.ui)
  const { username, firstName, lastName, logout } = useAuth()

  const displayName = firstName && lastName ? `${firstName} ${lastName}` : username ?? 'Utilisateur'

  return (
    <Layout.Header style={{
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#001529',
      position: 'sticky',
      top: 0,
      zIndex: 99,
    }}>
      {/* Left: toggle + app name */}
      <Space>
        <Tooltip title={sidebarCollapsed ? 'Ouvrir le menu' : 'Réduire le menu'}>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => dispatch(toggleSidebar())}
            style={{ color: '#fff', fontSize: 16 }}
          />
        </Tooltip>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          SchoolManager Pro
        </Typography.Text>
      </Space>

      {/* Right: theme toggle + user menu */}
      <Space size={8}>
        <Tooltip title={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}>
          <Button
            type="text"
            icon={<BulbOutlined />}
            onClick={() => dispatch(setTheme(theme === 'light' ? 'dark' : 'light'))}
            style={{ color: '#fff' }}
          />
        </Tooltip>

        <Dropdown
          menu={{
            items: [
              {
                key: 'profile',
                label: 'Mon profil',
                onClick: () => navigate('/settings'),
              },
              { type: 'divider' },
              {
                key: 'logout',
                label: 'Déconnexion',
                danger: true,
                onClick: logout,
              },
            ],
          }}
          placement="bottomRight"
        >
          <Space style={{ cursor: 'pointer', color: '#fff' }}>
            <Avatar
              icon={<UserOutlined />}
              size="small"
              style={{ backgroundColor: '#1E40AF' }}
            />
            <Typography.Text style={{ color: '#fff', fontSize: 13 }}>
              {displayName}
            </Typography.Text>
          </Space>
        </Dropdown>
      </Space>
    </Layout.Header>
  )
}
