import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Select, InputNumber,
  DatePicker, Typography, message, Space, Tag, Tooltip,
} from 'antd'
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { formatGNF, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Option } = Select

export function PaymentListPage() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [payments, setPayments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [feeTypes, setFeeTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const loadPayments = async () => {
    setLoading(true)
    // Load payments for all students — collect from each enrollment
    try {
      const stus = await ipc.students.list()
      setStudents(stus)
      const allPayments: any[] = []
      for (const s of stus.slice(0, 50)) {
        const enrollId = s.enrollments?.[0]?.id
        if (enrollId) {
          const pays = await ipc.payments.list(enrollId).catch(() => [])
          pays.forEach((p: any) => {
            allPayments.push({ ...p, studentName: `${s.lastName} ${s.firstName}`, studentId: s.id })
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

  const total = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0)

  const columns = [
    {
      title: 'Date',
      dataIndex: 'paidAt',
      key: 'date',
      width: 110,
      render: (d: string) => formatDate(d),
    },
    {
      title: 'Élève',
      dataIndex: 'studentName',
      key: 'student',
      render: (name: string, r: any) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/students/${r.studentId}`)}>
          {name}
        </Button>
      ),
    },
    { title: 'Motif', dataIndex: ['feeType', 'name'], key: 'feeType' },
    {
      title: 'Montant',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => <Typography.Text strong>{formatGNF(v)}</Typography.Text>,
    },
    {
      title: 'Reçu N°',
      dataIndex: 'receiptNo',
      key: 'receipt',
      render: (v: string) => <Typography.Text code style={{ fontSize: 12 }}>{v}</Typography.Text>,
    },
    { title: 'Méthode', dataIndex: 'method', key: 'method', width: 100 },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, r: any) => (
        <Tooltip title="Voir le reçu">
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/payments/${r.id}/receipt`)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Paiements"
        subtitle={payments.length > 0 ? `Total : ${formatGNF(total)}` : undefined}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Nouveau paiement
          </Button>
        }
      />

      <Table
        columns={columns}
        dataSource={payments}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `${t} paiements` }}
        size="middle"
        locale={{ emptyText: 'Aucun paiement enregistré' }}
      />

      {/* Modal création */}
      <Modal
        title="Nouveau paiement"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleRecord} requiredMark={false}>
          <Form.Item
            name="studentId"
            label="Élève"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Select
              showSearch
              placeholder="Rechercher un élève..."
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
            label="Motif"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Select placeholder="Sélectionner le motif">
              {feeTypes.map((f: any) => (
                <Option key={f.id} value={f.id}>
                  {f.name} — {formatGNF(f.amount)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="Montant (GNF)"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              addonAfter="GNF"
            />
          </Form.Item>

          <Form.Item
            name="method"
            label="Mode de paiement"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Select>
              <Option value="CASH">Espèces</Option>
              <Option value="ORANGE_MONEY">Orange Money</Option>
              <Option value="WAVE">Wave</Option>
              <Option value="MOBILE_MONEY">Mobile Money</Option>
              <Option value="BANK_TRANSFER">Virement bancaire</Option>
            </Select>
          </Form.Item>

          <Form.Item name="note" label="Remarque (optionnel)">
            <Form.Item name="note" noStyle>
              <Select placeholder="—" allowClear />
            </Form.Item>
          </Form.Item>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Enregistrer
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
