/**
 * DiscountPage — Remises et exonérations (§13.3 cahier des charges)
 * Permet d'accorder une remise sur les frais d'un élève avec motif obligatoire.
 */

import { useEffect, useState, useMemo } from 'react'
import {
  Card, Row, Col, Table, Button, Modal, Form, InputNumber,
  Select, Tag, Typography, Space, Tooltip, Statistic, Alert,
  Divider, theme,
} from 'antd'
import {
  GiftOutlined, PlusOutlined, TeamOutlined,
  DollarOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatGNF, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text } = Typography
const { Option } = Select

const MOTIFS = [
  'Bourse scolaire',
  'Réduction fratrie (2ème enfant)',
  'Réduction fratrie (3ème enfant et +)',
  'Difficultés financières avérées',
  'Enfant de personnel enseignant',
  'Mérite scolaire exceptionnel',
  'Accord de direction',
  'Autre motif',
]

export function DiscountPage() {
  const { userId } = useAuth()
  const message = useAppMessage()
  const { token } = theme.useToken()

  const [discounts, setDiscounts] = useState<any[]>([])
  const [students, setStudents]   = useState<any[]>([])
  const [feeTypes, setFeeTypes]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form] = Form.useForm()

  const watchedAmount = Form.useWatch('amount', form)
  const watchedFeeTypeId = Form.useWatch('feeTypeId', form)
  const selectedFeeType = feeTypes.find(f => f.id === watchedFeeTypeId)

  const load = async () => {
    setLoading(true)
    try {
      const [stus, fts] = await Promise.all([
        ipc.students.list(),
        ipc.payments.listFeeTypes(),
      ])
      setStudents(stus)
      setFeeTypes(fts)

      // Collect all discounts from all students
      const allDiscounts: any[] = []
      await Promise.all(
        stus.slice(0, 60).map(async (s: any) => {
          const enrollId = s.enrollments?.[0]?.id
          if (!enrollId) return
          const disc = await ipc.payments.listDiscounts(enrollId).catch(() => [])
          disc.forEach((d: any) => allDiscounts.push({
            ...d,
            studentName: `${s.lastName} ${s.firstName}`,
            studentId:   s.id,
            matricule:   s.matricule,
            className:   s.enrollments?.[0]?.class?.name ?? '—',
          }))
        })
      )
      allDiscounts.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      setDiscounts(allDiscounts)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => ({
    count:  discounts.length,
    total:  discounts.reduce((s, d) => s + d.amount, 0),
    beneficiaires: new Set(discounts.map(d => d.studentId)).size,
  }), [discounts])

  const handleRecord = async (values: any) => {
    setSaving(true)
    try {
      const student    = students.find(s => s.id === values.studentId)
      const enrollmentId = student?.enrollments?.[0]?.id
      if (!enrollmentId) throw new Error('Élève non inscrit dans une classe')

      await ipc.payments.recordDiscount({
        enrollmentId,
        feeTypeId: values.feeTypeId,
        amount:    values.amount,
        motif:     values.motif === 'Autre motif' ? (values.autreMotif ?? 'Autre') : values.motif,
      }, userId ?? 'system')

      message.success('Remise accordée et enregistrée')
      setModalOpen(false)
      form.resetFields()
      await load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'paidAt',
      key: 'date',
      width: 110,
      render: (d: string) => <Text style={{ fontSize: 12 }}>{formatDate(d)}</Text>,
    },
    {
      title: 'Élève',
      key: 'student',
      render: (_: any, r: any) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.studentName}</Text>
          <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{r.matricule} · {r.className}</div>
        </div>
      ),
    },
    {
      title: 'Motif de la remise',
      dataIndex: 'note',
      key: 'motif',
      render: (v: string) => (
        <Tag style={{
          background: 'rgba(99,102,241,0.1)', color: '#6366F1',
          border: 'none', borderRadius: 20, fontWeight: 600, fontSize: 11,
          maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Type de frais',
      key: 'feeType',
      render: (_: any, r: any) => (
        <Text style={{ fontSize: 12 }}>{r.feeType?.name ?? '—'}</Text>
      ),
    },
    {
      title: 'Montant remisé',
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      render: (v: number) => (
        <Text strong style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
          -{formatGNF(v)}
        </Text>
      ),
    },
    {
      title: 'Réf.',
      dataIndex: 'receiptNo',
      key: 'ref',
      width: 140,
      render: (v: string) => (
        <Text code style={{ fontSize: 10 }}>{v}</Text>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Remises et Exonérations"
        subtitle="Accordez des réductions sur les frais scolaires avec justificatif"
        icon={<GiftOutlined />}
        color="#6366F1"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Accorder une remise
          </Button>
        }
      />

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Remises accordées', value: stats.count, color: '#6366F1', icon: <GiftOutlined />, fmt: (v: number) => String(v) },
          { label: 'Total remisé', value: stats.total, color: '#F59E0B', icon: <DollarOutlined />, fmt: (v: number) => formatGNF(v) },
          { label: 'Élèves bénéficiaires', value: stats.beneficiaires, color: '#059669', icon: <TeamOutlined />, fmt: (v: number) => String(v) },
        ].map(({ label, value, color, icon, fmt }) => (
          <Col key={label} xs={24} sm={8}>
            <div className="glass" style={{ borderRadius: 16, padding: '18px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse at top right, ${color}10, transparent 60%)` }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: token.colorTextTertiary, marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)}</div>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 17 }}>
                  {icon}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Info */}
      <Alert
        type="info" showIcon
        message="Les remises sont déduites automatiquement du solde de l'élève. Elles apparaissent dans l'historique des paiements avec la mention 'REMISE' et le motif justificatif."
        style={{ borderRadius: 10, marginBottom: 16, fontSize: 12 }}
      />

      {/* Table */}
      <div className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={discounts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, style: { padding: '12px 16px' } }}
          size="middle"
          locale={{ emptyText: 'Aucune remise accordée' }}
        />
      </div>

      {/* Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
              <GiftOutlined />
            </div>
            <span>Accorder une remise</span>
          </div>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleRecord} requiredMark={false}>
          <Form.Item name="studentId" label="Élève" rules={[{ required: true }]}>
            <Select
              showSearch placeholder="Rechercher un élève…"
              filterOption={(input, opt) =>
                (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={students.map(s => ({
                value: s.id,
                label: `${s.lastName} ${s.firstName} — ${s.matricule}`,
              }))}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="feeTypeId" label="Type de frais concerné" rules={[{ required: true }]}>
                <Select placeholder="Sélectionner…">
                  {feeTypes.map(f => (
                    <Option key={f.id} value={f.id}>
                      {f.name}
                      <span style={{ color: token.colorTextTertiary, marginLeft: 6, fontSize: 11 }}>{formatGNF(f.amount)}</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="amount" label="Montant de la remise (GNF)" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }} min={1}
                  max={selectedFeeType?.amount ?? 9999999}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="motif" label="Motif de la remise" rules={[{ required: true }]}>
            <Select placeholder="Sélectionner le motif…">
              {MOTIFS.map(m => <Option key={m} value={m}>{m}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.motif !== cur.motif}
          >
            {({ getFieldValue }) =>
              getFieldValue('motif') === 'Autre motif' ? (
                <Form.Item name="autreMotif" label="Précisez le motif" rules={[{ required: true }]}>
                  <Select.Option value="">-</Select.Option>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          {/* Preview */}
          {watchedAmount > 0 && selectedFeeType && (
            <div style={{
              background: 'rgba(5,150,105,0.08)',
              border: '1px solid rgba(5,150,105,0.2)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <Text style={{ color: token.colorTextSecondary }}>Frais total</Text>
                <Text strong>{formatGNF(selectedFeeType.amount)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <Text style={{ color: token.colorTextSecondary }}>Remise accordée</Text>
                <Text strong style={{ color: '#059669' }}>-{formatGNF(watchedAmount)}</Text>
              </div>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: 700 }}>Reste à payer</Text>
                <Text strong style={{ fontSize: 16, color: '#6366F1' }}>
                  {formatGNF(Math.max(0, selectedFeeType.amount - watchedAmount))}
                </Text>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving} icon={<CheckCircleOutlined />}
              style={{ background: '#059669', borderColor: '#059669' }}>
              Accorder la remise
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
