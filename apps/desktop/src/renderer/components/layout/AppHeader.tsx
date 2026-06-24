import { Layout, Button, Dropdown, Avatar, Space, Typography, Tooltip, theme, Badge, List, Empty, Tag } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  MoonOutlined,
  SettingOutlined,
  LogoutOutlined,
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '../../store'
import { toggleSidebar, setTheme } from '../../store/uiSlice'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { ipc } from '../../utils/ipcBridge'
import dayjs from 'dayjs'

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/students':  'Gestion des élèves',
  '/staff':     'Personnel enseignant',
  '/grades':    'Notes & Bulletins',
  '/absences':  'Absences & Présences',
  '/schedule':  'Emploi du temps',
  '/payments':  'Paiements',
  '/expenses':  'Dépenses',
  '/reports':   'Rapports',
  '/library':   'Bibliothèque',
  '/infirmerie':'Infirmerie',
  '/transport': 'Transport scolaire',
  '/messages':  'Messagerie interne',
  '/settings':  'Paramètres',
}

const NOTIF_TYPE_COLORS: Record<string, string> = {
  ABSENCE: 'orange',
  PAYMENT: 'red',
  RESULT: 'blue',
  INFO: 'default',
  ALERT: 'volcano',
}

function NotificationBell() {
  const [notifs, setNotifs] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const { token } = theme.useToken()

  const load = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        ipc.notifications.list(30),
        ipc.notifications.countUnread(),
      ])
      setNotifs(list)
      setUnread(count)
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  const handleMarkRead = async (id: string) => {
    await ipc.notifications.markRead(id).catch(() => {})
    load()
  }

  const handleMarkAll = async () => {
    await ipc.notifications.markAllRead().catch(() => {})
    load()
  }

  const handleDelete = async (id: string) => {
    await ipc.notifications.delete(id).catch(() => {})
    load()
  }

  const dropdown = (
    <div style={{
      width: 360,
      background: token.colorBgElevated,
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      border: `1px solid ${token.colorBorderSecondary}`,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Typography.Text strong style={{ fontSize: 13 }}>
          Notifications {unread > 0 && <Badge count={unread} size="small" style={{ marginLeft: 6 }} />}
        </Typography.Text>
        {unread > 0 && (
          <Button size="small" type="link" icon={<CheckOutlined />} onClick={handleMarkAll}>
            Tout marquer lu
          </Button>
        )}
      </div>
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {notifs.length === 0 ? (
          <div style={{ padding: 24 }}>
            <Empty description="Aucune notification" styles={{ image: { height: 40 } }} />
          </div>
        ) : (
          <List
            dataSource={notifs}
            size="small"
            renderItem={(item: any) => (
              <List.Item
                style={{
                  padding: '10px 16px',
                  background: item.isRead ? 'transparent' : (token.colorPrimaryBg),
                  borderLeft: item.isRead ? 'none' : `3px solid ${token.colorPrimary}`,
                  cursor: 'default',
                }}
                actions={[
                  !item.isRead && (
                    <Tooltip title="Marquer lu" key="read">
                      <Button size="small" type="text" icon={<CheckOutlined />}
                        onClick={() => handleMarkRead(item.id)} />
                    </Tooltip>
                  ),
                  <Tooltip title="Supprimer" key="del">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => handleDelete(item.id)} />
                  </Tooltip>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space size={4}>
                      <Tag color={NOTIF_TYPE_COLORS[item.type] ?? 'default'} style={{ fontSize: 10, margin: 0 }}>
                        {item.type}
                      </Tag>
                      <Typography.Text style={{ fontSize: 12, fontWeight: item.isRead ? 400 : 600 }}>
                        {item.title}
                      </Typography.Text>
                    </Space>
                  }
                  description={
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{item.body}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                        {dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}
                      </Typography.Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  )

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => dropdown}
      placement="bottomRight"
      trigger={['click']}
    >
      <Tooltip title="Notifications">
        <Badge count={unread} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined />}
            style={{
              color: token.colorTextSecondary,
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          />
        </Badge>
      </Tooltip>
    </Dropdown>
  )
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; darkBg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin',  color: '#7C3AED', bg: '#F5F3FF', darkBg: '#2E1065' },
  DIRECTOR:    { label: 'Directeur',    color: '#3B82F6', bg: '#EFF6FF', darkBg: '#1E3A8A' },
  SECRETARY:   { label: 'Secrétaire',   color: '#10B981', bg: '#F0FDF4', darkBg: '#064E3B' },
  ACCOUNTANT:  { label: 'Comptable',    color: '#F59E0B', bg: '#FFFBEB', darkBg: '#451A03' },
  TEACHER:     { label: 'Enseignant',   color: '#0EA5E9', bg: '#F0F9FF', darkBg: '#0C4A6E' },
}

export function AppHeader() {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, theme: themeMode } = useSelector((s: RootState) => s.ui)
  const { username, firstName, lastName, role, logout } = useAuth()
  const { token } = theme.useToken()
  const isDark = themeMode === 'dark'

  const displayName = firstName && lastName
    ? `${firstName} ${lastName}`
    : username ?? 'Utilisateur'

  const initials = firstName && lastName
    ? `${lastName[0]}${firstName[0]}`.toUpperCase()
    : (username?.[0] ?? 'U').toUpperCase()

  const roleCfg = role ? (ROLE_CONFIG[role] ?? ROLE_CONFIG.TEACHER) : ROLE_CONFIG.TEACHER

  const pageKey = Object.keys(PAGE_LABELS)
    .sort((a, b) => b.length - a.length)
    .find(k => location.pathname.startsWith(k))
  const pageLabel = pageKey ? PAGE_LABELS[pageKey] : 'SGSI'

  return (
    <Layout.Header style={{
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: token.colorBgContainer,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      position: 'sticky',
      top: 0,
      zIndex: 99,
      height: 56,
      lineHeight: '56px',
    }}>
      {/* Left: toggle + breadcrumb */}
      <Space size={12}>
        <Tooltip title={sidebarCollapsed ? 'Ouvrir le menu' : 'Réduire le menu'}>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => dispatch(toggleSidebar())}
            style={{
              color: token.colorTextSecondary,
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          />
        </Tooltip>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Typography.Text style={{ fontSize: 11, color: token.colorTextQuaternary }}>SGSI</Typography.Text>
          <span style={{ color: token.colorBorder, fontSize: 12 }}>/</span>
          <Typography.Text strong style={{ fontSize: 13, color: token.colorText }}>
            {pageLabel}
          </Typography.Text>
        </div>
      </Space>

      {/* Right */}
      <Space size={8}>
        <NotificationBell />
        <Tooltip title={isDark ? 'Mode clair' : 'Mode sombre'}>
          <Button
            type="text"
            icon={isDark ? <BulbOutlined /> : <MoonOutlined />}
            onClick={() => dispatch(setTheme(isDark ? 'light' : 'dark'))}
            style={{
              color: token.colorTextSecondary,
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          />
        </Tooltip>

        <Dropdown
          menu={{
            items: [
              {
                key: 'user-info',
                label: (
                  <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: token.colorText }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>{username}</div>
                  </div>
                ),
                disabled: true,
              },
              { type: 'divider' },
              {
                key: 'profile',
                icon: <SettingOutlined />,
                label: 'Paramètres du compte',
                onClick: () => navigate('/settings'),
              },
              { type: 'divider' },
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Déconnexion',
                danger: true,
                onClick: logout,
              },
            ],
          }}
          placement="bottomRight"
          trigger={['click']}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 8,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgElevated,
            transition: 'all 0.15s',
          }}>
            <Avatar
              size={28}
              style={{
                background: `linear-gradient(135deg, ${roleCfg.color}CC, ${roleCfg.color})`,
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              <div>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: roleCfg.color,
                  background: isDark ? roleCfg.darkBg : roleCfg.bg,
                  padding: '1px 6px', borderRadius: 10,
                }}>
                  {roleCfg.label}
                </span>
              </div>
            </div>
          </div>
        </Dropdown>
      </Space>
    </Layout.Header>
  )
}
