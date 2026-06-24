import { useEffect, useState } from 'react'
import {
  Form, Input, Select, DatePicker, Radio, Button, Typography,
  Row, Col, Avatar, Tooltip,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, UserOutlined, CameraOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { formatMatricule } from '../../utils/formatters'
import { PageHeader } from '../../components/shared/PageHeader'

const { Option } = Select
const { Title } = Typography

export function StudentCreatePage() {
  const message = useAppMessage()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [classes, setClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [matricule, setMatricule] = useState('')
  const [studentCount, setStudentCount] = useState(0)
  const [photo, setPhoto] = useState<string | null>(null)

  const handlePickPhoto = async () => {
    try {
      const dataUrl = await ipc.dialog.openImage()
      if (dataUrl) setPhoto(dataUrl)
    } catch { /* user cancelled */ }
  }

  useEffect(() => {
    ipc.classes.list().then(setClasses).catch(() => {})
    ipc.students.list().then((list) => setStudentCount(list.length)).catch(() => {})
    ipc.settings.listAcademicYears().then((list) => {
      setYears(list)
      const current = list.find((y: any) => y.isCurrent)
      if (current) form.setFieldValue('academicYearId', current.id)
    }).catch(() => {})
  }, [])

  const updateMatricule = () => {
    const lastName = form.getFieldValue('lastName') ?? ''
    const firstName = form.getFieldValue('firstName') ?? ''
    if (lastName && firstName) {
      const year = new Date().getFullYear()
      setMatricule(formatMatricule('SCH', lastName, firstName, year, studentCount + 1))
    }
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const studentData = {
        firstName: values.firstName,
        lastName: values.lastName,
        gender: values.gender,
        birthDate: values.birthDate?.toDate(),
        birthPlace: values.birthPlace,
        nationality: values.nationality ?? 'Guinéenne',
        address: values.address,
        phone: values.phone,
        email: values.email,
        photo: photo ?? undefined,
      }

      const student = await ipc.students.create(studentData, userId ?? 'system')

      // Enroll if class is selected
      if (values.classId && values.academicYearId) {
        await ipc.students.enroll(student.id, values.classId, values.academicYearId, userId ?? 'system')
      }

      message.success(`Élève créé — Matricule: ${student.matricule}`)
      navigate(`/students/${student.id}`)
    } catch (e: any) {
      message.error(e.message ?? 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const sectionStyle = {
    background: 'var(--surface)',
    borderRadius: 12,
    padding: '24px',
    marginBottom: 16,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  }

  return (
    <div>
      <PageHeader
        title="Nouvel élève"
        breadcrumb={[{ label: 'Élèves', href: '/students' }, { label: 'Nouveau' }]}
        actions={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/students')}>
            Retour
          </Button>
        }
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        scrollToFirstError
      >
        {/* Section 1 — Informations personnelles */}
        <div style={sectionStyle}>
          <Title level={5} style={{ marginBottom: 20, color: '#1E40AF' }}>
            <UserOutlined style={{ marginRight: 8 }} />
            Informations personnelles
          </Title>

          {/* Photo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <Tooltip title="Cliquer pour sélectionner une photo">
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={handlePickPhoto}>
                <Avatar
                  size={80}
                  icon={<UserOutlined />}
                  src={photo ?? undefined}
                  style={{ background: '#1E40AF' }}
                />
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#1E40AF', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}>
                  <CameraOutlined />
                </div>
              </div>
            </Tooltip>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Photo de l'élève</div>
              <div style={{ fontSize: 12, color: '#888' }}>Optionnelle — JPG, PNG</div>
              {photo && (
                <Button size="small" type="link" danger onClick={() => setPhoto(null)} style={{ padding: 0, height: 'auto' }}>
                  Supprimer
                </Button>
              )}
            </div>
          </div>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Nom de famille"
                rules={[{ required: true, message: 'Nom requis' }, { min: 2 }]}
              >
                <Input placeholder="Ex: Diallo" onChange={updateMatricule} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="Prénom"
                rules={[{ required: true, message: 'Prénom requis' }, { min: 2 }]}
              >
                <Input placeholder="Ex: Mamadou" onChange={updateMatricule} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="gender"
                label="Sexe"
                rules={[{ required: true, message: 'Requis' }]}
              >
                <Radio.Group>
                  <Radio value="MALE">Masculin</Radio>
                  <Radio value="FEMALE">Féminin</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="birthDate"
                label="Date de naissance"
                rules={[{ required: true, message: 'Date requise' }]}
              >
                <DatePicker
                  placeholder="JJ/MM/AAAA"
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  disabledDate={(d) => d && d.isAfter(new Date())}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="birthPlace" label="Lieu de naissance">
                <Input placeholder="Ex: Conakry" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="nationality" label="Nationalité">
                <Input placeholder="Guinéenne" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="Téléphone élève">
                <Input placeholder="Ex: 622 XX XX XX" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="address" label="Adresse">
                <Input.TextArea rows={2} placeholder="Quartier, rue..." />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Section 2 — Scolarité */}
        <div style={sectionStyle}>
          <Title level={5} style={{ marginBottom: 20, color: '#1E40AF' }}>
            Scolarité
          </Title>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="academicYearId" label="Année scolaire">
                <Select placeholder="Sélectionner l'année" allowClear>
                  {years.map((y: any) => (
                    <Option key={y.id} value={y.id}>
                      {y.label}{y.isCurrent ? ' ✓' : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="classId" label="Classe">
                <Select placeholder="Sélectionner une classe" allowClear showSearch optionFilterProp="children">
                  {classes.map((c: any) => (
                    <Option key={c.id} value={c.id}>
                      {c.name} {c.level?.name ? `— ${c.level.name}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Matricule (auto-généré)">
                <Input value={matricule || '(remplir nom + prénom)'} disabled />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Section 3 — Contact parent */}
        <div style={sectionStyle}>
          <Title level={5} style={{ marginBottom: 20, color: '#1E40AF' }}>
            Contact parent / tuteur
          </Title>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="fatherName" label="Nom du père">
                <Input placeholder="Nom complet" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="fatherPhone" label="Téléphone père">
                <Input placeholder="622 XX XX XX" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="motherName" label="Nom de la mère">
                <Input placeholder="Nom complet" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="motherPhone" label="Téléphone mère">
                <Input placeholder="622 XX XX XX" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="tutorName" label="Tuteur (si différent)">
                <Input placeholder="Nom complet" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="tutorPhone" label="Téléphone tuteur">
                <Input placeholder="622 XX XX XX" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 24 }}>
          <Button size="large" onClick={() => navigate('/students')}>
            Annuler
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            icon={<SaveOutlined />}
          >
            Enregistrer
          </Button>
        </div>
      </Form>
    </div>
  )
}
