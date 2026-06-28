import { useEffect, useState, useMemo } from 'react'
import {
  Card, Row, Col, Statistic, Table, Button, Modal, Form,
  InputNumber, Select, Tag, Typography, Space, Tooltip, Popconfirm,
  Tabs, Alert, Divider, Badge, theme,
} from 'antd'
import {
  DollarOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlusOutlined, EyeOutlined, UserOutlined, TeamOutlined,
  PrinterOutlined, WarningOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatGNF } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text, Title } = Typography
const { Option } = Select

const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const CONTRACT_COLORS: Record<string, string> = {
  PERMANENT: '#059669',
  VACATAIRE: '#D97706',
  STAGIAIRE: '#0EA5E9',
}
const CONTRACT_LABELS: Record<string, string> = {
  PERMANENT: 'Permanent',
  VACATAIRE: 'Vacataire',
  STAGIAIRE: 'Stagiaire',
}

export function PayrollPage() {
  const { userId } = useAuth()
  const message = useAppMessage()
  const { token } = theme.useToken()
  const navigate = useNavigate()

  const [teachers, setTeachers] = useState<any[]>([])
  const [salariesByTeacher, setSalariesByTeacher] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(dayjs().month() + 1)
  const [year, setYear] = useState(dayjs().year())
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null)
  const [historyTeacher, setHistoryTeacher] = useState<any>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const yearOptions = Array.from({ length: 5 }, (_, i) => dayjs().year() - i)

  const load = async () => {
    setLoading(true)
    try {
      const list = await ipc.teachers.list()
      setTeachers(list)
      // Load salaries for each teacher
      const salaryMap: Record<string, any[]> = {}
      await Promise.all(
        list.map(async (t: any) => {
          const sals = await ipc.teachers.listSalaries(t.id).catch(() => [])
          salaryMap[t.id] = sals
        })
      )
      setSalariesByTeacher(salaryMap)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Find salary for current month/year
  const getSalaryForMonth = (teacherId: string) => {
    return (salariesByTeacher[teacherId] ?? []).find(
      s => s.month === month && s.year === year
    ) ?? null
  }

  // Stats
  const stats = useMemo(() => {
    let totalBrut = 0, totalNet = 0, paid = 0, pending = 0, notGenerated = 0
    teachers.forEach(t => {
      const sal = getSalaryForMonth(t.id)
      if (!sal) { notGenerated++; totalBrut += t.baseSalary ?? 0 }
      else {
        totalBrut += sal.baseSalary + (sal.bonuses ?? 0)
        totalNet += sal.netSalary
        if (sal.paidAt) paid++
        else pending++
      }
    })
    return { totalBrut, totalNet, paid, pending, notGenerated, total: teachers.length }
  }, [teachers, salariesByTeacher, month, year])

  const openGenerateModal = (teacher: any) => {
    setSelectedTeacher(teacher)
    const existing = getSalaryForMonth(teacher.id)
    form.setFieldsValue({
      baseSalary: existing?.baseSalary ?? teacher.baseSalary ?? 0,
      bonuses: existing?.bonuses ?? 0,
      advances: existing?.advances ?? 0,
      deductions: existing?.deductions ?? 0,
    })
    setModalOpen(true)
  }

  const handleGenerate = async (values: any) => {
    if (!selectedTeacher) return
    setSaving(true)
    try {
      await ipc.teachers.createSalary({
        teacherId: selectedTeacher.id,
        month,
        year,
        baseSalary: values.baseSalary,
        bonuses: values.bonuses ?? 0,
        advances: values.advances ?? 0,
        deductions: values.deductions ?? 0,
      }, userId ?? 'system')
      message.success('Bulletin de salaire généré')
      setModalOpen(false)
      form.resetFields()
      await load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleMarkPaid = async (salaryId: string) => {
    try {
      await ipc.teachers.markSalaryPaid(salaryId, userId ?? 'system')
      message.success('Salaire marqué comme payé')
      await load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const openHistory = (teacher: any) => {
    setHistoryTeacher(teacher)
    setHistoryOpen(true)
  }

  // Watch form values to compute net
  const watchedValues = Form.useWatch([], form)
  const computedNet = useMemo(() => {
    const base = watchedValues?.baseSalary ?? 0
    const bon = watchedValues?.bonuses ?? 0
    const adv = watchedValues?.advances ?? 0
    const ded = watchedValues?.deductions ?? 0
    return (base + bon) - adv - ded
  }, [watchedValues])

  const columns = [
    {
      title: 'Enseignant',
      key: 'teacher',
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: `linear-gradient(135deg, ${CONTRACT_COLORS[r.contractType ?? 'PERMANENT'] ?? '#6B7280'}40, ${CONTRACT_COLORS[r.contractType ?? 'PERMANENT'] ?? '#6B7280'}80)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: CONTRACT_COLORS[r.contractType ?? 'PERMANENT'] ?? '#6B7280', flexShrink: 0,
          }}>
            {r.user?.lastName?.[0]}{r.user?.firstName?.[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>
              {r.user?.lastName} {r.user?.firstName}
            </div>
            <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{r.matricule}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Contrat',
      dataIndex: 'contractType',
      key: 'contract',
      width: 110,
      render: (v: string) => {
        const color = CONTRACT_COLORS[v] ?? '#6B7280'
        const label = CONTRACT_LABELS[v] ?? v ?? '—'
        return (
          <Tag style={{ background: `${color}18`, color, border: 'none', borderRadius: 20, fontWeight: 600, fontSize: 11 }}>
            {label}
          </Tag>
        )
      },
    },
    {
      title: 'Salaire de base',
      dataIndex: 'baseSalary',
      key: 'baseSalary',
      width: 160,
      render: (v: number) => (
        <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatGNF(v ?? 0)}</Text>
      ),
    },
    {
      title: `Statut — ${MONTHS[month - 1]} ${year}`,
      key: 'status',
      width: 180,
      render: (_: any, r: any) => {
        const sal = getSalaryForMonth(r.id)
        if (!sal) return <Tag style={{ background: 'rgba(107,114,128,0.1)', color: '#6B7280', border: 'none', borderRadius: 20, fontWeight: 600 }}>Non généré</Tag>
        if (sal.paidAt) return <Tag style={{ background: 'rgba(5,150,105,0.12)', color: '#059669', border: 'none', borderRadius: 20, fontWeight: 600 }} icon={<CheckCircleOutlined />}>Payé</Tag>
        return <Tag style={{ background: 'rgba(217,119,6,0.12)', color: '#D97706', border: 'none', borderRadius: 20, fontWeight: 600 }} icon={<ClockCircleOutlined />}>En attente</Tag>
      },
    },
    {
      title: 'Net à payer',
      key: 'net',
      width: 160,
      render: (_: any, r: any) => {
        const sal = getSalaryForMonth(r.id)
        if (!sal) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        return (
          <Text strong style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
            {formatGNF(sal.netSalary)}
          </Text>
        )
      },
    },
    {
      title: '',
      key: 'actions',
      width: 180,
      render: (_: any, r: any) => {
        const sal = getSalaryForMonth(r.id)
        return (
          <Space size={4}>
            <Tooltip title={sal ? 'Recalculer' : 'Générer le bulletin'}>
              <Button
                size="small" type="primary"
                icon={<PlusOutlined />}
                onClick={() => openGenerateModal(r)}
              >
                {sal ? 'Modifier' : 'Générer'}
              </Button>
            </Tooltip>
            {sal && !sal.paidAt && (
              <Popconfirm
                title="Confirmer le paiement ?"
                description={`Marquer ${r.user?.firstName} ${r.user?.lastName} comme payé pour ${MONTHS[month - 1]} ${year} ?`}
                onConfirm={() => handleMarkPaid(sal.id)}
                okText="Confirmer"
                cancelText="Annuler"
              >
                <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#059669', borderColor: '#059669' }}>
                  Payer
                </Button>
              </Popconfirm>
            )}
            {sal && (
              <Tooltip title="Imprimer le bulletin">
                <Button
                  size="small"
                  icon={<PrinterOutlined />}
                  type="text"
                  style={{ color: '#6366F1' }}
                  onClick={() => navigate(`/payroll/salary/${sal.id}/receipt`)}
                />
              </Tooltip>
            )}
            <Tooltip title="Historique des salaires">
              <Button size="small" icon={<EyeOutlined />} type="text" onClick={() => openHistory(r)} />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  const historyColumns = [
    {
      title: 'Période',
      key: 'period',
      render: (_: any, r: any) => (
        <Text strong>{MONTHS[r.month - 1]} {r.year}</Text>
      ),
    },
    { title: 'Base', dataIndex: 'baseSalary', render: (v: number) => formatGNF(v) },
    { title: 'Primes', dataIndex: 'bonuses', render: (v: number) => v > 0 ? <Text style={{ color: '#059669' }}>+{formatGNF(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Avances', dataIndex: 'advances', render: (v: number) => v > 0 ? <Text style={{ color: '#DC2626' }}>-{formatGNF(v)}</Text> : <Text type="secondary">—</Text> },
    { title: 'Déductions', dataIndex: 'deductions', render: (v: number) => v > 0 ? <Text style={{ color: '#DC2626' }}>-{formatGNF(v)}</Text> : <Text type="secondary">—</Text> },
    {
      title: 'Net',
      dataIndex: 'netSalary',
      render: (v: number) => <Text strong style={{ color: '#059669' }}>{formatGNF(v)}</Text>,
    },
    {
      title: 'Statut',
      dataIndex: 'paidAt',
      render: (v: string) => v
        ? <Tag style={{ background: 'rgba(5,150,105,0.12)', color: '#059669', border: 'none', borderRadius: 20 }}>Payé le {dayjs(v).format('DD/MM/YYYY')}</Tag>
        : <Tag style={{ background: 'rgba(217,119,6,0.12)', color: '#D97706', border: 'none', borderRadius: 20 }}>En attente</Tag>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Paie du Personnel"
        subtitle="Gestion des salaires, primes et bulletins de paie"
        icon={<DollarOutlined />}
        color="#059669"
        actions={
          <Space>
            <Select value={month} onChange={setMonth} style={{ width: 130 }}>
              {MONTHS.map((m, i) => <Option key={i + 1} value={i + 1}>{m}</Option>)}
            </Select>
            <Select value={year} onChange={setYear} style={{ width: 90 }}>
              {yearOptions.map(y => <Option key={y} value={y}>{y}</Option>)}
            </Select>
          </Space>
        }
      />

      {/* KPI Cards */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total enseignants', value: stats.total, color: '#3B82F6', icon: <TeamOutlined />, suffix: '' },
          { title: 'Masse salariale brute', value: formatGNF(stats.totalBrut), color: '#7C3AED', icon: <DollarOutlined />, suffix: '' },
          { title: 'Salaires payés', value: stats.paid, color: '#059669', icon: <CheckCircleOutlined />, suffix: `/ ${stats.paid + stats.pending}` },
          { title: 'En attente', value: stats.pending + stats.notGenerated, color: '#D97706', icon: <ClockCircleOutlined />, suffix: '' },
        ].map(({ title, value, color, icon }) => (
          <Col key={title} xs={12} sm={6}>
            <Card
              variant="borderless"
              style={{
                borderRadius: 14, border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer, position: 'relative', overflow: 'hidden',
              }}
              styles={{ body: { padding: '16px 20px' } }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '14px 14px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: token.colorTextTertiary, marginBottom: 6 }}>
                    {title}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: token.colorText, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </div>
                </div>
                <div style={{
                  width: 38, height: 38, borderRadius: 9, background: `${color}18`,
                  border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color, fontSize: 17, flexShrink: 0,
                }}>
                  {icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Progress bar */}
      {teachers.length > 0 && (
        <Card
          variant="borderless"
          style={{ borderRadius: 12, border: `1px solid ${token.colorBorderSecondary}`, marginBottom: 16 }}
          styles={{ body: { padding: '14px 20px' } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorTextSecondary }}>
              Avancement de la paie — {MONTHS[month - 1]} {year}
            </Text>
            <Text style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>
              {stats.paid} / {teachers.length} payés
            </Text>
          </div>
          <div style={{ height: 8, background: token.colorBorderSecondary, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${teachers.length > 0 ? (stats.paid / teachers.length) * 100 : 0}%`,
              background: 'linear-gradient(90deg, #059669, #34D399)',
              transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
          {stats.notGenerated > 0 && (
            <div style={{ marginTop: 8 }}>
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message={`${stats.notGenerated} enseignant(s) sans bulletin généré pour ce mois`}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8 }}
              />
            </div>
          )}
        </Card>
      )}

      {/* Table */}
      <Card
        variant="borderless"
        style={{ borderRadius: 14, border: `1px solid ${token.colorBorderSecondary}` }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={teachers}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          locale={{ emptyText: 'Aucun enseignant enregistré' }}
        />
      </Card>

      {/* Modal — Générer bulletin de salaire */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(5,150,105,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669',
            }}>
              <DollarOutlined />
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>
                {selectedTeacher?.user?.lastName} {selectedTeacher?.user?.firstName}
              </div>
              <div style={{ fontSize: 11, color: token.colorTextTertiary, fontWeight: 400 }}>
                Bulletin de salaire — {MONTHS[month - 1]} {year}
              </div>
            </div>
          </div>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={500}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleGenerate} requiredMark={false}>
          <Form.Item name="baseSalary" label="Salaire de base (GNF)" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }} min={0}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
            />
          </Form.Item>

          <Divider style={{ margin: '12px 0', fontSize: 12 }}>Éléments de rémunération</Divider>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="bonuses" label="Primes & Indemnités (GNF)">
                <InputNumber
                  style={{ width: '100%' }} min={0}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                  placeholder="Transport, logement…"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="advances" label="Avances sur salaire (GNF)">
                <InputNumber
                  style={{ width: '100%' }} min={0}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="deductions" label="Retenues & Déductions (GNF)">
            <InputNumber
              style={{ width: '100%' }} min={0}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
              placeholder="Absences, cotisations…"
            />
          </Form.Item>

          {/* Net recap */}
          <div style={{
            background: computedNet >= 0 ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
            border: `1px solid ${computedNet >= 0 ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>Net à payer</Text>
              <Title level={4} style={{
                margin: 0, color: computedNet >= 0 ? '#059669' : '#DC2626',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatGNF(Math.max(0, computedNet))}
              </Title>
            </div>
            <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 4 }}>
              Base {formatGNF(watchedValues?.baseSalary ?? 0)}
              {(watchedValues?.bonuses ?? 0) > 0 && <span style={{ color: '#059669' }}> + primes {formatGNF(watchedValues?.bonuses ?? 0)}</span>}
              {(watchedValues?.advances ?? 0) > 0 && <span style={{ color: '#DC2626' }}> - avances {formatGNF(watchedValues?.advances ?? 0)}</span>}
              {(watchedValues?.deductions ?? 0) > 0 && <span style={{ color: '#DC2626' }}> - retenues {formatGNF(watchedValues?.deductions ?? 0)}</span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving} style={{ background: '#059669', borderColor: '#059669' }}>
              Générer le bulletin
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal — Historique des salaires */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserOutlined style={{ color: '#3B82F6' }} />
            <span>Historique — {historyTeacher?.user?.lastName} {historyTeacher?.user?.firstName}</span>
          </div>
        }
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={null}
        width={750}
        destroyOnHidden
      >
        {historyTeacher && (
          <Table
            dataSource={salariesByTeacher[historyTeacher.id] ?? []}
            columns={historyColumns}
            rowKey="id"
            pagination={{ pageSize: 12 }}
            size="small"
            locale={{ emptyText: 'Aucun historique de salaire' }}
          />
        )}
      </Modal>
    </div>
  )
}
