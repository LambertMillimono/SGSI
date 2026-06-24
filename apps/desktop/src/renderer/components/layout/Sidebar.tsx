import { Layout, Tooltip, Badge } from 'antd'
import {
  DashboardOutlined, TeamOutlined, ReadOutlined, DollarOutlined,
  SettingOutlined, CalendarOutlined, BarChartOutlined, UserSwitchOutlined,
  ScheduleOutlined, ShopOutlined, BookOutlined, MedicineBoxOutlined,
  CarOutlined, MessageOutlined, BankOutlined, GiftOutlined, WarningOutlined,
  AlertOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'
import { useAuth } from '../../hooks/useAuth'
import { useModules } from '../../contexts/ModulesContext'
import { canAccess } from '../../utils/permissions'

/* ─── Nav items ──────────────────────────────────────────────────── */
const NAV = [
  { key: '/dashboard',  icon: <DashboardOutlined />, label: 'Tableau de bord',   dividerBefore: false },
  { key: '/students',   icon: <TeamOutlined />,       label: 'Élèves',            dividerBefore: true  },
  { key: '/discipline', icon: <WarningOutlined />,    label: 'Discipline',        dividerBefore: false },
  { key: '/staff',      icon: <UserSwitchOutlined />, label: 'Personnel',         dividerBefore: false },
  { key: '/grades',     icon: <ReadOutlined />,       label: 'Notes & Bulletins', dividerBefore: false },
  { key: '/absences',   icon: <CalendarOutlined />,   label: 'Absences',          dividerBefore: false },
  { key: '/schedule',   icon: <ScheduleOutlined />,   label: 'Emploi du temps',   dividerBefore: false },
  { key: '/payments',        icon: <DollarOutlined />,  label: 'Paiements',          dividerBefore: true  },
  { key: '/payments/plans',     icon: <CalendarOutlined />, label: 'Plans de paiement', dividerBefore: false },
  { key: '/payments/discounts', icon: <GiftOutlined />,    label: 'Remises',           dividerBefore: false },
  { key: '/expenses',       icon: <ShopOutlined />,    label: 'Dépenses',           dividerBefore: false },
  { key: '/relances',       icon: <AlertOutlined />,   label: 'Relances',           dividerBefore: false },
  { key: '/payroll',    icon: <BankOutlined />,       label: 'Paie personnel',    dividerBefore: false },
  { key: '/reports',    icon: <BarChartOutlined />,   label: 'Rapports',          dividerBefore: false },
  { key: '/library',    icon: <BookOutlined />,       label: 'Bibliothèque',      dividerBefore: true  },
  { key: '/infirmerie', icon: <MedicineBoxOutlined />,label: 'Infirmerie',        dividerBefore: false },
  { key: '/transport',  icon: <CarOutlined />,        label: 'Transport',         dividerBefore: false },
  { key: '/messages',   icon: <MessageOutlined />,    label: 'Messagerie',        dividerBefore: false },
]

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', DIRECTOR: 'Directeur',
  SECRETARY: 'Secrétaire', ACCOUNTANT: 'Comptable', TEACHER: 'Enseignant',
}

export function Sidebar({ onManualToggle }: { onManualToggle?: () => void }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)
  const themeMode = useSelector((s: RootState) => s.ui.theme)
  const isDark    = themeMode === 'dark'
  const { firstName, lastName } = useAuth()
  const role      = useSelector((s: RootState) => s.auth.role)
  const { isEnabled } = useModules()

  const activeKey = NAV
    .filter(i => location.pathname.startsWith(i.key))
    .sort((a, b) => b.key.length - a.key.length)[0]?.key ?? '/dashboard'

  const initials = firstName && lastName
    ? `${lastName[0]}${firstName[0]}`.toUpperCase()
    : (firstName?.[0] ?? 'U').toUpperCase()

  /* ── Theme tokens ─────────────────────────────────────────────── */
  const tk = isDark ? {
    /* Warm indigo dark sidebar — completely new */
    siderBg:      '#1A1A2E',
    border:       'rgba(99,102,241,0.12)',
    logoText:     '#F0EFFF',
    logoSub:      '#6B6B8A',
    divider:      'rgba(99,102,241,0.1)',
    activeBg:     'rgba(99,102,241,0.15)',
    activeText:   '#C7D2FE',
    activeIcon:   '#818CF8',
    inactiveText: '#6B6B8A',
    inactiveIcon: '#6B6B8A',
    hoverBg:      'rgba(99,102,241,0.07)',
    hoverText:    '#A0A0C0',
    userBg:       'rgba(99,102,241,0.08)',
    userBorder:   'rgba(99,102,241,0.15)',
    userName:     '#F0EFFF',
    userSub:      '#6B6B8A',
    settingsBg:   'rgba(99,102,241,0.07)',
    settingsText: '#6B6B8A',
  } : {
    /* White sidebar with indigo accents — completely new */
    siderBg:      '#FFFFFF',
    border:       '#E4E4E7',
    logoText:     '#18181B',
    logoSub:      '#A1A1AA',
    divider:      '#F4F4F5',
    activeBg:     '#EEF2FF',
    activeText:   '#4338CA',
    activeIcon:   '#6366F1',
    inactiveText: '#71717A',
    inactiveIcon: '#A1A1AA',
    hoverBg:      '#FAFAFA',
    hoverText:    '#18181B',
    userBg:       '#FAFAFA',
    userBorder:   '#E4E4E7',
    userName:     '#18181B',
    userSub:      '#A1A1AA',
    settingsBg:   '#FAFAFA',
    settingsText: '#71717A',
  }

  const NavItem = ({ item }: { item: typeof NAV[0] }) => {
    const isActive  = activeKey === item.key
    const isVisible = isEnabled(item.key.replace('/', '')) && canAccess(role ?? '', item.key.replace('/', ''))
    if (!isVisible) return null

    return (
      <Tooltip title={collapsed ? item.label : ''} placement="right" mouseEnterDelay={0.3}>
        <button
          onClick={() => navigate(item.key)}
          style={{
            display: 'flex', alignItems: 'center',
            gap: 10, width: '100%',
            padding: collapsed ? '9px 0' : '8px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: isActive ? tk.activeBg : 'transparent',
            color: isActive ? tk.activeText : tk.inactiveText,
            border: 'none', borderRadius: 8,
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            fontSize: 13, fontWeight: isActive ? 600 : 400,
            letterSpacing: '-0.01em',
            transition: 'all 150ms cubic-bezier(0.16,1,0.3,1)',
            textAlign: 'left',
          }}
          onMouseEnter={e => {
            if (!isActive) {
              Object.assign((e.currentTarget as HTMLButtonElement).style, {
                background: tk.hoverBg,
                color: tk.hoverText,
              })
            }
          }}
          onMouseLeave={e => {
            if (!isActive) {
              Object.assign((e.currentTarget as HTMLButtonElement).style, {
                background: 'transparent',
                color: tk.inactiveText,
              })
            }
          }}
        >
          <span style={{
            fontSize: 15,
            color: isActive ? tk.activeIcon : tk.inactiveIcon,
            flexShrink: 0,
            transition: 'color 150ms',
            display: 'flex',
            alignItems: 'center',
          }}>
            {item.icon}
          </span>
          {!collapsed && (
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
      width={228}
      collapsedWidth={60}
      style={{
        position: 'fixed', height: '100vh',
        left: 0, top: 0, bottom: 0, zIndex: 100,
        background: tk.siderBg,
        borderRight: `1px solid ${tk.border}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 200ms cubic-bezier(0.16,1,0.3,1), background 200ms',
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div style={{
        height: 60,
        display: 'flex', alignItems: 'center',
        padding: collapsed ? '0' : '0 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: `1px solid ${tk.border}`,
        gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
        }}>
          <span style={{
            color: '#fff', fontWeight: 800, fontSize: 13,
            fontFamily: "'Inter', sans-serif", letterSpacing: '-0.5px',
          }}>S</span>
        </div>
        {!collapsed && (
          <div>
            <div style={{
              color: tk.logoText, fontWeight: 700, fontSize: 13,
              letterSpacing: '-0.03em', lineHeight: 1.2, fontFamily: "'Inter', sans-serif",
            }}>
              SGSI
            </div>
            <div style={{
              color: tk.logoSub, fontSize: 9, letterSpacing: '0.08em',
              textTransform: 'uppercase', lineHeight: 1.4,
            }}>
              SchoolManager Pro
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: collapsed ? '8px 6px' : '8px 8px',
        scrollbarWidth: 'none',
      }}>
        {NAV.map((item) => {
          const isVisible = isEnabled(item.key.replace('/', '')) && canAccess(role ?? '', item.key.replace('/', ''))
          if (!isVisible) return null
          return (
            <div key={item.key}>
              {item.dividerBefore && (
                <div style={{
                  height: 1, background: tk.divider,
                  margin: collapsed ? '8px 6px' : '6px 4px',
                }} />
              )}
              <NavItem item={item} />
            </div>
          )
        })}
      </div>

      {/* ── Bottom ───────────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid ${tk.border}`,
        padding: collapsed ? '8px 6px' : '8px 8px',
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {/* Settings */}
        {canAccess(role ?? '', 'settings') && (
          <Tooltip title={collapsed ? 'Paramètres' : ''} placement="right">
            <button
              onClick={() => navigate('/settings')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: collapsed ? '8px 0' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: location.pathname.startsWith('/settings') ? tk.activeBg : 'transparent',
                color: location.pathname.startsWith('/settings') ? tk.activeText : tk.settingsText,
                fontFamily: "'Inter', sans-serif", fontSize: 13,
                transition: 'all 150ms',
              }}
              onMouseEnter={e => {
                if (!location.pathname.startsWith('/settings')) {
                  (e.currentTarget as HTMLButtonElement).style.background = tk.settingsBg
                }
              }}
              onMouseLeave={e => {
                if (!location.pathname.startsWith('/settings')) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }
              }}
            >
              <SettingOutlined style={{ fontSize: 15, color: 'inherit' }} />
              {!collapsed && <span>Paramètres</span>}
            </button>
          </Tooltip>
        )}

        {/* User card */}
        {!collapsed ? (
          <div style={{
            marginTop: 4, padding: '10px 10px',
            borderRadius: 8, background: tk.userBg,
            border: `1px solid ${tk.userBorder}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
              fontFamily: "'Inter', sans-serif",
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                color: tk.userName, fontSize: 12, fontWeight: 600,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em',
              }}>
                {firstName} {lastName}
              </div>
              <div style={{ color: tk.userSub, fontSize: 10 }}>
                {ROLE_LABELS[role ?? ''] ?? role}
              </div>
            </div>
          </div>
        ) : (
          <Tooltip title={`${firstName} ${lastName}`} placement="right">
            <div style={{
              width: 36, height: 36, borderRadius: 8, margin: '2px auto 0',
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'default',
            }}>
              {initials}
            </div>
          </Tooltip>
        )}
      </div>
    </Layout.Sider>
  )
}
