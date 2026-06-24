/**
 * DisciplinePage — Registre des sanctions disciplinaires (§23 cahier des charges)
 * Vue globale de toutes les sanctions + création par élève
 */

import { useEffect, useState, useMemo } from 'react'
import {
  Table, Button, Modal, Form, Select, DatePicker,
  Tag, Typography, Space, Popconfirm, Statistic,
  Row, Col, Input, Alert, Badge, Tooltip, theme,
} from 'antd'
import {
  PlusOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  DeleteOutlined, EyeOutlined, WarningOutlined, TeamOutlined, FilePdfOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text } = Typography
const { Option } = Select
const { TextArea } = Input

const DISC_TYPES: Record<string, { label: string; color: string }> = {
  AVERTISSEMENT:  { label: 'Avertissement',       color: '#F59E0B' },
  BLAME:          { label: 'Blâme',               color: '#F97316' },
  CONVOCATION:    { label: 'Convocation parents', color: '#6366F1' },
  EXCLUSION_TEMP: { label: 'Exclusion temp.',     color: '#DC2626' },
  EXCLUSION_DEF:  { label: 'Exclusion déf.',      color: '#7F1D1D' },
  AUTRE:          { label: 'Autre mesure',         color: '#6B7280' },
}

export function DisciplinePage() {
  const { userId } = useAuth()
  const message = useAppMessage()
  const { token } = theme.useToken()

  const [records, setRecords]   = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState<any>(null)
  const [saving, setSaving]     = useState(false)
  const [filterResolved, setFilterResolved] = useState<boolean | undefined>(false)
  const [filterType, setFilterType] = useState<string | undefined>()
  const [form] = Form.useForm()
  const [resolveForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [recs, stus] = await Promise.all([
        ipc.discipline.listAll({ resolved: filterResolved, type: filterType }),
        ipc.students.list(),
      ])
      setRecords(recs)
      setStudents(stus)
    } catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterResolved, filterType])

  const stats = useMemo(() => ({
    total:  records.length,
    active: records.filter(r => !r.resolved).length,
    byType: Object.entries(DISC_TYPES).map(([k, v]) => ({
      type: k, label: v.label, color: v.color,
      count: records.filter(r => r.type === k).length,
    })).filter(t => t.count > 0),
  }), [records])

  const handleCreate = async (values: any) => {
    setSaving(true)
    try {
      await ipc.discipline.create({
        studentId:   values.studentId,
        type:        values.type,
        description: values.description,
        sanction:    values.sanction,
        note:        values.note,
        date:        values.date?.toISOString(),
      }, userId ?? 'system')
      message.success('Sanction enregistrée')
      setCreateOpen(false)
      form.resetFields()
      await load()
    } catch (e: any) { message.error(e.message) }
    finally { setSaving(false) }
  }

  const handleResolve = async (values: any) => {
    if (!resolveOpen) return
    setSaving(true)
    try {
      await ipc.discipline.resolve(resolveOpen.id, values.note)
      message.success('Sanction marquée comme résolue')
      setResolveOpen(null)
      resolveForm.resetFields()
      await load()
    } catch (e: any) { message.error(e.message) }
    finally { setSaving(false) }
  }

  const handleExportPdf = () => {
    const school = 'SGSI SchoolManager Pro'
    const date   = dayjs().format('DD/MM/YYYY')
    const rows   = records.map(r => `
      <tr>
        <td>${dayjs(r.date).format('DD/MM/YYYY')}</td>
        <td>${r.student?.lastName} ${r.student?.firstName}</td>
        <td>${r.student?.enrollments?.[0]?.class?.name ?? '—'}</td>
        <td style="color:${DISC_TYPES[r.type]?.color ?? '#000'};font-weight:600">${DISC_TYPES[r.type]?.label ?? r.type}</td>
        <td>${r.description}</td>
        <td>${r.sanction ?? '—'}</td>
        <td>${r.resolved ? '✅ Résolu' : '⏳ En cours'}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:12px}
      h1{color:#F97316;font-size:18px;margin-bottom:4px}
      .meta{color:#6B7280;font-size:11px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#F97316;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em}
      td{padding:7px 10px;border-bottom:1px solid #F3F4F6}
      tr:nth-child(even) td{background:#FFF7ED}
      .footer{margin-top:20px;font-size:10px;color:#9CA3AF;text-align:center}
    </style></head><body>
    <h1>Registre des Sanctions Disciplinaires</h1>
    <div class="meta">${school} · Exporté le ${date} · ${records.length} enregistrement(s)</div>
    <table>
      <thead><tr><th>Date</th><th>Élève</th><th>Classe</th><th>Type</th><th>Description</th><th>Sanction</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">SGSI SchoolManager Pro — Document généré automatiquement</div>
    </body></html>`

    const win = require('electron').remote
      ? require('electron').remote.getCurrentWindow()
      : null

    // Open print window via IPC
    ipc.dialog.openPrintWindow(html, `registre-sanctions-${dayjs().format('YYYY-MM-DD')}.pdf`)
      .catch(() => {
        // Fallback: open in browser window
        const blob = new Blob([html], { type: 'text/html' })
        const url  = URL.createObjectURL(blob)
        window.open(url)
      })
  }

  const handleDelete = async (id: string) => {
    try {
      await ipc.discipline.delete(id)
      message.success('Enregistrement supprimé')
      await load()
    } catch (e: any) { message.error(e.message) }
  }

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d: string) => <Text style={{ fontSize: 12 }}>{formatDate(d)}</Text>,
    },
    {
      title: 'Élève',
      key: 'student',
      render: (_: any, r: any) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {r.student?.lastName} {r.student?.firstName}
          </Text>
          <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {r.student?.matricule}
            {r.student?.enrollments?.[0]?.class?.name && ` · ${r.student.enrollments[0].class.name}`}
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 170,
      render: (v: string) => {
        const cfg = DISC_TYPES[v] ?? { label: v, color: '#6B7280' }
        return (
          <Tag style={{
            background: `${cfg.color}15`, color: cfg.color,
            border: 'none', borderRadius: 20, fontWeight: 600, fontSize: 11,
          }}>
            {cfg.label}
          </Tag>
        )
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'desc',
      render: (v: string) => (
        <Tooltip title={v}>
          <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: v }}>{v}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Sanction',
      dataIndex: 'sanction',
      key: 'sanction',
      width: 140,
      render: (v: string) => v
        ? <Text style={{ fontSize: 11, color: token.colorTextSecondary }}>{v}</Text>
        : <Text style={{ color: token.colorTextTertiary, fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Statut',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 110,
      render: (v: boolean) => v
        ? <Tag style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', border: 'none', borderRadius: 20, fontWeight: 600, fontSize: 10 }}>Résolu</Tag>
        : <Tag style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: 'none', borderRadius: 20, fontWeight: 600, fontSize: 10 }}>En cours</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: any, r: any) => (
        <Space size={4}>
          {!r.resolved && (
            <Tooltip title="Marquer comme résolu">
              <Button
                size="small" icon={<CheckCircleOutlined />}
                style={{ color: '#059669', borderColor: '#059669' }}
                onClick={() => setResolveOpen(r)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Supprimer cet enregistrement ?"
            onConfirm={() => handleDelete(r.id)}
            okText="Supprimer" okType="danger" cancelText="Annuler"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Conseil de Discipline"
        subtitle="Suivi des sanctions disciplinaires et mesures éducatives"
        icon={<WarningOutlined />}
        color="#F97316"
        actions={
          <Space size={8}>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>
              Exporter PDF
            </Button>
            <Button type="primary" icon={<PlusOutlined />}
              style={{ background: '#F97316', borderColor: '#F97316' }}
              onClick={() => setCreateOpen(true)}>
              Nouvelle sanction
            </Button>
          </Space>
        }
      />

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <div className="glass" style={{ borderRadius: 16, padding: '18px 22px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: token.colorTextTertiary, marginBottom: 8 }}>Total</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: token.colorText }}>{stats.total}</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="glass" style={{ borderRadius: 16, padding: '18px 22px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: token.colorTextTertiary, marginBottom: 8 }}>En cours</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#DC2626' }}>{stats.active}</div>
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div className="glass" style={{ borderRadius: 16, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: token.colorTextTertiary, marginBottom: 10 }}>Par type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stats.byType.map(t => (
                <span key={t.type} style={{
                  background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30`,
                  borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                }}>
                  {t.label} ({t.count})
                </span>
              ))}
              {stats.byType.length === 0 && <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>Aucun enregistrement</Text>}
            </div>
          </div>
        </Col>
      </Row>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          value={filterResolved === undefined ? 'all' : filterResolved ? 'resolved' : 'active'}
          onChange={v => setFilterResolved(v === 'all' ? undefined : v === 'resolved')}
          style={{ width: 160 }}
        >
          <Option value="active">En cours</Option>
          <Option value="resolved">Résolus</Option>
          <Option value="all">Tous</Option>
        </Select>
        <Select
          value={filterType ?? 'all'}
          onChange={v => setFilterType(v === 'all' ? undefined : v)}
          style={{ width: 180 }}
        >
          <Option value="all">Tous les types</Option>
          {Object.entries(DISC_TYPES).map(([k, v]) => (
            <Option key={k} value={k}>{v.label}</Option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, style: { padding: '12px 16px' } }}
          size="middle"
          locale={{ emptyText: 'Aucune sanction enregistrée' }}
        />
      </div>

      {/* Modal: Nouvelle sanction */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F97316' }}>
              <WarningOutlined />
            </div>
            <span>Enregistrer une sanction disciplinaire</span>
          </div>
        }
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        footer={null}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}
          initialValues={{ date: dayjs() }}>

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="studentId" label="Élève concerné" rules={[{ required: true }]}>
                <Select showSearch placeholder="Rechercher un élève…"
                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                  options={students.map(s => ({
                    value: s.id,
                    label: `${s.lastName} ${s.firstName} — ${s.matricule}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="type" label="Type de mesure disciplinaire" rules={[{ required: true }]}>
            <Select placeholder="Sélectionner…">
              {Object.entries(DISC_TYPES).map(([k, v]) => (
                <Option key={k} value={k}>
                  <span style={{ color: v.color, fontWeight: 600 }}>{v.label}</span>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Description des faits" rules={[{ required: true, message: 'Décrivez les faits' }]}>
            <TextArea rows={3} placeholder="Décrivez précisément les faits reprochés…" />
          </Form.Item>

          <Form.Item name="sanction" label="Mesure / Sanction appliquée">
            <Input placeholder="Ex: 3 jours d'exclusion, travaux d'intérêt scolaire…" />
          </Form.Item>

          <Form.Item name="note" label="Observation (optionnel)">
            <TextArea rows={2} placeholder="Observation ou suivi particulier…" />
          </Form.Item>

          <Alert
            type="warning" showIcon
            message="Cette sanction sera visible dans le dossier scolaire de l'élève et dans le rapport de discipline."
            style={{ fontSize: 12, borderRadius: 8, marginBottom: 16 }}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}
              style={{ background: '#F97316', borderColor: '#F97316' }}>
              Enregistrer la sanction
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: Résolution */}
      <Modal
        title="Marquer comme résolu"
        open={!!resolveOpen}
        onCancel={() => { setResolveOpen(null); resolveForm.resetFields() }}
        footer={null}
        width={440}
        destroyOnHidden
      >
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(249,115,22,0.06)', borderRadius: 10, border: '1px solid rgba(249,115,22,0.2)' }}>
          <Text strong>{resolveOpen?.student?.lastName} {resolveOpen?.student?.firstName}</Text>
          <Text style={{ display: 'block', fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
            {DISC_TYPES[resolveOpen?.type]?.label} — {formatDate(resolveOpen?.date)}
          </Text>
        </div>
        <Form form={resolveForm} layout="vertical" onFinish={handleResolve} requiredMark={false}>
          <Form.Item name="note" label="Note de clôture (optionnel)">
            <TextArea rows={3} placeholder="Ex: L'élève a présenté ses excuses, situation régularisée…" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setResolveOpen(null); resolveForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving} icon={<CheckCircleOutlined />}
              style={{ background: '#059669', borderColor: '#059669' }}>
              Marquer résolu
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
