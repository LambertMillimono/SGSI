import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, List, Button, Typography, Spin, Space, Progress, Badge, Divider } from 'antd'
import {
  TeamOutlined, ExclamationCircleOutlined,
  ReadOutlined, PlusOutlined, DollarOutlined, CalendarOutlined,
  ArrowUpOutlined, BellFilled, CheckCircleFilled, WarningFilled,
  FileTextOutlined, UserAddOutlined, BarChartOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import { useAuth } from '../../hooks/useAuth'
import { ipc } from '../../utils/ipcBridge'
import { formatGNF, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'
import dayjs from 'dayjs'

const { Text, Title } = Typography

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  title, value, icon, color, sub,
}: {
  title: string; value: number | string; icon: React.ReactNode; color: string; sub?: string
}) {
  return (
    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderTop: `3px solid ${color}` }}>
      <Statistic
        title={<span style={{ fontSize: 13 }}>{title}</span>}
        value={value}
        prefix={<span style={{ color, marginRight: 6 }}>{icon}</span>}
        valueStyle={{ fontWeight: 700, fontSize: 22 }}
      />
      {sub && <Text type="secondary" style={{ fontSize: 11 }}>{sub}</Text>}
    </Card>
  )
}

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

// ─── DIRECTEUR ───────────────────────────────────────────────────────────────
function DirectorDashboard() {
  const navigate = useNavigate()
  const { firstName, lastName } = useAuth()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [unpaid, setUnpaid] = useState<any[]>([])
  const [monthReport, setMonthReport] = useState<any>(null)
  const [bulletinCount, setBulletinCount] = useState(0)
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([])

  useEffect(() => {
    const currentYear = dayjs().year()
    Promise.all([
      ipc.students.list().catch(() => []),
      ipc.classes.list().catch(() => []),
      ipc.payments.listUnpaid().catch(() => []),
      ipc.payments.report(currentYear).catch(() => null),
      ipc.bulletins.countUnvalidated().catch(() => 0),
    ]).then(([s, c, u, r, bCount]) => {
      setStudents(s); setClasses(c); setUnpaid(u); setMonthReport(r)
      setBulletinCount(bCount as number)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const totalBalance = unpaid.reduce((s: number, u: any) => s + (u.balance ?? 0), 0)
  const currentMonth = dayjs().month() + 1
  const monthTotal = monthReport?.byMonth?.[currentMonth]?.total ?? 0
  const monthCount = monthReport?.byMonth?.[currentMonth]?.count ?? 0
  const yearTotal = monthReport?.totalYear ?? 0
  const boysCount = students.filter((s: any) => s.gender === 'MALE').length
  const girlsCount = students.length - boysCount

  const paidPct = students.length > 0
    ? Math.round(((students.length - unpaid.length) / students.length) * 100)
    : 0

  const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const monthChartData = MONTH_LABELS.map((m, i) => ({
    mois: m,
    total: monthReport?.byMonth?.[i + 1]?.total ?? 0,
  }))

  const byClass: Record<string, number> = {}
  students.forEach((s: any) => {
    const cn = s.enrollments?.[0]?.class?.name ?? 'Non assigné'
    byClass[cn] = (byClass[cn] ?? 0) + 1
  })
  const classChartData = Object.entries(byClass)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))

  const PIE_COLORS = ['#1E40AF','#2563EB','#3B82F6','#60A5FA','#7C3AED','#8B5CF6','#EC4899','#F59E0B']

  // Alertes actives
  type AlertItem = { id: number; type: 'warning' | 'error'; icon: React.ReactNode; title: string; desc: string; action?: () => void; actionLabel?: string }
  const allAlerts: AlertItem[] = []
  if (bulletinCount > 0) allAlerts.push({
    id: 1, type: 'warning',
    icon: <FileTextOutlined />,
    title: `${bulletinCount} bulletin(s) à valider`,
    desc: 'Des bulletins générés attendent votre signature pour être officialisés.',
    action: () => navigate('/grades'), actionLabel: 'Accéder aux bulletins',
  })
  if (unpaid.length > 0) allAlerts.push({
    id: 2, type: 'error',
    icon: <ExclamationCircleOutlined />,
    title: `${unpaid.length} élève(s) avec solde impayé`,
    desc: `Solde total dû : ${formatGNF(totalBalance)}`,
    action: () => navigate('/payments'), actionLabel: 'Voir les impayés',
  })
  const visibleAlerts = allAlerts.filter(a => !dismissedAlerts.includes(a.id))

  return (
    <div>
      {/* ── Bannière de bienvenue ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 60%, #3B82F6 100%)',
        borderRadius: 16, padding: '24px 32px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
      }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 }}>
            {dayjs().format('dddd D MMMM YYYY')}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>
            Bienvenue, {firstName} {lastName} 👋
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>
            {classes.length} classe(s) · {students.length} élève(s) · Année {dayjs().year()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            size="small" ghost
            icon={<UserAddOutlined />}
            onClick={() => navigate('/students/new')}
            style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
          >
            Nouvel élève
          </Button>
          <Button
            size="small" ghost
            icon={<BarChartOutlined />}
            onClick={() => navigate('/reports')}
            style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
          >
            Rapports
          </Button>
        </div>
      </div>

      {/* ── Alertes centrées ── */}
      {visibleAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          {visibleAlerts.map((a) => (
            <div key={a.id} style={{
              width: '100%', maxWidth: 680,
              background: a.type === 'error' ? '#FEF2F2' : '#FFFBEB',
              border: `1.5px solid ${a.type === 'error' ? '#FECACA' : '#FDE68A'}`,
              borderRadius: 12, padding: '14px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: a.type === 'error' ? '#DC2626' : '#D97706',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 18,
              }}>
                {a.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: a.type === 'error' ? '#991B1B' : '#92400E' }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{a.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {a.action && (
                  <Button size="small" type="primary" danger={a.type === 'error'} onClick={a.action}>
                    {a.actionLabel}
                  </Button>
                )}
                <Button
                  size="small" type="text"
                  style={{ color: '#9CA3AF' }}
                  onClick={() => setDismissedAlerts(prev => [...prev, a.id])}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── KPIs ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title="Élèves inscrits" value={students.length} icon={<TeamOutlined />} color="#1E40AF"
            sub={`${boysCount}G · ${girlsCount}F · ${classes.length} classe(s)`} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title="Encaissé ce mois" value={formatGNF(monthTotal)} icon={<DollarOutlined />} color="#16A34A"
            sub={`${monthCount} paiement(s) en ${dayjs().format('MMMM')}`} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title="Total année" value={formatGNF(yearTotal)} icon={<ArrowUpOutlined />} color="#7C3AED"
            sub={`Cumulé ${dayjs().format('YYYY')}`} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title="Solde impayé" value={formatGNF(totalBalance)} icon={<ExclamationCircleOutlined />} color="#DC2626"
            sub={`${unpaid.length} élève(s) en retard`} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Taux + Accès rapide */}
        <Col xs={24} lg={8}>
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', height: '100%' }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>Taux de recouvrement</Title>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <Progress
                type="circle"
                percent={paidPct}
                size={110}
                strokeColor={paidPct >= 80 ? '#16A34A' : paidPct >= 50 ? '#D97706' : '#DC2626'}
                format={(p) => <span style={{ fontSize: 18, fontWeight: 700 }}>{p}%</span>}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 12 }}>
              <Text type="secondary">À jour : <Text strong style={{ color: '#16A34A' }}>{students.length - unpaid.length}</Text></Text>
              <Text type="secondary">En retard : <Text strong style={{ color: '#DC2626' }}>{unpaid.length}</Text></Text>
            </div>
            <Divider style={{ margin: '10px 0' }} />
            <Title level={5} style={{ marginTop: 8, marginBottom: 8, fontSize: 13 }}>Accès rapide</Title>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <Button size="small" icon={<UserAddOutlined />} block onClick={() => navigate('/students/new')}>Inscrire un élève</Button>
              <Button size="small" icon={<DollarOutlined />} block onClick={() => navigate('/payments')}>Enregistrer un paiement</Button>
              <Button size="small" icon={<CalendarOutlined />} block onClick={() => navigate('/absences')}>Saisir les absences</Button>
              <Button size="small" icon={<FileTextOutlined />} block onClick={() => navigate('/grades')}>Voir les bulletins</Button>
            </Space>
          </Card>
        </Col>

        {/* Top impayés */}
        <Col xs={24} lg={16}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            title={
              <span>
                <ExclamationCircleOutlined style={{ color: '#DC2626', marginRight: 8 }} />
                Élèves avec solde impayé
                {unpaid.length > 0 && <Badge count={unpaid.length} style={{ marginLeft: 8, background: '#DC2626' }} />}
              </span>
            }
            extra={<Button size="small" type="link" onClick={() => navigate('/payments')}>Voir tout →</Button>}
          >
            {unpaid.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircleFilled style={{ fontSize: 36, color: '#16A34A', display: 'block', marginBottom: 8 }} />
                <Text type="secondary">Tous les élèves sont à jour ✓</Text>
              </div>
            ) : (
              <List
                dataSource={unpaid.slice(0, 6)}
                size="small"
                renderItem={(item: any) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: '#FEE2E2', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: '#DC2626', fontWeight: 700, fontSize: 12,
                        }}>
                          {(item.studentName ?? '?')[0]}
                        </div>
                      }
                      title={<Text strong style={{ fontSize: 13 }}>{item.studentName}</Text>}
                      description={<Text type="secondary" style={{ fontSize: 11 }}>{item.className} · {item.matricule}</Text>}
                    />
                    <Text strong style={{ color: '#DC2626', fontSize: 13 }}>{formatGNF(item.balance)}</Text>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Graphiques ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={15}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            title={<span><DollarOutlined style={{ color: '#1E40AF', marginRight: 8 }} />Recettes mensuelles — {dayjs().year()}</span>}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthChartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48}
                />
                <Tooltip
                  formatter={(v: any) => [formatGNF(v), 'Recettes']}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #E5E7EB' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {monthChartData.map((_, i) => (
                    <Cell key={i} fill={i === dayjs().month() ? '#1E40AF' : '#BFDBFE'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            title={<span><TeamOutlined style={{ color: '#7C3AED', marginRight: 8 }} />Élèves par classe</span>}
          >
            {classChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={classChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={3}
                  >
                    {classChartData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any) => [`${v} élève(s)`, name]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>Aucune donnée</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ─── SECRÉTARIAT ─────────────────────────────────────────────────────────────
function SecretaryDashboard() {
  const navigate = useNavigate()
  const { firstName } = useAuth()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [unpaid, setUnpaid] = useState<any[]>([])
  const [todayPayments, setTodayPayments] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      ipc.students.list().catch(() => []),
      ipc.payments.listUnpaid().catch(() => []),
    ]).then(([s, u]) => {
      setStudents(s); setUnpaid(u)
      // Collect today's payments from first 30 students
      const today = dayjs().format('YYYY-MM-DD')
      const allPayments: any[] = []
      Promise.all(
        s.slice(0, 30).map((st: any) => {
          const enrollId = st.enrollments?.[0]?.id
          if (!enrollId) return Promise.resolve([])
          return ipc.payments.list(enrollId)
            .then((pays: any[]) => pays
              .filter((p) => dayjs(p.paidAt).format('YYYY-MM-DD') === today)
              .map((p) => ({ ...p, studentName: `${st.lastName} ${st.firstName}` }))
            )
            .catch(() => [])
        })
      ).then((results) => {
        results.forEach((pays) => allPayments.push(...pays))
        allPayments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
        setTodayPayments(allPayments)
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const todayTotal = todayPayments.reduce((s, p) => s + (p.amount ?? 0), 0)

  return (
    <div>
      <PageHeader
        title={`Bonjour, ${firstName ?? 'Secrétaire'} !`}
        subtitle={dayjs().format('dddd D MMMM YYYY')}
      />

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <KpiCard title="Élèves inscrits" value={students.length} icon={<TeamOutlined />} color="#1E40AF" />
        </Col>
        <Col xs={24} sm={8}>
          <KpiCard title="Encaissé aujourd'hui" value={formatGNF(todayTotal)} icon={<DollarOutlined />} color="#16A34A"
            sub={`${todayPayments.length} paiement(s)`} />
        </Col>
        <Col xs={24} sm={8}>
          <KpiCard title="Élèves impayés" value={unpaid.length} icon={<ExclamationCircleOutlined />} color="#D97706" />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Accès rapide */}
        <Col xs={24} lg={8}>
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Title level={5} style={{ marginTop: 0 }}>Accès rapide</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" icon={<PlusOutlined />} block onClick={() => navigate('/students/new')}>
                Nouvel élève
              </Button>
              <Button icon={<DollarOutlined />} block onClick={() => navigate('/payments')}>
                Enregistrer un paiement
              </Button>
              <Button icon={<CalendarOutlined />} block onClick={() => navigate('/absences')}>
                Saisir les absences
              </Button>
              <Button icon={<ReadOutlined />} block onClick={() => navigate('/grades')}>
                Saisir les notes
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Paiements du jour */}
        <Col xs={24} lg={16}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            title={
              <span>
                <DollarOutlined style={{ color: '#16A34A', marginRight: 8 }} />
                Paiements du jour
                {todayTotal > 0 && (
                  <Tag color="green" style={{ marginLeft: 8 }}>{formatGNF(todayTotal)}</Tag>
                )}
              </span>
            }
            extra={<Button size="small" type="link" onClick={() => navigate('/payments')}>Tous les paiements</Button>}
          >
            {todayPayments.length === 0 ? (
              <Text type="secondary">Aucun paiement enregistré aujourd'hui</Text>
            ) : (
              <List
                dataSource={todayPayments.slice(0, 8)}
                size="small"
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Text strong>{item.studentName}</Text>}
                      description={<Text type="secondary" style={{ fontSize: 11 }}>{item.feeType?.name ?? '—'} · {formatDate(item.paidAt)}</Text>}
                    />
                    <Text strong style={{ color: '#16A34A' }}>{formatGNF(item.amount)}</Text>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ─── ENSEIGNANT ──────────────────────────────────────────────────────────────
function TeacherDashboard({ firstName }: { firstName: string }) {
  const navigate = useNavigate()
  const [classes, setClasses] = useState<any[]>([])

  useEffect(() => {
    ipc.classes.list().then(setClasses).catch(() => {})
  }, [])

  return (
    <div>
      <PageHeader title={`Bienvenue, ${firstName} !`} subtitle={dayjs().format('dddd D MMMM YYYY')} />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center', padding: '24px 0' }}
          >
            <ReadOutlined style={{ fontSize: 44, color: '#1E40AF', display: 'block', marginBottom: 12 }} />
            <Title level={4} style={{ marginBottom: 8 }}>Saisie des notes</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Entrez les notes DS1, DS2 et Composition par classe et matière.
            </Text>
            <Button type="primary" size="large" icon={<ReadOutlined />} onClick={() => navigate('/grades')}>
              Accéder aux notes
            </Button>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            variant="borderless"
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center', padding: '24px 0' }}
          >
            <CalendarOutlined style={{ fontSize: 44, color: '#D97706', display: 'block', marginBottom: 12 }} />
            <Title level={4} style={{ marginBottom: 8 }}>Gestion des absences</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Marquez les présences et absences pour chaque séance.
            </Text>
            <Button size="large" icon={<CalendarOutlined />} onClick={() => navigate('/absences')}>
              Feuille d'absences
            </Button>
          </Card>
        </Col>
        {classes.length > 0 && (
          <Col xs={24}>
            <Card
              variant="borderless"
              style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              title="Mes classes"
            >
              <Row gutter={[8, 8]}>
                {classes.map((c: any) => (
                  <Col key={c.id}>
                    <Tag
                      color="blue"
                      style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                      onClick={() => navigate('/grades')}
                    >
                      {c.name}
                    </Tag>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  )
}
