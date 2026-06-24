import { Layout, Tooltip } from 'antd'
import {
  DashboardOutlined,
  TeamOutlined,
  ReadOutlined,
  DollarOutlined,
  SettingOutlined,
  CalendarOutlined,
  BarChartOutlined,
  UserSwitchOutlined,
  ScheduleOutlined,
  ShopOutlined,
  BookOutlined,
  MedicineBoxOutlined,
  CarOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'
import { useAuth } from '../../hooks/useAuth'
import { useModules } from '../../contexts/ModulesContext'
import { canAccess } from '../../utils/permissions'

const NAV_ITEMS = [
  { key: '/dashboard',  icon: <DashboardOutlined />,   label: 'Tableau de bord' },
  { key: '/students',   icon: <TeamOutlined />,         label: 'Élèves' },
  { key: '/staff',      icon: <UserSwitchOutlined />,   label: 'Personnel' },
  { key: '/grades',     icon: <ReadOutlined />,         label: 'Notes & Bulletins' },
  { key: '/absences',   icon: <CalendarOutlined />,     label: 'Absences' },
  { key: '/schedule',   icon: <ScheduleOutlined />,     label: 'Emploi du temps' },
  { key: '/payments',   icon: <DollarOutlined />,       label: 'Paiements' },
  { key: '/expenses',   icon: <ShopOutlined />,         label: 'Dépenses' },
  { key: '/reports',    icon: <BarChartOutlined />,     label: 'Rapports' },
  { key: '/library',    icon: <BookOutlined />,          label: 'Bibliothèque' },
  { key: '/infirmerie', icon: <MedicineBoxOutlined />,   label: 'Infirmerie' },
  { key: '/transport',  icon: <CarOutlined />,           label: 'Transport' },
  { key: '/messages',   icon: <MessageOutlined />,       label: 'Messagerie' },
]

const BOTTOM_ITEMS = [
  { key: '/settings', icon: <SettingOutlined />, label: 'Paramètres' },
]

// Palette pour chaque mode
const DARK_THEME = {
  siderBg:       '#0F172A',
  logoBorder:    'rgba(255,255,255,0.07)',
  logoTitle:     '#fff',
  logoSub:       'rgba(255,255,255,0.35)',
  navLabel:      'rgba(255,255,255,0.25)',
  itemActiveBg:  'rgba(255,255,255,0.15)',
  itemActiveText:'#fff',
  itemActiveIcon:'#60A5FA',
  itemInactiveText:'rgba(255,255,255,0.6)',
  itemInactiveIcon:'rgba(255,255,255,0.5)',
  indicator:     '#60A5FA',
  bottomBorder:  'rgba(255,255,255,0.07)',
  bottomActiveBg:'rgba(255,255,255,0.12)',
  bottomActiveText:'#fff',
  bottomInactiveText:'rgba(255,255,255,0.5)',
  bottomIconColor:'rgba(255,255,255,0.5)',
  logoutColor:   '#F87171',
  userCardBg:    'rgba(255,255,255,0.06)',
  userCardName:  '#fff',
  userCardSub:   'rgba(255,255,255,0.35)',
}

const LIGHT_THEME = {
  siderBg:       '#ffffff',
  logoBorder:    '#E5E7EB',
  logoTitle:     '#111827',
  logoSub:       '#9CA3AF',
  navLabel:      '#D1D5DB',
  itemActiveBg:  '#EFF6FF',
  itemActiveText:'#1D4ED8',
  itemActiveIcon:'#1D4ED8',
  itemInactiveText:'#374151',
  itemInactiveIcon:'#9CA3AF',
  indicator:     '#1D4ED8',
  bottomBorder:  '#E5E7EB',
  bottomActiveBg:'#F3F4F6',
  bottomActiveText:'#111827',
  bottomInactiveText:'#6B7280',
  bottomIconColor:'#9CA3AF',
  logoutColor:   '#DC2626',
  userCardBg:    '#F9FAFB',
  userCardName:  '#111827',
  userCardSub:   '#9CA3AF',
}

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  const themeMode = useSelector((s: RootState) => s.ui.theme)
  const { firstName, lastName } = useAuth()
  const role = useSelector((s: RootState) => s.auth.role)
  const { isEnabled } = useModules()

  // En mode sombre → sidebar blanche (LIGHT_THEME)
  // En mode clair  → sidebar navy  (DARK_THEME)
  const t = themeMode === 'dark' ? LIGHT_THEME : DARK_THEME

  const visibleNavItems = NAV_ITEMS.filter(item => {
    const moduleKey = item.key.replace('/', '')
    return isEnabled(moduleKey) && canAccess(role ?? '', moduleKey)
  })

  const selectedKey = visibleNavItems.find(i => location.pathname.startsWith(i.key))?.key ?? '/dashboard'

  const initials = firstName && lastName
    ? `${lastName[0]}${firstName[0]}`.toUpperCase()
    : '?'

  const NavItem = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const isActive = selectedKey === item.key
    return (
      <Tooltip title={collapsed ? item.label : ''} placement="right">
        <button
          onClick={() => navigate(item.key)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: collapsed ? '10px 0' : '9px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            background: isActive ? t.itemActiveBg : 'transparent',
            color: isActive ? t.itemActiveText : t.itemInactiveText,
            position: 'relative',
            textAlign: 'left',
          }}
        >
          {isActive && (
            <span style={{
              position: 'absolute',
              left: 0, top: '50%',
              transform: 'translateY(-50%)',
              width: 3, height: 20,
              background: t.indicator,
              borderRadius: '0 3px 3px 0',
            }} />
          )}
          <span style={{
            fontSize: 16,
            color: isActive ? t.itemActiveIcon : t.itemInactiveIcon,
            flexShrink: 0,
            marginLeft: !collapsed && isActive ? 3 : 0,
          }}>
            {item.icon}
          </span>
          {!collapsed && (
            <span style={{
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {item.label}
            </span>
          )}
        </button>
      </Tooltip>
    )
  }

  return (
    <Layout.Sider
      collapsed={collapsed}
      width={216}
      collapsedWidth={64}
      style={{
        position: 'fixed',
        height: '100vh',
        left: 0, top: 0, bottom: 0,
        zIndex: 100,
        background: t.siderBg,
        borderRight: `1px solid ${t.logoBorder}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      {/* Logo */}
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: collapsed ? '0' : '0 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: `1px solid ${t.logoBorder}`,
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
        }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: -0.5 }}>S</span>
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: t.logoTitle, fontWeight: 800, fontSize: 15, lineHeight: 1.2, letterSpacing: 1 }}>
              SGSI
            </div>
            <div style={{ color: t.logoSub, fontSize: 9, letterSpacing: 0.5, lineHeight: 1 }}>
              SchoolManager Pro
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '12px 8px',
        scrollbarWidth: 'none',
      }}>
        {!collapsed && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: t.navLabel,
            letterSpacing: 1, textTransform: 'uppercase',
            padding: '4px 8px 8px',
          }}>
            Navigation
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleNavItems.map(item => <NavItem key={item.key} item={item} />)}
        </div>
      </div>

      {/* Bottom section */}
      <div style={{
        borderTop: `1px solid ${t.bottomBorder}`,
        padding: '8px 8px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {BOTTOM_ITEMS.filter(item => canAccess(role ?? '', item.key.replace('/', ''))).map(item => {
            const isActive = location.pathname.startsWith(item.key)
            return (
              <Tooltip key={item.key} title={collapsed ? item.label : ''} placement="right">
                <button
                  onClick={() => navigate(item.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%',
                    padding: collapsed ? '10px 0' : '9px 16px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isActive ? t.bottomActiveBg : 'transparent',
                    color: isActive ? t.bottomActiveText : t.bottomInactiveText,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 16, color: t.bottomIconColor, flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && <span style={{ fontSize: 13 }}>{item.label}</span>}
                </button>
              </Tooltip>
            )
          })}

          {/* User mini-card */}
          {!collapsed && (
            <div style={{
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 8,
              background: t.userCardBg,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  color: t.userCardName, fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {firstName} {lastName}
                </div>
                <div style={{ color: t.userCardSub, fontSize: 10 }}>
                  Connecté
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout.Sider>
  )
}
