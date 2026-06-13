import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Tabs, Descriptions, Tag, Button, Table, Typography,
  Spin, Result, Space, Avatar,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, UserOutlined,
  DollarOutlined, ReadOutlined, FileOutlined,
} from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { formatDate, formatGNF } from '../../utils/formatters'
import { StatusBadge } from '../../components/shared/StatusBadge'

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    ipc.students.getById(id)
      .then(setStudent)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (notFound || !student) {
    return (
      <Result
        status="404"
        title="Élève introuvable"
        extra={<Button type="primary" onClick={() => navigate('/students')}>Retour à la liste</Button>}
      />
    )
  }

  const currentEnrollment = student.enrollments?.[0]

  const tabItems = [
    {
      key: 'history',
      label: <span><ReadOutlined /> Scolarité</span>,
      children: <EnrollmentTab enrollments={student.enrollments ?? []} />,
    },
    {
      key: 'payments',
      label: <span><DollarOutlined /> Paiements</span>,
      children: <PaymentsTab enrollmentId={currentEnrollment?.id} />,
    },
    {
      key: 'grades',
      label: <span><ReadOutlined /> Notes</span>,
      children: <GradesTab enrollmentId={currentEnrollment?.id} />,
    },
    {
      key: 'documents',
      label: <span><FileOutlined /> Documents</span>,
      children: <DocumentsTab documents={student.documents ?? []} />,
    },
  ]

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/students')}>
          Retour
        </Button>
        <Typography.Title level={3} style={{ margin: 0, flex: 1 }}>
          {student.lastName} {student.firstName}
        </Typography.Title>
        <Button icon={<EditOutlined />} onClick={() => navigate(`/students/${id}/edit`)}>
          Modifier
        </Button>
      </div>

      {/* Summary card */}
      <Card
        bordered={false}
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <Avatar
            size={80}
            icon={<UserOutlined />}
            src={student.photo}
            style={{ background: '#1E40AF', flexShrink: 0 }}
          />
          <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
            <Descriptions.Item label="Matricule">
              <Typography.Text code>{student.matricule}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Classe">
              {currentEnrollment?.class?.name ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Statut">
              <StatusBadge status={currentEnrollment?.status ?? 'ACTIVE'} />
            </Descriptions.Item>
            <Descriptions.Item label="Date de naissance">
              {student.birthDate ? formatDate(student.birthDate) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Lieu de naissance">
              {student.birthPlace ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Sexe">
              {student.gender === 'MALE' ? 'Masculin' : 'Féminin'}
            </Descriptions.Item>
            <Descriptions.Item label="Téléphone">
              {student.phone ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Nationalité">
              {student.nationality ?? '—'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Card>

      {/* Tabs */}
      <Card
        bordered={false}
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}

// ─── Onglet Scolarité ────────────────────────────────────────────────────────

function EnrollmentTab({ enrollments }: { enrollments: any[] }) {
  const columns = [
    { title: 'Année', dataIndex: ['academicYear', 'label'], key: 'year' },
    { title: 'Classe', dataIndex: ['class', 'name'], key: 'class' },
    {
      title: 'Statut',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <StatusBadge status={s} />,
    },
    {
      title: 'Date inscription',
      dataIndex: 'enrolledAt',
      key: 'date',
      render: (d: string) => d ? formatDate(d) : '—',
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={enrollments}
      rowKey="id"
      pagination={false}
      size="small"
      locale={{ emptyText: 'Aucun historique scolaire' }}
    />
  )
}

// ─── Onglet Paiements ────────────────────────────────────────────────────────

function PaymentsTab({ enrollmentId }: { enrollmentId?: string }) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enrollmentId) return
    setLoading(true)
    ipc.payments.list(enrollmentId).then(setPayments).catch(() => {}).finally(() => setLoading(false))
  }, [enrollmentId])

  const columns = [
    {
      title: 'Date',
      dataIndex: 'paidAt',
      key: 'date',
      render: (d: string) => formatDate(d),
    },
    { title: 'Motif', dataIndex: ['feeType', 'name'], key: 'feeType' },
    {
      title: 'Montant',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => <Typography.Text strong>{formatGNF(v)}</Typography.Text>,
    },
    { title: 'Reçu N°', dataIndex: 'receiptNo', key: 'receipt' },
    { title: 'Méthode', dataIndex: 'method', key: 'method' },
  ]

  if (!enrollmentId) return <Typography.Text type="secondary">Élève non inscrit</Typography.Text>

  return (
    <Table
      columns={columns}
      dataSource={payments}
      rowKey="id"
      loading={loading}
      pagination={false}
      size="small"
      locale={{ emptyText: 'Aucun paiement enregistré' }}
    />
  )
}

// ─── Onglet Notes ────────────────────────────────────────────────────────────

function GradesTab({ enrollmentId }: { enrollmentId?: string }) {
  const navigate = useNavigate()

  if (!enrollmentId) return <Typography.Text type="secondary">Élève non inscrit</Typography.Text>

  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <ReadOutlined style={{ fontSize: 36, color: '#1E40AF', marginBottom: 12, display: 'block' }} />
      <Typography.Paragraph type="secondary">
        Les notes sont gérées dans le module Notes.
      </Typography.Paragraph>
      <Button type="primary" onClick={() => navigate('/grades')}>
        Accéder aux notes
      </Button>
    </div>
  )
}

// ─── Onglet Documents ────────────────────────────────────────────────────────

function DocumentsTab({ documents }: { documents: any[] }) {
  if (documents.length === 0) {
    return <Typography.Text type="secondary">Aucun document enregistré</Typography.Text>
  }

  return (
    <Table
      dataSource={documents}
      rowKey="id"
      pagination={false}
      size="small"
      columns={[
        { title: 'Type', dataIndex: 'type', key: 'type' },
        {
          title: 'Date upload',
          dataIndex: 'uploadedAt',
          key: 'date',
          render: (d: string) => formatDate(d),
        },
      ]}
    />
  )
}
