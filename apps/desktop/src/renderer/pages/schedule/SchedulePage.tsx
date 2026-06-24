import { useEffect, useState, useCallback } from 'react'
import {
  Select, Button, Modal, Form, Input, InputNumber, TimePicker,
  Typography, Tag, Tooltip, Popconfirm, Card, Empty,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CalendarOutlined, PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAppMessage } from '../../hooks/useAppMessage'
import { PageHeader } from '../../components/shared/PageHeader'

const { Option } = Select
const { Text, Title } = Typography

const DAYS = [
  { key: 1, label: 'Lundi' },
  { key: 2, label: 'Mardi' },
  { key: 3, label: 'Mercredi' },
  { key: 4, label: 'Jeudi' },
  { key: 5, label: 'Vendredi' },
  { key: 6, label: 'Samedi' },
]

// Time slots 07:00 → 18:00 by 30min
const TIME_SLOTS: string[] = []
for (let h = 7; h < 18; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}
TIME_SLOTS.push('18:00')

const SUBJECT_COLORS = [
  '#1E40AF','#15803D','#7C3AED','#B45309','#DC2626',
  '#0369A1','#4D7C0F','#9333EA','#D97706','#BE123C',
]

function colorForSubject(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length]
}

// Number of 30-min slots a session occupies
function slotCount(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return ((eh * 60 + em) - (sh * 60 + sm)) / 30
}

function slotIndex(time: string) {
  return TIME_SLOTS.indexOf(time)
}

export function SchedulePage() {
  const message = useAppMessage()
  const [classes, setClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addDay, setAddDay] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      ipc.classes.list(),
      ipc.teachers.list(),
      ipc.schedules.listRooms(),
    ]).then(([c, t, r]) => {
      setClasses(c)
      setTeachers(t)
      setRooms(r)
    }).catch(() => {})
  }, [])

  const loadSchedules = useCallback(async () => {
    if (viewMode === 'class' && !selectedClassId) return
    if (viewMode === 'teacher' && !selectedTeacherId) return
    setLoading(true)
    try {
      const data = viewMode === 'class'
        ? await ipc.schedules.listByClass(selectedClassId!)
        : await ipc.schedules.listByTeacher(selectedTeacherId!)
      setSchedules(data)
    } catch { setSchedules([]) }
    finally { setLoading(false) }
  }, [viewMode, selectedClassId, selectedTeacherId])

  useEffect(() => { loadSchedules() }, [loadSchedules])

  const handleAdd = async (values: any) => {
    setSaving(true)
    try {
      const startTime = values.startTime?.format('HH:mm')
      const endTime = values.endTime?.format('HH:mm')
      if (!startTime || !endTime) throw new Error('Horaires requis')
      if (startTime >= endTime) throw new Error('L\'heure de fin doit être après l\'heure de début')

      await ipc.schedules.create({
        classId: viewMode === 'class' ? selectedClassId : values.classId,
        teacherId: values.teacherId,
        roomId: values.roomId || undefined,
        dayOfWeek: addDay ?? values.dayOfWeek,
        startTime,
        endTime,
        subjectName: values.subjectName,
      })
      message.success('Cours ajouté')
      setAddOpen(false)
      form.resetFields()
      loadSchedules()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipc.schedules.delete(id)
      message.success('Cours supprimé')
      loadSchedules()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  // Build grid: day → slot → schedule
  const grid: Record<number, Record<string, any>> = {}
  DAYS.forEach(d => { grid[d.key] = {} })
  schedules.forEach(s => {
    grid[s.dayOfWeek] = grid[s.dayOfWeek] ?? {}
    grid[s.dayOfWeek][s.startTime] = s
  })

  const CELL_H = 40
  const SLOT_W = 120

  return (
    <div>
      <PageHeader
        title="Emploi du temps"
        subtitle="Planning hebdomadaire"
        actions={
          <Button icon={<PrinterOutlined />} onClick={() => window.print()} className="no-print">
            Imprimer
          </Button>
        }
      />

      {/* Contrôles */}
      <Card variant="borderless" style={{ marginBottom: 16, borderRadius: 10 }} className="no-print">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select value={viewMode} onChange={v => { setViewMode(v); setSchedules([]) }} style={{ width: 160 }}>
            <Option value="class">Par classe</Option>
            <Option value="teacher">Par enseignant</Option>
          </Select>

          {viewMode === 'class' ? (
            <Select
              placeholder="Choisir une classe..."
              style={{ width: 220 }}
              value={selectedClassId}
              onChange={setSelectedClassId}
              showSearch
              optionFilterProp="children"
            >
              {classes.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
            </Select>
          ) : (
            <Select
              placeholder="Choisir un enseignant..."
              style={{ width: 220 }}
              value={selectedTeacherId}
              onChange={setSelectedTeacherId}
              showSearch
              optionFilterProp="children"
            >
              {teachers.map(t => (
                <Option key={t.id} value={t.id}>{t.user.lastName} {t.user.firstName}</Option>
              ))}
            </Select>
          )}

          {(selectedClassId || selectedTeacherId) && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setAddDay(null); setAddOpen(true) }}
            >
              Ajouter un cours
            </Button>
          )}
        </div>
      </Card>

      {/* Grille */}
      {(selectedClassId || selectedTeacherId) ? (
        <div id="schedule-print" style={{ overflowX: 'auto' }}>
          {/* Print header */}
          <div className="print-only" style={{ display: 'none', marginBottom: 16, textAlign: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>Emploi du temps</Title>
            <Text type="secondary">
              {viewMode === 'class'
                ? classes.find(c => c.id === selectedClassId)?.name
                : (() => { const t = teachers.find(t => t.id === selectedTeacherId); return t ? `${t.user.lastName} ${t.user.firstName}` : '' })()
              }
            </Text>
          </div>

          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 60, background: '#1E40AF', color: '#fff', padding: '8px 4px', fontSize: 11, textAlign: 'center' }}>
                  Heure
                </th>
                {DAYS.map(d => (
                  <th key={d.key} style={{
                    width: SLOT_W, background: '#1E40AF', color: '#fff',
                    padding: '8px 4px', fontSize: 12, textAlign: 'center',
                  }}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.slice(0, -1).map((slot, si) => {
                return (
                  <tr key={slot} style={{ height: CELL_H }}>
                    <td style={{
                      fontSize: 10, color: '#888', textAlign: 'center',
                      borderRight: '1px solid #e5e7eb',
                      background: '#fafafa',
                      padding: '2px 4px',
                      verticalAlign: 'top',
                    }}>
                      {slot}
                    </td>
                    {DAYS.map(d => {
                      const entry = grid[d.key]?.[slot]
                      // check if this slot is "occupied" by a previous entry
                      const prevOccupied = TIME_SLOTS.slice(0, si).some(prevSlot => {
                        const prev = grid[d.key]?.[prevSlot]
                        if (!prev) return false
                        return slotIndex(prevSlot) + slotCount(prevSlot, prev.endTime) > si
                      })

                      if (prevOccupied) return null

                      if (entry) {
                        const count = slotCount(entry.startTime, entry.endTime)
                        const color = colorForSubject(entry.subjectName)
                        const teacherName = entry.teacher
                          ? `${entry.teacher.user.lastName} ${entry.teacher.user.firstName}`
                          : ''
                        return (
                          <td
                            key={d.key}
                            rowSpan={count}
                            style={{
                              background: color, color: '#fff',
                              borderRadius: 4, padding: '4px 6px',
                              verticalAlign: 'top',
                              border: '2px solid #fff',
                              cursor: 'default',
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{entry.subjectName}</div>
                            {viewMode !== 'teacher' && <div style={{ fontSize: 10, opacity: 0.85 }}>{teacherName}</div>}
                            {viewMode === 'teacher' && entry.class && (
                              <div style={{ fontSize: 10, opacity: 0.85 }}>{entry.class.name}</div>
                            )}
                            <div style={{ fontSize: 10, opacity: 0.8 }}>{entry.startTime}–{entry.endTime}</div>
                            {entry.room && <div style={{ fontSize: 10, opacity: 0.7 }}>{entry.room.name}</div>}
                            <Popconfirm
                              title="Supprimer ce cours ?"
                              onConfirm={() => handleDelete(entry.id)}
                              okText="Oui"
                            >
                              <Button
                                size="small" type="text"
                                icon={<DeleteOutlined />}
                                style={{ color: '#fff', opacity: 0.7, padding: 0, height: 16, marginTop: 2 }}
                                className="no-print"
                              />
                            </Popconfirm>
                          </td>
                        )
                      }

                      return (
                        <td
                          key={d.key}
                          style={{
                            border: '1px solid var(--border)',
                            background: si % 2 === 0 ? 'var(--surface)' : 'var(--surface-raised)',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setAddDay(d.key)
                            form.setFieldValue('dayOfWeek', d.key)
                            form.setFieldValue('startTime', dayjs(`2000-01-01 ${slot}`))
                            const nextSlot = TIME_SLOTS[si + 2] ?? TIME_SLOTS[si + 1]
                            form.setFieldValue('endTime', nextSlot ? dayjs(`2000-01-01 ${nextSlot}`) : undefined)
                            setAddOpen(true)
                          }}
                          title="Cliquer pour ajouter un cours"
                        />
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="no-print" style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
            Cliquez sur une cellule vide pour ajouter un cours directement.
          </div>
        </div>
      ) : (
        <Empty
          image={<CalendarOutlined style={{ fontSize: 64, color: '#d1d5db' }} />}
          description={viewMode === 'class' ? 'Sélectionnez une classe pour voir son emploi du temps' : 'Sélectionnez un enseignant'}
          style={{ marginTop: 60 }}
        />
      )}

      {/* Modal ajout */}
      <Modal
        title={addDay ? `Ajouter un cours — ${DAYS.find(d => d.key === addDay)?.label}` : 'Ajouter un cours'}
        open={addOpen}
        onCancel={() => { setAddOpen(false); form.resetFields() }}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd} requiredMark={false}>
          {!addDay && (
            <Form.Item name="dayOfWeek" label="Jour" rules={[{ required: true }]}>
              <Select>
                {DAYS.map(d => <Option key={d.key} value={d.key}>{d.label}</Option>)}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="subjectName" label="Matière" rules={[{ required: true }]}>
            <Input placeholder="Ex: Mathématiques" />
          </Form.Item>

          {viewMode === 'teacher' && (
            <Form.Item name="classId" label="Classe" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="children">
                {classes.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="teacherId" label="Enseignant" rules={viewMode === 'class' ? [{ required: true }] : []}>
            <Select showSearch optionFilterProp="children" placeholder="Sélectionner..." allowClear>
              {teachers.map(t => (
                <Option key={t.id} value={t.id}>{t.user.lastName} {t.user.firstName}</Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="startTime" label="Heure de début" rules={[{ required: true }]} style={{ flex: 1 }}>
              <TimePicker format="HH:mm" minuteStep={30} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="endTime" label="Heure de fin" rules={[{ required: true }]} style={{ flex: 1 }}>
              <TimePicker format="HH:mm" minuteStep={30} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="roomId" label="Salle (optionnel)">
            <Select allowClear placeholder="Choisir une salle...">
              {rooms.map(r => <Option key={r.id} value={r.id}>{r.name} ({r.capacity} places)</Option>)}
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setAddOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Ajouter</Button>
          </div>
        </Form>
      </Modal>

      <style>{`
        .print-only { display: none !important; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body * { visibility: hidden !important; }
          #schedule-print, #schedule-print * { visibility: visible !important; }
          #schedule-print { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; }
        }
        @page { size: A4 landscape; margin: 8mm; }
      `}</style>
    </div>
  )
}
