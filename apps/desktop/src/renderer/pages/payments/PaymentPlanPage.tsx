import { useEffect, useState, useMemo } from 'react'
import {
  Card, Row, Col, Table, Button, Modal, Form, InputNumber,
  Select, Tag, Typography, Space, Tooltip, Popconfirm,
  DatePicker, Statistic, Alert, Divider, Badge, theme,
} from 'antd'
import {
  PlusOutlined, CheckCircleOutlined, ClockCircleOutlined,
  DeleteOutlined, CalendarOutlined, DollarOutlined,
  ExclamationCircleOutlined, EyeOutlined, TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatGNF, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text, Title } = Typography
const { Option } = Select

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces', ORANGE_MONEY: 'Orange Money', WAVE: 'Wave',
  MOBILE_MONEY: 'Mobile Money', BANK_TRANSFER: 'Virement',
}
const METHOD_COLORS: Record<string, string> = {
  CASH: '#059669', ORANGE_MONEY: '#EA580C', WAVE: '#0EA5E9',
  MOBILE_MONEY: '#7C3AED', BANK_TRANSFER: '#0369A1',
}

export function PaymentPlanPage() {
  const { userId } = useAuth()
  const message = useAppMessage()
  const { token } = theme.useToken()

  const [plans, setPlans] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [feeTypes, setFeeTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailPlan, setDetailPlan] = useState<any>(null)
  const [payInstallOpen, setPayInstallOpen] = useState<{ inst: any; plan: any } | null>(null)
  const [saving, setSaving] = useState(false)
  const [numTranches, setNumTranches] = useState(3)
  const [form] = Form.useForm()
  const [payForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [p, s, ft] = await Promise.all([
        ipc.payments.listAllPlans(),
        ipc.students.list(),
        ipc.payments.listFeeTypes(),
      ])
      setPlans(p)
      setStudents(s)
      setFeeTypes(ft)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Stats
  const stats = useMemo(() => {
    let totalPlanned = 0, totalPaid = 0, overdue = 0, pending = 0
    plans.forEach(p => {
      const note = p.note ?? ''
      const totalMatch = note.match(/Total (\d+)/)
      const total = totalMatch ? Number(totalMatch[1]) : 0
      totalPlanned += total
      p.installments.forEach((i: any) => {
        if (i.isPaid) totalPaid += i.amount
        else {
          pending += i.amount
          if (dayjs(i.dueDate).isBefore(dayjs(), 'day')) overdue += i.amount
        }
      })
    })
    return { totalPlanned, totalPaid, overdue, pending, count: plans.length }
  }, [plans])

  // Create plan
  const handleCreate = async (values: any) => {
    setSaving(true)
    try {
      const student = students.find(s => s.id === values.studentId)
      const enrollmentId = student?.enrollments?.[0]?.id
      if (!enrollmentId) throw new Error('Élève non inscrit dans une classe')

      // Build installments from form
      const installments: Array<{ dueDate: Date; amount: number }> = []
      for (let i = 1; i <= numTranches; i++) {
        installments.push({
          dueDate: values[`dueDate_${i}`].toDate(),
          amount: values[`amount_${i}`],
        })
      }

      await ipc.payments.createPlan({
        enrollmentId,
        feeTypeId: values.feeTypeId,
        totalAmount: values.totalAmount,
        installments,
      }, userId ?? 'system')

      message.success('Plan de paiement créé')
      setCreateOpen(false)
      form.resetFields()
      setNumTranches(3)
      await load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Pay installment
  const handlePayInstallment = async (values: any) => {
    if (!payInstallOpen) return
    setSaving(true)
    try {
      await ipc.payments.payInstallment(
        payInstallOpen.inst.id,
        values.method,
        userId ?? 'system'
      )
      message.success('Tranche payée — reçu généré')
      setPayInstallOpen(null)
      payForm.resetFields()
      if (detailPlan) {
        const updated = plans.find(p => p.id === detailPlan.id)
        if (updated) setDetailPlan(updated)
      }
      await load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlan = async (planId: string) => {
    try {
      await ipc.payments.deletePlan(planId, userId ?? 'system')
      message.success('Plan supprimé')
      if (detailPlan?.id === planId) setDetailPlan(null)
      await load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  // Auto-distribute total amount equally across tranches
  const autoDistribute = () => {
    const total = form.getFieldValue('totalAmount')
    if (!total) return
    const perTranche = Math.round(total / numTranches)
    for (let i = 1; i <= numTranches; i++) {
      form.setFieldValue(`amount_${i}`, i === numTranches
        ? total - perTranche * (numTranches - 1)
        : perTranche
      )
    }
  }

  // Table columns — plans list
  const columns = [
    {
      title: 'Élève',
      key: 'student',
      render: (_: any, r: any) => {
        const s = r.enrollment?.student
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(99,102,241,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6366F1', fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}>
              {s?.lastName?.[0]}{s?.firstName?.[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>
                {s?.lastName} {s?.firstName}
              </div>
              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                {r.enrollment?.class?.name} · {s?.matricule}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Motif',
      key: 'feeType',
      width: 160,
      render: (_: any, r: any) => (
        <Tag style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', border: 'none', borderRadius: 20, fontWeight: 600 }}>
          {r.feeType?.name}
        </Tag>
      ),
    },
    {
      title: 'Total plan',
      key: 'total',
      width: 140,
      render: (_: any, r: any) => {
        const m = (r.note ?? '').match(/Total (\d+)/)
        return <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatGNF(m ? Number(m[1]) : 0)}</Text>
      },
    },
    {
      title: 'Progression',
      key: 'progress',
      width: 200,
      render: (_: any, r: any) => {
        const total = r.installments.length
        const paid = r.installments.filter((i: any) => i.isPaid).length
        const overdue = r.installments.filter((i: any) => !i.isPaid && dayjs(i.dueDate).isBefore(dayjs(), 'day')).length
        return (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <Tag style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', border: 'none', borderRadius: 20, fontWeight: 600, fontSize: 10 }}>
                {paid}/{total} payées
              </Tag>
              {overdue > 0 && (
                <Tag style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: 'none', borderRadius: 20, fontWeight: 600, fontSize: 10 }}>
                  {overdue} en retard
                </Tag>
              )}
            </div>
            <div style={{ height: 4, background: token.colorBorderSecondary, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${total > 0 ? (paid / total) * 100 : 0}%`,
                background: paid === total ? '#059669' : overdue > 0 ? '#DC2626' : '#6366F1',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )
      },
    },
    {
      title: 'Créé le',
      key: 'createdAt',
      width: 110,
      render: (_: any, r: any) => (
        <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>{formatDate(r.paidAt)}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: any, r: any) => {
        const anyPaid = r.installments.some((i: any) => i.isPaid)
        return (
          <Space size={4}>
            <Tooltip title="Voir les tranches">
              <Button size="small" type="primary" icon={<EyeOutlined />}
                onClick={() => setDetailPlan(r)}>
                Détail
              </Button>
            </Tooltip>
            {!anyPaid && (
              <Popconfirm
                title="Supprimer ce plan ?"
                description="Cette action est irréversible."
                onConfirm={() => handleDeletePlan(r.id)}
                okText="Supprimer" okType="danger" cancelText="Annuler"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Plans de paiement"
        subtitle="Gestion des paiements partiels et échelonnés"
        icon={<CalendarOutlined />}
        color="#6366F1"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Nouveau plan
          </Button>
        }
      />

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Plans actifs', value: stats.count, color: '#6366F1', icon: <TeamOutlined /> },
          { label: 'Total planifié', value: formatGNF(stats.totalPlanned), color: '#F59E0B', icon: <DollarOutlined /> },
          { label: 'Déjà encaissé', value: formatGNF(stats.totalPaid), color: '#059669', icon: <CheckCircleOutlined /> },
          { label: 'En retard', value: formatGNF(stats.overdue), color: '#DC2626', icon: <WarningOutlined /> },
        ].map(({ label, value, color, icon }) => (
          <Col key={label} xs={12} sm={6}>
            <div className="glass" style={{
              borderRadius: 16, padding: '16px 20px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
                background: `radial-gradient(ellipse at top right, ${color}10 0%, transparent 65%)`,
              }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: token.colorTextTertiary, marginBottom: 8 }}>{label}</div>
                  <div className={color === '#6366F1' ? 'gradient-text-indigo' : color === '#059669' ? 'gradient-text-emerald' : color === '#DC2626' ? 'gradient-text-red' : 'gradient-text-gold'}
                    style={{ fontSize: 'clamp(18px, 1.8vw, 26px)', fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 16 }}>
                  {icon}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Plans table */}
      <div className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={plans}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, style: { padding: '12px 16px' } }}
          size="middle"
          locale={{ emptyText: 'Aucun plan de paiement créé' }}
        />
      </div>

      {/* ── MODAL: Create plan ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
              <CalendarOutlined />
            </div>
            <span>Nouveau plan de paiement</span>
          </div>
        }
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); setNumTranches(3) }}
        footer={null}
        width={580}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="studentId" label="Élève" rules={[{ required: true }]}>
                <Select showSearch placeholder="Rechercher un élève…"
                  filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                  options={students.map(s => ({
                    value: s.id,
                    label: `${s.lastName} ${s.firstName} — ${s.matricule}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="feeTypeId" label="Type de frais" rules={[{ required: true }]}>
                <Select placeholder="Sélectionner…">
                  {feeTypes.map(f => (
                    <Option key={f.id} value={f.id}>
                      <span>{f.name}</span>
                      <span style={{ color: token.colorTextTertiary, marginLeft: 6, fontSize: 11 }}>{formatGNF(f.amount)}</span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12} align="bottom">
            <Col span={12}>
              <Form.Item name="totalAmount" label="Montant total (GNF)" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }} min={1}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Nb. tranches">
                <Select value={numTranches} onChange={setNumTranches}>
                  {[2, 3, 4, 5, 6].map(n => <Option key={n} value={n}>{n} tranches</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label=" ">
                <Button block onClick={autoDistribute}>Répartir</Button>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 16px' }}>
            <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>Détail des tranches</Text>
          </Divider>

          {Array.from({ length: numTranches }, (_, i) => i + 1).map(n => (
            <Row key={n} gutter={12} align="bottom">
              <Col span={3}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(99,102,241,0.1)', color: '#6366F1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13, marginBottom: 24,
                }}>
                  {n}
                </div>
              </Col>
              <Col span={10}>
                <Form.Item name={`dueDate_${n}`} label={n === 1 ? 'Échéance' : ' '}
                  rules={[{ required: true, message: 'Requis' }]}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY"
                    placeholder={`Tranche ${n}`}
                    defaultValue={dayjs().add(n - 1, 'month')}
                  />
                </Form.Item>
              </Col>
              <Col span={11}>
                <Form.Item name={`amount_${n}`} label={n === 1 ? 'Montant (GNF)' : ' '}
                  rules={[{ required: true, message: 'Requis' }]}>
                  <InputNumber
                    style={{ width: '100%' }} min={1}
                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                    parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                  />
                </Form.Item>
              </Col>
            </Row>
          ))}

          <Alert
            type="info"
            showIcon
            message="La somme des tranches doit être égale au montant total. Utilisez 'Répartir' pour une distribution automatique."
            style={{ fontSize: 12, marginBottom: 20, borderRadius: 10 }}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields(); setNumTranches(3) }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer le plan</Button>
          </div>
        </Form>
      </Modal>

      {/* ── MODAL: Plan Detail ── */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Plan — {detailPlan?.enrollment?.student?.lastName} {detailPlan?.enrollment?.student?.firstName}
            </div>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, fontWeight: 400, marginTop: 2 }}>
              {detailPlan?.feeType?.name} · {detailPlan?.enrollment?.class?.name}
            </div>
          </div>
        }
        open={!!detailPlan}
        onCancel={() => setDetailPlan(null)}
        footer={null}
        width={560}
        destroyOnHidden
      >
        {detailPlan && (() => {
          const totalMatch = (detailPlan.note ?? '').match(/Total (\d+)/)
          const total = totalMatch ? Number(totalMatch[1]) : 0
          const paid = detailPlan.installments.filter((i: any) => i.isPaid).reduce((s: number, i: any) => s + i.amount, 0)
          const remaining = total - paid
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0

          return (
            <div>
              {/* Summary */}
              <div className="glass" style={{ borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title={<span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: token.colorTextTertiary }}>Total</span>}
                      value={formatGNF(total)}
                      valueStyle={{ fontSize: 16, fontWeight: 800 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title={<span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: token.colorTextTertiary }}>Payé</span>}
                      value={formatGNF(paid)}
                      valueStyle={{ fontSize: 16, fontWeight: 800, color: '#059669' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title={<span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: token.colorTextTertiary }}>Restant</span>}
                      value={formatGNF(remaining)}
                      valueStyle={{ fontSize: 16, fontWeight: 800, color: remaining > 0 ? '#DC2626' : '#059669' }}
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: token.colorTextTertiary }}>
                    <span>Avancement</span>
                    <span style={{ fontWeight: 700 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, background: token.colorBorderSecondary, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, #6366F1, #059669)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              </div>

              {/* Installments list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detailPlan.installments.map((inst: any, idx: number) => {
                  const isOverdue = !inst.isPaid && dayjs(inst.dueDate).isBefore(dayjs(), 'day')
                  return (
                    <div key={inst.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 10,
                      background: inst.isPaid
                        ? 'rgba(5,150,105,0.06)'
                        : isOverdue ? 'rgba(220,38,38,0.06)' : token.colorBgContainer,
                      border: `1px solid ${inst.isPaid ? 'rgba(5,150,105,0.2)' : isOverdue ? 'rgba(220,38,38,0.2)' : token.colorBorderSecondary}`,
                    }}>
                      {/* Number */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: inst.isPaid ? 'rgba(5,150,105,0.12)' : isOverdue ? 'rgba(220,38,38,0.12)' : 'rgba(99,102,241,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 12,
                        color: inst.isPaid ? '#059669' : isOverdue ? '#DC2626' : '#6366F1',
                      }}>
                        {idx + 1}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text strong style={{ fontSize: 14 }}>{formatGNF(inst.amount)}</Text>
                          {inst.isPaid && (
                            <Tag style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', border: 'none', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                              Payée
                            </Tag>
                          )}
                          {isOverdue && (
                            <Tag style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: 'none', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                              En retard
                            </Tag>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
                          {inst.isPaid
                            ? `Payée le ${formatDate(inst.paidAt)}`
                            : `Échéance : ${formatDate(inst.dueDate)}`
                          }
                        </div>
                      </div>

                      {/* Action */}
                      {!inst.isPaid && (
                        <Button
                          size="small" type="primary"
                          icon={<CheckCircleOutlined />}
                          style={{ background: isOverdue ? '#DC2626' : '#6366F1', borderColor: isOverdue ? '#DC2626' : '#6366F1' }}
                          onClick={() => setPayInstallOpen({ inst, plan: detailPlan })}
                        >
                          Payer
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── MODAL: Pay installment ── */}
      <Modal
        title={
          <div>
            <div style={{ fontWeight: 700 }}>Payer la tranche</div>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, fontWeight: 400 }}>
              {payInstallOpen && formatGNF(payInstallOpen.inst.amount)}
              {payInstallOpen && ` · Échéance ${formatDate(payInstallOpen.inst.dueDate)}`}
            </div>
          </div>
        }
        open={!!payInstallOpen}
        onCancel={() => { setPayInstallOpen(null); payForm.resetFields() }}
        footer={null}
        width={380}
        destroyOnHidden
      >
        <Form form={payForm} layout="vertical" onFinish={handlePayInstallment} requiredMark={false}>
          {payInstallOpen && (
            <div className="glass" style={{ borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ color: token.colorTextSecondary, fontSize: 12 }}>Montant à encaisser</Text>
                <Text strong style={{ fontSize: 18, color: '#6366F1' }}>{formatGNF(payInstallOpen.inst.amount)}</Text>
              </div>
            </div>
          )}

          <Form.Item name="method" label="Mode de paiement" rules={[{ required: true }]}>
            <Select placeholder="Choisir…">
              {Object.entries(METHOD_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>
                  <span style={{ color: METHOD_COLORS[key], fontWeight: 600 }}>{label}</span>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Alert
            type="info" showIcon
            message="Un reçu sera automatiquement généré après le paiement."
            style={{ fontSize: 12, borderRadius: 8, marginBottom: 20 }}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setPayInstallOpen(null); payForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving} icon={<CheckCircleOutlined />}>
              Confirmer le paiement
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
