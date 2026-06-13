import { useEffect, useState, useCallback } from 'react'
import { Select, Table, InputNumber, Typography, Tag, Spin, message } from 'antd'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/shared/PageHeader'

const { Option } = Select

interface GradeRow {
  enrollmentId: string
  studentName: string
  value: number | null
  saved: boolean
  error: boolean
}

export function GradeEntryPage() {
  const { userId } = useAuth()
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<string>()
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [period, setPeriod] = useState<number>(1)
  const [rows, setRows] = useState<GradeRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ipc.classes.list().then(setClasses).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedClass) return
    setLoading(true)
    ipc.students.list({ classId: selectedClass })
      .then((students) => {
        setRows(students.map((s: any) => ({
          enrollmentId: s.enrollments?.[0]?.id ?? s.id,
          studentName: `${s.lastName} ${s.firstName}`,
          value: null,
          saved: false,
          error: false,
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedClass])

  const saveGrade = useCallback(async (enrollmentId: string, value: number) => {
    if (!userId) return
    try {
      await ipc.grades.save({
        enrollmentId,
        subjectId: 'default',
        period,
        evalType: 'DEVOIR',
        value,
        maxValue: 20,
      }, userId)
      setRows((prev) =>
        prev.map((r) => r.enrollmentId === enrollmentId ? { ...r, saved: true, error: false } : r)
      )
    } catch {
      setRows((prev) =>
        prev.map((r) => r.enrollmentId === enrollmentId ? { ...r, error: true } : r)
      )
      message.error('Erreur lors de la sauvegarde')
    }
  }, [userId, period])

  const handleChange = useCallback((enrollmentId: string, value: number | null) => {
    setRows((prev) =>
      prev.map((r) => r.enrollmentId === enrollmentId ? { ...r, value, saved: false, error: false } : r)
    )
    if (value !== null && value >= 0 && value <= 20) {
      const timer = setTimeout(() => saveGrade(enrollmentId, value), 1000)
      return () => clearTimeout(timer)
    }
  }, [saveGrade])

  const saved = rows.filter((r) => r.saved).length
  const total = rows.length

  const columns = [
    {
      title: 'Élève',
      dataIndex: 'studentName',
      key: 'student',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: 'Note /20',
      key: 'value',
      width: 140,
      render: (_: any, row: GradeRow) => (
        <InputNumber
          min={0}
          max={20}
          step={0.5}
          value={row.value}
          onChange={(v) => handleChange(row.enrollmentId, v)}
          style={{ width: 100, borderColor: row.error ? '#DC2626' : undefined }}
          placeholder="—"
        />
      ),
    },
    {
      title: 'Statut',
      key: 'status',
      width: 120,
      render: (_: any, row: GradeRow) => {
        if (row.error) return <Tag color="error">Erreur</Tag>
        if (row.saved) return <Tag color="success">✓ Sauvé</Tag>
        if (row.value !== null) return <Tag color="processing">En cours…</Tag>
        return <Tag color="default">Non saisi</Tag>
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Saisie des notes"
        subtitle={total > 0 ? `${saved}/${total} notes saisies` : undefined}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Select
          placeholder="Sélectionner une classe"
          value={selectedClass}
          onChange={setSelectedClass}
          style={{ width: 200 }}
        >
          {classes.map((c: any) => (
            <Option key={c.id} value={c.id}>{c.name}</Option>
          ))}
        </Select>
        <Select value={period} onChange={setPeriod} style={{ width: 160 }}>
          <Option value={1}>Trimestre 1</Option>
          <Option value={2}>Trimestre 2</Option>
          <Option value={3}>Trimestre 3</Option>
        </Select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : (
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="enrollmentId"
          pagination={false}
          size="middle"
          locale={{ emptyText: selectedClass ? 'Aucun élève dans cette classe' : 'Sélectionnez une classe' }}
        />
      )}
    </div>
  )
}
