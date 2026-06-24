import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker,
  Typography, Tag, Popconfirm, Card, Row, Col, Statistic, Tabs,
  Alert, Space, Divider,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ShopOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatGNF, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Option } = Select
const { Text } = Typography

const CATEGORIES = [
  'Fournitures scolaires',
  'Entretien et réparation',
  'Électricité / Eau',
  'Salaires et primes',
  'Transport',
  'Alimentation / Cantine',
  'Matériel informatique',
  'Communication',
  'Frais administratifs',
  'Divers',
]

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']

export function ExpensesPage() {
  return (
    <div>
      <PageHeader title="Dépenses & Caisse" subtitle="Gestion des dépenses et de la caisse journalière" />
      <Card variant="borderless" style={{ borderRadius: 12 }}>
        <Tabs
          items={[
            { key: 'expenses', label: 'Dépenses', children: <ExpensesTab /> },
            { key: 'cash', label: 'Caisse du jour', children: <CashTab /> },
            { key: 'summary', label: 'Résumé annuel', children: <SummaryTab /> },
          ]}
        />
      </Card>
    </div>
  )
}

// ─── Dépenses ────────────────────────────────────────────────────────────────
function ExpensesTab() {
  const message = useAppMessage()
  const { userId, firstName, lastName } = useAuth()
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [filterMonth, setFilterMonth] = useState<number | undefined>(dayjs().month() + 1)
  const [filterYear] = useState(dayjs().year())

  const load = () => {
    setLoading(true)
    ipc.expenses.list({ year: filterYear, month: filterMonth })
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterMonth])

  const handleCreate = async (values: any) => {
    setSaving(true)
    try {
      await ipc.expenses.create({
        label: values.label,
        amount: values.amount,
        category: values.category,
        recordedBy: userId ?? 'system',
        doneAt: values.doneAt?.toDate() ?? new Date(),
      })
      message.success('Dépense enregistrée')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipc.expenses.delete(id)
      message.success('Dépense supprimée')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const total = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  const columns = [
    {
      title: 'Date',
      dataIndex: 'doneAt',
      key: 'date',
      width: 100,
      render: (d: string) => formatDate(d),
    },
    {
      title: 'Libellé',
      dataIndex: 'label',
      key: 'label',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Catégorie',
      dataIndex: 'category',
      key: 'cat',
      width: 170,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Montant',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      render: (v: number) => <Text strong style={{ color: '#DC2626' }}>{formatGNF(v)}</Text>,
    },
    {
      title: 'Saisi par',
      dataIndex: 'recordedBy',
      key: 'by',
      width: 100,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: '',
      key: 'del',
      width: 50,
      render: (_: any, r: any) => (
        <Popconfirm title="Supprimer cette dépense ?" onConfirm={() => handleDelete(r.id)} okText="Supprimer" okButtonProps={{ danger: true }}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Select
          value={filterMonth}
          onChange={setFilterMonth}
          style={{ width: 140 }}
          allowClear
          placeholder="Tous les mois"
        >
          {MONTHS.map((m, i) => <Option key={i + 1} value={i + 1}>{m} {filterYear}</Option>)}
        </Select>

        {total > 0 && (
          <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>
            Total : {formatGNF(total)}
          </Tag>
        )}

        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Nouvelle dépense
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={expenses}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="middle"
        locale={{ emptyText: 'Aucune dépense enregistrée' }}
        summary={() => total > 0 ? (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3} align="right">
              <Text strong>Total</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3}>
              <Text strong style={{ color: '#DC2626' }}>{formatGNF(total)}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} colSpan={2} />
          </Table.Summary.Row>
        ) : null}
      />

      <Modal
        title={<><ShopOutlined style={{ marginRight: 8 }} />Nouvelle dépense</>}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={460}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}
          initialValues={{ doneAt: dayjs() }}>
          <Form.Item name="label" label="Libellé" rules={[{ required: true, message: 'Requis' }]}>
            <Input placeholder="Ex: Achat de craies et cahiers" />
          </Form.Item>
          <Form.Item name="category" label="Catégorie" rules={[{ required: true }]}>
            <Select placeholder="Choisir...">
              {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="Montant (GNF)" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }} min={1}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
            />
          </Form.Item>
          <Form.Item name="doneAt" label="Date">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Enregistrer</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Caisse du jour ───────────────────────────────────────────────────────────
function CashTab() {
  const message = useAppMessage()
  const { userId } = useAuth()
  const [cash, setCash] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [openForm] = Form.useForm()
  const [closeForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    ipc.expenses.todayCash()
      .then(setCash)
      .catch(() => setCash(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleOpen = async (values: any) => {
    setSaving(true)
    try {
      await ipc.expenses.openCash(values.openBalance, userId ?? 'system')
      message.success('Caisse ouverte')
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async (values: any) => {
    setSaving(true)
    try {
      await ipc.expenses.closeCash(cash.id, values.closeBalance, userId ?? 'system')
      message.success('Caisse clôturée')
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div style={{ maxWidth: 500 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {dayjs().format('dddd D MMMM YYYY')}
      </Text>

      {!cash ? (
        <Card variant="borderless" style={{ borderTop: '3px solid #1E40AF', borderRadius: 8 }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Ouvrir la caisse</Text>
          <Form form={openForm} layout="vertical" onFinish={handleOpen} requiredMark={false}>
            <Form.Item name="openBalance" label="Solde d'ouverture (GNF)" rules={[{ required: true }]}>
              <InputNumber
                style={{ width: '100%' }} min={0}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} icon={<UnlockOutlined />}>
              Ouvrir la caisse
            </Button>
          </Form>
        </Card>
      ) : cash.isClosed ? (
        <Alert
          type="info"
          icon={<LockOutlined />}
          showIcon
          message="Caisse clôturée"
          description={
            <div>
              <div>Solde d'ouverture : <Text strong>{formatGNF(cash.openBalance)}</Text></div>
              <div>Solde de clôture : <Text strong>{formatGNF(cash.closeBalance ?? 0)}</Text></div>
              <div>Clôturée par : {cash.closedBy}</div>
            </div>
          }
        />
      ) : (
        <Card variant="borderless" style={{ borderTop: '3px solid #16A34A', borderRadius: 8 }}>
          <Alert
            type="success"
            showIcon
            icon={<UnlockOutlined />}
            message="Caisse ouverte"
            description={`Solde d'ouverture : ${formatGNF(cash.openBalance)} — Ouverte par ${cash.openedBy}`}
            style={{ marginBottom: 16 }}
          />
          <Divider style={{ margin: '12px 0' }}>Clôturer la caisse</Divider>
          <Form form={closeForm} layout="vertical" onFinish={handleClose} requiredMark={false}>
            <Form.Item name="closeBalance" label="Solde de clôture (GNF)" rules={[{ required: true }]}>
              <InputNumber
                style={{ width: '100%' }} min={0}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
              />
            </Form.Item>
            <Button danger htmlType="submit" loading={saving} icon={<LockOutlined />}>
              Clôturer la caisse
            </Button>
          </Form>
        </Card>
      )}
    </div>
  )
}

// ─── Résumé annuel ────────────────────────────────────────────────────────────
function SummaryTab() {
  const [year, setYear] = useState(dayjs().year())
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    ipc.expenses.summary(year)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [year])

  const yearOptions = Array.from({ length: 5 }, (_, i) => dayjs().year() - i)
  const maxMonth = summary ? Math.max(...Object.values(summary.byMonth as Record<string, number>), 1) : 1

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Select value={year} onChange={setYear} style={{ width: 110 }}>
          {yearOptions.map(y => <Option key={y} value={y}>{y}</Option>)}
        </Select>
      </div>

      {summary && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={8}>
              <Card size="small" style={{ borderTop: '3px solid #DC2626', borderRadius: 8 }}>
                <Statistic title="Total dépenses" value={summary.total}
                  formatter={v => formatGNF(Number(v))}
                  valueStyle={{ color: '#DC2626', fontSize: 18 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderTop: '3px solid #1E40AF', borderRadius: 8 }}>
                <Statistic title="Nombre d'opérations" value={summary.count} valueStyle={{ fontSize: 18 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderTop: '3px solid #D97706', borderRadius: 8 }}>
                <Statistic title="Moyenne mensuelle"
                  value={summary.count > 0 ? summary.total / 12 : 0}
                  formatter={v => formatGNF(Number(v))}
                  valueStyle={{ color: '#D97706', fontSize: 18 }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Card title="Par mois" size="small" loading={loading}>
                {MONTHS.map((m, i) => {
                  const val = summary.byMonth[i + 1] ?? 0
                  return (
                    <div key={m} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text style={{ width: 80, fontSize: 12 }}>{m}</Text>
                        <Text strong style={{ fontSize: 12, color: '#DC2626' }}>{formatGNF(val)}</Text>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${(val / maxMonth) * 100}%`,
                          background: '#DC2626', transition: 'width 0.4s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </Card>
            </Col>
            <Col span={10}>
              <Card title="Par catégorie" size="small" loading={loading}>
                {Object.entries(summary.byCategory as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, val]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                      <Tag color="blue" style={{ fontSize: 11 }}>{cat}</Tag>
                      <Text strong style={{ color: '#DC2626' }}>{formatGNF(val as number)}</Text>
                    </div>
                  ))
                }
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
