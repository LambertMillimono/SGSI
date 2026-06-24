import { useEffect, useState } from 'react'
import {
  Button, Typography, Spin, Space, Progress, Badge, theme,
} from 'antd'
import {
  TeamOutlined, ExclamationCircleOutlined, ReadOutlined,
  PlusOutlined, DollarOutlined, CalendarOutlined,
  ArrowUpOutlined, CheckCircleFilled, FileTextOutlined,
  UserAddOutlined, BarChartOutlined, RiseOutlined,
  SafetyOutlined, WarningOutlined,
} from '@ant-design/icons'
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import { useAuth } from '../../hooks/useAuth'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'
import { ipc } from '../../utils/ipcBridge'
import { formatGNF, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'
import dayjs from 'dayjs'

const { Text, Title } = Typography

/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
   DASHBOARD ROUTER
   �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */
export function DashboardPage() {
  const { isDirecteur, isSecretaire, isEnseignant } = useRole()
  const { firstName, role } = useAuth()

  if (isEnseignant() && !isSecretaire()) {
    return <TeacherDashboard firstName={firstName ?? 'Enseignant'} />
  }
  if (isDirecteur() || role === 'SUPER_ADMIN') {
    return <DirectorDashboard />
  }
  return <SecretaryDashboard />
}

/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
   DIRECTOR DASHBOARD — Premium cinematic design
   �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */
function DirectorDashboard() {
  const navigate  = useNavigate()
  const { firstName, lastName } = useAuth()
  const themeMode = useSelector((s: RootState) => s.ui.theme)
  const isDark    = themeMode === 'dark'
  const { token } = theme.useToken()
  const [loading, setLoading] = useState(true)
  const [students,      setStudents]      = useState<any[]>([])
  const [classes,       setClasses]       = useState<any[]>([])
  const [unpaid,        setUnpaid]        = useState<any[]>([])
  const [monthReport,   setMonthReport]   = useState<any>(null)
  const [bulletinCount, setBulletinCount] = useState(0)
  const [absenceStats,  setAbsenceStats]  = useState<any>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([])

  useEffect(() => {
    Promise.all([
      ipc.students.list().catch(() => []),
      ipc.classes.list().catch(() => []),
      ipc.payments.listUnpaid().catch(() => []),
      ipc.payments.report(dayjs().year()).catch(() => null),
      ipc.bulletins.countUnvalidated().catch(() => 0),
      ipc.absences.globalStats().catch(() => null),
    ]).then(([s, c, u, r, bCount, abs]) => {
      setStudents(s); setClasses(c); setUnpaid(u); setMonthReport(r)
      setBulletinCount(bCount as number)
      setAbsenceStats(abs)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <Spin size="large" />
    </div>
  )

  const totalBalance = unpaid.reduce((s, u) => s + (u.balance ?? 0), 0)
  const currentMonth = dayjs().month() + 1
  const monthTotal   = monthReport?.byMonth?.[currentMonth]?.total ?? 0
  const monthCount   = monthReport?.byMonth?.[currentMonth]?.count ?? 0
  const yearTotal    = monthReport?.totalYear ?? 0
  const boysCount    = students.filter(s => s.gender === 'MALE').length
  const girlsCount   = students.length - boysCount
  const paidPct      = students.length > 0
    ? Math.round(((students.length - unpaid.length) / students.length) * 100)
    : 0

  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const monthChartData = MONTHS.map((m, i) => ({
    mois: m,
    total: monthReport?.byMonth?.[i + 1]?.total ?? 0,
  }))

  const byClass: Record<string, number> = {}
  students.forEach(s => {
    const cn = s.enrollments?.[0]?.class?.name ?? 'Non assigné'
    byClass[cn] = (byClass[cn] ?? 0) + 1
  })
  const classChartData = Object.entries(byClass)
    .sort(([, a], [, b]) => b - a).slice(0, 6)
    .map(([name, value]) => ({ name, value }))

  const PIE_COLORS = ['#6366F1','#06B6D4','#10B981','#F59E0B','#F43F5E','#A78BFA']

  const alerts: Array<{ id: number; type: 'warning' | 'error'; icon: React.ReactNode; title: string; desc: string; action?: () => void; actionLabel?: string }> = []
  if (bulletinCount > 0) alerts.push({
    id: 1, type: 'warning', icon: <FileTextOutlined />,
    title: `${bulletinCount} bulletin(s) à valider`,
    desc: 'Des bulletins attendent votre signature.',
    action: () => navigate('/grades'), actionLabel: 'Voir les bulletins',
  })
  if (unpaid.length > 0) alerts.push({
    id: 2, type: 'error', icon: <ExclamationCircleOutlined />,
    title: `${unpaid.length} élève(s) avec solde impayé`,
    desc: `Solde total dû : ${formatGNF(totalBalance)}`,
    action: () => navigate('/payments'), actionLabel: 'Voir les impayés',
  })
  const visibleAlerts = alerts.filter(a => !dismissedAlerts.includes(a.id))

  /* �"?�"? Shared styles �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */
  const C = {
    /* Cards */
    card: {
      background: isDark ? '#111827' : '#FFFFFF',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#E5E7EB'}`,
      borderRadius: 12,
    } as React.CSSProperties,
    /* Section label */
    sectionLabel: {
      fontSize: 11, fontWeight: 700 as const, textTransform: 'uppercase' as const,
      letterSpacing: '0.1em', color: token.colorTextTertiary,
      fontFamily: "'Inter', sans-serif",
    } as React.CSSProperties,
    /* Metric label */
    metricLabel: {
      fontSize: 11, fontWeight: 600 as const, textTransform: 'uppercase' as const,
      letterSpacing: '0.08em', color: token.colorTextTertiary,
      display: 'block', marginBottom: 6,
    } as React.CSSProperties,
    /* Metric value */
    metricValue: (color: string) => ({
      fontSize: 28, fontWeight: 800 as const, letterSpacing: '-0.04em',
      lineHeight: 1, fontVariantNumeric: 'tabular-nums' as const,
      color, whiteSpace: 'nowrap' as const, fontFamily: "'Inter', sans-serif",
    }) as React.CSSProperties,
  }

  const CHART_TT = {
    borderRadius: 8, fontSize: 12,
    background: isDark ? '#1F2937' : '#FFFFFF',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}`,
    color: isDark ? '#F9FAFB' : '#111827',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  }

  /* KPI data */
  const KPIS = [
    { label: 'Élèves inscrits',    value: students.length,          color: '#6366F1', icon: <TeamOutlined />,             sub: `${boysCount}G · ${girlsCount}F · ${classes.length} cl.` },
    { label: 'Encaissé ce mois',   value: formatGNF(monthTotal),    color: '#22C55E', icon: <DollarOutlined />,            sub: `${monthCount} paiement(s) · ${dayjs().format('MMMM')}` },
    { label: 'Total année',         value: formatGNF(yearTotal),     color: '#F59E0B', icon: <ArrowUpOutlined />,           sub: `Cumulé ${dayjs().year()}` },
    { label: 'Solde impayé',        value: formatGNF(totalBalance),  color: '#EF4444', icon: <ExclamationCircleOutlined />, sub: `${unpaid.length} élève(s) en retard` },
    { label: 'Présence du jour',    value: absenceStats ? `${absenceStats.todayRate}%` : '—', color: '#06B6D4', icon: <SafetyOutlined />, sub: absenceStats ? `${absenceStats.todayAbsences} absence(s)` : '—' },
  ]

  /* �"?�"? Shared style helpers �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"? */
  const surface = isDark ? '#111827' : '#FFFFFF'
  const border  = isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6'
  const muted   = token.colorTextTertiary as string
  const TT = {
    borderRadius: 8, fontSize: 12,
    background: isDark ? '#1F2937' : '#FFFFFF',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB'}`,
    color: isDark ? '#F9FAFB' : '#111827',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    padding: '8px 12px',
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
          SECTION 1 — HEADER
          �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28, gap: 16, flexWrap: 'wrap',
      }}>
        {/* Left */}
        <div>
          {/* Date pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB',
            border: `1px solid ${border}`,
            borderRadius: 999, padding: '3px 12px',
            fontSize: 11, color: muted, fontWeight: 500,
            marginBottom: 10, letterSpacing: 0.2,
          }}>
            {dayjs().format('dddd D MMMM YYYY')}
          </div>
          {/* Name */}
          <div style={{
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em',
            color: token.colorText, lineHeight: 1.1, marginBottom: 6,
          }}>
            Bonjour, {firstName} {lastName}
          </div>
          {/* Meta */}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: muted, flexWrap: 'wrap' }}>
            {[
              { label: `${students.length} élèves`, dot: '#6366F1' },
              { label: `${classes.length} classes`, dot: '#22C55E' },
              { label: `Année ${dayjs().year()}`, dot: '#F59E0B' },
            ].map((m, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right — actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<UserAddOutlined />} onClick={() => navigate('/students/new')}>
            Nouvel élève
          </Button>
          <Button type="primary" icon={<BarChartOutlined />} onClick={() => navigate('/reports')}>
            Rapports
          </Button>
        </div>
      </div>

      {/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
          ALERTS (compact, inline)
          �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */}
      {visibleAlerts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {visibleAlerts.map(a => (
            <div key={a.id} style={{
              flex: 1, minWidth: 260,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: isDark
                ? a.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'
                : a.type === 'error' ? '#FEF2F2' : '#FFFBEB',
              borderRadius: 10,
              borderLeft: `3px solid ${a.type === 'error' ? '#EF4444' : '#F59E0B'}`,
              border: `1px solid ${a.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
              borderLeftWidth: 3,
            }}>
              <span style={{ color: a.type === 'error' ? '#EF4444' : '#F59E0B', fontSize: 14 }}>
                {a.type === 'error' ? <ExclamationCircleOutlined /> : <WarningOutlined />}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: token.colorText }}>{a.title}</span>
                <span style={{ fontSize: 11, color: muted, marginLeft: 6 }}>{a.desc}</span>
              </div>
              {a.action && (
                <Button size="small" type="link" onClick={a.action} style={{ fontSize: 11, padding: 0, height: 'auto' }}>
                  {a.actionLabel} →
                </Button>
              )}
              <button onClick={() => setDismissedAlerts(p => [...p, a.id])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 13, padding: 0, lineHeight: 1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
          SECTION 2 — KPI CARDS (5 × equal, fixed height)
          �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {KPIS.map((kpi, i) => (
          <div key={i} style={{
            flex: '1 1 0', minWidth: 0,
            background: surface,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: '16px 18px',
            height: 120,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            borderTop: `3px solid ${kpi.color}`,
            transition: 'box-shadow 200ms, transform 200ms',
            cursor: 'default',
            boxSizing: 'border-box',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px ${kpi.color}30`
            ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
            ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
          }}
          >
            {/* Top row: label + icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted }}>
                {kpi.label}
              </span>
              <span style={{
                width: 28, height: 28, borderRadius: 7,
                background: `${kpi.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: kpi.color, fontSize: 14,
              }}>
                {kpi.icon}
              </span>
            </div>

            {/* Value */}
            <div style={{
              fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em',
              color: kpi.color, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {kpi.value}
            </div>

            {/* Sub */}
            <div style={{ fontSize: 10, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
          SECTION 3 — CHARTS + PANEL
          �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'stretch' }}>

        {/* Revenue chart (65%) */}
        <div style={{ flex: '0 0 63%', background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '20px 22px', minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted }}>
                Recettes — {dayjs().year()}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#22C55E', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {formatGNF(yearTotal)}
              </div>
            </div>
            <Button size="small" onClick={() => navigate('/reports')} style={{ marginTop: 4 }}>
              Rapports É'
            </Button>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={monthChartData} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#22C55E" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0.0}  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6'} />
              <XAxis dataKey="mois" tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} width={40}
              />
              <RechartTooltip formatter={(v: any) => [formatGNF(v), 'Recettes']} contentStyle={TT} cursor={{ stroke: '#22C55E', strokeWidth: 1, strokeDasharray: '4 2' }} />
              <Area type="monotone" dataKey="total" stroke="#22C55E" strokeWidth={2}
                fill="url(#greenGrad)"
                dot={(props: any) => {
                  const cur = props.index === dayjs().month()
                  return cur ? <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill="#22C55E" stroke="#FFFFFF" strokeWidth={2} /> : <g key={props.key} />
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right panel (37%) */}
        <div style={{ flex: '0 0 calc(37% - 12px)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

          {/* Recovery rate */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 14 }}>
              Taux de recouvrement
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Progress ring */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Progress
                  type="circle" percent={paidPct} size={64}
                  strokeColor={paidPct >= 80 ? '#22C55E' : paidPct >= 50 ? '#F59E0B' : '#EF4444'}
                  strokeWidth={8}
                  trailColor={isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'}
                  format={p => <span style={{ fontSize: 14, fontWeight: 800, color: token.colorText }}>{p}%</span>}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: muted }}>É jour</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>{students.length - unpaid.length}</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, borderRadius: 99, background: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6', marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${paidPct}%`, background: '#22C55E', borderRadius: 99 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: muted }}>En retard</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>{unpaid.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 12 }}>
              Accès rapide
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {[
                { icon: <UserAddOutlined />, label: 'Élève',     color: '#6366F1', to: '/students/new' },
                { icon: <DollarOutlined />,  label: 'Paiement', color: '#22C55E', to: '/payments'     },
                { icon: <CalendarOutlined />,label: 'Absences',  color: '#F59E0B', to: '/absences'     },
                { icon: <ReadOutlined />,    label: 'Bulletins', color: '#A78BFA', to: '/grades'       },
              ].map(a => (
                <button key={a.label} onClick={() => navigate(a.to)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 11px', borderRadius: 8, border: `1px solid ${border}`,
                  background: isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  color: token.colorTextSecondary,
                  transition: 'all 150ms', fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = `${a.color}12`
                  el.style.borderColor = `${a.color}30`
                  el.style.color = a.color
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA'
                  el.style.borderColor = border
                  el.style.color = token.colorTextSecondary as string
                }}
                >
                  <span style={{ color: a.color, fontSize: 14 }}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
          SECTION 4 — DATA ROW (Unpaid + Classes)
          �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */}
      <div style={{ display: 'flex', gap: 12 }}>

        {/* Unpaid (57%) */}
        <div style={{ flex: '0 0 57%', background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 4 }}>
                Impayés
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#EF4444', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                  {formatGNF(totalBalance)}
                </span>
                {unpaid.length > 0 && (
                  <span style={{
                    background: '#EF4444', color: '#fff',
                    fontSize: 10, fontWeight: 700, borderRadius: 999,
                    padding: '1px 7px',
                  }}>
                    {unpaid.length}
                  </span>
                )}
              </div>
            </div>
            <Button size="small" onClick={() => navigate('/payments')}>Voir tout É'</Button>
          </div>

          {unpaid.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircleFilled style={{ fontSize: 32, color: '#22C55E', display: 'block', marginBottom: 8 }} />
              <span style={{ fontSize: 12, color: muted }}>Tous les élèves sont à jour</span>
            </div>
          ) : (
            /* Clean table-style list */
            <div>
              {/* Header */}
              <div style={{
                display: 'flex', padding: '0 4px 8px',
                borderBottom: `1px solid ${border}`,
                marginBottom: 4,
              }}>
                {['Élève', 'Classe', 'Solde'].map((h, i) => (
                  <span key={h} style={{
                    flex: i === 0 ? 3 : i === 1 ? 2 : 2,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: muted,
                    textAlign: i === 2 ? 'right' : 'left',
                  }}>{h}</span>
                ))}
              </div>
              {unpaid.slice(0, 5).map((item: any, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center',
                  padding: '9px 4px',
                  borderBottom: i < 4 ? `1px solid ${border}` : 'none',
                }}>
                  {/* Avatar + name */}
                  <div style={{ flex: 3, display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: '#EF444415',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#EF4444', fontWeight: 700, fontSize: 12,
                    }}>
                      {(item.studentName ?? '?')[0]}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.studentName}
                    </span>
                  </div>
                  {/* Class */}
                  <div style={{ flex: 2 }}>
                    <span style={{ fontSize: 11, color: muted }}>{item.className}</span>
                  </div>
                  {/* Balance */}
                  <div style={{ flex: 2, textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', fontVariantNumeric: 'tabular-nums' }}>
                      {formatGNF(item.balance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Class distribution (43%) */}
        <div style={{ flex: '0 0 calc(43% - 12px)', background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px', minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 12 }}>
            Élèves par classe
          </div>
          {classChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={classChartData} dataKey="value" nameKey="name"
                  cx="50%" cy="46%"
                  outerRadius={68} innerRadius={36} paddingAngle={3}
                  strokeWidth={0}
                >
                  {classChartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartTooltip formatter={(v: any, n: any) => [`${v} élève(s)`, n]} contentStyle={TT} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: muted, paddingTop: 4 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: muted, fontSize: 12 }}>
              Aucune classe enregistrée
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
   SECRETARY DASHBOARD
   �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */
function SecretaryDashboard() {
  const navigate  = useNavigate()
  const { firstName } = useAuth()
  const { token } = theme.useToken()
  const themeMode = useSelector((s: RootState) => s.ui.theme)
  const isDark    = themeMode === 'dark'
  const [loading, setLoading] = useState(true)
  const [students,      setStudents]      = useState<any[]>([])
  const [unpaid,        setUnpaid]        = useState<any[]>([])
  const [todayPayments, setTodayPayments] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      ipc.students.list().catch(() => []),
      ipc.payments.listUnpaid().catch(() => []),
    ]).then(([s, u]) => {
      setStudents(s); setUnpaid(u)
      const today = dayjs().format('YYYY-MM-DD')
      const allPays: any[] = []
      Promise.all(
        s.slice(0, 30).map((st: any) => {
          const enrollId = st.enrollments?.[0]?.id
          if (!enrollId) return Promise.resolve([])
          return ipc.payments.list(enrollId)
            .then((pays: any[]) => pays
              .filter(p => dayjs(p.paidAt).format('YYYY-MM-DD') === today)
              .map(p => ({ ...p, studentName: `${st.lastName} ${st.firstName}` }))
            ).catch(() => [])
        })
      ).then(results => {
        results.forEach(pays => allPays.push(...pays))
        allPays.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
        setTodayPayments(allPays)
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <Spin size="large" />
    </div>
  )

  const todayTotal = todayPayments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const surface = isDark ? '#111827' : '#FFFFFF'
  const border  = isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6'
  const muted   = token.colorTextTertiary as string

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB', border: `1px solid ${border}`, borderRadius: 999, padding: '3px 12px', fontSize: 11, color: muted, marginBottom: 10 }}>
          {dayjs().format('dddd D MMMM YYYY')}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: token.colorText }}>
          Bonjour, {firstName ?? 'Secrétaire'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Élèves inscrits', value: students.length, color: '#6366F1', icon: <TeamOutlined /> },
          { label: "Encaissé aujourd'hui", value: formatGNF(todayTotal), color: '#22C55E', icon: <DollarOutlined /> },
          { label: 'Élèves impayés', value: unpaid.length, color: '#EF4444', icon: <ExclamationCircleOutlined /> },
        ].map((k, i) => (
          <div key={i} style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderTop: `3px solid ${k.color}`, borderRadius: 12, padding: '16px 18px', height: 110, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted }}>{k.label}</span>
              <span style={{ width: 26, height: 26, borderRadius: 6, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, fontSize: 13 }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            <div />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: '0 0 240px', background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 12 }}>Accès rapide</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {[
              { icon: <PlusOutlined />, label: 'Nouvel élève', color: '#6366F1', to: '/students/new' },
              { icon: <DollarOutlined />, label: 'Enregistrer un paiement', color: '#22C55E', to: '/payments' },
              { icon: <CalendarOutlined />, label: 'Saisir les absences', color: '#F59E0B', to: '/absences' },
              { icon: <ReadOutlined />, label: 'Saisir les notes', color: '#A78BFA', to: '/grades' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.to)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 8, border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: token.colorTextSecondary, transition: 'all 150ms', fontFamily: "'Inter', sans-serif", textAlign: 'left' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = `${a.color}10`; el.style.borderColor = `${a.color}30`; el.style.color = a.color }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFA'; el.style.borderColor = border; el.style.color = token.colorTextSecondary as string }}>
                <span style={{ color: a.color }}>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 4 }}>Paiements du jour</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#22C55E', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{formatGNF(todayTotal)}</div>
            </div>
            <Button size="small" onClick={() => navigate('/payments')}>Tous É'</Button>
          </div>
          {todayPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: muted, fontSize: 12 }}>Aucun paiement enregistré aujourd'hui</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {todayPayments.slice(0, 6).map((item: any, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 4px', borderBottom: i < 5 ? `1px solid ${border}` : 'none' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>{item.studentName}</div>
                    <div style={{ fontSize: 11, color: muted }}>{item.feeType?.name ?? '—'} · {formatDate(item.paidAt)}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E', fontVariantNumeric: 'tabular-nums' }}>{formatGNF(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.�
   TEACHER DASHBOARD
   �.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.��.� */
function TeacherDashboard({ firstName }: { firstName: string }) {
  const navigate  = useNavigate()
  const { token } = theme.useToken()
  const themeMode = useSelector((s: RootState) => s.ui.theme)
  const isDark    = themeMode === 'dark'
  const [classes, setClasses] = useState<any[]>([])

  useEffect(() => { ipc.classes.list().then(setClasses).catch(() => {}) }, [])

  const surface = isDark ? '#111827' : '#FFFFFF'
  const border  = isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6'
  const muted   = token.colorTextTertiary as string

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB', border: `1px solid ${border}`, borderRadius: 999, padding: '3px 12px', fontSize: 11, color: muted, marginBottom: 10 }}>
          {dayjs().format('dddd D MMMM YYYY')}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: token.colorText }}>
          Bienvenue, {firstName}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {[
          { icon: <ReadOutlined />, title: 'Saisie des notes', desc: 'DS1, DS2, Composition', color: '#6366F1', to: '/grades', btn: 'Saisir les notes' },
          { icon: <CalendarOutlined />, title: 'Absences', desc: 'Présences et absences', color: '#F59E0B', to: '/absences', btn: 'Feuille d\'appel' },
        ].map(a => (
          <div key={a.title} style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderTop: `3px solid ${a.color}`, borderRadius: 12, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.color, fontSize: 20 }}>{a.icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: token.colorText, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: muted }}>{a.desc}</div>
            </div>
            <Button type="primary" onClick={() => navigate(a.to)} style={{ background: a.color, borderColor: a.color, alignSelf: 'flex-start' }}>
              {a.btn}
            </Button>
          </div>
        ))}
      </div>

      {classes.length > 0 && (
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: muted, marginBottom: 12 }}>Mes classes</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {classes.map((c: any) => (
              <button key={c.id} onClick={() => navigate('/grades')} style={{
                padding: '6px 14px', borderRadius: 999, border: `1px solid ${border}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : '#F9FAFB',
                color: token.colorTextSecondary, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 150ms',
              }}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
