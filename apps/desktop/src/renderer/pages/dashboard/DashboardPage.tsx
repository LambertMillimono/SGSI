import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, List, Button, Typography, Spin, Space } from 'antd'
import {
  TeamOutlined,
  BankOutlined,
  ExclamationCircleOutlined,
  ReadOutlined,
  PlusOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import { useAuth } from '../../hooks/useAuth'
import { ipc } from '../../utils/ipcBridge'
import { formatGNF } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

function KpiCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
}) {
  return (
    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <Statistic
        title={<span style={{ fontSize: 13, color: '#6B7280' }}>{title}</span>}
        value={value}
        prefix={<span style={{ color, marginRight: 8 }}>{icon}</span>}
        valueStyle={{ color: '#111827', fontWeight: 700 }}
      />
    </Card>
  )
}

export function DashboardPage() {
  const { isDirecteur, isSecretaire, isEnseignant } = useRole()
  const { firstName } = useAuth()

  if (isEnseignant() && !isSecretaire()) {
    return <TeacherDashboard firstName={firstName ?? 'Enseignant'} />
  }
  if (isDirecteur()) {
    return <DirectorDashboard />
  }
  return <SecretaryDashboard />
}

// ─── DIRECTOR ────────────────────────────────────────────────────────────────

function DirectorDashboard() {
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [unpaid, setUnpaid] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      ipc.students.list().catch(() => []),
      ipc.classes.list().catch(() => []),
      ipc.payments.listUnpaid().catch(() => []),
    ]).then(([s, c, u]) => {
      setStudents(s)
      setClasses(c)
      setUnpaid(u)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  const totalBalance = unpaid.reduce((sum: number, u: any) => sum + (u.balance ?? 0), 0)

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue directeur — synthèse de l'établissement" />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title="Élèves inscrits" value={students.length} icon={<TeamOutlined />} color="#1E40AF" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title="Classes actives" value={classes.length} icon={<BankOutlined />} color="#16A34A" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title="Élèves impayés" value={unpaid.length} icon={<ExclamationCircleOutlined />} color="#D97706" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard title="Solde impayé total" value={formatGNF(totalBalance)} icon={<DollarOutlined />} color="#DC2626" />
        </Col>
      </Row>

      <Card
        title="Élèves avec solde impayé (Top 5)"
        bordered={false}
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        {unpaid.length === 0 ? (
          <Typography.Text type="secondary">Aucun impayé en attente</Typography.Text>
        ) : (
          <List
            dataSource={unpaid.slice(0, 5)}
            renderItem={(item: any) => (
              <List.Item>
                <List.Item.Meta
                  title={item.studentName}
                  description={`${item.className} — ${item.matricule}`}
                />
                <Typography.Text strong style={{ color: '#DC2626' }}>
                  {formatGNF(item.balance)}
                </Typography.Text>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}

// ─── SECRETARY ───────────────────────────────────────────────────────────────

function SecretaryDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [unpaid, setUnpaid] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      ipc.students.list().catch(() => []),
      ipc.payments.listUnpaid().catch(() => []),
    ]).then(([s, u]) => {
      setStudents(s)
      setUnpaid(u)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue secrétariat" />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard title="Élèves inscrits" value={students.length} icon={<TeamOutlined />} color="#1E40AF" />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <KpiCard title="Élèves impayés" value={unpaid.length} icon={<ExclamationCircleOutlined />} color="#D97706" />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 12, color: '#6B7280', fontSize: 13 }}>
              Accès rapide
            </Typography.Text>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" icon={<PlusOutlined />} block onClick={() => navigate('/students/new')}>
                Nouvel élève
              </Button>
              <Button icon={<PlusOutlined />} block onClick={() => navigate('/payments')}>
                Enregistrer un paiement
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title="Élèves avec solde impayé"
        bordered={false}
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        {unpaid.length === 0 ? (
          <Typography.Text type="secondary">Aucun impayé en attente</Typography.Text>
        ) : (
          <List
            dataSource={unpaid.slice(0, 5)}
            renderItem={(item: any) => (
              <List.Item>
                <List.Item.Meta title={item.studentName} description={item.className} />
                <Typography.Text strong style={{ color: '#DC2626' }}>
                  {formatGNF(item.balance)}
                </Typography.Text>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}

// ─── TEACHER ─────────────────────────────────────────────────────────────────

function TeacherDashboard({ firstName }: { firstName: string }) {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue enseignant" />
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          textAlign: 'center',
          padding: '40px 24px',
        }}
      >
        <ReadOutlined style={{ fontSize: 48, color: '#1E40AF', display: 'block', marginBottom: 16 }} />
        <Typography.Title level={3}>Bienvenue, {firstName} !</Typography.Title>
        <Typography.Paragraph type="secondary">
          Consultez et saisissez les notes de vos classes depuis le module Notes.
        </Typography.Paragraph>
        <Button type="primary" size="large" icon={<ReadOutlined />} onClick={() => navigate('/grades')}>
          Accéder aux notes
        </Button>
      </Card>
    </div>
  )
}
