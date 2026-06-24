import { useEffect, useState } from 'react'
import {
  Card, Select, Table, Typography, Tabs, Statistic, Row, Col,
  Tag, Empty, Button, Progress, Alert,
} from 'antd'
import {
  DollarOutlined, TeamOutlined, PrinterOutlined,
  ExclamationCircleOutlined, CalendarOutlined, DownloadOutlined,
  BarChartOutlined, FileExcelOutlined, RiseOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatGNF } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text, Title } = Typography
const { Option } = Select

const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

// ── Rapport financier ──────────────────────────────────────────────────────────
function FinancialReport() {
  const message = useAppMessage()
  const [year, setYear] = useState(dayjs().year())
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [byFeeType, setByFeeType] = useState<any[]>([])

  const load = async (y: number) => {
    setLoading(true)
    try {
      const [r, ft] = await Promise.all([
        ipc.payments.report(y),
        ipc.payments.reportByFeeType(y),
      ])
      setReport(r)
      setByFeeType(ft)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(year) }, [year])

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const result = await ipc.reports.exportFinancialExcel(year)
      if (result) message.success('Rapport exporté avec succès !')
    } catch (e: any) {
      message.error(e.message ?? 'Erreur lors de l\'export Excel')
    } finally { setExporting(false) }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => dayjs().year() - i)

  const monthRows = report
    ? Object.entries(report.byMonth as Record<string, { total: number; count: number }>)
        .map(([m, v]) => ({ month: MONTHS[Number(m) - 1], ...v }))
    : []

  const maxMonth = Math.max(...monthRows.map(r => r.total), 1)

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Text strong>Année :</Text>
        <Select value={year} onChange={setYear} style={{ width: 110 }}>
          {yearOptions.map(y => <Option key={y} value={y}>{y}</Option>)}
        </Select>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimer</Button>
        <Button
          icon={<FileExcelOutlined />}
          type="primary"
          style={{ background: '#15803D', borderColor: '#15803D' }}
          loading={exporting}
          onClick={handleExportExcel}
        >
          Exporter Excel
        </Button>
      </div>

      {/* KPIs */}
      {report && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #1E40AF' }}>
              <Statistic
                title="Total encaissé"
                value={report.totalYear}
                formatter={v => formatGNF(Number(v))}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#1E40AF', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #16A34A' }}>
              <Statistic
                title="Nombre de paiements"
                value={report.count}
                suffix="reçus"
                valueStyle={{ color: '#16A34A', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #D97706' }}>
              <Statistic
                title="Moyenne mensuelle"
                value={report.count > 0 ? report.totalYear / 12 : 0}
                formatter={v => formatGNF(Number(v))}
                valueStyle={{ color: '#D97706', fontSize: 18 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={16}>
        {/* Par mois */}
        <Col span={14}>
          <Card title="Encaissements par mois" size="small" loading={loading}>
            {monthRows.every(r => r.total === 0) ? (
              <Empty description="Aucun paiement enregistré" />
            ) : (
              <div>
                {monthRows.map(r => (
                  <div key={r.month} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ width: 80, fontSize: 12 }}>{r.month}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{r.count} paiem.</Text>
                      <Text strong style={{ fontSize: 12 }}>{formatGNF(r.total)}</Text>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${(r.total / maxMonth) * 100}%`,
                        background: '#1E40AF',
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* Par type de frais */}
        <Col span={10}>
          <Card title="Par type de frais" size="small" loading={loading}>
            <Table
              dataSource={byFeeType}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Type', dataIndex: 'name', key: 'name' },
                { title: 'Montant', dataIndex: 'total', key: 'total',
                  render: (v: number) => <Text strong>{formatGNF(v)}</Text> },
                { title: 'N°', dataIndex: 'count', key: 'count', width: 40 },
              ]}
              locale={{ emptyText: 'Aucun paiement' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// ── Helpers CSV ───────────────────────────────────────────────────────────────
function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Rapport pédagogique ────────────────────────────────────────────────────────
function PedagoReport() {
  const message = useAppMessage()
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [period, setPeriod] = useState(1)
  const [loading, setLoading] = useState(false)
  const [rankings, setRankings] = useState<any[]>([])
  const [absStats, setAbsStats] = useState<any[]>([])
  const [subjectStats, setSubjectStats] = useState<any[]>([])
  const [subTab, setSubTab] = useState<'ranking' | 'subjects'>('ranking')

  useEffect(() => {
    ipc.classes.list().then(setClasses).catch(() => {})
  }, [])

  const load = async () => {
    if (!selectedClassId) return
    setLoading(true)
    try {
      const [r, a, s] = await Promise.all([
        ipc.grades.getRanking(selectedClassId, period),
        ipc.absences.stats(selectedClassId),
        ipc.grades.statsBySubject(selectedClassId, period),
      ])
      setRankings(r)
      setAbsStats(a)
      setSubjectStats(s)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (selectedClassId) load() }, [selectedClassId, period])

  const absMap = Object.fromEntries(absStats.map(a => [a.enrollmentId, a]))

  const rankingColumns = [
    { title: 'Rang', key: 'rank', width: 55,
      render: (_: any, r: any, i: number) => {
        const rank = i + 1
        const colors = ['#D97706', '#6B7280', '#92400E']
        return <Text strong style={{ color: colors[rank - 1] }}>{rank}</Text>
      }
    },
    { title: 'Élève', dataIndex: 'studentName', key: 'name',
      render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Moyenne générale', dataIndex: 'average', key: 'avg', width: 140,
      render: (v: number) => (
        <Tag color={v >= 16 ? 'green' : v >= 14 ? 'cyan' : v >= 10 ? 'blue' : 'red'}>
          {v?.toFixed(2)}/20
        </Tag>
      )
    },
    { title: 'Mention', key: 'mention', width: 120,
      render: (_: any, r: any) => {
        const v = r.average ?? 0
        const m = v >= 16 ? 'Très Bien' : v >= 14 ? 'Bien' : v >= 12 ? 'Assez Bien' : v >= 10 ? 'Passable' : 'Insuffisant'
        const c = v >= 16 ? 'green' : v >= 14 ? 'cyan' : v >= 12 ? 'blue' : v >= 10 ? 'default' : 'red'
        return <Tag color={c}>{m}</Tag>
      }
    },
    { title: 'Absences', key: 'abs', width: 80,
      render: (_: any, r: any) => {
        const a = absMap[r.enrollmentId]
        return a ? <Tag color={a.total > 5 ? 'red' : 'default'}>{a.total} j.</Tag> : '—'
      }
    },
  ]

  const subjectColumns = [
    { title: 'Matière', dataIndex: 'subjectName', key: 'name',
      render: (v: string, r: any) => (
        <div>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.subjectCode}</Text>
        </div>
      )
    },
    { title: 'Coef.', dataIndex: 'coefficient', key: 'coef', width: 60,
      render: (v: number) => <Tag>{v}</Tag> },
    { title: 'Moy. classe', dataIndex: 'classAverage', key: 'avg', width: 110,
      render: (v: number | null) => v !== null
        ? <Tag color={v >= 10 ? 'green' : 'red'}>{v.toFixed(2)}/20</Tag>
        : <Text type="secondary">—</Text>,
      sorter: (a: any, b: any) => (a.classAverage ?? -1) - (b.classAverage ?? -1),
    },
    { title: 'Min', dataIndex: 'minAvg', key: 'min', width: 80,
      render: (v: number | null) => v !== null
        ? <Text style={{ color: '#DC2626', fontSize: 12 }}>{v.toFixed(2)}</Text>
        : '—'
    },
    { title: 'Max', dataIndex: 'maxAvg', key: 'max', width: 80,
      render: (v: number | null) => v !== null
        ? <Text style={{ color: '#16A34A', fontSize: 12 }}>{v.toFixed(2)}</Text>
        : '—'
    },
    { title: 'Taux de réussite', dataIndex: 'passRate', key: 'pass', width: 130,
      render: (v: number | null) => v !== null
        ? <Progress percent={v} size="small"
            strokeColor={v >= 70 ? '#16A34A' : v >= 50 ? '#D97706' : '#DC2626'}
            style={{ marginBottom: 0 }} />
        : '—'
    },
    { title: 'Élèves notés', dataIndex: 'count', key: 'count', width: 100,
      render: (v: number) => <Text type="secondary">{v}</Text> },
  ]

  const handleExportRanking = () => {
    downloadCsv(
      rankings.map((r, i) => ({
        Rang: i + 1,
        Élève: r.studentName,
        Moyenne: r.average?.toFixed(2) ?? '',
        Absences: absMap[r.enrollmentId]?.total ?? 0,
      })),
      `classement_T${period}.csv`
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Select style={{ width: 220 }} placeholder="Sélectionner une classe…"
          onChange={v => setSelectedClassId(v)} allowClear>
          {classes.map((c: any) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
        </Select>
        <Select value={period} onChange={setPeriod} style={{ width: 150 }}>
          <Option value={1}>1er Trimestre</Option>
          <Option value={2}>2ème Trimestre</Option>
          <Option value={3}>3ème Trimestre</Option>
        </Select>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type={subTab === 'ranking' ? 'primary' : 'default'}
            icon={<TeamOutlined />}
            size="small"
            onClick={() => setSubTab('ranking')}
          >
            Classement
          </Button>
          <Button
            type={subTab === 'subjects' ? 'primary' : 'default'}
            icon={<BarChartOutlined />}
            size="small"
            onClick={() => setSubTab('subjects')}
          >
            Par matière
          </Button>
        </div>
        <Button icon={<PrinterOutlined />} size="small" onClick={() => window.print()}>Imprimer</Button>
        {subTab === 'ranking' && rankings.length > 0 && (
          <Button icon={<DownloadOutlined />} size="small" onClick={handleExportRanking}>CSV</Button>
        )}
      </div>

      {rankings.length > 0 && subTab === 'ranking' && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          {[
            { label: 'Effectif', value: rankings.length },
            { label: 'Moy. générale', value: `${(rankings.reduce((s, r) => s + (r.average ?? 0), 0) / rankings.length).toFixed(2)}/20` },
            { label: 'Admis (≥10)', value: rankings.filter(r => (r.average ?? 0) >= 10).length },
            { label: 'Échec (<10)', value: rankings.filter(r => (r.average ?? 0) < 10).length },
          ].map(({ label, value }) => (
            <Col key={label}>
              <Card size="small" style={{ minWidth: 110 }}>
                <Statistic title={label} value={value} valueStyle={{ fontSize: 18 }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {subTab === 'ranking' && (
        <Table
          columns={rankingColumns}
          dataSource={rankings}
          rowKey="enrollmentId"
          loading={loading}
          pagination={false}
          size="middle"
          locale={{ emptyText: selectedClassId ? 'Aucune note saisie pour ce trimestre' : 'Sélectionnez une classe' }}
        />
      )}

      {subTab === 'subjects' && (
        <Table
          columns={subjectColumns}
          dataSource={subjectStats.filter(s => s.count > 0)}
          rowKey="subjectId"
          loading={loading}
          pagination={false}
          size="middle"
          locale={{ emptyText: selectedClassId ? 'Aucune note saisie pour ce trimestre' : 'Sélectionnez une classe' }}
        />
      )}
    </div>
  )
}

// ── Rapport des impayés ────────────────────────────────────────────────────────
function UnpaidReport() {
  const message = useAppMessage()
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [unpaid, setUnpaid] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ipc.classes.list().then(setClasses).catch(() => {})
    load()
  }, [])

  const load = async (cid?: string) => {
    setLoading(true)
    try {
      const data = await ipc.payments.listUnpaid(cid)
      setUnpaid(data)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalBalance = unpaid.reduce((s, u) => s + u.balance, 0)
  const avgBalance = unpaid.length > 0 ? totalBalance / unpaid.length : 0

  const columns = [
    { title: 'Matricule', dataIndex: 'matricule', key: 'mat', width: 130,
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }} type="secondary">{v}</Text> },
    { title: 'Élève', dataIndex: 'studentName', key: 'name',
      render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Classe', dataIndex: 'className', key: 'class', width: 120,
      render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Total dû', dataIndex: 'totalDue', key: 'due', width: 160,
      render: (v: number) => <Text type="secondary">{formatGNF(v)}</Text> },
    { title: 'Payé', dataIndex: 'totalPaid', key: 'paid', width: 160,
      render: (v: number) => <Text style={{ color: '#16A34A' }}>{formatGNF(v)}</Text> },
    { title: 'Solde restant', dataIndex: 'balance', key: 'balance', width: 160,
      render: (v: number) => <Text strong style={{ color: '#DC2626' }}>{formatGNF(v)}</Text> },
    { title: 'Avancement', key: 'pct', width: 130,
      render: (_: any, r: any) => {
        const pct = r.totalDue > 0 ? Math.round((r.totalPaid / r.totalDue) * 100) : 0
        return <Progress percent={pct} size="small"
          strokeColor={pct === 0 ? '#DC2626' : pct < 50 ? '#D97706' : '#D97706'}
          style={{ marginBottom: 0 }} />
      } },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Select
          value={classId}
          onChange={(v) => { setClassId(v); load(v) }}
          style={{ width: 200 }}
          placeholder="Toutes les classes"
          allowClear
        >
          {classes.map((c: any) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
        </Select>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimer</Button>
        {unpaid.length > 0 && (
          <Button icon={<DownloadOutlined />} onClick={() => downloadCsv(
            unpaid.map(u => ({
              Matricule: u.matricule,
              Élève: u.studentName,
              Classe: u.className,
              'Total dû (GNF)': u.totalDue,
              'Payé (GNF)': u.totalPaid,
              'Solde restant (GNF)': u.balance,
            })),
            'rapport_impayes.csv'
          )}>CSV</Button>
        )}
      </div>

      {unpaid.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #DC2626' }}>
              <Statistic
                title="Total impayé"
                value={totalBalance}
                formatter={v => formatGNF(Number(v))}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#DC2626', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #D97706' }}>
              <Statistic
                title="Élèves concernés"
                value={unpaid.length}
                suffix="élève(s)"
                valueStyle={{ color: '#D97706', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #6B7280' }}>
              <Statistic
                title="Solde moyen / élève"
                value={avgBalance}
                formatter={v => formatGNF(Number(v))}
                valueStyle={{ color: '#6B7280', fontSize: 18 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {unpaid.length === 0 && !loading && (
        <Alert
          type="success"
          message="Tous les élèves sont à jour dans leurs paiements."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={unpaid}
        rowKey="studentId"
        loading={loading}
        pagination={{ pageSize: 30, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'Aucun impayé' }}
      />
    </div>
  )
}

// ── Rapport d'absences ─────────────────────────────────────────────────────────
function AbsenceReport() {
  const message = useAppMessage()
  const [classes, setClasses] = useState<any[]>([])
  const [classId, setClassId] = useState<string | null>(null)
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const THRESHOLD = 5

  useEffect(() => {
    ipc.classes.list().then(setClasses).catch(() => {})
  }, [])

  const load = async (cid: string) => {
    setLoading(true)
    try {
      const data = await ipc.absences.stats(cid)
      setStats(data)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const atRisk = stats.filter(s => s.total >= THRESHOLD)
  const avgAbs = stats.length > 0
    ? (stats.reduce((s, r) => s + r.total, 0) / stats.length).toFixed(1)
    : '0'

  const columns = [
    { title: 'Élève', dataIndex: 'studentName', key: 'name',
      render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Matricule', dataIndex: 'matricule', key: 'mat', width: 130,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 80,
      render: (v: number) => (
        <Tag color={v >= THRESHOLD ? 'red' : v >= 3 ? 'orange' : 'default'}>
          {v} j.
        </Tag>
      ),
      sorter: (a: any, b: any) => b.total - a.total,
      defaultSortOrder: 'ascend' as const,
    },
    { title: 'Justifiées', dataIndex: 'justified', key: 'just', width: 100,
      render: (v: number) => <Tag color="green">{v}</Tag> },
    { title: 'Non justifiées', dataIndex: 'unjustified', key: 'unjust', width: 120,
      render: (v: number) => <Tag color={v > 0 ? 'red' : 'default'}>{v}</Tag> },
    { title: 'Retards', dataIndex: 'late', key: 'late', width: 80,
      render: (v: number) => <Tag color={v > 0 ? 'orange' : 'default'}>{v}</Tag> },
    { title: 'Statut', key: 'status', width: 120,
      render: (_: any, r: any) => r.total >= THRESHOLD
        ? <Tag color="red">À risque</Tag>
        : <Tag color="default">Normal</Tag>,
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <Select
          value={classId ?? undefined}
          onChange={(v) => { setClassId(v); load(v) }}
          style={{ width: 200 }}
          placeholder="Sélectionner une classe…"
          allowClear
        >
          {classes.map((c: any) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
        </Select>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimer</Button>
        {stats.length > 0 && (
          <Button icon={<DownloadOutlined />} onClick={() => downloadCsv(
            stats.map(s => ({
              Élève: s.studentName,
              Matricule: s.matricule,
              'Total absences': s.total,
              Justifiées: s.justified,
              'Non justifiées': s.unjustified,
              Retards: s.late,
              Statut: s.total >= THRESHOLD ? 'À risque' : 'Normal',
            })),
            'rapport_absences.csv'
          )}>CSV</Button>
        )}
      </div>

      {stats.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #1E40AF' }}>
              <Statistic title="Effectif" value={stats.length}
                prefix={<TeamOutlined />} valueStyle={{ fontSize: 18, color: '#1E40AF' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #DC2626' }}>
              <Statistic title={`Élèves à risque (≥${THRESHOLD} abs.)`}
                value={atRisk.length} suffix={`/ ${stats.length}`}
                valueStyle={{ fontSize: 18, color: '#DC2626' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderTop: '3px solid #D97706' }}>
              <Statistic title="Moyenne absences / élève"
                value={avgAbs} suffix="j."
                valueStyle={{ fontSize: 18, color: '#D97706' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Table
        columns={columns}
        dataSource={stats}
        rowKey="enrollmentId"
        loading={loading}
        pagination={false}
        size="middle"
        locale={{ emptyText: classId ? 'Aucune donnée pour cette classe' : 'Sélectionnez une classe' }}
        rowClassName={(r: any) => r.total >= THRESHOLD ? 'abs-row-at-risk' : ''}
      />
    </div>
  )
}

// ── Rapport Prévisions de recettes ────────────────────────────────────────────
function ForecastReport() {
  const message = useAppMessage()
  const [year, setYear]       = useState(dayjs().year())
  const [loading, setLoading] = useState(false)
  const [data, setData]       = useState<any>(null)

  const yearOptions = Array.from({ length: 5 }, (_, i) => dayjs().year() - i)

  const load = async (y: number) => {
    setLoading(true)
    try { setData(await ipc.payments.forecast(y)) }
    catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load(year) }, [year])

  const rateColor = !data ? '#6366F1'
    : data.rate >= 80 ? '#059669'
    : data.rate >= 50 ? '#F59E0B'
    : '#DC2626'

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Typography.Text strong>Année :</Typography.Text>
        <Select value={year} onChange={y => { setYear(y); load(y) }} style={{ width: 110 }}>
          {yearOptions.map(y => <Select.Option key={y} value={y}>{y}</Select.Option>)}
        </Select>
      </div>

      {data && (
        <>
          {/* KPI Hero */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <div className="glass" style={{ borderRadius: 16, padding: '20px 22px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>Taux de recouvrement</div>
                <Progress
                  type="circle" percent={data.rate} size={90}
                  strokeColor={rateColor}
                  format={p => <span style={{ fontSize: 18, fontWeight: 800, color: rateColor }}>{p}%</span>}
                />
              </div>
            </Col>
            <Col span={6}>
              <div className="glass" style={{ borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Recettes prévues</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#6366F1', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{formatGNF(data.totalExpected)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{data.activeEnrollments} élèves actifs</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="glass" style={{ borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Encaissé</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#059669', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{formatGNF(data.totalPaid)}</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="glass" style={{ borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Reste à encaisser</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: data.remaining > 0 ? '#DC2626' : '#059669', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                  {formatGNF(data.remaining)}
                </div>
              </div>
            </Col>
          </Row>

          {/* Barre de progression globale */}
          <div className="glass" style={{ borderRadius: 16, padding: '18px 22px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Typography.Text style={{ fontWeight: 600, fontSize: 13 }}>Avancement global du recouvrement {year}</Typography.Text>
              <Typography.Text style={{ fontWeight: 800, color: rateColor }}>{data.rate}%</Typography.Text>
            </div>
            <div style={{ height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${data.rate}%`,
                background: `linear-gradient(90deg, ${rateColor}, ${rateColor}CC)`,
                transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>0 GNF</span>
              <span>{formatGNF(data.totalPaid)} encaissé sur {formatGNF(data.totalExpected)} prévu</span>
            </div>
          </div>

          {/* Breakdown par type de frais */}
          <div className="glass" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <Table
              dataSource={data.byFeeType}
              rowKey="name"
              size="small"
              loading={loading}
              pagination={false}
              columns={[
                { title: 'Type de frais', dataIndex: 'name', key: 'name',
                  render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
                { title: 'Attendu', dataIndex: 'expected', key: 'exp', width: 160,
                  render: (v: number) => <Typography.Text style={{ color: '#6366F1', fontVariantNumeric: 'tabular-nums' }}>{formatGNF(v)}</Typography.Text> },
                { title: 'Encaissé', dataIndex: 'paid', key: 'paid', width: 160,
                  render: (v: number) => <Typography.Text style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{formatGNF(v)}</Typography.Text> },
                { title: 'Écart', key: 'ecart', width: 160,
                  render: (_: any, r: any) => {
                    const diff = r.expected - r.paid
                    return <Typography.Text strong style={{ color: diff > 0 ? '#DC2626' : '#059669', fontVariantNumeric: 'tabular-nums' }}>
                      {diff > 0 ? '-' : '+'}{formatGNF(Math.abs(diff))}
                    </Typography.Text>
                  }
                },
                { title: 'Taux', key: 'rate', width: 100,
                  render: (_: any, r: any) => {
                    const rate = r.expected > 0 ? Math.round((r.paid / r.expected) * 100) : 0
                    return <Tag style={{
                      background: rate >= 80 ? 'rgba(5,150,105,0.1)' : rate >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)',
                      color: rate >= 80 ? '#059669' : rate >= 50 ? '#F59E0B' : '#DC2626',
                      border: 'none', borderRadius: 20, fontWeight: 700,
                    }}>{rate}%</Tag>
                  }
                },
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}

// ── Rapport Recettes vs Dépenses ──────────────────────────────────────────────
function ComparisonReport() {
  const message = useAppMessage()
  const [year, setYear]       = useState(dayjs().year())
  const [loading, setLoading] = useState(false)
  const [data, setData]       = useState<any[]>([])
  const [totals, setTotals]   = useState({ recettes: 0, depenses: 0, solde: 0 })

  const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const yearOptions  = Array.from({ length: 5 }, (_, i) => dayjs().year() - i)

  const load = async (y: number) => {
    setLoading(true)
    try {
      const [payReport, expSummary] = await Promise.all([
        ipc.payments.report(y),
        ipc.expenses.summary(y),
      ])

      const chartData = MONTHS_SHORT.map((mois, i) => {
        const m    = i + 1
        const rec  = payReport?.byMonth?.[m]?.total ?? 0
        const dep  = expSummary?.byMonth?.[m] ?? 0
        return { mois, recettes: rec, depenses: dep, solde: rec - dep }
      })

      setData(chartData)
      const totRec = chartData.reduce((s, r) => s + r.recettes, 0)
      const totDep = chartData.reduce((s, r) => s + r.depenses, 0)
      setTotals({ recettes: totRec, depenses: totDep, solde: totRec - totDep })
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(year) }, [year])

  const formatK = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v)

  const soldeColor = totals.solde >= 0 ? '#059669' : '#DC2626'

  return (
    <div>
      {/* Sélecteur année */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Typography.Text strong>Année :</Typography.Text>
        <Select value={year} onChange={y => { setYear(y); load(y) }} style={{ width: 110 }}>
          {yearOptions.map(y => <Select.Option key={y} value={y}>{y}</Select.Option>)}
        </Select>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { label: 'Total recettes', value: totals.recettes, color: '#6366F1', icon: <DollarOutlined /> },
          { label: 'Total dépenses', value: totals.depenses, color: '#DC2626', icon: <ExclamationCircleOutlined /> },
          { label: 'Solde net', value: totals.solde, color: soldeColor, icon: <RiseOutlined /> },
        ].map(({ label, value, color, icon }) => (
          <Col key={label} span={8}>
            <div className="glass" style={{ borderRadius: 16, padding: '18px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse at top right, ${color}10, transparent 60%)` }} />
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                {formatGNF(value)}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Chart */}
      <div className="glass" style={{ borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
          Recettes vs Dépenses — {year}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(99,102,241,0.1)" />
            <XAxis dataKey="mois" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
            <RechartTooltip
              formatter={(v: any, name: string) => [formatGNF(Number(v)), name === 'recettes' ? 'Recettes' : 'Dépenses']}
              contentStyle={{ borderRadius: 10, fontSize: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <Legend
              iconType="square"
              formatter={v => v === 'recettes' ? 'Recettes' : 'Dépenses'}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="recettes" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="depenses" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly detail table */}
      <div className="glass" style={{ borderRadius: 16, marginTop: 16, overflow: 'hidden' }}>
        <Table
          dataSource={data}
          rowKey="mois"
          size="small"
          loading={loading}
          pagination={false}
          columns={[
            { title: 'Mois', dataIndex: 'mois', key: 'mois', width: 80 },
            {
              title: 'Recettes', dataIndex: 'recettes', key: 'rec',
              render: (v: number) => <Typography.Text strong style={{ color: '#6366F1' }}>{formatGNF(v)}</Typography.Text>,
            },
            {
              title: 'Dépenses', dataIndex: 'depenses', key: 'dep',
              render: (v: number) => <Typography.Text strong style={{ color: '#F43F5E' }}>{formatGNF(v)}</Typography.Text>,
            },
            {
              title: 'Solde', dataIndex: 'solde', key: 'sol',
              render: (v: number) => (
                <Typography.Text strong style={{ color: v >= 0 ? '#059669' : '#DC2626' }}>
                  {v >= 0 ? '+' : ''}{formatGNF(v)}
                </Typography.Text>
              ),
            },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><Typography.Text strong>Total</Typography.Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1}><Typography.Text strong style={{ color: '#6366F1' }}>{formatGNF(totals.recettes)}</Typography.Text></Table.Summary.Cell>
              <Table.Summary.Cell index={2}><Typography.Text strong style={{ color: '#F43F5E' }}>{formatGNF(totals.depenses)}</Typography.Text></Table.Summary.Cell>
              <Table.Summary.Cell index={3}><Typography.Text strong style={{ color: soldeColor }}>{totals.solde >= 0 ? '+' : ''}{formatGNF(totals.solde)}</Typography.Text></Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export function ReportsPage() {
  const items = [
    { key: 'financial',   label: <span><DollarOutlined />               Financier</span>,            children: <FinancialReport /> },
    { key: 'forecast',    label: <span><RiseOutlined />                  Prévisions</span>,           children: <ForecastReport /> },
    { key: 'comparison',  label: <span><BarChartOutlined />              Recettes vs Dépenses</span>, children: <ComparisonReport /> },
    { key: 'pedagogy',    label: <span><TeamOutlined />                  Pédagogique</span>,          children: <PedagoReport /> },
    { key: 'unpaid',      label: <span><ExclamationCircleOutlined />     Impayés</span>,              children: <UnpaidReport /> },
    { key: 'absences',    label: <span><CalendarOutlined />              Absences</span>,             children: <AbsenceReport /> },
  ]

  return (
    <div>
      <PageHeader title="Rapports" subtitle="Synthèses financières, pédagogiques et de présence" />
      <Card variant="borderless" style={{ borderRadius: 12 }}>
        <Tabs items={items} defaultActiveKey="financial" />
      </Card>
    </div>
  )
}
