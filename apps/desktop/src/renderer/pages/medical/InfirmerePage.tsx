import { useEffect, useState } from 'react'
import {
  Card, Row, Col, Table, Button, Modal, Form, Input,
  Select, Typography, Space, Popconfirm, Tooltip, DatePicker, Tag,
} from 'antd'
import {
  MedicineBoxOutlined, PlusOutlined, DeleteOutlined,
  SearchOutlined, HeartOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAppMessage } from '../../hooks/useAppMessage'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text } = Typography
const { Option } = Select
const { Search } = Input

const BLOOD_TYPES = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']

export function InfirmerePage() {
  const message = useAppMessage()
  const [recentConsultations, setRecentConsultations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [medRecord, setMedRecord] = useState<any>(null)
  const [recordLoading, setRecordLoading] = useState(false)
  const [consultModal, setConsultModal] = useState(false)
  const [consultForm] = Form.useForm()
  const [recordForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'recent' | 'patient'>('recent')

  const loadRecent = () => {
    setLoading(true)
    ipc.medical.listRecent(60).then(setRecentConsultations).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRecent()
    ipc.students.list().then(setStudents).catch(() => {})
  }, [])

  const loadRecord = async (studentId: string) => {
    setRecordLoading(true)
    try {
      const rec = await ipc.medical.getRecord(studentId)
      setMedRecord(rec)
      recordForm.setFieldsValue({
        bloodType: rec.bloodType ?? undefined,
        allergies: rec.allergies ?? '',
        conditions: rec.conditions ?? '',
        emergencyContact: rec.emergencyContact ?? '',
      })
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setRecordLoading(false)
    }
  }

  const handleSelectStudent = async (studentId: string) => {
    const s = students.find(st => st.id === studentId)
    setSelectedStudent(s ?? null)
    setMedRecord(null)
    if (studentId) await loadRecord(studentId)
  }

  const handleSaveRecord = async (values: any) => {
    if (!medRecord) return
    setSaving(true)
    try {
      const updated = await ipc.medical.updateRecord(medRecord.id, values)
      setMedRecord(updated)
      message.success('Dossier médical mis à jour')
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddConsultation = async (values: any) => {
    if (!medRecord) return
    setSaving(true)
    try {
      await ipc.medical.addConsultation(medRecord.id, {
        ...values,
        date: values.date ? values.date.toISOString() : undefined,
      })
      message.success('Consultation enregistrée')
      setConsultModal(false)
      consultForm.resetFields()
      await loadRecord(selectedStudent.id)
      loadRecent()
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
      if (selectedStudent) await loadRecord(selectedStudent.id)
      loadRecent()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const recentColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 130,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Patient',
      key: 'patient',
      render: (_: any, r: any) => {
        const s = r.medicalRecord?.student
        return s ? (
          <Text strong>{s.lastName} {s.firstName}</Text>
        ) : '—'
      },
    },
    {
      title: 'Motif',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Traitement',
      dataIndex: 'treatment',
      key: 'treatment',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string) => v
        ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
        : '—',
    },
    {
      title: '',
      key: 'del',
      width: 50,
      render: (_: any, r: any) => (
        <Popconfirm
          title="Supprimer cette consultation ?"
          onConfirm={() => handleDeleteConsultation(r.id)}
          okText="Supprimer"
          okType="danger"
          cancelText="Annuler"
        >
          <Button size="small" danger type="text" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const consultColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Motif',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Traitement',
      dataIndex: 'treatment',
      key: 'treatment',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string) => v
        ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
        : '—',
    },
    {
      title: '',
      key: 'del',
      width: 50,
      render: (_: any, r: any) => (
        <Popconfirm
          title="Supprimer ?"
          onConfirm={() => handleDeleteConsultation(r.id)}
          okText="Oui"
          okType="danger"
          cancelText="Non"
        >
          <Button size="small" danger type="text" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Infirmerie" subtitle="Dossiers médicaux et consultations" />

      {/* Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Button
          type={tab === 'recent' ? 'primary' : 'default'}
          icon={<MedicineBoxOutlined />}
          onClick={() => setTab('recent')}
        >
          Registre des consultations
        </Button>
        <Button
          type={tab === 'patient' ? 'primary' : 'default'}
          icon={<SearchOutlined />}
          onClick={() => setTab('patient')}
        >
          Dossier patient
        </Button>
      </div>

      {/* ─── Tab : Registre ─── */}
      {tab === 'recent' && (
        <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <Table
            columns={recentColumns}
            dataSource={recentConsultations}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="middle"
            locale={{ emptyText: 'Aucune consultation enregistrée' }}
          />
        </Card>
      )}

      {/* ─── Tab : Dossier patient ─── */}
      {tab === 'patient' && (
        <div>
          {/* Recherche patient */}
          <Card
            variant="borderless"
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: 16 }}
          >
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Rechercher un élève</Text>
            <Select
              showSearch
              optionFilterProp="children"
              placeholder="Nom, prénom ou matricule…"
              style={{ width: '100%', maxWidth: 420 }}
              onChange={handleSelectStudent}
              allowClear
            >
              {students.map((s: any) => (
                <Option key={s.id} value={s.id}>
                  {s.lastName} {s.firstName}
                  {s.enrollments?.[0]?.class?.name && (
                    <Text type="secondary"> — {s.enrollments[0].class.name}</Text>
                  )}
                </Option>
              ))}
            </Select>
          </Card>

          {medRecord && selectedStudent && (
            <Row gutter={16}>
              {/* Infos médicales */}
              <Col xs={24} lg={10}>
                <Card
                  variant="borderless"
                  style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: 16 }}
                  title={
                    <Space>
                      <HeartOutlined style={{ color: '#DC2626' }} />
                      <Text strong>
                        {selectedStudent.lastName} {selectedStudent.firstName}
                      </Text>
                    </Space>
                  }
                  loading={recordLoading}
                >
                  <Form
                    form={recordForm}
                    layout="vertical"
                    onFinish={handleSaveRecord}
                    requiredMark={false}
                    size="small"
                  >
                    <Form.Item name="bloodType" label="Groupe sanguin">
                      <Select allowClear placeholder="Groupe sanguin">
                        {BLOOD_TYPES.map(bt => <Option key={bt} value={bt}>{bt}</Option>)}
                      </Select>
                    </Form.Item>
                    <Form.Item name="allergies" label="Allergies connues">
                      <Input.TextArea rows={2} placeholder="Ex: Pénicilline, arachides…" />
                    </Form.Item>
                    <Form.Item name="conditions" label="Antécédents / Affections">
                      <Input.TextArea rows={2} placeholder="Ex: Asthme, diabète…" />
                    </Form.Item>
                    <Form.Item name="emergencyContact" label="Contact d'urgence">
                      <Input placeholder="Nom et téléphone" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={saving} size="small">
                      Enregistrer le dossier
                    </Button>
                  </Form>
                </Card>
              </Col>

              {/* Historique consultations */}
              <Col xs={24} lg={14}>
                <Card
                  variant="borderless"
                  style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
                  title="Historique des consultations"
                  extra={
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => { consultForm.resetFields(); setConsultModal(true) }}
                    >
                      Nouvelle consultation
                    </Button>
                  }
                  loading={recordLoading}
                >
                  <Table
                    columns={consultColumns}
                    dataSource={medRecord.consultations ?? []}
                    rowKey="id"
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    size="small"
                    locale={{ emptyText: 'Aucune consultation' }}
                  />
                </Card>
              </Col>
            </Row>
          )}
        </div>
      )}

      {/* Modal consultation */}
      <Modal
        title="Nouvelle consultation"
        open={consultModal}
        onCancel={() => { setConsultModal(false); consultForm.resetFields() }}
        footer={null}
        width={480}
      >
        <Form
          form={consultForm}
          layout="vertical"
          onFinish={handleAddConsultation}
          requiredMark={false}
          initialValues={{ date: dayjs() }}
        >
          <Form.Item name="date" label="Date">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="Motif de la consultation" rules={[{ required: true }]}>
            <Select placeholder="Sélectionner ou saisir un motif" mode="tags">
              {['Fièvre', 'Blessure', 'Maux de tête', 'Maux de ventre', 'Malaise', 'Accident', 'Contrôle de routine'].map(m => (
                <Option key={m} value={m}>{m}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="treatment" label="Traitement administré">
            <Input placeholder="Ex: Paracétamol 500mg, repos…" />
          </Form.Item>
          <Form.Item name="notes" label="Notes complémentaires">
            <Input.TextArea rows={3} placeholder="Observations, recommandations…" />
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
