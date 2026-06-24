import { useEffect, useState, useCallback } from 'react'
import {
  Tabs, Table, Button, Modal, Form, Input, Select, Card,
  Row, Col, Statistic, Tag, Space, Popconfirm, Tooltip,
  Typography, DatePicker, InputNumber, Badge,
} from 'antd'
import {
  BookOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  SwapOutlined, CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAppMessage } from '../../hooks/useAppMessage'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text } = Typography
const { Option } = Select
const { Search } = Input

export function LibraryPage() {
  const [stats, setStats] = useState<any>({
    totalBooks: 0, totalCopies: 0, totalLoans: 0, activeLoans: 0, overdueLoans: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  const loadStats = useCallback(() => {
    setStatsLoading(true)
    ipc.library.stats().then(setStats).catch(() => {}).finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const tabItems = [
    {
      key: 'catalogue',
      label: <span><BookOutlined /> Catalogue</span>,
      children: <CatalogueTab onStatsRefresh={loadStats} />,
    },
    {
      key: 'loans',
      label: (
        <span>
          <SwapOutlined /> Emprunts
          {stats.activeLoans > 0 && (
            <Badge count={stats.activeLoans} size="small" style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: <LoansTab onStatsRefresh={loadStats} />,
    },
  ]

  const kpis = [
    { title: 'Titres en catalogue', value: stats.totalBooks, color: '#1E40AF' },
    { title: 'Total exemplaires', value: stats.totalCopies, color: '#4F46E5' },
    { title: 'Prêts actifs', value: stats.activeLoans, color: '#D97706' },
    { title: 'En retard', value: stats.overdueLoans, color: '#DC2626' },
  ]

  return (
    <div>
      <PageHeader title="Bibliothèque" subtitle="Gestion du fonds documentaire et des prêts" />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {kpis.map(({ title, value, color }) => (
          <Col key={title} xs={12} sm={6}>
            <Card
              size="small"
              variant="borderless"
              style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}` }}
              loading={statsLoading}
            >
              <Statistic title={title} value={value} valueStyle={{ color, fontWeight: 700 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}

// ─── Catalogue ─────────────────────────────────────────────────────────────────
function CatalogueTab({ onStatsRefresh }: { onStatsRefresh: () => void }) {
  const message = useAppMessage()
  const [books, setBooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = (q?: string) => {
    setLoading(true)
    ipc.library.listBooks(q).then(setBooks).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditRecord(null)
    form.resetFields()
    form.setFieldsValue({ copies: 1 })
    setModalOpen(true)
  }

  const openEdit = (r: any) => {
    setEditRecord(r)
    form.setFieldsValue({
      title: r.title,
      author: r.author ?? '',
      isbn: r.isbn ?? '',
      category: r.category ?? '',
      copies: r.copies,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    setSaving(true)
    try {
      if (editRecord) {
        await ipc.library.updateBook(editRecord.id, { ...values, copies: Number(values.copies) })
        message.success('Livre mis à jour')
      } else {
        await ipc.library.createBook({ ...values, copies: Number(values.copies) })
        message.success('Livre ajouté au catalogue')
      }
      setModalOpen(false)
      load(search || undefined)
      onStatsRefresh()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipc.library.deleteBook(id)
      message.success('Livre supprimé')
      load(search || undefined)
      onStatsRefresh()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: 'Titre',
      dataIndex: 'title',
      key: 'title',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Auteur',
      dataIndex: 'author',
      key: 'author',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Catégorie',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '—',
    },
    {
      title: 'ISBN',
      dataIndex: 'isbn',
      key: 'isbn',
      width: 140,
      render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
    {
      title: 'Disponibles',
      key: 'available',
      width: 120,
      render: (_: any, r: any) => {
        const ratio = r.copies === 0 ? 0 : r.available / r.copies
        const color = ratio === 0 ? '#DC2626' : ratio < 0.4 ? '#D97706' : '#16A34A'
        return <Text strong style={{ color }}>{r.available} / {r.copies}</Text>
      },
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Modifier">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title="Supprimer ce livre ?"
            description="Impossible s'il a des prêts en cours."
            onConfirm={() => handleDelete(r.id)}
            okText="Supprimer"
            okType="danger"
            cancelText="Annuler"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <Search
          placeholder="Rechercher par titre, auteur, ISBN…"
          style={{ maxWidth: 380 }}
          onSearch={(v) => { setSearch(v); load(v || undefined) }}
          allowClear
          onChange={(e) => { if (!e.target.value) { setSearch(''); load() } }}
        />
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nouveau livre
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={books}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'Aucun livre dans le catalogue' }}
      />

      <Modal
        title={editRecord ? 'Modifier le livre' : 'Nouveau livre'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item name="title" label="Titre" rules={[{ required: true }]}>
            <Input placeholder="Titre du livre" />
          </Form.Item>
          <Form.Item name="author" label="Auteur">
            <Input placeholder="Nom de l'auteur" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="category" label="Catégorie">
                <Select placeholder="Ex: Romans, Sciences…" allowClear>
                  {['Romans', 'Sciences', 'Histoire', 'Mathématiques', 'Géographie', 'Littérature', 'Référence', 'Religion', 'Technique'].map(c => (
                    <Option key={c} value={c}>{c}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="copies" label="Exemplaires" rules={[{ required: true }]}>
                <InputNumber min={1} max={999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isbn" label="ISBN (optionnel)">
            <Input placeholder="978-XXX-XXXXX-XX-X" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {editRecord ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Emprunts ──────────────────────────────────────────────────────────────────
function LoansTab({ onStatsRefresh }: { onStatsRefresh: () => void }) {
  const message = useAppMessage()
  const [loans, setLoans] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [availableBooks, setAvailableBooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [loanModal, setLoanModal] = useState(false)
  const [returnModal, setReturnModal] = useState<any>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [fine, setFine] = useState<number>(0)

  const load = (history?: boolean) => {
    setLoading(true)
    ipc.library.listLoans(history ? undefined : { returned: false })
      .then(setLoans).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(showHistory) }, [showHistory])

  const openLoanModal = () => {
    form.resetFields()
    form.setFieldsValue({ dueDate: dayjs().add(14, 'day') })
    Promise.all([ipc.students.list(), ipc.library.listBooks()])
      .then(([s, b]) => {
        setStudents(s)
        setAvailableBooks(b.filter((bk: any) => bk.available > 0))
      })
      .catch(() => {})
    setLoanModal(true)
  }

  const handleCreateLoan = async (values: any) => {
    setSaving(true)
    try {
      await ipc.library.createLoan({
        bookId: values.bookId,
        studentId: values.studentId,
        dueDate: values.dueDate.toISOString(),
      })
      message.success('Prêt enregistré')
      setLoanModal(false)
      load(showHistory)
      onStatsRefresh()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReturn = async () => {
    if (!returnModal) return
    setSaving(true)
    try {
      await ipc.library.returnLoan(returnModal.id, fine > 0 ? fine : undefined)
      message.success('Retour enregistré')
      setReturnModal(null)
      setFine(0)
      load(showHistory)
      onStatsRefresh()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const isOverdue = (dueDate: string) => dayjs().isAfter(dayjs(dueDate))

  const columns = [
    {
      title: 'Livre',
      key: 'book',
      render: (_: any, r: any) => <Text strong>{r.book?.title ?? '—'}</Text>,
    },
    {
      title: 'Élève',
      key: 'student',
      render: (_: any, r: any) => r.student
        ? `${r.student.lastName} ${r.student.firstName}`
        : '—',
    },
    {
      title: 'Date prêt',
      dataIndex: 'loanDate',
      key: 'loanDate',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Échéance',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (v: string, r: any) => {
        if (r.returnedAt) return <Text type="secondary">{dayjs(v).format('DD/MM/YYYY')}</Text>
        const overdue = isOverdue(v)
        return (
          <Text style={{ color: overdue ? '#DC2626' : undefined }}>
            {overdue && <WarningOutlined style={{ marginRight: 4 }} />}
            {dayjs(v).format('DD/MM/YYYY')}
          </Text>
        )
      },
    },
    {
      title: 'Statut',
      key: 'status',
      width: 130,
      render: (_: any, r: any) => {
        if (r.returnedAt) return <Tag color="green" icon={<CheckCircleOutlined />}>Retourné</Tag>
        if (isOverdue(r.dueDate)) return <Tag color="red" icon={<WarningOutlined />}>En retard</Tag>
        return <Tag color="blue">En cours</Tag>
      },
    },
    {
      title: 'Pénalité',
      dataIndex: 'fine',
      key: 'fine',
      width: 100,
      render: (v: number) => v > 0
        ? <Text strong style={{ color: '#DC2626' }}>{v.toLocaleString('fr-FR')} GNF</Text>
        : '—',
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_: any, r: any) => !r.returnedAt && (
        <Button
          size="small"
          icon={<SwapOutlined />}
          onClick={() => { setReturnModal(r); setFine(0) }}
        >
          Retour
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <Button
          type={!showHistory ? 'primary' : 'default'}
          onClick={() => setShowHistory(false)}
        >
          En cours
        </Button>
        <Button
          type={showHistory ? 'primary' : 'default'}
          onClick={() => setShowHistory(true)}
        >
          Historique complet
        </Button>
        <div style={{ flex: 1 }} />
        {!showHistory && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openLoanModal}>
            Nouvel emprunt
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={loans}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: showHistory ? "Aucun emprunt dans l'historique" : 'Aucun emprunt en cours' }}
      />

      {/* Modal nouvel emprunt */}
      <Modal
        title="Enregistrer un emprunt"
        open={loanModal}
        onCancel={() => { setLoanModal(false); form.resetFields() }}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateLoan} requiredMark={false}>
          <Form.Item name="bookId" label="Livre" rules={[{ required: true, message: 'Requis' }]}>
            <Select showSearch optionFilterProp="children" placeholder="Choisir un livre disponible">
              {availableBooks.map((b: any) => (
                <Option key={b.id} value={b.id}>
                  {b.title}{b.author ? ` — ${b.author}` : ''}{' '}
                  <Text type="secondary">({b.available} disponible{b.available > 1 ? 's' : ''})</Text>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="studentId" label="Élève" rules={[{ required: true, message: 'Requis' }]}>
            <Select showSearch optionFilterProp="children" placeholder="Choisir un élève">
              {students.map((s: any) => (
                <Option key={s.id} value={s.id}>
                  {s.lastName} {s.firstName}
                  {s.enrollments?.[0]?.class?.name && (
                    <Text type="secondary"> — {s.enrollments[0].class.name}</Text>
                  )}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="dueDate" label="Date de retour prévue" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setLoanModal(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Enregistrer le prêt</Button>
          </div>
        </Form>
      </Modal>

      {/* Modal retour */}
      <Modal
        title="Enregistrer le retour"
        open={!!returnModal}
        onOk={handleReturn}
        onCancel={() => { setReturnModal(null); setFine(0) }}
        okText="Confirmer le retour"
        confirmLoading={saving}
        width={440}
      >
        {returnModal && (
          <div>
            <p style={{ marginTop: 0 }}>
              <Text strong>{returnModal.book?.title}</Text>
              {' '}emprunté par{' '}
              <Text strong>{returnModal.student?.lastName} {returnModal.student?.firstName}</Text>
            </p>
            {isOverdue(returnModal.dueDate) && (
              <Tag color="red" style={{ marginBottom: 16 }}>
                <WarningOutlined /> En retard depuis le {dayjs(returnModal.dueDate).format('DD/MM/YYYY')}
              </Tag>
            )}
            <Form layout="vertical">
              <Form.Item label="Pénalité de retard (GNF — laisser 0 si aucune)">
                <InputNumber
                  min={0}
                  step={1000}
                  style={{ width: '100%' }}
                  value={fine}
                  onChange={(v) => setFine(v ?? 0)}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
