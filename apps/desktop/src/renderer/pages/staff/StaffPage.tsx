import { useEffect, useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker,
  Tag, Typography, Tabs, Space, Popconfirm, Card, Row, Col, Statistic,
  Descriptions, List, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  UserOutlined, DollarOutlined, CheckOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatGNF, formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Option } = Select
const { Text, Title } = Typography

const CONTRACT_LABELS: Record<string, string> = {
  PERMANENT: 'Permanent',
  PART_TIME: 'Vacataire',
  INTERN: 'Stagiaire',
}

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']

export function StaffPage() {
  const message = useAppMessage()
  const { userId } = useAuth()
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [detailTarget, setDetailTarget] = useState<any | null>(null)
  const [salaryTarget, setSalaryTarget] = useState<any | null>(null)
  const [salaries, setSalaries] = useState<any[]>([])
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [salaryForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    ipc.teachers.list()
      .then(setTeachers)
      .catch(() => setTeachers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (values: any) => {
    setSaving(true)
    try {
      await ipc.teachers.create({
        ...values,
        hireDate: values.hireDate?.toDate(),
        baseSalary: values.baseSalary ?? 0,
        hoursPerWeek: values.hoursPerWeek ?? 0,
      }, userId ?? 'system')
      message.success('Enseignant créé avec succès')
      setCreateOpen(false)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (values: any) => {
    if (!editTarget) return
    setSaving(true)
    try {
      await ipc.teachers.update(editTarget.id, {
        ...values,
        hireDate: values.hireDate?.toDate(),
      }, userId ?? 'system')
      message.success('Enseignant modifié')
      setEditTarget(null)
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipc.teachers.delete(id, userId ?? 'system')
      message.success('Enseignant supprimé')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const openEdit = (t: any) => {
    setEditTarget(t)
    editForm.setFieldsValue({
      firstName: t.user.firstName,
      lastName: t.user.lastName,
      email: t.user.email,
      phone: t.user.phone,
      diploma: t.diploma,
      contractType: t.contractType,
      baseSalary: t.baseSalary,
      hoursPerWeek: t.hoursPerWeek,
      hireDate: t.hireDate ? dayjs(t.hireDate) : undefined,
    })
  }

  const openSalary = async (t: any) => {
    setSalaryTarget(t)
    const list = await ipc.teachers.listSalaries(t.id).catch(() => [])
    setSalaries(list)
    salaryForm.setFieldsValue({
      baseSalary: t.baseSalary,
      month: dayjs().month() + 1,
      year: dayjs().year(),
      bonuses: 0,
      advances: 0,
      deductions: 0,
    })
  }

  const handleSalary = async (values: any) => {
    if (!salaryTarget) return
    setSaving(true)
    try {
      await ipc.teachers.createSalary({ ...values, teacherId: salaryTarget.id }, userId ?? 'system')
      message.success('Fiche de paie créée')
      const list = await ipc.teachers.listSalaries(salaryTarget.id)
      setSalaries(list)
      salaryForm.resetFields()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: 'Matricule',
      dataIndex: 'matricule',
      key: 'mat',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Nom complet',
      key: 'name',
      render: (_: any, r: any) => (
        <div>
          <Text strong>{r.user.lastName.toUpperCase()} {r.user.firstName}</Text>
          {r.user.email && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.user.email}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Contrat',
      dataIndex: 'contractType',
      key: 'contract',
      width: 110,
      render: (v: string) => v ? <Tag color="blue">{CONTRACT_LABELS[v] ?? v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Matières',
      key: 'subjects',
      render: (_: any, r: any) => {
        const unique = [...new Set(r.subjects.map((s: any) => s.subject.name))]
        return unique.length > 0
          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(unique as string[]).slice(0, 3).map(n => <Tag key={n} style={{ fontSize: 11 }}>{n}</Tag>)}
              {unique.length > 3 && <Tag>+{unique.length - 3}</Tag>}
            </div>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Salaire',
      dataIndex: 'baseSalary',
      key: 'salary',
      width: 130,
      render: (v: number) => <Text strong>{formatGNF(v)}</Text>,
    },
    {
      title: 'Statut',
      key: 'status',
      width: 80,
      render: (_: any, r: any) => (
        <Badge status={r.user.isActive ? 'success' : 'error'} text={r.user.isActive ? 'Actif' : 'Inactif'} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => setDetailTarget(r)} />
          <Button size="small" type="text" icon={<DollarOutlined />} onClick={() => openSalary(r)} title="Paie" />
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm
            title="Supprimer cet enseignant ?"
            description="L'utilisateur associé sera aussi supprimé."
            onConfirm={() => handleDelete(r.id)}
            okText="Supprimer"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Personnel"
        subtitle={`${teachers.length} enseignant(s) enregistré(s)`}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Ajouter un enseignant
          </Button>
        }
      />

      {/* KPIs */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" variant="borderless" style={{ borderLeft: '4px solid #1E40AF', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic title="Total enseignants" value={teachers.length} prefix={<UserOutlined style={{ color: '#1E40AF' }} />} valueStyle={{ color: '#1E40AF', fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" variant="borderless" style={{ borderLeft: '4px solid #16A34A', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic title="Permanents" value={teachers.filter(t => t.contractType === 'PERMANENT').length} valueStyle={{ color: '#16A34A', fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" variant="borderless" style={{ borderLeft: '4px solid #D97706', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Statistic title="Vacataires" value={teachers.filter(t => t.contractType === 'PART_TIME').length} valueStyle={{ color: '#D97706', fontWeight: 700 }} />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={teachers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, style: { padding: '12px 16px' } }}
          size="middle"
          locale={{ emptyText: 'Aucun enseignant enregistré' }}
        />
      </Card>

      {/* Modal création */}
      <Modal
        title={<><UserOutlined style={{ marginRight: 8 }} />Nouvel enseignant</>}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="lastName" label="Nom" rules={[{ required: true }]}>
                <Input placeholder="Ex: Diallo" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstName" label="Prénom" rules={[{ required: true }]}>
                <Input placeholder="Ex: Mamadou" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="username" label="Identifiant (connexion)" rules={[{ required: true }]}>
                <Input placeholder="Ex: mdiallo" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label="Mot de passe initial">
                <Input.Password placeholder="Enseignant@1234 par défaut" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="email@exemple.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Téléphone">
                <Input placeholder="622 XX XX XX" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="diploma" label="Diplôme">
                <Input placeholder="Ex: Licence en Mathématiques" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contractType" label="Type de contrat">
                <Select placeholder="Sélectionner">
                  <Option value="PERMANENT">Permanent</Option>
                  <Option value="PART_TIME">Vacataire</Option>
                  <Option value="INTERN">Stagiaire</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hireDate" label="Date d'embauche">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hoursPerWeek" label="Heures / semaine">
                <InputNumber min={0} max={40} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="baseSalary" label="Salaire de base (GNF)">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer</Button>
          </div>
        </Form>
      </Modal>

      {/* Modal édition */}
      <Modal
        title="Modifier l'enseignant"
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="lastName" label="Nom" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstName" label="Prénom" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Téléphone">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="diploma" label="Diplôme">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contractType" label="Type de contrat">
                <Select>
                  <Option value="PERMANENT">Permanent</Option>
                  <Option value="PART_TIME">Vacataire</Option>
                  <Option value="INTERN">Stagiaire</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hireDate" label="Date d'embauche">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hoursPerWeek" label="Heures / semaine">
                <InputNumber min={0} max={40} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="baseSalary" label="Salaire de base (GNF)">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditTarget(null)}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Enregistrer</Button>
          </div>
        </Form>
      </Modal>

      {/* Détail enseignant */}
      <Modal
        title={detailTarget ? `${detailTarget.user.lastName} ${detailTarget.user.firstName}` : ''}
        open={!!detailTarget}
        onCancel={() => setDetailTarget(null)}
        footer={<Button onClick={() => setDetailTarget(null)}>Fermer</Button>}
        width={560}
      >
        {detailTarget && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Matricule">{detailTarget.matricule}</Descriptions.Item>
              <Descriptions.Item label="Contrat">{CONTRACT_LABELS[detailTarget.contractType] ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Téléphone">{detailTarget.user.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailTarget.user.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Diplôme" span={2}>{detailTarget.diploma ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Date d'embauche">
                {detailTarget.hireDate ? formatDate(detailTarget.hireDate) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="H/semaine">{detailTarget.hoursPerWeek ?? 0} h</Descriptions.Item>
              <Descriptions.Item label="Salaire de base" span={2}>
                <Text strong style={{ color: '#16A34A' }}>{formatGNF(detailTarget.baseSalary)}</Text>
              </Descriptions.Item>
            </Descriptions>
            <Title level={5}>Matières enseignées</Title>
            {detailTarget.subjects.length === 0
              ? <Text type="secondary">Aucune matière affectée</Text>
              : (
                <List
                  dataSource={detailTarget.subjects}
                  size="small"
                  renderItem={(s: any) => (
                    <List.Item>
                      <Text strong>{s.subject.name}</Text>
                      <Text type="secondary" style={{ marginLeft: 12 }}>{s.class.name}</Text>
                      <Tag style={{ marginLeft: 8 }}>Coeff. {s.coefficient}</Tag>
                    </List.Item>
                  )}
                />
              )
            }
          </>
        )}
      </Modal>

      {/* Modal paie */}
      <Modal
        title={salaryTarget ? `Paie — ${salaryTarget.user.lastName} ${salaryTarget.user.firstName}` : ''}
        open={!!salaryTarget}
        onCancel={() => setSalaryTarget(null)}
        footer={null}
        width={600}
      >
        {salaryTarget && (
          <Tabs
            items={[
              {
                key: 'new',
                label: 'Nouvelle fiche',
                children: (
                  <Form form={salaryForm} layout="vertical" onFinish={handleSalary} requiredMark={false}>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item name="month" label="Mois" rules={[{ required: true }]}>
                          <Select>
                            {MONTHS.map((m, i) => <Option key={i + 1} value={i + 1}>{m}</Option>)}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="year" label="Année" rules={[{ required: true }]}>
                          <InputNumber style={{ width: '100%' }} min={2020} max={2100} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="baseSalary" label="Salaire de base (GNF)" rules={[{ required: true }]}>
                          <InputNumber
                            style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                            parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="bonuses" label="Primes (GNF)">
                          <InputNumber style={{ width: '100%' }} min={0}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                            parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="advances" label="Avances (GNF)">
                          <InputNumber style={{ width: '100%' }} min={0}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                            parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="deductions" label="Déductions (GNF)">
                          <InputNumber style={{ width: '100%' }} min={0}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                            parser={v => Number(v?.replace(/\s/g, '') ?? 0)}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Button type="primary" htmlType="submit" loading={saving}>Générer la fiche</Button>
                    </div>
                  </Form>
                ),
              },
              {
                key: 'history',
                label: `Historique (${salaries.length})`,
                children: (
                  <List
                    dataSource={salaries}
                    size="small"
                    locale={{ emptyText: 'Aucune fiche de paie' }}
                    renderItem={(s: any) => (
                      <List.Item
                        actions={[
                          !s.paidAt && (
                            <Button
                              key="pay"
                              size="small"
                              icon={<CheckOutlined />}
                              onClick={async () => {
                                await ipc.teachers.markSalaryPaid(s.id, userId ?? 'system')
                                const list = await ipc.teachers.listSalaries(salaryTarget.id)
                                setSalaries(list)
                              }}
                            >
                              Marquer payé
                            </Button>
                          ),
                        ]}
                      >
                        <List.Item.Meta
                          title={<Text strong>{MONTHS[s.month - 1]} {s.year}</Text>}
                          description={
                            <span>
                              Net : <Text strong style={{ color: '#16A34A' }}>{formatGNF(s.netSalary)}</Text>
                              {s.paidAt && <Tag color="green" style={{ marginLeft: 8 }}>Payé le {formatDate(s.paidAt)}</Tag>}
                            </span>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  )
}
