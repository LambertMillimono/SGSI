import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Select, InputNumber, Input,
  Typography, Tag, Tooltip, Card, Row, Col, Statistic, Avatar,
} from 'antd'
import {
  PlusOutlined, FileTextOutlined, DollarOutlined, CalendarOutlined,
  TeamOutlined, CreditCardOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatGNF } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Option } = Select
const { Text } = Typography

const METHOD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CASH:          { label: 'Espèces',          color: '#16A34A', bg: '#F0FDF4' },
  ORANGE_MONEY:  { label: 'Orange Money',     color: '#EA580C', bg: '#FFF7ED' },
  WAVE:          { label: 'Wave',             color: '#0EA5E9', bg: '#F0F9FF' },
  MOBILE_MONEY:  { label: 'Mobile Money',     color: '#7C3AED', bg: '#F5F3FF' },
  BANK_TRANSFER: { label: 'Virement',         color: '#0369A1', bg: '#EFF6FF' },
}

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  return parts.map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export function PaymentListPage() {
  const message = useAppMessage()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [payments, setPayments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [feeTypes, setFeeTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [methodFilter, setMethodFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const loadPayments = async () => {
    setLoading(true)
    try {
      const stus = await ipc.students.list()
      setStudents(stus)
      const allPayments: any[] = []
      for (const s of stus.slice(0, 50)) {
        const enrollId = s.enrollments?.[0]?.id
        if (enrollId) {
          const pays = await ipc.payments.list(enrollId).catch(() => [])
          pays.forEach((p: any) => {
            allPayments.push({
              ...p,
              studentName: `${s.lastName} ${s.firstName}`,
              studentId: s.id,
            })
          })
        }
      }
      allPayments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      setPayments(allPayments)
    } catch {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
    ipc.payments.listFeeTypes().then(setFeeTypes).catch(() => {})
  }, [])

  const handleRecord = async (values: any) => {
    setSaving(true)
    try {
      const student = students.find((s: any) => s.id === values.studentId)
      const enrollmentId = student?.enrollments?.[0]?.id
      if (!enrollmentId) throw new Error('Élève non inscrit')
      await ipc.payments.record({
        enrollmentId,
        feeTypeId: values.feeTypeId,
        amount: values.amount,
        method: values.method,
        note: values.note,
      }, userId ?? 'system')
      message.success('Paiement enregistré')
      setModalOpen(false)
      form.resetFields()
      loadPayments()
    } catch (e: any) {
      message.error(e.message ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const filtered = methodFilter ? payments.filter(p => p.method === methodFilter) : payments
  const total = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const todayTotal = payments
    .filter(p => dayjs(p.paidAt).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD'))
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const uniqueStudents = new Set(payments.map(p => p.studentId)).size

  const columns = [
    {
      title: '#',
      key: 'idx',
      width: 44,
      render: (_: any, __: any, i: number) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{(page - 1) * 20 + i + 1}</Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'paidAt',
      key: 'date',
      width: 110,
      render: (d: string) => (
        <div>
          <Text strong style={{ fontSize: 12 }}>{dayjs(d).format('DD/MM/YYYY')}</Text>
          <div><Text type="secondary" style={{ fontSize: 10 }}>{dayjs(d).format('HH:mm')}</Text></div>
        </div>
      ),
    },
    {
      title: 'Élève',
      dataIndex: 'studentName',
      key: 'student',
      render: (name: string, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={30}
            style={{ background: '#1E40AF', fontSize: 10, fontWeight: 700, flexShrink: 0 }}
          >
            {getInitials(name)}
          </Avatar>
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 13 }}
            onClick={() => navigate(`/students/${r.studentId}`)}
          >
            {name}
          </Button>
        </div>
      ),
    },
    {
      title: 'Motif',
      dataIndex: ['feeType', 'name'],
      key: 'feeType',
      render: (v: string) => (
        <Tag style={{ background: '#EFF6FF', border: 0, color: '#1D4ED8', fontWeight: 600, fontSize: 11 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Montant',
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      sorter: (a: any, b: any) => a.amount - b.amount,
      render: (v: number) => (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#F0FDF4', borderRadius: 8, padding: '4px 10px',
        }}>
          <DollarOutlined style={{ color: '#16A34A', fontSize: 12 }} />
          <Text strong style={{ color: '#16A34A', fontSize: 13 }}>{formatGNF(v)}</Text>
        </div>
      ),
    },
    {
      title: 'Reçu',
      dataIndex: 'receiptNo',
      key: 'receipt',
      width: 120,
      render: (v: string) => (
        <Text code style={{ fontSize: 10, background: '#F0F9FF', borderColor: '#BAE6FD', color: '#0369A1' }}>
          {v}
        </Text>
      ),
    },
    {
      title: 'Méthode',
      dataIndex: 'method',
      key: 'method',
      width: 130,
      render: (v: string) => {
        const cfg = METHOD_CONFIG[v] ?? { label: v, color: '#6B7280', bg: '#F3F4F6' }
        return (
          <Tag style={{ background: cfg.bg, border: 0, color: cfg.color, fontWeight: 600, fontSize: 11 }}>
            {cfg.label}
          </Tag>
        )
      },
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_: any, r: any) => (
        <Tooltip title="Voir le reçu">
          <Button
            type="default"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/payments/${r.id}/receipt`)}
            style={{ borderRadius: 6 }}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Paiements"
        subtitle={`${payments.length} transaction${payments.length !== 1 ? 's' : ''} enregistrée${payments.length !== 1 ? 's' : ''}`}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => setModalOpen(true)}
            style={{ borderRadius: 8 }}
          >
            Nouveau paiement
          </Button>
        }
      />

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total encaissé', value: formatGNF(total), color: '#16A34A', icon: <DollarOutlined />, raw: true },
          { label: 'Encaissé aujourd\'hui', value: formatGNF(todayTotal), color: '#1E40AF', icon: <CalendarOutlined />, raw: true },
          { label: 'Nb. de transactions', value: payments.length, color: '#7C3AED', icon: <CreditCardOutlined />, raw: false },
          { label: 'Élèves ayant payé', value: uniqueStudents, color: '#D97706', icon: <TeamOutlined />, raw: false },
        ].map(({ label, value, color, icon, raw }) => (
          <Col xs={12} sm={6} key={label}>
            <Card
              size="small"
              variant="borderless"
              style={{ borderRadius: 10, borderLeft: `4px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <Statistic
                title={<span style={{ fontSize: 12 }}>{label}</span>}
                value={raw ? (value as string) : (value as number)}
                prefix={<span style={{ color, marginRight: 4, fontSize: 14 }}>{icon}</span>}
                valueStyle={{ fontSize: raw ? 15 : 20, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filtres */}
      <Card
        variant="borderless"
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: '10px 16px' } }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            placeholder="Toutes les méthodes"
            value={methodFilter}
            onChange={setMethodFilter}
            allowClear
            style={{ width: 180 }}
          >
            {Object.entries(METHOD_CONFIG).map(([key, cfg]) => (
              <Option key={key} value={key}>
                <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
              </Option>
            ))}
          </Select>
          {methodFilter && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} — {formatGNF(filtered.reduce((s, p) => s + p.amount, 0))}
            </Text>
          )}
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
          </Text>
        </div>
      </Card>

      <Card variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: 20,
            total: filtered.length,
            onChange: setPage,
            showTotal: (t) => `${t} transaction${t !== 1 ? 's' : ''}`,
            style: { padding: '12px 16px' },
          }}
          size="middle"
          locale={{ emptyText: 'Aucun paiement enregistré' }}
          style={{ borderRadius: 10 }}
        />
      </Card>

      {/* Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: '#EFF6FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DollarOutlined style={{ color: '#1E40AF', fontSize: 16 }} />
            </div>
            <span>Nouveau paiement</span>
          </div>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleRecord} requiredMark={false} style={{ marginTop: 8 }}>
          <Form.Item
            name="studentId"
            label={<span style={{ fontWeight: 600 }}>Élève</span>}
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Select
              showSearch
              placeholder="Rechercher un élève…"
              filterOption={(input, opt) =>
                (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={students.map((s: any) => ({
                value: s.id,
                label: `${s.lastName} ${s.firstName} — ${s.matricule}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="feeTypeId"
            label={<span style={{ fontWeight: 600 }}>Motif du paiement</span>}
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Select
              placeholder="Sélectionner le motif"
              onChange={(id) => {
                const ft = feeTypes.find((f: any) => f.id === id)
                if (ft) form.setFieldValue('amount', ft.amount)
              }}
            >
              {feeTypes.map((f: any) => (
                <Option key={f.id} value={f.id}>
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span style={{ color: '#6B7280', marginLeft: 8 }}>{formatGNF(f.amount)}</span>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="amount"
                label={<span style={{ fontWeight: 600 }}>Montant (GNF)</span>}
                rules={[{ required: true, message: 'Requis' }]}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={(v) => Number(v?.replace(/\s/g, '') ?? 0)}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="method"
                label={<span style={{ fontWeight: 600 }}>Mode de paiement</span>}
                rules={[{ required: true, message: 'Requis' }]}
              >
                <Select placeholder="Méthode">
                  {Object.entries(METHOD_CONFIG).map(([key, cfg]) => (
                    <Option key={key} value={key}>
                      <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label={<span style={{ fontWeight: 600 }}>Remarque (optionnel)</span>}>
            <Input.TextArea rows={2} placeholder="Remarque optionnelle…" />
          </Form.Item>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving} style={{ fontWeight: 600 }}>
              Enregistrer le paiement
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
