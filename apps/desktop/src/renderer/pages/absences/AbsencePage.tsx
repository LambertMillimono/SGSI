import { useEffect, useState } from 'react'
import {
  Select, Table, Button, DatePicker, Tag, Typography,
  Badge, Input, Card, Row, Col, Statistic, Avatar, Tooltip, Progress,
} from 'antd'
import {
  SaveOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  BarChartOutlined, CalendarOutlined, TeamOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/fr'
import { ipc } from '../../utils/ipcBridge'
import { useAppMessage } from '../../hooks/useAppMessage'
import { PageHeader } from '../../components/shared/PageHeader'

dayjs.locale('fr')

const { Option } = Select
const { Text } = Typography

type AbsenceType = 'PRESENT' | 'ABSENT' | 'LATE'

interface SheetRow {
  enrollmentId: string
  studentName: string
  matricule: string
  gender: string
  absence: any | null
  type: AbsenceType
  justified: boolean
  reason: string
}

const TYPE_CONFIG: Record<AbsenceType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PRESENT: { label: 'Présent',  color: '#16A34A', bg: '#F0FDF4', icon: <CheckCircleOutlined /> },
  ABSENT:  { label: 'Absent',   color: '#DC2626', bg: '#FFF5F5', icon: <CloseCircleOutlined /> },
  LATE:    { label: 'Retard',   color: '#D97706', bg: '#FFFBEB', icon: <ClockCircleOutlined /> },
}

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export function AbsencePage() {
  const message = useAppMessage()
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [rows, setRows] = useState<SheetRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'sheet' | 'stats'>('sheet')
  const [stats, setStats] = useState<any[]>([])

  useEffect(() => { ipc.classes.list().then(setClasses).catch(() => {}) }, [])
  useEffect(() => { if (selectedClassId && selectedDate) loadSheet() }, [selectedClassId, selectedDate])

  const loadSheet = async () => {
    if (!selectedClassId) return
    setLoading(true)
    try {
      const data = await ipc.absences.getSheet(selectedClassId, selectedDate.toISOString())
      setRows(data.map((r: any) => ({
        ...r,
        type: r.absence ? (r.absence.type as AbsenceType) : 'PRESENT',
        justified: r.absence?.justified ?? false,
        reason: r.absence?.reason ?? '',
      })))
    } catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  const loadStats = async () => {
    if (!selectedClassId) return
    setLoading(true)
    try { setStats(await ipc.absences.stats(selectedClassId)) }
    catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  const handleViewChange = (v: 'sheet' | 'stats') => {
    setView(v)
    if (v === 'stats' && selectedClassId) loadStats()
  }

  const setRowType = (enrollmentId: string, type: AbsenceType) => {
    setRows(prev => prev.map(r =>
      r.enrollmentId === enrollmentId ? { ...r, type, justified: false, reason: '' } : r
    ))
  }

  const setRowField = (enrollmentId: string, field: 'justified' | 'reason', value: any) => {
    setRows(prev => prev.map(r =>
      r.enrollmentId === enrollmentId ? { ...r, [field]: value } : r
    ))
  }

  const handleSave = async () => {
    if (!rows.length) return
    setSaving(true)
    try {
      await ipc.absences.saveSheet(
        rows.map(r => ({ enrollmentId: r.enrollmentId, type: r.type, justified: r.justified, reason: r.reason || undefined })),
        selectedDate.toISOString()
      )
      message.success(`Pointage enregistré — ${selectedDate.format('dddd D MMMM YYYY')}`)
    } catch (e: any) { message.error(e.message) }
    finally { setSaving(false) }
  }

  const countByType = (type: AbsenceType) => rows.filter(r => r.type === type).length
  const presents = countByType('PRESENT')
  const absents = countByType('ABSENT')
  const retards = countByType('LATE')
  const presenceRate = rows.length > 0 ? Math.round((presents / rows.length) * 100) : 0

  const sheetColumns = [
    {
      title: '#',
      key: 'idx',
      width: 44,
      render: (_: any, __: any, i: number) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text>
      ),
    },
    {
      title: 'Élève',
      key: 'student',
      render: (_: any, r: SheetRow) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={32}
            style={{
              background: r.gender === 'FEMALE' ? '#BE185D' : '#1E40AF',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}
          >
            {getInitials(r.studentName)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13 }}>{r.studentName}</Text>
            <div><Text code style={{ fontSize: 10, color: '#6B7280' }}>{r.matricule}</Text></div>
          </div>
        </div>
      ),
    },
    {
      title: 'Statut de présence',
      key: 'status',
      width: 280,
      render: (_: any, r: SheetRow) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {(['PRESENT', 'ABSENT', 'LATE'] as AbsenceType[]).map(type => {
            const cfg = TYPE_CONFIG[type]
            const selected = r.type === type
            return (
              <button
                key={type}
                onClick={() => setRowType(r.enrollmentId, type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20,
                  border: `2px solid ${selected ? cfg.color : 'var(--border)'}`,
                  background: selected ? cfg.bg : 'var(--surface)',
                  color: selected ? cfg.color : '#9CA3AF',
                  fontWeight: selected ? 700 : 500,
                  fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.15s',
                  outline: 'none',
                }}
              >
                <span style={{ fontSize: 13 }}>{cfg.icon}</span>
                {cfg.label}
              </button>
            )
          })}
        </div>
      ),
    },
    {
      title: 'Justifiée',
      key: 'justified',
      width: 110,
      render: (_: any, r: SheetRow) => r.type !== 'PRESENT' ? (
        <button
          onClick={() => setRowField(r.enrollmentId, 'justified', !r.justified)}
          style={{
            padding: '4px 12px', borderRadius: 16,
            border: `2px solid ${r.justified ? '#2563EB' : 'var(--border)'}`,
            background: r.justified ? '#EFF6FF' : 'var(--surface)',
            color: r.justified ? '#1D4ED8' : '#9CA3AF',
            fontWeight: r.justified ? 700 : 500,
            fontSize: 12, cursor: 'pointer', outline: 'none',
          }}
        >
          {r.justified ? '✓ Justifiée' : 'Non just.'}
        </button>
      ) : null,
    },
    {
      title: 'Motif',
      key: 'reason',
      render: (_: any, r: SheetRow) => r.type !== 'PRESENT' ? (
        <Input
          size="small"
          placeholder="Motif de l'absence…"
          value={r.reason}
          onChange={e => setRowField(r.enrollmentId, 'reason', e.target.value)}
          style={{ borderRadius: 6, fontSize: 12 }}
        />
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
      ),
    },
  ]

  const statsColumns = [
    {
      title: 'Élève',
      key: 'name',
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={28} style={{ background: '#1E40AF', fontSize: 10, fontWeight: 700 }}>
            {getInitials(r.studentName)}
          </Avatar>
          <Text strong style={{ fontSize: 13 }}>{r.studentName}</Text>
        </div>
      ),
    },
    {
      title: 'Total absences',
      dataIndex: 'total',
      key: 'total',
      width: 130,
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge
            count={v}
            showZero
            style={{
              background: v === 0 ? '#16A34A' : v < 5 ? '#D97706' : '#DC2626',
              fontWeight: 700,
            }}
          />
          {v > 10 && (
            <Tag style={{ background: '#FEE2E2', border: 0, color: '#DC2626', fontSize: 10 }}>
              Alerte
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Non justifiées',
      dataIndex: 'unjustified',
      key: 'unjust',
      width: 120,
      render: (v: number) => (
        <Tag
          style={{
            background: v > 0 ? '#FEE2E2' : '#F0FDF4',
            border: 0,
            color: v > 0 ? '#DC2626' : '#16A34A',
            fontWeight: 600,
          }}
        >
          {v > 0 ? `${v} absence${v > 1 ? 's' : ''}` : 'Aucune'}
        </Tag>
      ),
    },
    {
      title: 'Justifiées',
      dataIndex: 'justified',
      key: 'just',
      width: 100,
      render: (v: number) => (
        <Tag style={{ background: '#EFF6FF', border: 0, color: '#1D4ED8', fontWeight: 600 }}>{v}</Tag>
      ),
    },
    {
      title: 'Retards',
      dataIndex: 'late',
      key: 'late',
      width: 80,
      render: (v: number) => v > 0
        ? <Tag style={{ background: '#FFFBEB', border: 0, color: '#92400E', fontWeight: 600 }}>{v}</Tag>
        : <Text type="secondary">0</Text>,
    },
  ]

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name

  return (
    <div>
      <PageHeader
        title="Absences & Présences"
        subtitle={selectedClassId
          ? `${selectedClassName} — ${selectedDate.format('dddd D MMMM YYYY')}`
          : 'Pointage quotidien des élèves'
        }
        actions={
          view === 'sheet' && rows.length > 0 ? (
            <Button type="primary" icon={<SaveOutlined />} size="large" loading={saving} onClick={handleSave} style={{ borderRadius: 8 }}>
              Enregistrer le pointage
            </Button>
          ) : undefined
        }
      />

      {/* Contrôles */}
      <Card
        variant="borderless"
        style={{ borderRadius: 12, marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            style={{ width: 220 }}
            placeholder="Choisir une classe…"
            value={selectedClassId}
            onChange={v => setSelectedClassId(v)}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {classes.map((c: any) => (
              <Option key={c.id} value={c.id}>
                {c.name}{c.level ? ` — ${c.level.name}` : ''}
              </Option>
            ))}
          </Select>

          {view === 'sheet' && (
            <DatePicker
              value={selectedDate}
              onChange={d => d && setSelectedDate(d)}
              format="DD/MM/YYYY"
              allowClear={false}
              style={{ borderRadius: 8 }}
            />
          )}

          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <Button
              icon={<CalendarOutlined />}
              type={view === 'sheet' ? 'primary' : 'default'}
              onClick={() => handleViewChange('sheet')}
              style={{ borderRadius: 8 }}
            >
              Feuille de présence
            </Button>
            <Button
              icon={<BarChartOutlined />}
              type={view === 'stats' ? 'primary' : 'default'}
              onClick={() => handleViewChange('stats')}
              style={{ borderRadius: 8 }}
            >
              Statistiques
            </Button>
          </div>
        </div>
      </Card>

      {/* Vue : feuille de présence */}
      {view === 'sheet' && (
        <>
          {/* Compteurs visuels */}
          {rows.length > 0 && (
            <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
              <Col xs={24} sm={6}>
                <Card
                  size="small"
                  variant="borderless"
                  style={{ borderRadius: 10, borderLeft: '4px solid #16A34A', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                >
                  <Statistic
                    title={<span style={{ fontSize: 12 }}>Présents</span>}
                    value={presents}
                    suffix={<span style={{ fontSize: 14 }}>/ {rows.length}</span>}
                    prefix={<CheckCircleOutlined style={{ color: '#16A34A', marginRight: 4 }} />}
                    valueStyle={{ color: '#16A34A', fontWeight: 700, fontSize: 22 }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card
                  size="small"
                  variant="borderless"
                  style={{ borderRadius: 10, borderLeft: '4px solid #DC2626', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                >
                  <Statistic
                    title={<span style={{ fontSize: 12 }}>Absents</span>}
                    value={absents}
                    prefix={<CloseCircleOutlined style={{ color: '#DC2626', marginRight: 4 }} />}
                    valueStyle={{ color: '#DC2626', fontWeight: 700, fontSize: 22 }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card
                  size="small"
                  variant="borderless"
                  style={{ borderRadius: 10, borderLeft: '4px solid #D97706', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                >
                  <Statistic
                    title={<span style={{ fontSize: 12 }}>Retards</span>}
                    value={retards}
                    prefix={<ClockCircleOutlined style={{ color: '#D97706', marginRight: 4 }} />}
                    valueStyle={{ color: '#D97706', fontWeight: 700, fontSize: 22 }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={6}>
                <Card
                  size="small"
                  variant="borderless"
                  style={{ borderRadius: 10, borderLeft: '4px solid #1E40AF', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                >
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Taux de présence</Text>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: presenceRate >= 80 ? '#16A34A' : presenceRate >= 60 ? '#D97706' : '#DC2626' }}>
                    {presenceRate}%
                  </div>
                  <Progress
                    percent={presenceRate}
                    showInfo={false}
                    size="small"
                    strokeColor={presenceRate >= 80 ? '#16A34A' : presenceRate >= 60 ? '#D97706' : '#DC2626'}
                    trailColor="#e5e7eb"
                    style={{ marginTop: 4 }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }} styles={{ body: { padding: 0 } }}>
            <Table
              columns={sheetColumns}
              dataSource={rows}
              rowKey="enrollmentId"
              loading={loading}
              pagination={false}
              size="middle"
              rowClassName={(r: SheetRow) =>
                r.type === 'ABSENT' ? 'abs-row-absent'
                : r.type === 'LATE' ? 'abs-row-late'
                : 'abs-row-present'
              }
              locale={{
                emptyText: !selectedClassId
                  ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <TeamOutlined style={{ fontSize: 48, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                      <Text type="secondary">Sélectionnez une classe pour commencer le pointage</Text>
                    </div>
                  )
                  : 'Aucun élève dans cette classe',
              }}
            />
          </Card>
        </>
      )}

      {/* Vue : statistiques */}
      {view === 'stats' && (
        <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }} styles={{ body: { padding: 0 } }}>
          <Table
            columns={statsColumns}
            dataSource={stats}
            rowKey="enrollmentId"
            loading={loading}
            pagination={{ pageSize: 30, showTotal: t => `${t} élèves` }}
            size="middle"
            locale={{ emptyText: 'Sélectionnez une classe pour voir les statistiques' }}
          />
        </Card>
      )}

      <style>{`
        .abs-row-absent td { background: #FFF5F5 !important; }
        .abs-row-late td { background: #FFFBEB !important; }
        .abs-row-present td { background: #fff !important; }
        .ant-table-row.abs-row-absent:hover td { background: #FEE2E2 !important; }
        .ant-table-row.abs-row-late:hover td { background: #FEF3C7 !important; }
      `}</style>
    </div>
  )
}
