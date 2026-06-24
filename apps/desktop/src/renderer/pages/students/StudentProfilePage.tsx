import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Tabs, Descriptions, Tag, Button, Table, Typography,
  Spin, Result, Avatar, Select, Statistic, Row, Col, Empty,
  Modal, Form, Space, Tooltip, Popconfirm, Input,
} from 'antd'
import {
  ArrowLeftOutlined, UserOutlined,
  DollarOutlined, ReadOutlined, FileOutlined, CalendarOutlined,
  PlusOutlined, FileDoneOutlined, TeamOutlined, EditOutlined, KeyOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatDate, formatGNF } from '../../utils/formatters'
import { StatusBadge } from '../../components/shared/StatusBadge'

const { Text } = Typography
const { Option } = Select

// ─── Photo Upload ─────────────────────────────────────────────────────────────

function PhotoUpload({ photo, studentId, onUpdate }: { photo?: string | null; studentId?: string; onUpdate: () => void }) {
  const message = useAppMessage()
  const { userId } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleChange = async () => {
    if (!studentId) return
    setLoading(true)
    try {
      const dataUrl = await ipc.dialog.openImage()
      if (!dataUrl) return
      await ipc.students.update(studentId, { photo: dataUrl }, userId ?? 'system')
      onUpdate()
      message.success('Photo mise à jour')
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip title="Changer la photo">
      <div
        style={{ position: 'relative', flexShrink: 0, cursor: 'pointer', width: 80 }}
        onClick={handleChange}
      >
        <Avatar
          size={80}
          icon={<UserOutlined />}
          src={photo ?? undefined}
          style={{ background: '#1E40AF', display: 'block' }}
        />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: loading ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
          className="photo-overlay"
        >
          <EditOutlined style={{ color: '#fff', fontSize: 20 }} />
        </div>
        <style>{`.photo-overlay { opacity: 0 } div:hover > .photo-overlay { opacity: 1 }`}</style>
      </div>
    </Tooltip>
  )
}

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const loadStudent = () => {
    if (!id) return
    ipc.students.getById(id)
      .then(setStudent)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadStudent() }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (notFound || !student) {
    return (
      <Result
        status="404"
        title="Élève introuvable"
        extra={<Button type="primary" onClick={() => navigate('/students')}>Retour à la liste</Button>}
      />
    )
  }

  const currentEnrollment = student.enrollments?.[0]

  const tabItems = [
    {
      key: 'history',
      label: <span><ReadOutlined /> Scolarité</span>,
      children: <EnrollmentTab enrollments={student.enrollments ?? []} studentId={id} onRefresh={loadStudent} />,
    },
    {
      key: 'payments',
      label: <span><DollarOutlined /> Paiements</span>,
      children: <PaymentsTab enrollmentId={currentEnrollment?.id} />,
    },
    {
      key: 'grades',
      label: <span><ReadOutlined /> Notes</span>,
      children: <GradesTab enrollmentId={currentEnrollment?.id} studentId={id} />,
    },
    {
      key: 'absences',
      label: <span><CalendarOutlined /> Absences</span>,
      children: <AbsencesTab enrollmentId={currentEnrollment?.id} />,
    },
    {
      key: 'documents',
      label: <span><FileOutlined /> Pièces jointes</span>,
      children: <DocumentsTab documents={student.documents ?? []} studentId={id} />,
    },
    {
      key: 'parents',
      label: <span><TeamOutlined /> Parents & Tuteurs</span>,
      children: <ParentsTab studentId={id} />,
    },
    {
      key: 'medical',
      label: <span><MedicineBoxOutlined /> Médical</span>,
      children: <MedicalTab studentId={id} />,
    },
  ]

  const genderColor = student.gender === 'MALE' ? '#3B82F6' : '#EC4899'
  const genderLabel = student.gender === 'MALE' ? 'Garçon' : 'Fille'

  return (
    <div>
      {/* ── Hero Card ─────────────────────────────────────────────────────── */}
      <Card
        variant="borderless"
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16, overflow: 'hidden', padding: 0 }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Gradient top banner */}
        <div style={{
          height: 80,
          background: `linear-gradient(135deg, #1E3A8A 0%, #1E40AF 40%, ${genderColor}99 100%)`,
          position: 'relative',
        }} />

        {/* Content row */}
        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Avatar (overlaps the banner) */}
          <div style={{ marginTop: -40, flexShrink: 0 }}>
            <div style={{
              padding: 3, borderRadius: '50%',
              background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              display: 'inline-flex',
            }}>
              <PhotoUpload photo={student.photo} studentId={id} onUpdate={loadStudent} />
            </div>
          </div>

          {/* Info column */}
          <div style={{ flex: 1, paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <Typography.Title level={3} style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                {student.lastName} {student.firstName}
              </Typography.Title>
              <Tag style={{ background: `${genderColor}18`, color: genderColor, border: `1px solid ${genderColor}30`, borderRadius: 20, fontWeight: 700, fontSize: 11 }}>
                {genderLabel}
              </Tag>
              <StatusBadge status={currentEnrollment?.status ?? 'ACTIVE'} />
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 6 }}>
              {student.matricule && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matricule</span>
                  <Text code style={{ fontSize: 12 }}>{student.matricule}</Text>
                </div>
              )}
              {currentEnrollment?.class?.name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Classe</span>
                  <Tag style={{ background: '#EFF6FF', color: '#1D4ED8', border: 0, borderRadius: 20, fontWeight: 700 }}>
                    {currentEnrollment.class.name}
                  </Tag>
                </div>
              )}
              {student.birthDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Né(e) le</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>{formatDate(student.birthDate)}</span>
                </div>
              )}
              {student.nationality && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nationalité</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>{student.nationality}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 12, flexShrink: 0 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/students')}>
              Retour
            </Button>
            <Button type="primary" icon={<FileDoneOutlined />} onClick={() => navigate(`/students/${id}/documents`)}>
              Documents officiels
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Onglets ───────────────────────────────────────────────────────── */}
      <Card
        variant="borderless"
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
      >
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}

// ─── Onglet Scolarité ────────────────────────────────────────────────────────

function EnrollmentTab({ enrollments, studentId, onRefresh }: { enrollments: any[]; studentId?: string; onRefresh: () => void }) {
  const message = useAppMessage()
  const { userId } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [classes, setClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const openModal = () => {
    Promise.all([ipc.classes.list(), ipc.settings.listAcademicYears()])
      .then(([cls, yrs]) => { setClasses(cls); setYears(yrs) })
      .catch(() => {})
    setModalOpen(true)
  }

  const handleEnroll = async (values: any) => {
    if (!studentId) return
    setSaving(true)
    try {
      await ipc.students.enroll(studentId, values.classId, values.yearId, userId ?? 'system')
      message.success('Élève réinscrit avec succès')
      setModalOpen(false)
      form.resetFields()
      onRefresh()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const currentYear = years.find((y: any) => y.isCurrent)

  const columns = [
    { title: 'Année', dataIndex: ['academicYear', 'label'], key: 'year' },
    { title: 'Classe', dataIndex: ['class', 'name'], key: 'class' },
    {
      title: 'Statut',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <StatusBadge status={s} />,
    },
    {
      title: 'Date inscription',
      dataIndex: 'enrolledAt',
      key: 'date',
      render: (d: string) => d ? formatDate(d) : '—',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={openModal}>
          Réinscrire / Changer de classe
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={enrollments}
        rowKey="id"
        pagination={false}
        size="small"
        locale={{ emptyText: 'Aucun historique scolaire' }}
      />
      <Modal
        title="Réinscrire l'élève"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={420}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEnroll}
          requiredMark={false}
          initialValues={{ yearId: currentYear?.id }}
        >
          <Form.Item name="yearId" label="Année scolaire" rules={[{ required: true, message: 'Requis' }]}>
            <Select placeholder="Sélectionner l'année">
              {years.map((y: any) => (
                <Select.Option key={y.id} value={y.id}>
                  {y.label}{y.isCurrent ? ' (en cours)' : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="classId" label="Classe" rules={[{ required: true, message: 'Requis' }]}>
            <Select placeholder="Sélectionner la classe" showSearch optionFilterProp="children">
              {classes.map((c: any) => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Inscrire</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Onglet Paiements ────────────────────────────────────────────────────────

function PaymentsTab({ enrollmentId }: { enrollmentId?: string }) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enrollmentId) return
    setLoading(true)
    ipc.payments.list(enrollmentId).then(setPayments).catch(() => {}).finally(() => setLoading(false))
  }, [enrollmentId])

  const columns = [
    { title: 'Date', dataIndex: 'paidAt', key: 'date', render: (d: string) => formatDate(d) },
    { title: 'Motif', dataIndex: ['feeType', 'name'], key: 'feeType' },
    {
      title: 'Montant',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => <Text strong>{formatGNF(v)}</Text>,
    },
    { title: 'Reçu N°', dataIndex: 'receiptNo', key: 'receipt' },
    { title: 'Méthode', dataIndex: 'method', key: 'method' },
  ]

  if (!enrollmentId) return <Text type="secondary">Élève non inscrit cette année</Text>

  return (
    <Table
      columns={columns}
      dataSource={payments}
      rowKey="id"
      loading={loading}
      pagination={false}
      size="small"
      locale={{ emptyText: 'Aucun paiement enregistré' }}
    />
  )
}

// ─── Onglet Notes ────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 1, label: '1er Trimestre' },
  { value: 2, label: '2ème Trimestre' },
  { value: 3, label: '3ème Trimestre' },
]

function GradesTab({ enrollmentId, studentId }: { enrollmentId?: string; studentId?: string }) {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<number>(1)
  const [averages, setAverages] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enrollmentId) return
    setLoading(true)
    ipc.grades.getAverages(enrollmentId, period)
      .then(setAverages)
      .catch(() => setAverages(null))
      .finally(() => setLoading(false))
  }, [enrollmentId, period])

  if (!enrollmentId) return <Text type="secondary">Élève non inscrit cette année</Text>

  const subjectAverages: any[] = averages?.subjectAverages ?? []
  const generalAverage: number = averages?.generalAverage ?? 0
  const isEliminated: boolean = averages?.isEliminated ?? false

  const averageColor = generalAverage >= 16 ? '#16A34A' : generalAverage >= 10 ? '#1E40AF' : '#DC2626'

  const columns = [
    {
      title: 'Matière',
      dataIndex: 'subjectName',
      key: 'subject',
      render: (n: string) => <Text strong>{n}</Text>,
    },
    {
      title: 'Coeff.',
      dataIndex: 'coefficient',
      key: 'coeff',
      width: 70,
      render: (v: number) => <Text type="secondary">{v}</Text>,
    },
    {
      title: 'Notes saisies',
      dataIndex: 'grades',
      key: 'grades',
      render: (grades: any[]) => {
        if (!grades || grades.length === 0) return <Text type="secondary">—</Text>
        return (
          <span>
            {grades.map((g: any, i: number) => (
              <Tag key={i} style={{ fontSize: 12 }}>{g.evalType}: {g.value}/{g.maxValue}</Tag>
            ))}
          </span>
        )
      },
    },
    {
      title: 'Moyenne',
      dataIndex: 'average',
      key: 'average',
      width: 100,
      render: (v: number, row: any) => {
        if (!row.grades || row.grades.length === 0) return <Text type="secondary">—</Text>
        const color = v >= 16 ? 'green' : v >= 10 ? 'blue' : 'red'
        return <Tag color={color} style={{ fontWeight: 600 }}>{v?.toFixed(2)}/20</Tag>
      },
    },
  ]

  return (
    <div>
      {/* Period selector + link to grade entry */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Select value={period} onChange={setPeriod} style={{ width: 160 }}>
          {PERIOD_OPTIONS.map((p) => (
            <Option key={p.value} value={p.value}>{p.label}</Option>
          ))}
        </Select>
        <Button size="small" onClick={() => navigate('/grades')}>
          Aller à la saisie →
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : subjectAverages.length === 0 ? (
        <Empty description="Aucune note saisie pour ce trimestre" />
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={subjectAverages}
            rowKey="subjectId"
            pagination={false}
            size="small"
            locale={{ emptyText: 'Aucune note saisie' }}
          />
          {/* Récapitulatif général */}
          <div style={{
            marginTop: 16,
            padding: '12px 16px',
            background: '#F8FAFC',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Row gutter={32}>
              <Col>
                <Statistic
                  title="Moyenne générale"
                  value={generalAverage}
                  suffix="/20"
                  precision={2}
                  valueStyle={{ color: averageColor, fontSize: 22 }}
                />
              </Col>
              <Col>
                <Statistic
                  title="Décision"
                  value={isEliminated ? 'Éliminé(e)' : generalAverage >= 10 ? 'Admis(e)' : 'Insuffisant'}
                  valueStyle={{
                    fontSize: 16,
                    color: isEliminated ? '#DC2626' : generalAverage >= 10 ? '#16A34A' : '#D97706',
                  }}
                />
              </Col>
            </Row>
            {studentId && (
              <Button
                type="primary"
                onClick={() => navigate(`/grades/bulletins/${studentId}`)}
              >
                Voir bulletin
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Onglet Absences ─────────────────────────────────────────────────────────

function AbsencesTab({ enrollmentId }: { enrollmentId?: string }) {
  const [absences, setAbsences] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enrollmentId) return
    setLoading(true)
    ipc.absences.listByEnrollment(enrollmentId)
      .then(setAbsences)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [enrollmentId])

  if (!enrollmentId) return <Text type="secondary">Élève non inscrit cette année</Text>

  const total = absences.length
  const justified = absences.filter((a) => a.justified).length
  const late = absences.filter((a) => a.type === 'RETARD').length

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (d: string) => formatDate(d),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (t: string) => {
        const map: Record<string, { label: string; color: string }> = {
          ABSENT: { label: 'Absence', color: 'error' },
          RETARD: { label: 'Retard', color: 'warning' },
          DEPART_ANTICIPE: { label: 'Départ anticipé', color: 'orange' },
        }
        const info = map[t] ?? { label: t, color: 'default' }
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    {
      title: 'Justifiée',
      dataIndex: 'justified',
      key: 'justified',
      width: 100,
      render: (v: boolean) => v
        ? <Tag color="green">Oui</Tag>
        : <Tag color="default">Non</Tag>,
    },
    {
      title: 'Motif',
      dataIndex: 'reason',
      key: 'reason',
      render: (r: string) => r ? <Text type="secondary">{r}</Text> : '—',
    },
  ]

  return (
    <div>
      {total > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col>
            <Card size="small" style={{ minWidth: 120 }}>
              <Statistic title="Total absences" value={total} valueStyle={{ fontSize: 18, color: '#DC2626' }} />
            </Card>
          </Col>
          <Col>
            <Card size="small" style={{ minWidth: 120 }}>
              <Statistic title="Justifiées" value={justified} valueStyle={{ fontSize: 18, color: '#16A34A' }} />
            </Card>
          </Col>
          <Col>
            <Card size="small" style={{ minWidth: 120 }}>
              <Statistic title="Retards" value={late} valueStyle={{ fontSize: 18, color: '#D97706' }} />
            </Card>
          </Col>
        </Row>
      )}
      <Table
        columns={columns}
        dataSource={absences}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: 'Aucune absence enregistrée' }}
      />
    </div>
  )
}

// ─── Onglet Parents & Tuteurs ─────────────────────────────────────────────────

const RELATION_LABELS: Record<string, string> = {
  PERE: 'Père',
  MERE: 'Mère',
  TUTEUR: 'Tuteur',
}
const RELATION_COLORS: Record<string, string> = {
  PERE: 'blue',
  MERE: 'pink',
  TUTEUR: 'purple',
}

function ParentsTab({ studentId }: { studentId?: string }) {
  const message = useAppMessage()
  const [parents, setParents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  const load = () => {
    if (!studentId) return
    setLoading(true)
    ipc.parents.listByStudent(studentId)
      .then(setParents).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [studentId])

  const openCreate = () => {
    setEditRecord(null)
    form.resetFields()
    form.setFieldsValue({ relation: 'PERE' })
    setModalOpen(true)
  }

  const openEdit = (r: any) => {
    setEditRecord(r)
    form.setFieldsValue({
      relation: r.relation,
      lastName: r.lastName,
      firstName: r.firstName,
      phone: r.phone,
      phone2: r.phone2 ?? '',
      email: r.email ?? '',
      address: r.address ?? '',
      profession: r.profession ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    if (!studentId) return
    setSaving(true)
    try {
      if (editRecord) {
        await ipc.parents.update(editRecord.id, values)
        message.success('Tuteur mis à jour')
      } else {
        await ipc.parents.create(values, studentId)
        message.success('Tuteur ajouté avec succès')
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUnlink = async (parentId: string) => {
    if (!studentId) return
    try {
      await ipc.parents.unlink(parentId, studentId)
      message.success('Tuteur retiré du dossier')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleGenerateCode = async (parentId: string) => {
    try {
      const code = await ipc.parents.generateCode(parentId)
      setGeneratedCode(code)
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: 'Lien',
      dataIndex: 'relation',
      key: 'relation',
      width: 100,
      render: (r: string) => <Tag color={RELATION_COLORS[r] ?? 'default'}>{RELATION_LABELS[r] ?? r}</Tag>,
    },
    {
      title: 'Nom complet',
      key: 'name',
      render: (_: any, r: any) => <Text strong>{r.lastName} {r.firstName}</Text>,
    },
    { title: 'Téléphone', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Profession',
      dataIndex: 'profession',
      key: 'profession',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Code accès',
      dataIndex: 'accessCode',
      key: 'code',
      render: (code: string) => code
        ? <Text code style={{ fontSize: 12 }}>{code}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Modifier"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Générer code d'accès mobile">
            <Button size="small" icon={<KeyOutlined />} onClick={() => handleGenerateCode(r.id)} />
          </Tooltip>
          <Popconfirm
            title="Retirer ce tuteur du dossier ?"
            onConfirm={() => handleUnlink(r.id)}
            okText="Retirer"
            okType="danger"
            cancelText="Annuler"
          >
            <Button size="small" danger>Retirer</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={openCreate}>
          Ajouter un tuteur
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={parents}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: 'Aucun parent / tuteur enregistré' }}
      />

      <Modal
        title={editRecord ? 'Modifier le tuteur' : 'Ajouter un parent / tuteur'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item name="relation" label="Lien de parenté" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="PERE">Père</Select.Option>
              <Select.Option value="MERE">Mère</Select.Option>
              <Select.Option value="TUTEUR">Tuteur / Tutrice</Select.Option>
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="lastName" label="Nom" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstName" label="Prénom" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phone" label="Téléphone" rules={[{ required: true }]}>
                <Input placeholder="+224 6XX XXX XXX" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone2" label="Tél. 2 (optionnel)">
                <Input placeholder="+224 6XX XXX XXX" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="email" label="Email (optionnel)"><Input type="email" /></Form.Item>
          <Form.Item name="profession" label="Profession">
            <Input placeholder="Ex: Commerçant, Enseignant…" />
          </Form.Item>
          <Form.Item name="address" label="Adresse"><Input /></Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {editRecord ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Code d'accès généré"
        open={!!generatedCode}
        onOk={() => setGeneratedCode(null)}
        onCancel={() => setGeneratedCode(null)}
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Communiquez ce code au parent pour qu'il se connecte à l'application mobile.
        </Text>
        <div style={{
          textAlign: 'center', fontSize: 28, fontWeight: 800,
          letterSpacing: 4, color: '#1D4ED8', padding: '16px 0',
          border: '2px solid #BFDBFE', borderRadius: 8, background: '#EFF6FF',
        }}>
          {generatedCode}
        </div>
      </Modal>
    </div>
  )
}

// ─── Onglet Médical ───────────────────────────────────────────────────────────

const BLOOD_TYPES = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']

function MedicalTab({ studentId }: { studentId?: string }) {
  const message = useAppMessage()
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [consultModal, setConsultModal] = useState(false)
  const [recordForm] = Form.useForm()
  const [consultForm] = Form.useForm()

  const load = async () => {
    if (!studentId) return
    setLoading(true)
    try {
      const rec = await ipc.medical.getRecord(studentId)
      setRecord(rec)
      recordForm.setFieldsValue({
        bloodType: rec.bloodType ?? undefined,
        allergies: rec.allergies ?? '',
        conditions: rec.conditions ?? '',
        emergencyContact: rec.emergencyContact ?? '',
      })
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [studentId])

  const handleSaveRecord = async (values: any) => {
    if (!record) return
    setSaving(true)
    try {
      const updated = await ipc.medical.updateRecord(record.id, values)
      setRecord(updated)
      message.success('Dossier médical mis à jour')
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddConsultation = async (values: any) => {
    if (!record) return
    setSaving(true)
    try {
      await ipc.medical.addConsultation(record.id, values)
      message.success('Consultation enregistrée')
      setConsultModal(false)
      consultForm.resetFields()
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConsultation = async (id: string) => {
    try {
      await ipc.medical.deleteConsultation(id)
      message.success('Consultation supprimée')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const consultColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date', width: 110,
      render: (v: string) => formatDate(v) },
    { title: 'Motif', dataIndex: 'reason', key: 'reason' },
    { title: 'Traitement', dataIndex: 'treatment', key: 'treatment',
      render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: 'Notes', dataIndex: 'notes', key: 'notes',
      render: (v: string) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—' },
    { title: '', key: 'del', width: 40,
      render: (_: any, r: any) => (
        <Popconfirm title="Supprimer ?" onConfirm={() => handleDeleteConsultation(r.id)} okText="Oui" cancelText="Non" okType="danger">
          <Button size="small" danger type="text">✕</Button>
        </Popconfirm>
      ) },
  ]

  return (
    <div>
      <Row gutter={16}>
        {/* Infos médicales */}
        <Col xs={24} md={10}>
          <Card
            size="small"
            style={{ marginBottom: 12 }}
            title="Informations médicales"
            loading={loading}
          >
            <Form form={recordForm} layout="vertical" onFinish={handleSaveRecord} requiredMark={false} size="small">
              <Form.Item name="bloodType" label="Groupe sanguin">
                <Select allowClear placeholder="—">
                  {BLOOD_TYPES.map(bt => <Select.Option key={bt} value={bt}>{bt}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="allergies" label="Allergies">
                <Input placeholder="Ex: Pénicilline, arachides…" />
              </Form.Item>
              <Form.Item name="conditions" label="Antécédents médicaux">
                <Input placeholder="Ex: Asthme, épilepsie…" />
              </Form.Item>
              <Form.Item name="emergencyContact" label="Contact d'urgence">
                <Input placeholder="Nom et téléphone" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saving} size="small">
                Enregistrer
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Historique consultations */}
        <Col xs={24} md={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>Consultations ({record?.consultations?.length ?? 0})</Text>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { consultForm.resetFields(); setConsultModal(true) }}
            >
              Nouvelle
            </Button>
          </div>
          <Table
            columns={consultColumns}
            dataSource={record?.consultations ?? []}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
            locale={{ emptyText: 'Aucune consultation' }}
          />
        </Col>
      </Row>

      <Modal
        title="Nouvelle consultation"
        open={consultModal}
        onCancel={() => { setConsultModal(false); consultForm.resetFields() }}
        footer={null}
        width={460}
      >
        <Form form={consultForm} layout="vertical" onFinish={handleAddConsultation} requiredMark={false}>
          <Form.Item name="reason" label="Motif" rules={[{ required: true }]}>
            <Input placeholder="Ex: Fièvre, blessure, maux de tête…" />
          </Form.Item>
          <Form.Item name="treatment" label="Traitement administré">
            <Input placeholder="Ex: Paracétamol 500mg, repos…" />
          </Form.Item>
          <Form.Item name="notes" label="Notes complémentaires">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setConsultModal(false); consultForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Enregistrer</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Onglet Documents (pièces jointes) ──────────────────────────────────────

const DOC_TYPES = [
  "Extrait de naissance",
  "Certificat de transfert",
  "Photo d'identité",
  "Certificat médical",
  "Diplôme / Attestation",
  "Autre",
]

function DocumentsTab({ documents: _initial, studentId }: { documents: any[]; studentId?: string }) {
  const message = useAppMessage()
  const [docs, setDocs] = useState<any[]>(_initial)
  const [selectedType, setSelectedType] = useState<string>(DOC_TYPES[0])
  const [adding, setAdding] = useState(false)

  const load = async () => {
    if (!studentId) return
    const list = await ipc.studentdocs.list(studentId).catch(() => [] as any[])
    setDocs(list)
  }

  const handleAdd = async () => {
    if (!studentId) return
    setAdding(true)
    try {
      const doc = await ipc.studentdocs.add(studentId, selectedType)
      if (doc) {
        message.success('Document ajouté')
        load()
      }
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const handleOpen = async (id: string) => {
    try {
      await ipc.studentdocs.open(id)
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipc.studentdocs.delete(id)
      message.success('Document supprimé')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const getFilename = (filePath: string) => {
    const parts = filePath.replace(/\\/g, '/').split('/')
    const name = parts[parts.length - 1] ?? filePath
    // Strip timestamp prefix  "1234567890_filename.pdf" → "filename.pdf"
    return name.replace(/^\d+_/, '')
  }

  const columns = [
    { title: 'Type', dataIndex: 'type', key: 'type',
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Fichier', dataIndex: 'filePath', key: 'file',
      render: (v: string) => (
        <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{getFilename(v)}</Text>
      ) },
    { title: 'Date', dataIndex: 'uploadedAt', key: 'date', width: 120,
      render: (d: string) => formatDate(d) },
    { title: '', key: 'actions', width: 100,
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Ouvrir">
            <Button size="small" type="primary" ghost onClick={() => handleOpen(r.id)}>
              Ouvrir
            </Button>
          </Tooltip>
          <Popconfirm title="Supprimer ce document ?" onConfirm={() => handleDelete(r.id)}
            okText="Oui" okType="danger" cancelText="Non">
            <Button size="small" danger type="text">✕</Button>
          </Popconfirm>
        </Space>
      ) },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          value={selectedType}
          onChange={setSelectedType}
          style={{ width: 220 }}
        >
          {DOC_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
        </Select>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={adding}
          onClick={handleAdd}
          disabled={!studentId}
        >
          Joindre un fichier
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={docs}
        rowKey="id"
        pagination={false}
        size="small"
        locale={{ emptyText: 'Aucune pièce jointe. Cliquez "Joindre un fichier" pour en ajouter.' }}
      />
    </div>
  )
}
