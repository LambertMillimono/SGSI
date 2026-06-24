import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Select, Table, InputNumber, Typography, Tag, Spin, Button,
  Card, Row, Col, Progress, Tooltip, Space, Avatar, Empty, Modal, Alert,
} from 'antd'
import {
  SaveOutlined, FileTextOutlined, CheckCircleOutlined, ReloadOutlined,
  ReadOutlined, BookOutlined, UploadOutlined, CheckOutlined, CloseOutlined,
  DownloadOutlined, FileExcelOutlined,
} from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text } = Typography
const { Option } = Select

const EVAL_OPTIONS = [
  { value: 'DS1',         label: 'Devoir 1',          coeff: 1,   color: '#1E40AF' },
  { value: 'DS2',         label: 'Devoir 2',          coeff: 1,   color: '#1E40AF' },
  { value: 'COMPOSITION', label: 'Composition',       coeff: 2,   color: '#7C3AED' },
  { value: 'INTERRO',     label: 'Interrogation',     coeff: 0.5, color: '#0369A1' },
  { value: 'TP',          label: 'Travaux Pratiques', coeff: 0.5, color: '#15803D' },
  { value: 'EXAM',        label: 'Examen',            coeff: 3,   color: '#B45309' },
]

const PERIOD_OPTIONS = [
  { value: 1, label: '1er Trimestre' },
  { value: 2, label: '2ème Trimestre' },
  { value: 3, label: '3ème Trimestre' },
]

interface GradeRow {
  enrollmentId: string
  studentName: string
  matricule: string
  gradeId: string | null
  value: number | null
  saved: boolean
  saving: boolean
  error: boolean
}

function gradeColor(v: number | null, max: number = 20): string {
  if (v === null) return 'transparent'
  if (v < max * 0.5) return '#FEE2E2'
  if (v < max * 0.7) return '#FEF3C7'
  if (v < max * 0.8) return '#D1FAE5'
  return '#A7F3D0'
}

function gradeTextColor(v: number | null, max: number = 20): string {
  if (v === null) return 'inherit'
  if (v < max * 0.5) return '#DC2626'
  if (v < max * 0.7) return '#92400E'
  if (v < max * 0.8) return '#065F46'
  return '#064E3B'
}

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export function GradeEntryPage() {
  const message = useAppMessage()
  const { userId } = useAuth()
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<string | undefined>()
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>()
  const [period, setPeriod] = useState<number>(1)
  const [evalType, setEvalType] = useState<string>('DS1')
  const [rows, setRows] = useState<GradeRow[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [csvRows, setCsvRows] = useState<Array<{ lastName: string; firstName: string; matricule: string; value: number | null; matchedEnrollmentId: string | null; matched: boolean }>>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [xlsxImporting, setXlsxImporting] = useState(false)
  const [xlsxResult, setXlsxResult] = useState<any>(null)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => { ipc.classes.list().then(setClasses).catch(() => {}) }, [])

  // Maternelle / Primaire → /10 ; Collège / Lycée → /20
  const maxGrade = useMemo(() => {
    if (!selectedClass) return 20
    const cls = classes.find((c: any) => c.id === selectedClass)
    const cycle: string = cls?.level?.cycle?.name ?? ''
    return (cycle === 'Maternelle' || cycle === 'Primaire') ? 10 : 20
  }, [selectedClass, classes])

  useEffect(() => {
    setSubjects([]); setSelectedSubject(undefined); setRows([])
    if (!selectedClass) return
    ipc.subjects.listByClass(selectedClass).then(setSubjects).catch(() => {})
  }, [selectedClass])

  const loadGrades = useCallback(async () => {
    if (!selectedClass || !selectedSubject) return
    setLoadingStudents(true)
    try {
      const data = await ipc.grades.listByClass(selectedClass, selectedSubject, period, evalType)
      setRows(data.map((d: any) => ({
        enrollmentId: d.enrollmentId,
        studentName: d.studentName,
        matricule: d.matricule,
        gradeId: d.grade?.id ?? null,
        value: d.grade?.value ?? null,
        saved: d.grade !== null,
        saving: false,
        error: false,
      })))
    } catch (e: any) {
      message.error('Erreur : ' + e.message)
    } finally {
      setLoadingStudents(false)
    }
  }, [selectedClass, selectedSubject, period, evalType])

  useEffect(() => { loadGrades() }, [loadGrades])

  const saveGrade = useCallback(async (enrollmentId: string, value: number) => {
    if (!userId || !selectedSubject) return
    setRows(prev => prev.map(r => r.enrollmentId === enrollmentId ? { ...r, saving: true, error: false } : r))
    try {
      const saved = await ipc.grades.upsert({
        enrollmentId, subjectId: selectedSubject, period, evalType, value, maxValue: maxGrade,
      }, userId)
      setRows(prev => prev.map(r =>
        r.enrollmentId === enrollmentId ? { ...r, gradeId: saved.id, saved: true, saving: false, error: false } : r
      ))
    } catch {
      setRows(prev => prev.map(r =>
        r.enrollmentId === enrollmentId ? { ...r, saving: false, error: true } : r
      ))
    }
  }, [userId, selectedSubject, period, evalType, maxGrade])

  const handleChange = useCallback((enrollmentId: string, value: number | null) => {
    setRows(prev => prev.map(r =>
      r.enrollmentId === enrollmentId ? { ...r, value, saved: false, error: false } : r
    ))
    if (timers.current[enrollmentId]) clearTimeout(timers.current[enrollmentId])
    if (value !== null && value >= 0 && value <= maxGrade) {
      timers.current[enrollmentId] = setTimeout(() => saveGrade(enrollmentId, value), 800)
    }
  }, [saveGrade, maxGrade])

  const handleOpenCsvImport = async () => {
    if (!selectedClass || !selectedSubject) {
      message.warning('Sélectionnez une classe et une matière avant d\'importer')
      return
    }
    const parsed = await ipc.grades.parseCsv()
    if (!parsed) return // user cancelled
    if (parsed.length === 0) { message.warning('Le fichier CSV est vide ou mal formaté'); return }

    // Match CSV rows against enrolled students
    const matched = parsed.map(row => {
      let match = rows.find(r =>
        r.matricule && row.matricule && r.matricule.toLowerCase() === row.matricule.toLowerCase()
      )
      if (!match && row.lastName) {
        match = rows.find(r => {
          const rName = r.studentName.toLowerCase()
          const csvLast = row.lastName.toLowerCase()
          const csvFirst = row.firstName.toLowerCase()
          return rName.includes(csvLast) && (!csvFirst || rName.includes(csvFirst))
        })
      }
      return {
        ...row,
        matchedEnrollmentId: match?.enrollmentId ?? null,
        matched: !!match,
      }
    })
    setCsvRows(matched)
    setCsvModalOpen(true)
  }

  const handleConfirmCsvImport = async () => {
    if (!userId || !selectedSubject) return
    setCsvImporting(true)
    let imported = 0
    let errors = 0
    for (const row of csvRows) {
      if (!row.matched || !row.matchedEnrollmentId || row.value === null) continue
      if (row.value < 0 || row.value > maxGrade) continue
      try {
        await ipc.grades.upsert({
          enrollmentId: row.matchedEnrollmentId,
          subjectId: selectedSubject,
          period,
          evalType,
          value: row.value,
          maxValue: maxGrade,
        }, userId)
        imported++
      } catch { errors++ }
    }
    setCsvImporting(false)
    setCsvModalOpen(false)
    setCsvRows([])
    if (imported > 0) {
      message.success(`${imported} note${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}${errors > 0 ? ` · ${errors} erreur(s)` : ''}`)
      loadGrades()
    } else {
      message.warning('Aucune note importée')
    }
  }

  /* ── Import Excel multi-colonnes (DS1 / DS2 / Composition) ── */
  const handleImportExcel = async () => {
    if (!selectedClass || !selectedSubject) {
      message.warning('Sélectionnez une classe et une matière avant d\'importer')
      return
    }
    if (!userId) return
    setXlsxImporting(true)
    try {
      const result = await ipc.grades.importExcel(selectedClass, selectedSubject, period, userId)
      if (!result) return // user cancelled
      setXlsxResult(result)
      if (result.imported > 0) {
        message.success(`${result.imported} élève(s) importé(s) avec succès`)
        loadGrades()
      } else {
        message.warning('Aucune note importée. Vérifiez le fichier.')
      }
    } catch (e: any) {
      message.error(e.message ?? 'Erreur import Excel')
    } finally {
      setXlsxImporting(false)
    }
  }

  const handleGenerateBulletins = async () => {
    if (!selectedClass || !userId) return
    setGenerating(true)
    try {
      const result = await ipc.bulletins.generateForClass(selectedClass, period, userId)
      message.success(`${result.success}/${result.total} bulletins générés${result.failed > 0 ? ` (${result.failed} erreurs)` : ''}`)
    } catch (e: any) {
      message.error('Erreur : ' + e.message)
    } finally { setGenerating(false) }
  }

  const saved = rows.filter(r => r.saved).length
  const total = rows.length
  const percent = total > 0 ? Math.round((saved / total) * 100) : 0
  const canGenerate = !!(selectedClass && total > 0 && saved > 0)

  const selectedEval = EVAL_OPTIONS.find(e => e.value === evalType)
  const selectedSubjectName = subjects.find(s => s.subjectId === selectedSubject)?.subject?.name ?? ''
  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label ?? ''

  // Grade distribution
  const dist = { red: 0, yellow: 0, green: 0, darkGreen: 0 }
  rows.forEach(r => {
    if (r.value === null) return
    if (r.value < maxGrade * 0.5) dist.red++
    else if (r.value < maxGrade * 0.7) dist.yellow++
    else if (r.value < maxGrade * 0.8) dist.green++
    else dist.darkGreen++
  })

  const isReady = !!(selectedClass && selectedSubject)

  const columns = [
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
      render: (_: any, row: GradeRow) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={32} style={{ background: '#1E40AF', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {getInitials(row.studentName)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13 }}>{row.studentName}</Text>
            <div>
              <Text code style={{ fontSize: 10, color: '#6B7280' }}>{row.matricule}</Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: (
        <span>
          Note <Text type="secondary" style={{ fontSize: 11 }}>/{maxGrade}</Text>
        </span>
      ),
      key: 'value',
      width: 160,
      render: (_: any, row: GradeRow) => (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <InputNumber
            min={0} max={maxGrade} step={0.25} precision={2}
            value={row.value}
            onChange={(v) => handleChange(row.enrollmentId, v)}
            disabled={row.saving}
            placeholder="—"
            style={{
              width: 90,
              background: gradeColor(row.value, maxGrade),
              borderColor: row.error ? '#DC2626' : row.saved ? '#16A34A' : row.value !== null ? '#d1d5db' : undefined,
              color: gradeTextColor(row.value, maxGrade),
              fontWeight: row.value !== null ? 700 : 400,
              borderRadius: 6,
            }}
          />
          {row.value !== null && (
            <Text style={{
              fontSize: 16, fontWeight: 800,
              color: gradeTextColor(row.value, maxGrade),
              minWidth: 28,
            }}>
              {row.value?.toFixed(2).replace('.00', '')}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Appréciation',
      key: 'appre',
      width: 130,
      render: (_: any, row: GradeRow) => {
        if (row.value === null) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        const v = row.value
        const m = maxGrade
        if (v >= m * 0.8) return <Tag color="#064E3B" style={{ background: '#A7F3D0', border: 0, color: '#064E3B', fontWeight: 600 }}>Très Bien</Tag>
        if (v >= m * 0.7) return <Tag color="#065F46" style={{ background: '#D1FAE5', border: 0, color: '#065F46', fontWeight: 600 }}>Bien</Tag>
        if (v >= m * 0.6) return <Tag color="#0369A1" style={{ background: '#E0F2FE', border: 0, color: '#0369A1', fontWeight: 600 }}>Assez Bien</Tag>
        if (v >= m * 0.5) return <Tag style={{ background: '#FEF3C7', border: 0, color: '#92400E', fontWeight: 600 }}>Passable</Tag>
        return <Tag style={{ background: '#FEE2E2', border: 0, color: '#DC2626', fontWeight: 600 }}>Insuffisant</Tag>
      },
    },
    {
      title: 'Statut',
      key: 'status',
      width: 120,
      render: (_: any, row: GradeRow) => {
        if (row.saving) return <Tag color="processing" style={{ borderRadius: 6 }}>Sauvegarde…</Tag>
        if (row.error) return <Tag color="error" style={{ borderRadius: 6 }}>Erreur !</Tag>
        if (row.saved) return <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 6 }}>Enregistré</Tag>
        if (row.value !== null) return <Tag color="warning" style={{ borderRadius: 6 }}>Non sauvé</Tag>
        return <Tag style={{ borderRadius: 6, color: '#9CA3AF', borderColor: '#e5e7eb' }}>Non saisi</Tag>
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Saisie des Notes"
        subtitle={isReady ? `${selectedSubjectName} · ${selectedEval?.label} · ${periodLabel}` : 'Sélectionnez une classe et une matière pour commencer'}
      />

      {/* Filtres — panneau de sélection */}
      <Card
        variant="borderless"
        style={{ borderRadius: 12, marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={[12, 10]} align="bottom">
          <Col>
            <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              1 · Classe
            </Text>
            <Select
              placeholder="Choisir…"
              value={selectedClass}
              onChange={(v) => { setSelectedClass(v); setRows([]) }}
              style={{ width: 180 }}
              showSearch optionFilterProp="children"
            >
              {classes.map((c: any) => (
                <Option key={c.id} value={c.id}>{c.name}</Option>
              ))}
            </Select>
            {selectedClass && (
              <Tag
                style={{ marginTop: 4, display: 'block', width: 'fit-content' }}
                color={maxGrade === 10 ? 'orange' : 'blue'}
              >
                Barème /{maxGrade}
              </Tag>
            )}
          </Col>
          <Col>
            <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              2 · Trimestre
            </Text>
            <Select value={period} onChange={setPeriod} style={{ width: 160 }}>
              {PERIOD_OPTIONS.map(p => <Option key={p.value} value={p.value}>{p.label}</Option>)}
            </Select>
          </Col>
          <Col>
            <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              3 · Matière
            </Text>
            <Select
              placeholder="Choisir…"
              value={selectedSubject}
              onChange={setSelectedSubject}
              style={{ width: 210 }}
              disabled={!selectedClass || subjects.length === 0}
            >
              {subjects.map((cs: any) => (
                <Option key={cs.subjectId} value={cs.subjectId}>
                  <span>{cs.subject?.name ?? cs.subjectId}</span>
                  <Text type="secondary" style={{ fontSize: 10, marginLeft: 8 }}>coeff {cs.coefficient}</Text>
                </Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              4 · Type d'éval.
            </Text>
            <Select value={evalType} onChange={setEvalType} style={{ width: 185 }}>
              {EVAL_OPTIONS.map(e => (
                <Option key={e.value} value={e.value}>
                  <span style={{ color: e.color, fontWeight: 600 }}>{e.label}</span>
                  <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>coeff ×{e.coeff}</Text>
                </Option>
              ))}
            </Select>
          </Col>
          {selectedEval && (
            <Col style={{ marginLeft: 'auto' }}>
              <div style={{
                background: selectedEval.color + '18',
                border: `1px solid ${selectedEval.color}44`,
                borderRadius: 8, padding: '8px 16px', textAlign: 'center',
              }}>
                <Text style={{ fontSize: 11, color: selectedEval.color, fontWeight: 600 }}>Coeff.</Text>
                <div style={{ fontSize: 22, fontWeight: 900, color: selectedEval.color, lineHeight: 1 }}>
                  ×{selectedEval.coeff}
                </div>
              </div>
            </Col>
          )}
        </Row>
      </Card>

      {/* Progression + stats + actions */}
      {isReady && total > 0 && (
        <Row gutter={12} style={{ marginBottom: 14 }}>
          {/* Barre de progression */}
          <Col flex="1">
            <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', height: '100%' }} styles={{ body: { padding: '14px 18px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text strong style={{ fontSize: 13 }}>Progression de saisie</Text>
                <Text style={{ fontSize: 13, color: percent === 100 ? '#16A34A' : '#6B7280' }}>
                  <Text strong style={{ color: percent === 100 ? '#16A34A' : '#1E40AF' }}>{saved}</Text>
                  /{total} élèves
                </Text>
              </div>
              <Progress
                percent={percent}
                showInfo={false}
                strokeColor={percent === 100 ? '#16A34A' : { from: '#1E40AF', to: '#3B82F6' }}
                trailColor="#e5e7eb"
                size={['100%', 10]}
              />
              {/* Distribution */}
              {saved > 0 && (
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  {[
                    { label: 'Insuffisant (<10)', count: dist.red, color: '#DC2626', bg: '#FEE2E2' },
                    { label: 'Passable (10–13)', count: dist.yellow, color: '#92400E', bg: '#FEF3C7' },
                    { label: 'Bien (14–15)', count: dist.green, color: '#065F46', bg: '#D1FAE5' },
                    { label: 'Très bien (≥16)', count: dist.darkGreen, color: '#064E3B', bg: '#A7F3D0' },
                  ].filter(d => d.count > 0).map(d => (
                    <div key={d.label} style={{
                      background: d.bg, borderRadius: 6, padding: '3px 10px',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <Text style={{ fontSize: 18, fontWeight: 800, color: d.color, lineHeight: 1 }}>{d.count}</Text>
                      <Text style={{ fontSize: 10, color: d.color, lineHeight: 1.3 }}>{d.label}</Text>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
          {/* Actions */}
          <Col>
            <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', height: '100%' }} styles={{ body: { padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center' } }}>
              <Tooltip title={canGenerate ? `Générer les bulletins du ${periodLabel}` : 'Saisissez au moins une note'}>
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={generating}
                  onClick={handleGenerateBulletins}
                  disabled={!canGenerate}
                  style={{ borderRadius: 8 }}
                >
                  Générer bulletins
                </Button>
              </Tooltip>
              <Tooltip title="Importer DS1 + DS2 + Composition depuis un fichier Excel (toutes les évals en même temps)">
                <Button
                  icon={<FileExcelOutlined />}
                  loading={xlsxImporting}
                  onClick={handleImportExcel}
                  disabled={!selectedClass || !selectedSubject}
                  style={{ borderRadius: 8, color: '#059669', borderColor: '#059669' }}
                >
                  Importer Excel
                </Button>
              </Tooltip>
              <Tooltip title="Télécharger le modèle Excel à remplir">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => ipc.grades.downloadTemplate()}
                  style={{ borderRadius: 8 }}
                >
                  Modèle Excel
                </Button>
              </Tooltip>
              <Button icon={<UploadOutlined />} onClick={handleOpenCsvImport} style={{ borderRadius: 8 }} size="small">
                Importer CSV
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadGrades} style={{ borderRadius: 8 }} size="small">
                Actualiser
              </Button>
            </Card>
          </Col>
        </Row>
      )}

      {/* Table des notes */}
      <Card
        variant="borderless"
        style={{ borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}
        styles={{ body: { padding: 0 } }}
      >
        {loadingStudents ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : (
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="enrollmentId"
            pagination={false}
            size="middle"
            rowClassName={(r) => r.error ? 'grade-row-error' : r.saved ? 'grade-row-saved' : ''}
            locale={{
              emptyText: !selectedClass
                ? (
                  <Empty
                    image={<BookOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
                    styles={{ image: { height: 60 } }}
                    description={<Text type="secondary">Sélectionnez d'abord une classe</Text>}
                  />
                )
                : !selectedSubject
                  ? (
                    <Empty
                      image={<ReadOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
                      styles={{ image: { height: 60 } }}
                      description={<Text type="secondary">Sélectionnez une matière</Text>}
                    />
                  )
                  : <Empty description={<Text type="secondary">Aucun élève inscrit dans cette classe</Text>} />,
            }}
          />
        )}
      </Card>

      <style>{`
        .grade-row-saved td { background: #f0fdf4 !important; }
        .grade-row-error td { background: #fff5f5 !important; }
        .ant-table-row:hover td { background: #f8faff !important; }
      `}</style>

      {/* Modale résultat import Excel multi-colonnes */}
      <Modal
        title={<span><FileExcelOutlined style={{ marginRight: 8, color: '#059669' }} />Résultat import Excel — DS1 / DS2 / Composition</span>}
        open={!!xlsxResult}
        onCancel={() => setXlsxResult(null)}
        footer={<Button type="primary" onClick={() => setXlsxResult(null)}>Fermer</Button>}
        width={620}
      >
        {xlsxResult && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {[
                { label: 'Importés',      value: xlsxResult.imported, color: '#059669' },
                { label: 'Introuvables',  value: xlsxResult.notFound, color: '#D97706' },
                { label: 'Erreurs',       value: xlsxResult.errors,   color: '#DC2626' },
                { label: 'Total fichier', value: xlsxResult.total,    color: '#6366F1' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: `${s.color}10`, borderRadius: 10, border: `1px solid ${s.color}25` }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <Table
              size="small"
              dataSource={xlsxResult.report}
              rowKey={(r: any, i: number) => `${r.matricule}-${i}`}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'Matricule', dataIndex: 'matricule', key: 'mat', width: 160,
                  render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
                { title: 'Nom', dataIndex: 'name', key: 'name' },
                { title: 'DS1',  dataIndex: 'ds1',  key: 'ds1',  width: 55, render: (v: any) => v ?? <Text type="secondary">—</Text> },
                { title: 'DS2',  dataIndex: 'ds2',  key: 'ds2',  width: 55, render: (v: any) => v ?? <Text type="secondary">—</Text> },
                { title: 'Compo',dataIndex: 'composition', key: 'comp', width: 65, render: (v: any) => v ?? <Text type="secondary">—</Text> },
                { title: 'Statut', dataIndex: 'status', key: 'st', width: 130,
                  render: (v: string) => (
                    <Tag color={v === 'Importé' ? 'success' : v === 'Élève introuvable' ? 'warning' : 'error'} style={{ fontSize: 10 }}>
                      {v}
                    </Tag>
                  ) },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Modale prévisualisation import CSV */}
      <Modal
        title={<span><UploadOutlined style={{ marginRight: 8 }} />Prévisualisation de l'import CSV</span>}
        open={csvModalOpen}
        onCancel={() => { setCsvModalOpen(false); setCsvRows([]) }}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => { setCsvModalOpen(false); setCsvRows([]) }}>Annuler</Button>,
          <Button
            key="import"
            type="primary"
            loading={csvImporting}
            disabled={!csvRows.some(r => r.matched && r.value !== null)}
            onClick={handleConfirmCsvImport}
          >
            Importer {csvRows.filter(r => r.matched && r.value !== null).length} note(s)
          </Button>,
        ]}
      >
        <Alert
          type="info"
          message="Format CSV attendu : colonnes nom, prenom, note (ou matricule, note). Séparateur virgule ou point-virgule."
          style={{ marginBottom: 14, fontSize: 12 }}
        />
        {csvRows.some(r => !r.matched) && (
          <Alert
            type="warning"
            message={`${csvRows.filter(r => !r.matched).length} élève(s) non trouvé(s) — ignorés à l'import`}
            style={{ marginBottom: 14, fontSize: 12 }}
          />
        )}
        <Table
          size="small"
          pagination={false}
          rowKey={(r, i) => String(i)}
          dataSource={csvRows}
          columns={[
            {
              title: 'Élève (CSV)',
              key: 'name',
              render: (_, r) => (
                <span style={{ fontWeight: 600 }}>
                  {r.lastName} {r.firstName || r.matricule}
                </span>
              ),
            },
            {
              title: 'Note',
              dataIndex: 'value',
              key: 'value',
              width: 80,
              render: (v) => v !== null
                ? <Tag color={v >= 10 ? 'success' : 'error'} style={{ fontWeight: 700 }}>{v}</Tag>
                : <Tag color="default">—</Tag>,
            },
            {
              title: 'Correspondance',
              key: 'match',
              width: 120,
              render: (_, r) => r.matched
                ? <Tag color="success" icon={<CheckOutlined />}>Trouvé</Tag>
                : <Tag color="error" icon={<CloseOutlined />}>Non trouvé</Tag>,
            },
          ]}
          rowClassName={(r) => r.matched ? '' : 'csv-row-unmatched'}
          scroll={{ y: 400 }}
        />
        <style>{`.csv-row-unmatched td { opacity: 0.45; }`}</style>
      </Modal>
    </div>
  )
}
