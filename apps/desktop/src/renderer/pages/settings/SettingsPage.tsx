import { useEffect, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'

import {
  Tabs, Form, Input, Button, Table, Tag, Modal, Select,
  Card, Space, Popconfirm, Typography, Alert, InputNumber,
  DatePicker, Switch, Tooltip, Badge, Spin, Divider, Row, Col, theme,
} from 'antd'
import { useAppMessage } from '../../hooks/useAppMessage'
import {
  UserAddOutlined, EditOutlined, KeyOutlined, PlusOutlined,
  SaveOutlined, DatabaseOutlined, UploadOutlined, CheckCircleOutlined,
  HistoryOutlined, SafetyCertificateOutlined, AppstoreOutlined, LockOutlined,
  BookOutlined, CheckOutlined, WarningOutlined,
  BankOutlined, CalendarOutlined, TeamOutlined, ReadOutlined, DollarOutlined,
  StarOutlined, MailOutlined, CloudDownloadOutlined,
} from '@ant-design/icons'
import { ALL_MODULES, useModules } from '../../contexts/ModulesContext'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/shared/PageHeader'

const { Title, Text } = Typography
const { Option } = Select

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  DIRECTOR: 'Directeur',
  SECRETARY: 'Secrétaire',
  ACCOUNTANT: 'Comptable',
  TEACHER: 'Enseignant',
}
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'purple',
  DIRECTOR: 'blue',
  SECRETARY: 'cyan',
  ACCOUNTANT: 'green',
  TEACHER: 'orange',
}

// ─── Code de récupération ─────────────────────────────────────────────────────
function RecoveryCodeSection() {
  const message = useAppMessage()
  const [isSet, setIsSet]       = useState<boolean | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    ipc.settings.getRecoveryCode()
      .then(r => setIsSet(r.isSet))
      .catch(() => setIsSet(false))
  }, [])

  const handleSet = async (values: { code: string }) => {
    setSaving(true)
    try {
      await ipc.settings.setRecoveryCode(values.code)
      setIsSet(true)
      setModalOpen(false)
      form.resetFields()
      message.success('Code de récupération enregistré')
    } catch (e: any) {
      message.error(e.message)
    } finally { setSaving(false) }
  }

  return (
    <>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16, borderRadius: 8 }}
        message="Ce code permet de réinitialiser un mot de passe depuis l'écran de connexion, sans être connecté."
        description="Définissez un code mémorable et communiquez-le uniquement aux personnes autorisées (directeur, administrateur)."
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isSet === null ? (
          <Spin size="small" />
        ) : isSet ? (
          <>
            <Tag color="success" icon={<CheckOutlined />}>Code configuré</Tag>
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => { form.resetFields(); setModalOpen(true) }}
            >
              Modifier le code
            </Button>
          </>
        ) : (
          <>
            <Tag color="warning" icon={<WarningOutlined />}>Non configuré</Tag>
            <Button
              type="primary" size="small" icon={<KeyOutlined />}
              onClick={() => { form.resetFields(); setModalOpen(true) }}
            >
              Définir un code
            </Button>
          </>
        )}
      </div>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyOutlined style={{ color: '#1E40AF' }} />
            <span>Définir le code de récupération</span>
          </div>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={420}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          message="Ce code sera demandé pour réinitialiser un mot de passe depuis la page de connexion."
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
        <Form form={form} layout="vertical" onFinish={handleSet} requiredMark={false}>
          <Form.Item
            name="code"
            label={<span style={{ fontWeight: 600 }}>Nouveau code</span>}
            rules={[{ required: true, message: 'Requis' }, { min: 6, message: 'Minimum 6 caractères' }]}
          >
            <Input.Password
              size="large" style={{ borderRadius: 8 }}
              placeholder="Minimum 6 caractères"
              autoFocus
            />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={<span style={{ fontWeight: 600 }}>Confirmer le code</span>}
            dependencies={['code']}
            rules={[
              { required: true, message: 'Requis' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('code') === value) return Promise.resolve()
                  return Promise.reject(new Error('Les codes ne correspondent pas'))
                },
              }),
            ]}
          >
            <Input.Password size="large" style={{ borderRadius: 8 }} placeholder="Répétez le code" />
          </Form.Item>
          <Button
            type="primary" htmlType="submit" loading={saving}
            block size="large" style={{ borderRadius: 8 }}
          >
            Enregistrer
          </Button>
        </Form>
      </Modal>
    </>
  )
}

// ─── Configuration SMTP (réinitialisation mot de passe par email) ─────────────
function SmtpConfigSection() {
  const message = useAppMessage()
  const [form] = Form.useForm()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testModal, setTestModal] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    ipc.settings.getSmtpConfig().then(cfg => {
      if (cfg) {
        form.setFieldsValue(cfg)
        setConfigured(true)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.setSmtpConfig(values)
      setConfigured(true)
      message.success('Configuration SMTP enregistrée')
    } catch (e: any) {
      message.error(e.message)
    } finally { setSaving(false) }
  }

  const handleTest = async () => {
    if (!testEmail.trim()) return
    setTesting(true)
    try {
      await ipc.settings.testSmtp(testEmail.trim())
      message.success(`Email de test envoyé à ${testEmail}`)
      setTestModal(false)
      setTestEmail('')
    } catch (e: any) {
      message.error('Échec : ' + e.message)
    } finally { setTesting(false) }
  }

  if (loading) return <Spin size="small" />

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 8 }}
        message="Serveur email (SMTP)"
        description="Nécessaire pour envoyer les codes de réinitialisation de mot de passe par email. Fonctionne avec Gmail, Outlook, ou tout serveur SMTP."
      />

      <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 16px' }}>
          <Form.Item name="host" label="Serveur SMTP" rules={[{ required: true, message: 'Requis' }]}>
            <Input placeholder="smtp.gmail.com" />
          </Form.Item>
          <Form.Item name="port" label="Port" style={{ width: 90 }} rules={[{ required: true }]}>
            <Input type="number" placeholder="587" />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item name="user" label="Identifiant (email SMTP)" rules={[{ required: true }]}>
            <Input placeholder="contact@monecole.gn" />
          </Form.Item>
          <Form.Item name="password" label="Mot de passe SMTP" rules={[{ required: true }]}>
            <Input.Password placeholder={configured ? '••••••••' : 'Mot de passe'} />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item name="fromName" label="Nom d'expéditeur">
            <Input placeholder="École Demo SGSI" />
          </Form.Item>
          <Form.Item name="fromEmail" label="Email d'expéditeur">
            <Input placeholder="noreply@monecole.gn (optionnel)" />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
            Enregistrer
          </Button>
          {configured && (
            <Button icon={<CheckOutlined />} onClick={() => setTestModal(true)}>
              Envoyer un email de test
            </Button>
          )}
        </div>
      </Form>

      <Modal
        title="Envoyer un email de test"
        open={testModal}
        onCancel={() => setTestModal(false)}
        footer={null}
        width={380}
      >
        <Typography.Text style={{ display: 'block', color: '#6B7280', marginBottom: 12 }}>
          Entrez votre adresse email pour vérifier que la configuration fonctionne.
        </Typography.Text>
        <Input
          placeholder="votre@email.com" size="large" style={{ borderRadius: 8, marginBottom: 12 }}
          value={testEmail} onChange={e => setTestEmail(e.target.value)}
          onPressEnter={handleTest}
        />
        <Button type="primary" block size="large" loading={testing} onClick={handleTest}
          style={{ borderRadius: 8 }} disabled={!testEmail.trim()}>
          Envoyer
        </Button>
      </Modal>
    </>
  )
}

// ─── Onglet Établissement ──────────────────────────────────────────────────────
function SchoolTab() {
  const message = useAppMessage()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(() => {
    ipc.settings.getSchool().then((s) => {
      form.setFieldsValue(s)
      setLogo(s?.logo ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handlePickLogo = async () => {
    try {
      const dataUrl = await ipc.dialog.openImage()
      if (dataUrl) setLogo(dataUrl)
    } catch { /* annulé */ }
  }

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.updateSchool({ ...values, logo: logo ?? undefined })
      message.success('Configuration sauvegardée')
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card loading={loading} style={{ maxWidth: 700 }}>
      <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
        <Title level={5} style={{ marginTop: 0 }}>Informations de l'établissement</Title>

        {/* Logo */}
        <Form.Item label="Logo de l'école (affiché sur les documents imprimés)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 12, overflow: 'hidden',
              border: '2px dashed #d9d9d9', background: '#fafafa',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {logo
                ? <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: 28, color: '#d9d9d9' }}>🏫</span>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button icon={<UploadOutlined />} onClick={handlePickLogo}>
                {logo ? 'Changer le logo' : 'Choisir un logo'}
              </Button>
              {logo && (
                <Button danger size="small" onClick={() => setLogo(null)}>
                  Supprimer
                </Button>
              )}
              <Text type="secondary" style={{ fontSize: 11 }}>JPG, PNG — recommandé 200×200 px</Text>
            </div>
          </div>
        </Form.Item>

        <Form.Item name="name" label="Nom de l'école" rules={[{ required: true }]}>
          <Input placeholder="Ex: Lycée Moderne de Conakry" />
        </Form.Item>

        <Form.Item name="sigle" label="Sigle (pour les matricules)" rules={[{ required: true }, { max: 6 }]}>
          <Input placeholder="Ex: LMC" style={{ textTransform: 'uppercase', width: 120 }} />
        </Form.Item>

        <Form.Item name="directorName" label="Nom du directeur">
          <Input placeholder="Ex: M. Mamadou Diallo" />
        </Form.Item>

        <Form.Item name="address" label="Adresse">
          <Input placeholder="Ex: Quartier Madina, Conakry" />
        </Form.Item>

        <Form.Item name="phone" label="Téléphone">
          <Input placeholder="+224 6XX XXX XXX" />
        </Form.Item>

        <Form.Item name="email" label="Email">
          <Input type="email" placeholder="contact@ecole.gn" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
          Enregistrer
        </Button>
      </Form>

      <Divider />
      <Title level={5} style={{ marginBottom: 12 }}>
        <KeyOutlined style={{ marginRight: 8, color: '#6366F1' }} />
        Réinitialisation par email
      </Title>
      <Alert
        type="success"
        showIcon
        message={<span>✅ Géré par <strong>Brevo</strong></span>}
        description={
          <span>
            Les emails de réinitialisation de mot de passe sont envoyés via Brevo (configuré dans l'onglet{' '}
            <strong>Email (Brevo)</strong>). SMTP n'est plus nécessaire.
          </span>
        }
        style={{ borderRadius: 10, fontSize: 13 }}
      />

      <Divider />
      <Title level={5} style={{ marginBottom: 12 }}>
        <LockOutlined style={{ marginRight: 8, color: '#92400E' }} />
        Code de récupération (secours sans email)
      </Title>
      <RecoveryCodeSection />
    </Card>
  )
}

// ─── Onglet Utilisateurs ───────────────────────────────────────────────────────
function UsersTab() {
  const message = useAppMessage()
  const { userId } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [tempPwd, setTempPwd] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    ipc.settings.listUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditUser(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (u: any) => { setEditUser(u); form.setFieldsValue(u); setModalOpen(true) }

  const handleSubmit = async (values: any) => {
    setSaving(true)
    try {
      if (editUser) {
        await ipc.settings.updateUser(editUser.id, values)
        message.success('Utilisateur mis à jour')
      } else {
        await ipc.settings.createUser(values)
        message.success(`Utilisateur créé — mot de passe temporaire : ${values.password ?? 'Temp@1234'}`)
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (u: any) => {
    try {
      const res = await ipc.settings.resetUserPassword(u.id, userId ?? '')
      setTempPwd(res.tempPassword)
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleToggleActive = async (u: any) => {
    try {
      await ipc.settings.updateUser(u.id, { ...u, isActive: !u.isActive })
      message.success(u.isActive ? 'Compte désactivé' : 'Compte réactivé')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: 'Nom',
      key: 'name',
      render: (_: any, r: any) => <Text strong>{r.lastName} {r.firstName}</Text>,
    },
    { title: 'Identifiant', dataIndex: 'username', key: 'username', render: (v: string) => <Text code>{v}</Text> },
    {
      title: 'Rôle',
      dataIndex: 'role',
      key: 'role',
      render: (v: string) => <Tag color={ROLE_COLORS[v]}>{ROLE_LABELS[v] ?? v}</Tag>,
    },
    {
      title: 'Statut',
      dataIndex: 'isActive',
      key: 'status',
      render: (v: boolean) => v ? <Badge status="success" text="Actif" /> : <Badge status="error" text="Inactif" />,
    },
    {
      title: 'Dernière connexion',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Modifier"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Réinitialiser le mot de passe">
            <Popconfirm title="Générer un mot de passe temporaire ?" onConfirm={() => handleReset(r)} okText="Oui" cancelText="Non">
              <Button size="small" icon={<KeyOutlined />} />
            </Popconfirm>
          </Tooltip>
          <Tooltip title={r.isActive ? 'Désactiver' : 'Réactiver'}>
            <Switch size="small" checked={r.isActive} onChange={() => handleToggleActive(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<UserAddOutlined />} onClick={openCreate}>Nouvel utilisateur</Button>
      </div>

      <Table columns={columns} dataSource={users} rowKey="id" loading={loading} size="middle" pagination={false} />

      {/* Modal create/edit */}
      <Modal
        title={editUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item name="lastName" label="Nom" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="firstName" label="Prénom" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="username" label="Identifiant" rules={[{ required: true }]}>
            <Input disabled={!!editUser} />
          </Form.Item>
          {!editUser && (
            <Form.Item name="password" label="Mot de passe temporaire">
              <Input placeholder="Temp@1234 par défaut" />
            </Form.Item>
          )}
          <Form.Item name="role" label="Rôle" rules={[{ required: true }]}>
            <Select>
              {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'SUPER_ADMIN').map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" />
          </Form.Item>
          <Form.Item name="phone" label="Téléphone">
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {editUser ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal affichage mot de passe temporaire */}
      <Modal
        title="Mot de passe temporaire généré"
        open={!!tempPwd}
        onOk={() => setTempPwd(null)}
        onCancel={() => setTempPwd(null)}
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <Alert
          type="warning"
          message="Notez ce mot de passe et communiquez-le à l'utilisateur. Il ne sera plus affiché."
          style={{ marginBottom: 16 }}
        />
        <Text style={{ fontSize: 24, fontWeight: 700, letterSpacing: 4, display: 'block', textAlign: 'center' }}>
          {tempPwd}
        </Text>
      </Modal>
    </div>
  )
}

// ─── Onglet Année scolaire ─────────────────────────────────────────────────────
function AcademicYearsTab() {
  const message = useAppMessage()
  const [years, setYears] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    ipc.settings.listAcademicYears().then(setYears).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.createAcademicYear({
        label: values.label,
        startDate: values.startDate.toDate(),
        endDate: values.endDate.toDate(),
        isCurrent: values.isCurrent ?? false,
      })
      message.success('Année scolaire créée')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSetCurrent = async (id: string) => {
    try {
      await ipc.settings.setCurrentYear(id)
      message.success('Année courante mise à jour')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const columns = [
    { title: 'Libellé', dataIndex: 'label', key: 'label', render: (v: string, r: any) => (
      <Space>{v}{r.isCurrent && <Tag color="blue">Courante</Tag>}</Space>
    )},
    { title: 'Début', dataIndex: 'startDate', key: 'start', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Fin', dataIndex: 'endDate', key: 'end', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Actions', key: 'actions',
      render: (_: any, r: any) => !r.isCurrent && (
        <Popconfirm title="Définir comme année courante ?" onConfirm={() => handleSetCurrent(r.id)} okText="Oui" cancelText="Non">
          <Button size="small" icon={<CheckCircleOutlined />}>Définir courante</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Nouvelle année
        </Button>
      </div>

      <Table columns={columns} dataSource={years} rowKey="id" loading={loading} pagination={false} size="middle" />

      <Modal title="Nouvelle année scolaire" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields() }} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Form.Item name="label" label="Libellé" rules={[{ required: true }]}>
            <Input placeholder="Ex: 2024-2025" />
          </Form.Item>
          <Form.Item name="startDate" label="Date de début" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="endDate" label="Date de fin" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="isCurrent" label="Définir comme année courante" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Onglet Classes ────────────────────────────────────────────────────────────
function ClassesTab() {
  const message = useAppMessage()
  const [cycles, setCycles] = useState<any[]>([])
  const [allClasses, setAllClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null)
  const [cycleModalOpen, setCycleModalOpen] = useState(false)
  const [levelModalOpen, setLevelModalOpen] = useState(false)
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [cycleForm] = Form.useForm()
  const [levelForm] = Form.useForm()
  const [classForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [c, cls, y] = await Promise.all([
        ipc.classes.listCycles(),
        ipc.classes.list(),
        ipc.settings.listAcademicYears(),
      ])
      setCycles(c)
      setAllClasses(cls)
      setYears(y)
      if (!selectedCycleId && c.length > 0) setSelectedCycleId(c[0].id)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const selectedCycle = cycles.find(c => c.id === selectedCycleId)
  const niveaux: any[] = selectedCycle?.levels ?? []
  const selectedLevel = niveaux.find(l => l.id === selectedLevelId) ?? niveaux[0] ?? null
  const filteredClasses = selectedLevel
    ? allClasses.filter(c => c.levelId === selectedLevel.id)
    : []

  const handleCreateCycle = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.createCycle({ name: values.name })
      message.success('Cycle créé')
      setCycleModalOpen(false)
      cycleForm.resetFields()
      load()
    } catch (e: any) { message.error(e.message) } finally { setSaving(false) }
  }

  const handleCreateLevel = async (values: any) => {
    if (!selectedCycleId) return
    setSaving(true)
    try {
      await ipc.settings.createLevel({ name: values.name, cycleId: selectedCycleId })
      message.success('Niveau créé')
      setLevelModalOpen(false)
      levelForm.resetFields()
      load()
    } catch (e: any) { message.error(e.message) } finally { setSaving(false) }
  }

  const handleCreateClass = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.createClass({
        name: values.name,
        levelId: values.levelId ?? selectedLevel?.id,
        academicYearId: values.academicYearId,
        maxStudents: Number(values.maxStudents) || 40,
      })
      message.success('Classe créée')
      setClassModalOpen(false)
      classForm.resetFields()
      load()
    } catch (e: any) { message.error(e.message) } finally { setSaving(false) }
  }

  const openClassModal = () => {
    classForm.setFieldsValue({
      levelId: selectedLevel?.id,
      academicYearId: years.find(y => y.isCurrent)?.id,
    })
    setClassModalOpen(true)
  }

  return (
    <div>
      {/* ── Cycles ── */}
      <Card
        size="small"
        style={{ marginBottom: 12 }}
        loading={loading}
        title={<Text strong>Cycles</Text>}
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={() => setCycleModalOpen(true)}>
            Nouveau cycle
          </Button>
        }
      >
        <Space wrap>
          {cycles.map(c => (
            <Tag
              key={c.id}
              color={selectedCycleId === c.id ? 'blue' : 'default'}
              style={{ padding: '4px 14px', fontSize: 13, cursor: 'pointer', fontWeight: selectedCycleId === c.id ? 600 : 400 }}
              onClick={() => { setSelectedCycleId(c.id); setSelectedLevelId(null) }}
            >
              {c.name}
            </Tag>
          ))}
          {cycles.length === 0 && <Text type="secondary">Aucun cycle</Text>}
        </Space>
      </Card>

      {/* ── Niveaux du cycle sélectionné ── */}
      {selectedCycle && (
        <Card
          size="small"
          style={{ marginBottom: 12 }}
          title={<Text strong>Niveaux — {selectedCycle.name}</Text>}
          extra={
            <Button size="small" icon={<PlusOutlined />} onClick={() => setLevelModalOpen(true)}>
              Nouveau niveau
            </Button>
          }
        >
          <Space wrap>
            {niveaux.map(l => (
              <Tag
                key={l.id}
                color={selectedLevel?.id === l.id ? 'geekblue' : 'default'}
                style={{ padding: '4px 14px', fontSize: 13, cursor: 'pointer', fontWeight: selectedLevel?.id === l.id ? 600 : 400 }}
                onClick={() => setSelectedLevelId(l.id)}
              >
                {l.name}
              </Tag>
            ))}
            {niveaux.length === 0 && <Text type="secondary">Aucun niveau dans ce cycle</Text>}
          </Space>
        </Card>
      )}

      {/* ── Classes du niveau sélectionné ── */}
      <Table
        title={() => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>
              Classes{selectedLevel ? ` — ${selectedLevel.name}` : ''}
            </Text>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              disabled={!selectedLevel}
              onClick={openClassModal}
            >
              Nouvelle classe
            </Button>
          </div>
        )}
        dataSource={filteredClasses}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
        columns={[
          { title: 'Nom', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
          { title: 'Cycle', key: 'cycle', render: (_: any, r: any) => r.level?.cycle?.name ?? '—' },
          { title: 'Niveau', key: 'level', render: (_: any, r: any) => r.level?.name ?? '—' },
          { title: 'Élèves', key: 'count', render: (_: any, r: any) => `${r._count?.enrollments ?? 0} / ${r.maxStudents ?? 40}` },
        ]}
        locale={{ emptyText: selectedLevel ? 'Aucune classe dans ce niveau' : 'Sélectionnez un niveau' }}
      />

      {/* ── Modal Cycle ── */}
      <Modal title="Nouveau cycle" open={cycleModalOpen} onCancel={() => { setCycleModalOpen(false); cycleForm.resetFields() }} footer={null} width={380}>
        <Form form={cycleForm} layout="vertical" onFinish={handleCreateCycle} requiredMark={false}>
          <Form.Item name="name" label="Nom du cycle" rules={[{ required: true }]}>
            <Input placeholder="Ex: Maternelle, Primaire, Collège…" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setCycleModalOpen(false); cycleForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer</Button>
          </div>
        </Form>
      </Modal>

      {/* ── Modal Niveau ── */}
      <Modal
        title={`Nouveau niveau${selectedCycle ? ` — ${selectedCycle.name}` : ''}`}
        open={levelModalOpen}
        onCancel={() => { setLevelModalOpen(false); levelForm.resetFields() }}
        footer={null}
        width={380}
      >
        <Form form={levelForm} layout="vertical" onFinish={handleCreateLevel} requiredMark={false}>
          <Form.Item name="name" label="Nom du niveau" rules={[{ required: true }]}>
            <Input placeholder="Ex: 2ème Année, CE2, 6ème…" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setLevelModalOpen(false); levelForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer</Button>
          </div>
        </Form>
      </Modal>

      {/* ── Modal Classe ── */}
      <Modal
        title={`Nouvelle classe${selectedLevel ? ` — ${selectedLevel.name}` : ''}`}
        open={classModalOpen}
        onCancel={() => { setClassModalOpen(false); classForm.resetFields() }}
        footer={null}
      >
        <Form form={classForm} layout="vertical" onFinish={handleCreateClass} requiredMark={false}>
          <Form.Item name="name" label="Nom de la classe" rules={[{ required: true }]}>
            <Input placeholder={`Ex: ${selectedLevel?.name ?? 'CE2'} A`} />
          </Form.Item>
          <Form.Item name="levelId" label="Niveau" rules={[{ required: true }]}>
            <Select placeholder="Choisir un niveau">
              {cycles.map(c => ({
                label: c.name,
                options: (c.levels ?? []).map((l: any) => ({ value: l.id, label: l.name })),
              })).map(g => (
                <Select.OptGroup key={g.label} label={g.label}>
                  {g.options.map((o: any) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                </Select.OptGroup>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="academicYearId" label="Année scolaire" rules={[{ required: true }]}>
            <Select placeholder="Choisir l'année">
              {years.map(y => <Option key={y.id} value={y.id}>{y.label}{y.isCurrent ? ' (courante)' : ''}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="maxStudents" label="Capacité max" initialValue={40}>
            <Input type="number" min={1} max={200} style={{ width: 120 }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setClassModalOpen(false); classForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Onglet Matières ───────────────────────────────────────────────────────────
function SubjectsTab() {
  const message = useAppMessage()
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [classSubjects, setClassSubjects] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [csLoading, setCsLoading] = useState(false)
  const [subjectModal, setSubjectModal] = useState(false)
  const [assignModal, setAssignModal] = useState(false)
  const [subjectForm] = Form.useForm()
  const [assignForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const loadSubjects = () => {
    setLoading(true)
    Promise.all([ipc.subjects.list(), ipc.classes.list()])
      .then(([s, c]) => { setSubjects(s); setClasses(c) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadClassSubjects = (classId: string) => {
    setCsLoading(true)
    ipc.subjects.listByClass(classId)
      .then(setClassSubjects)
      .catch(() => {})
      .finally(() => setCsLoading(false))
  }

  useEffect(() => { loadSubjects() }, [])
  useEffect(() => { if (selectedClassId) loadClassSubjects(selectedClassId) }, [selectedClassId])

  const handleCreateSubject = async (values: any) => {
    setSaving(true)
    try {
      await ipc.subjects.create(values)
      message.success('Matière créée')
      setSubjectModal(false)
      subjectForm.resetFields()
      loadSubjects()
    } catch (e: any) { message.error(e.message) } finally { setSaving(false) }
  }

  const handleDeleteSubject = async (id: string) => {
    try {
      await ipc.subjects.delete(id)
      message.success('Matière supprimée')
      loadSubjects()
      if (selectedClassId) loadClassSubjects(selectedClassId)
    } catch (e: any) { message.error(e.message) }
  }

  const handleAssign = async (values: any) => {
    if (!selectedClassId) return
    setSaving(true)
    try {
      await ipc.subjects.addToClass({
        classId: selectedClassId,
        subjectId: values.subjectId,
        coefficient: Number(values.coefficient) || 1,
        hoursPerWeek: Number(values.hoursPerWeek) || 2,
      })
      message.success('Matière assignée')
      setAssignModal(false)
      assignForm.resetFields()
      loadClassSubjects(selectedClassId)
    } catch (e: any) { message.error(e.message) } finally { setSaving(false) }
  }

  const handleRemoveFromClass = async (id: string) => {
    try {
      await ipc.subjects.removeFromClass(id)
      message.success('Matière retirée')
      if (selectedClassId) loadClassSubjects(selectedClassId)
    } catch (e: any) { message.error(e.message) }
  }

  const assignedIds = new Set(classSubjects.map(cs => cs.subjectId))
  const availableSubjects = subjects.filter(s => !assignedIds.has(s.id))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
      {/* ── Matières globales ── */}
      <div>
        <Table
          title={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Matières</Text>
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setSubjectModal(true)}>
                Nouvelle matière
              </Button>
            </div>
          )}
          dataSource={subjects}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          columns={[
            { title: 'Code', dataIndex: 'code', key: 'code', width: 70, render: (v: string) => <Text code>{v}</Text> },
            { title: 'Nom', dataIndex: 'name', key: 'name' },
            {
              title: '', key: 'del', width: 40,
              render: (_: any, r: any) => (
                <Popconfirm title="Supprimer cette matière ?" onConfirm={() => handleDeleteSubject(r.id)} okText="Oui" cancelText="Non">
                  <Button size="small" type="text" danger icon={<span style={{ fontSize: 12 }}>✕</span>} />
                </Popconfirm>
              ),
            },
          ]}
          locale={{ emptyText: 'Aucune matière' }}
        />
      </div>

      {/* ── Matières par classe ── */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Matières par classe</Text>
          <Select
            style={{ width: '100%' }}
            placeholder="Sélectionner une classe…"
            onChange={(v) => setSelectedClassId(v)}
            allowClear
          >
            {classes.map((c: any) => (
              <Option key={c.id} value={c.id}>
                {c.name} {c.level ? `— ${c.level.name}` : ''}
              </Option>
            ))}
          </Select>
        </div>

        {selectedClassId && (
          <Table
            title={() => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>{classSubjects.length} matière{classSubjects.length !== 1 ? 's' : ''} assignée{classSubjects.length !== 1 ? 's' : ''}</Text>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  disabled={availableSubjects.length === 0}
                  onClick={() => setAssignModal(true)}
                >
                  Ajouter
                </Button>
              </div>
            )}
            dataSource={classSubjects}
            rowKey="id"
            loading={csLoading}
            pagination={false}
            size="small"
            columns={[
              { title: 'Matière', key: 'subject', render: (_: any, r: any) => r.subject?.name ?? '—' },
              {
                title: 'Coef', dataIndex: 'coefficient', key: 'coef', width: 60,
                render: (v: number) => <Text strong>{v}</Text>,
              },
              { title: 'H/sem', dataIndex: 'hoursPerWeek', key: 'hours', width: 60 },
              {
                title: '', key: 'del', width: 40,
                render: (_: any, r: any) => (
                  <Popconfirm title="Retirer cette matière ?" onConfirm={() => handleRemoveFromClass(r.id)} okText="Oui" cancelText="Non">
                    <Button size="small" type="text" danger icon={<span style={{ fontSize: 12 }}>✕</span>} />
                  </Popconfirm>
                ),
              },
            ]}
            locale={{ emptyText: 'Aucune matière assignée' }}
          />
        )}
      </div>

      {/* ── Modal nouvelle matière ── */}
      <Modal title="Nouvelle matière" open={subjectModal} onCancel={() => { setSubjectModal(false); subjectForm.resetFields() }} footer={null} width={380}>
        <Form form={subjectForm} layout="vertical" onFinish={handleCreateSubject} requiredMark={false}>
          <Form.Item name="code" label="Code" rules={[{ required: true }, { max: 8 }]}>
            <Input placeholder="Ex: MATH, FR, SVT" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="name" label="Nom complet" rules={[{ required: true }]}>
            <Input placeholder="Ex: Mathématiques" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setSubjectModal(false); subjectForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer</Button>
          </div>
        </Form>
      </Modal>

      {/* ── Modal assigner matière ── */}
      <Modal title="Assigner une matière" open={assignModal} onCancel={() => { setAssignModal(false); assignForm.resetFields() }} footer={null} width={400}>
        <Form form={assignForm} layout="vertical" onFinish={handleAssign} requiredMark={false}
          initialValues={{ coefficient: 1, hoursPerWeek: 2 }}>
          <Form.Item name="subjectId" label="Matière" rules={[{ required: true }]}>
            <Select placeholder="Choisir une matière">
              {availableSubjects.map(s => <Option key={s.id} value={s.id}>{s.name} ({s.code})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="coefficient" label="Coefficient">
            <Input type="number" min={0.5} max={10} step={0.5} style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="hoursPerWeek" label="Heures / semaine">
            <Input type="number" min={1} max={20} style={{ width: 100 }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setAssignModal(false); assignForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Assigner</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Onglet Sauvegarde ─────────────────────────────────────────────────────────
function BackupTab() {
  const message = useAppMessage()
  const [backups,   setBackups]   = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [autoFreq,  setAutoFreq]  = useState<'daily' | 'weekly'>('daily')
  const [lastAuto,  setLastAuto]  = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  const loadBackups = () => {
    ipc.backup.list().then(setBackups).catch(() => {}).finally(() => setLoading(false))
  }

  const loadAutoConfig = async () => {
    try {
      const cfg = await ipc.settings.getAutoBackupConfig()
      if (cfg) {
        setAutoEnabled(cfg.enabled ?? false)
        setAutoFreq(cfg.frequency ?? 'daily')
        setLastAuto(cfg.lastBackupAt ?? null)
      }
    } catch {}
  }

  useEffect(() => { loadBackups(); loadAutoConfig() }, [])

  const handleBackup = async (format: 'db' | 'zip') => {
    setSaving(true)
    try {
      const res = await ipc.backup.create(format)
      message.success(`Sauvegarde créée : ${res.filePath}`)
      loadBackups()
    } catch (e: any) {
      message.error(e.message ?? 'Erreur lors de la sauvegarde')
    } finally { setSaving(false) }
  }

  const handleSaveAutoConfig = async () => {
    try {
      await ipc.settings.setAutoBackupConfig({ enabled: autoEnabled, frequency: autoFreq })
      message.success('Configuration de sauvegarde automatique enregistrée')
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const ok = await ipc.backup.restore()
      if (ok) message.success('Base de données restaurée. Redémarrez l\'application.')
    } catch (e: any) {
      message.error(e.message)
    } finally { setRestoring(false) }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Sauvegarde manuelle */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>Sauvegarde manuelle</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Crée une copie de la base dans <strong>Documents/SGSI/backups</strong>. Copiez ensuite sur une clé USB.
        </Text>
        <Space>
          <Button type="primary" icon={<DatabaseOutlined />} loading={saving} onClick={() => handleBackup('db')}>
            Sauvegarder (.db)
          </Button>
          <Button icon={<DatabaseOutlined />} loading={saving} onClick={() => handleBackup('zip')}>
            Sauvegarder (.zip avec photos)
          </Button>
        </Space>
      </Card>

      {/* Sauvegarde automatique */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>Sauvegarde automatique</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              SGSI sauvegarde automatiquement la base de données selon la fréquence choisie.
            </Text>
          </div>
          <Switch
            checked={autoEnabled}
            onChange={setAutoEnabled}
            checkedChildren="Activée"
            unCheckedChildren="Désactivée"
          />
        </div>

        {autoEnabled && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <Text style={{ fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 600 }}>Fréquence</Text>
              <Select value={autoFreq} onChange={setAutoFreq} style={{ width: 180 }}>
                <Select.Option value="daily">Chaque jour</Select.Option>
                <Select.Option value="weekly">Chaque semaine</Select.Option>
              </Select>
            </div>
            {lastAuto && (
              <div style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Dernière sauvegarde : <strong>{dayjs(lastAuto).format('DD/MM/YYYY à HH:mm')}</strong>
                </Text>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={handleSaveAutoConfig} icon={<SaveOutlined />}>
            Enregistrer la configuration
          </Button>
        </div>

        {autoEnabled && (
          <Alert
            type="info" showIcon
            message={`La sauvegarde automatique est activée — ${autoFreq === 'daily' ? 'quotidienne' : 'hebdomadaire'}. Les sauvegardes se trouvent dans Documents/SGSI/backups.`}
            style={{ marginTop: 14, borderRadius: 8 }}
          />
        )}
      </Card>

      {/* Restauration */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0, color: '#DC2626' }}>
          <WarningOutlined style={{ marginRight: 8 }} />Restaurer une sauvegarde
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 14 }}>
          Remplace la base de données actuelle par une sauvegarde. <strong>Toutes les données non sauvegardées seront perdues.</strong>
        </Text>
        <Button danger icon={<UploadOutlined />} loading={restoring} onClick={handleRestore}>
          Choisir un fichier de sauvegarde…
        </Button>
      </Card>

      {/* Liste des sauvegardes */}
      <Table
        title={() => <Text strong>Sauvegardes disponibles</Text>}
        dataSource={backups}
        rowKey={(r: any, i?: number) => r.filePath ?? String(i ?? 0)}
        loading={loading}
        pagination={{ pageSize: 8 }}
        size="small"
        columns={[
          { title: 'Fichier', dataIndex: 'fileName', key: 'fileName', render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
          { title: 'Date', dataIndex: 'createdAt', key: 'date', width: 150, render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
          { title: 'Taille', dataIndex: 'size', key: 'size', width: 90, render: (v: number) => `${(v / 1024).toFixed(0)} KB` },
        ]}
        locale={{ emptyText: 'Aucune sauvegarde trouvée' }}
      />
    </div>
  )
}

// ─── Onglet Frais de scolarité ────────────────────────────────────────────────
function FeeTypesTab() {
  const message = useAppMessage()
  const { userId } = useAuth()
  const [feeTypes, setFeeTypes] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      ipc.payments.listFeeTypes(),
      ipc.classes.listLevels(),
    ]).then(([ft, lvl]) => {
      setFeeTypes(ft)
      setLevels(lvl)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditRecord(null)
    form.resetFields()
    form.setFieldsValue({ isRequired: true })
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditRecord(record)
    form.setFieldsValue({
      name: record.name,
      amount: record.amount,
      levelId: record.levelId ?? undefined,
      isRequired: record.isRequired,
    })
    setModalOpen(true)
  }

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      if (editRecord) {
        await ipc.payments.updateFeeType(editRecord.id, {
          name: values.name,
          amount: values.amount,
          isRequired: values.isRequired,
        }, userId ?? 'system')
        message.success('Type de frais modifié')
      } else {
        await ipc.payments.createFeeType({
          name: values.name,
          amount: values.amount,
          levelId: values.levelId ?? undefined,
          isRequired: values.isRequired ?? true,
        }, userId ?? 'system')
        message.success('Type de frais créé')
      }
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await ipc.payments.deleteFeeType(id, userId ?? 'system')
      message.success('Type de frais supprimé')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: 'Désignation',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <Text strong>{n}</Text>,
    },
    {
      title: 'Montant',
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      render: (v: number) => (
        <Text strong style={{ color: '#1E40AF' }}>
          {v.toLocaleString('fr-FR')} GNF
        </Text>
      ),
    },
    {
      title: 'Niveau',
      dataIndex: ['level', 'name'],
      key: 'level',
      width: 150,
      render: (v: string) => v
        ? <Tag color="blue">{v}</Tag>
        : <Tag color="default">Tous niveaux</Tag>,
    },
    {
      title: 'Obligatoire',
      dataIndex: 'isRequired',
      key: 'required',
      width: 110,
      render: (v: boolean) => v
        ? <Tag color="green">Oui</Tag>
        : <Tag color="default">Non</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Modifier">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm
            title="Supprimer ce type de frais ?"
            description="Cette action est irréversible si aucun paiement n'est associé."
            onConfirm={() => handleDelete(r.id)}
            okText="Supprimer"
            okType="danger"
            cancelText="Annuler"
          >
            <Button size="small" danger icon={<span style={{ fontSize: 11 }}>✕</span>} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const totalRequired = feeTypes
    .filter((f) => f.isRequired && !f.levelId)
    .reduce((s, f) => s + f.amount, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Total frais obligatoires (tous niveaux) :&nbsp;
            <Text strong style={{ color: '#1E40AF' }}>{totalRequired.toLocaleString('fr-FR')} GNF</Text>
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Nouveau type de frais
        </Button>
      </div>

      <Table
        dataSource={feeTypes}
        rowKey="id"
        loading={loading}
        columns={columns}
        pagination={false}
        size="middle"
        locale={{ emptyText: 'Aucun type de frais configuré' }}
      />

      <Modal
        title={editRecord ? 'Modifier le type de frais' : 'Nouveau type de frais'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          <Form.Item name="name" label="Désignation" rules={[{ required: true, message: 'Requis' }]}>
            <Input placeholder="ex : Frais de scolarité T1, Frais d'examen…" />
          </Form.Item>
          <Form.Item name="amount" label="Montant (GNF)" rules={[{ required: true, message: 'Requis' }]}>
            <input
              type="number"
              min={0}
              style={{
                width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9',
                borderRadius: 6, fontSize: 14, lineHeight: '22px',
              }}
              placeholder="ex : 500000"
            />
          </Form.Item>
          {!editRecord && (
            <Form.Item name="levelId" label="Niveau concerné (optionnel)">
              <Select placeholder="Tous niveaux" allowClear>
                {levels.map((l: any) => (
                  <Option key={l.id} value={l.id}>{l.name}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="isRequired" label="Frais obligatoire" valuePropName="checked">
            <Switch checkedChildren="Oui" unCheckedChildren="Non" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {editRecord ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Onglet Journal d'activité ─────────────────────────────────────────────────
function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [entities, setEntities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [entity, setEntity] = useState<string | undefined>(undefined)

  const load = (ent?: string) => {
    setLoading(true)
    ipc.auditlog.list({ entity: ent, limit: 200 })
      .then(setLogs).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    ipc.auditlog.entities().then(setEntities).catch(() => {})
    load()
  }, [])

  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'purple', LOGOUT: 'default',
  }

  const columns = [
    {
      title: 'Date / Heure',
      dataIndex: 'createdAt',
      key: 'date',
      width: 150,
      render: (v: string) => dayjs(v).format('DD/MM/YY HH:mm'),
    },
    {
      title: 'Utilisateur',
      key: 'user',
      width: 180,
      render: (_: any, r: any) => r.user
        ? <Text strong>{r.user.lastName} {r.user.firstName}</Text>
        : <Text type="secondary">Système</Text>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (v: string) => <Tag color={ACTION_COLORS[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Entité',
      dataIndex: 'entity',
      key: 'entity',
      width: 130,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 110,
      render: (v: string) => v
        ? <Text type="secondary" style={{ fontSize: 11 }}>{v.slice(0, 8)}…</Text>
        : '—',
    },
    {
      title: 'Détails',
      dataIndex: 'details',
      key: 'details',
      render: (v: string) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <Text type="secondary">Filtrer par entité :</Text>
        <Select
          value={entity}
          onChange={(val) => { setEntity(val); load(val) }}
          allowClear
          style={{ width: 200 }}
          placeholder="Toutes les entités"
        >
          {entities.map(e => <Option key={e} value={e}>{e}</Option>)}
        </Select>
        <Text type="secondary" style={{ marginLeft: 'auto' }}>
          {logs.length} entrée{logs.length !== 1 ? 's' : ''}
        </Text>
      </div>
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: false }}
        size="small"
        locale={{ emptyText: 'Aucune activité enregistrée' }}
      />
    </div>
  )
}

// ─── Onglet Modules ────────────────────────────────────────────────────────────
function ModulesTab() {
  const message = useAppMessage()
  const { enabledModules, reload } = useModules()
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!loaded && enabledModules.length > 0) {
      setSelected(enabledModules)
      setLoaded(true)
    }
  }, [enabledModules, loaded])

  const toggle = (key: string, required: boolean) => {
    if (required) return
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await ipc.settings.setModules(selected)
      reload()
      message.success('Configuration des modules sauvegardée')
    } catch (e: any) {
      message.error(e.message)
    } finally { setSaving(false) }
  }

  const CATEGORIES = [
    { label: 'Modules principaux', keys: ['students', 'grades', 'payments'] },
    { label: 'Vie scolaire', keys: ['absences', 'schedule', 'staff'] },
    { label: 'Administration', keys: ['expenses', 'reports'] },
    { label: 'Services additionnels', keys: ['library', 'infirmerie', 'transport', 'messages'] },
  ]

  return (
    <div style={{ maxWidth: 760 }}>
      <Alert
        type="info"
        message="Les modules désactivés disparaissent de la navigation. Les données ne sont pas supprimées."
        style={{ marginBottom: 20, fontSize: 13 }}
      />

      {CATEGORIES.map(cat => (
        <div key={cat.label} style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 12, color: '#374151' }}>{cat.label}</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {cat.keys.map(key => {
              const mod = ALL_MODULES.find(m => m.key === key)!
              const active = selected.includes(key)
              return (
                <div
                  key={key}
                  onClick={() => toggle(key, mod.required)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 10, cursor: mod.required ? 'default' : 'pointer',
                    border: `1.5px solid ${active ? '#1E40AF' : '#E5E7EB'}`,
                    background: active ? '#EFF6FF' : '#FAFAFA',
                    transition: 'all 0.15s',
                    opacity: mod.required ? 0.85 : 1,
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                    background: active ? '#1E40AF' : '#E5E7EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}>
                    {mod.required
                      ? <LockOutlined style={{ color: active ? '#fff' : '#9CA3AF', fontSize: 16 }} />
                      : <AppstoreOutlined style={{ color: active ? '#fff' : '#9CA3AF', fontSize: 16 }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text strong style={{ fontSize: 13, color: active ? '#1E40AF' : '#111827' }}>
                        {mod.label}
                      </Text>
                      {mod.required && (
                        <Tag style={{ fontSize: 10, padding: '0 5px', height: 16, lineHeight: '16px', borderRadius: 4 }}>
                          Requis
                        </Tag>
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{mod.description}</Text>
                  </div>
                  <Switch
                    size="small"
                    checked={active}
                    disabled={mod.required}
                    onChange={() => toggle(key, mod.required)}
                    onClick={(_, e) => e.stopPropagation()}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} size="large">
          Enregistrer la configuration
        </Button>
      </div>
    </div>
  )
}

// ─── Onglet Licence ────────────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  PROFESSIONAL: 'Professionnel',
  ULTIMATE: 'Ultimate',
}
const PLAN_COLORS: Record<string, string> = {
  STANDARD: 'blue',
  PROFESSIONAL: 'purple',
  ULTIMATE: 'gold',
}

function LicenseTab() {
  const message    = useAppMessage()
  const [info,     setInfo]       = useState<any>(null)
  const [loading,  setLoading]    = useState(true)
  const [activating, setActivating] = useState(false)
  const [key,      setKey]        = useState('')

  const load = () => {
    setLoading(true)
    ipc.license.get()
      .then(res => setInfo(res))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleActivate = async () => {
    if (!key.trim()) { message.error('Entrez une clé de licence'); return }
    setActivating(true)
    try {
      await ipc.license.activate(key.trim())
      message.success('Licence activée avec succès !')
      setKey('')
      load()
    } catch (e: any) {
      message.error(e.message ?? "Erreur d'activation")
    } finally { setActivating(false) }
  }

  // Extraction des données depuis la nouvelle structure { db, cache, validity }
  const lic      = info?.db ?? info?.cache ?? null
  const validity = info?.validity ?? null
  const isValid  = validity?.valid ?? (lic?.isActive ?? false)
  const isExpired = lic?.expiresAt ? new Date() > new Date(lic.expiresAt) : false
  const isGrace  = validity?.source === 'grace'

  const SOURCE_LABELS: Record<string, string> = {
    server: 'Validée en ligne',
    grace:  `Mode hors-ligne (${validity?.daysLeft ?? '?'} jour(s) restant(s))`,
    cache:  'Cache local',
    db:     'Base locale',
  }

  const statusBadge = () => {
    if (!lic) return <Badge status="default" text="Non configurée" />
    if (!isValid) {
      if (isExpired)       return <Badge status="error"   text="Expirée" />
      if (validity?.reason) return <Badge status="error"   text={validity.reason} />
      return                      <Badge status="warning" text="Désactivée" />
    }
    if (isGrace) return <Badge status="warning" text={SOURCE_LABELS.grace} />
    return              <Badge status="success" text="Active" />
  }

  return (
    <div style={{ maxWidth: 680 }}>

      {/* ── Statut ── */}
      <Card loading={loading} style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <SafetyCertificateOutlined style={{ color: isValid ? '#16A34A' : isGrace ? '#D97706' : '#DC2626' }} />
          Statut de la licence
        </Title>

        {!lic ? (
          <Alert
            type="warning"
            showIcon
            message="Aucune licence active"
            description="Activez une clé de licence pour utiliser toutes les fonctionnalités."
            style={{ marginBottom: 0, borderRadius: 8 }}
          />
        ) : (
          <>
            {/* Alerte grace period */}
            {isGrace && (
              <Alert
                type="warning" showIcon
                message={`Mode hors-ligne — ${validity?.daysLeft ?? '?'} jour(s) avant expiration`}
                description="Connectez-vous à Internet pour re-valider votre licence."
                style={{ marginBottom: 16, borderRadius: 8 }}
              />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', fontSize: 13, alignItems: 'center' }}>
              <Text type="secondary">Statut</Text>
              {statusBadge()}

              <Text type="secondary">Plan</Text>
              <Tag color={PLAN_COLORS[lic.plan] ?? 'default'} style={{ fontWeight: 600 }}>
                {PLAN_LABELS[lic.plan] ?? lic.plan ?? '—'}
              </Tag>

              <Text type="secondary">École</Text>
              <Text strong>{lic.schoolName || '—'}</Text>

              <Text type="secondary">Clé</Text>
              <Text code style={{ fontSize: 12, letterSpacing: 1 }}>{lic.key}</Text>

              <Text type="secondary">Élèves max.</Text>
              <Text strong>{(lic.maxStudents ?? 0).toLocaleString()} élèves</Text>

              <Text type="secondary">Activée le</Text>
              <Text>{lic.issuedAt ? dayjs(lic.issuedAt).format('DD/MM/YYYY') : '—'}</Text>

              <Text type="secondary">Expiration</Text>
              <Text style={{ color: isExpired ? '#DC2626' : undefined }}>
                {lic.expiresAt ? dayjs(lic.expiresAt).format('DD/MM/YYYY') : 'Illimitée'}
              </Text>

              {validity?.source && !isGrace && (
                <>
                  <Text type="secondary">Source</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {SOURCE_LABELS[validity.source] ?? validity.source}
                  </Text>
                </>
              )}
            </div>
          </>
        )}
      </Card>

      {/* ── Activation ── */}
      <Card>
        <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
          {lic ? 'Renouveler / Changer de licence' : 'Activer une licence'}
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          Entrez la clé fournie par votre distributeur SGSI.
          Format : <Text code style={{ fontSize: 12 }}>SGSI-PRO-XXXXXX-2027</Text>
        </Text>

        <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
          <Input
            placeholder="SGSI-STD-XXXXXX-2027"
            value={key}
            onChange={e => setKey(e.target.value.toUpperCase())}
            onPressEnter={handleActivate}
            style={{ fontFamily: 'monospace', letterSpacing: 1, fontSize: 14 }}
            maxLength={32}
            prefix={<KeyOutlined style={{ color: '#6B7280' }} />}
          />
          <Button
            type="primary"
            loading={activating}
            onClick={handleActivate}
            icon={<SafetyCertificateOutlined />}
          >
            Activer
          </Button>
        </Space.Compact>

        <div style={{
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12,
        }}>
          <Text strong style={{ color: '#6366F1', display: 'block', marginBottom: 4 }}>
            Plans disponibles
          </Text>
          {[
            { plan: 'STD', label: 'Standard',     max: '500',   color: 'default' },
            { plan: 'PRO', label: 'Professionnel', max: '2 000', color: 'blue'   },
            { plan: 'ULT', label: 'Ultimate',      max: 'Illimité', color: 'gold' },
          ].map(p => (
            <div key={p.plan} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text type="secondary"><Tag color={p.color} style={{ fontSize: 10 }}>{p.plan}</Tag> {p.label}</Text>
              <Text type="secondary">{p.max} élèves</Text>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Onglet Programme par niveau ───────────────────────────────────────────────
function ProgrammeTab() {
  const message = useAppMessage()
  const [cycles, setCycles] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [levelSubjects, setLevelSubjects] = useState<any[]>([])
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [addForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lsRef = useRef<any[]>([])
  lsRef.current = levelSubjects

  useEffect(() => {
    Promise.all([ipc.classes.listCycles(), ipc.subjects.list()])
      .then(([c, s]) => { setCycles(c); setSubjects(s) })
      .catch(() => {})
  }, [])

  const loadLevelSubjects = (levelId: string) => {
    setLoading(true)
    ipc.subjects.listByLevel(levelId)
      .then(setLevelSubjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (selectedLevelId) loadLevelSubjects(selectedLevelId)
    else setLevelSubjects([])
  }, [selectedLevelId])

  const handleChange = (rowId: string, field: 'coefficient' | 'hoursPerWeek', val: number) => {
    setLevelSubjects(prev => prev.map(ls => ls.id === rowId ? { ...ls, [field]: val } : ls))
    clearTimeout(saveTimers.current[rowId])
    saveTimers.current[rowId] = setTimeout(async () => {
      const latest = lsRef.current.find(ls => ls.id === rowId)
      if (!latest) return
      try {
        await ipc.subjects.setForLevel({
          levelId: latest.levelId,
          subjectId: latest.subjectId,
          coefficient: latest.coefficient,
          hoursPerWeek: latest.hoursPerWeek,
        })
      } catch (e: any) { message.error('Erreur : ' + e.message) }
    }, 600)
  }

  const handleRemove = async (id: string) => {
    try {
      await ipc.subjects.removeFromLevel(id)
      setLevelSubjects(prev => prev.filter(ls => ls.id !== id))
      message.success('Matière retirée du niveau')
    } catch (e: any) { message.error(e.message) }
  }

  const handleAdd = async (values: any) => {
    if (!selectedLevelId) return
    setSaving(true)
    try {
      await ipc.subjects.setForLevel({
        levelId: selectedLevelId,
        subjectId: values.subjectId,
        coefficient: Number(values.coefficient) || 1,
        hoursPerWeek: Number(values.hoursPerWeek) || 2,
      })
      setAddModal(false)
      addForm.resetFields()
      loadLevelSubjects(selectedLevelId)
      message.success('Matière ajoutée au programme')
    } catch (e: any) { message.error(e.message) } finally { setSaving(false) }
  }

  const handleApply = async () => {
    if (!selectedLevelId) return
    setApplying(true)
    try {
      const res = await ipc.subjects.applyLevelToClasses(selectedLevelId)
      message.success(`${res.updated} coefficient(s) mis à jour dans ${res.classes} classe(s)`)
    } catch (e: any) { message.error(e.message) } finally { setApplying(false) }
  }

  const assignedIds = new Set(levelSubjects.map(ls => ls.subjectId))
  const availableSubjects = subjects.filter((s: any) => !assignedIds.has(s.id))
  const selectedLevel = cycles.flatMap((c: any) => c.levels ?? []).find((l: any) => l.id === selectedLevelId)

  return (
    <div>
      {/* Sélecteur de niveau */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Text strong>Niveau :</Text>
        <Select
          placeholder="Choisir un niveau…"
          style={{ width: 260 }}
          onChange={(v) => setSelectedLevelId(v ?? null)}
          allowClear
        >
          {cycles.map((c: any) => (
            <Select.OptGroup key={c.id} label={c.name}>
              {(c.levels ?? []).map((l: any) => (
                <Option key={l.id} value={l.id}>{l.name}</Option>
              ))}
            </Select.OptGroup>
          ))}
        </Select>
        {selectedLevelId && levelSubjects.length > 0 && (
          <Tooltip title="Propage ces coefficients vers toutes les classes existantes de ce niveau">
            <Button type="primary" loading={applying} onClick={handleApply}>
              Appliquer aux classes
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Tableau du programme */}
      <Table
        title={() => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>
              {selectedLevel
                ? `${selectedLevel.name} — ${levelSubjects.length} matière${levelSubjects.length !== 1 ? 's' : ''}`
                : 'Sélectionnez un niveau pour configurer son programme'
              }
            </Text>
            {selectedLevelId && (
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                disabled={availableSubjects.length === 0}
                onClick={() => setAddModal(true)}
              >
                Ajouter une matière
              </Button>
            )}
          </div>
        )}
        dataSource={levelSubjects}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        columns={[
          {
            title: '#',
            key: 'idx',
            width: 36,
            render: (_: any, __: any, i: number) => <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text>,
          },
          {
            title: 'Matière',
            key: 'subject',
            render: (_: any, r: any) => (
              <Space>
                <Text code style={{ fontSize: 11 }}>{r.subject?.code}</Text>
                <Text strong>{r.subject?.name}</Text>
              </Space>
            ),
          },
          {
            title: 'Coefficient',
            key: 'coefficient',
            width: 150,
            render: (_: any, r: any) => (
              <InputNumber
                min={0.5} max={20} step={0.5} precision={1}
                value={r.coefficient}
                style={{ width: 95 }}
                onChange={(val) => { if (val !== null) handleChange(r.id, 'coefficient', val) }}
              />
            ),
          },
          {
            title: 'H / semaine',
            key: 'hours',
            width: 130,
            render: (_: any, r: any) => (
              <InputNumber
                min={1} max={40} step={1} precision={0}
                value={r.hoursPerWeek}
                style={{ width: 85 }}
                onChange={(val) => { if (val !== null) handleChange(r.id, 'hoursPerWeek', val) }}
              />
            ),
          },
          {
            title: '',
            key: 'del',
            width: 50,
            render: (_: any, r: any) => (
              <Popconfirm
                title="Retirer cette matière du programme ?"
                onConfirm={() => handleRemove(r.id)}
                okText="Oui"
                cancelText="Non"
              >
                <Button size="small" type="text" danger icon={<span style={{ fontSize: 12 }}>✕</span>} />
              </Popconfirm>
            ),
          },
        ]}
        locale={{
          emptyText: selectedLevelId
            ? 'Aucune matière configurée — cliquez sur "Ajouter une matière"'
            : 'Sélectionnez un niveau pour configurer son programme',
        }}
      />

      {/* Modal ajouter une matière */}
      <Modal
        title={`Ajouter une matière — ${selectedLevel?.name ?? '…'}`}
        open={addModal}
        onCancel={() => { setAddModal(false); addForm.resetFields() }}
        footer={null}
        width={420}
      >
        <Form form={addForm} layout="vertical" onFinish={handleAdd} requiredMark={false}
          initialValues={{ coefficient: 1, hoursPerWeek: 2 }}>
          <Form.Item name="subjectId" label="Matière" rules={[{ required: true, message: 'Choisissez une matière' }]}>
            <Select placeholder="Choisir une matière" showSearch optionFilterProp="children">
              {availableSubjects.map((s: any) => (
                <Option key={s.id} value={s.id}>
                  {s.name} <Text type="secondary" style={{ fontSize: 11 }}>({s.code})</Text>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="coefficient" label="Coefficient">
            <InputNumber min={0.5} max={20} step={0.5} precision={1} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="hoursPerWeek" label="Heures / semaine">
            <InputNumber min={1} max={40} step={1} precision={0} style={{ width: 120 }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onClick={() => { setAddModal(false); addForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Ajouter</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Onglet Appréciations ──────────────────────────────────────────────────────
function AppreciationTab() {
  const message = useAppMessage()
  const [ranges, setRanges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setRanges(await ipc.appreciation.getRanges()) }
    catch (e: any) { message.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const update = (index: number, field: string, value: any) => {
    setRanges(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const handleSave = async () => {
    // Validate: ranges should cover 0-20 without major gaps
    setSaving(true)
    try {
      await ipc.appreciation.saveRanges(ranges)
      message.success('Appréciations sauvegardées')
    } catch (e: any) { message.error(e.message) }
    finally { setSaving(false) }
  }

  const handleReset = async () => {
    try {
      const defaults = await ipc.appreciation.reset()
      setRanges(defaults)
      message.success('Appréciations remises aux valeurs par défaut')
    } catch (e: any) { message.error(e.message) }
  }

  const SWATCH_COLORS = ['#059669','#10B981','#3B82F6','#6366F1','#F59E0B','#DC2626','#7C3AED','#0EA5E9']

  return (
    <div>
      <Alert
        type="info" showIcon
        message="Configurez les plages de notes et leurs appréciations correspondantes. Ces appréciations seront utilisées lors de la génération des bulletins."
        style={{ borderRadius: 10, marginBottom: 20, fontSize: 12 }}
      />

      {loading ? <Spin /> : (
        <>
          <Table
            dataSource={ranges}
            rowKey={(r, i) => String(i)}
            size="small"
            pagination={false}
            columns={[
              {
                title: 'Note minimum', dataIndex: 'min', key: 'min', width: 140,
                render: (v: number, _: any, i: number) => (
                  <InputNumber
                    value={v} min={0} max={20} step={0.5}
                    style={{ width: '100%' }}
                    onChange={val => update(i, 'min', val)}
                  />
                ),
              },
              {
                title: 'Note maximum', dataIndex: 'max', key: 'max', width: 140,
                render: (v: number, _: any, i: number) => (
                  <InputNumber
                    value={v} min={0} max={20} step={0.5}
                    style={{ width: '100%' }}
                    onChange={val => update(i, 'max', val)}
                  />
                ),
              },
              {
                title: 'Appréciation', dataIndex: 'label', key: 'label',
                render: (v: string, _: any, i: number) => (
                  <Input
                    value={v}
                    onChange={e => update(i, 'label', e.target.value)}
                    placeholder="Ex: Très Bien"
                  />
                ),
              },
              {
                title: 'Couleur', dataIndex: 'color', key: 'color', width: 160,
                render: (v: string, _: any, i: number) => (
                  <Select
                    value={v}
                    onChange={val => update(i, 'color', val)}
                    style={{ width: '100%' }}
                  >
                    {SWATCH_COLORS.map(c => (
                      <Select.Option key={c} value={c}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 14, height: 14, borderRadius: 3, background: c, display: 'inline-block' }} />
                          {c}
                        </span>
                      </Select.Option>
                    ))}
                  </Select>
                ),
              },
              {
                title: 'Aperçu', key: 'preview', width: 120,
                render: (_: any, r: any) => (
                  <Tag style={{
                    background: `${r.color}18`, color: r.color,
                    border: 'none', borderRadius: 20, fontWeight: 600,
                  }}>
                    {r.label}
                  </Tag>
                ),
              },
            ]}
          />

          <Space style={{ marginTop: 16 }}>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              Enregistrer
            </Button>
            <Button onClick={handleReset}>Remettre par défaut</Button>
          </Space>

          <Divider />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Exemple : note de 16.50 → se situe entre 16.00 et 17.99 → reçoit l'appréciation "Très Bien"
          </Text>
        </>
      )}
    </div>
  )
}

// ─── Onglet Email (Resend) ─────────────────────────────────────────────────────
function ResendTab() {
  const message   = useAppMessage()
  const [form]    = Form.useForm()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    ipc.settings.getResendConfig()
      .then(cfg => {
        if (cfg) {
          form.setFieldsValue(cfg)
          setConfigured(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.setResendConfig(values)
      setConfigured(true)
      message.success('Configuration Resend enregistrée')
    } catch (e: any) { message.error(e.message) }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
    if (!testEmail) return message.warning('Entrez un email de test')
    setTesting(true)
    try {
      const result = await ipc.settings.testResend(testEmail)
      message.success(`Email envoyé avec succès ! (ID: ${result.id})`)
    } catch (e: any) { message.error(e.message) }
    finally { setTesting(false) }
  }

  if (loading) return <Spin />

  return (
    <div style={{ maxWidth: 560 }}>
      <Alert
        type="info" showIcon
        message={
          <span>
            Configuration de <strong>Brevo.com</strong> pour l'envoi automatique des identifiants aux enseignants.
            300 emails/jour gratuits · Envoi depuis Gmail possible.
            {' '}<a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
              Obtenir une clé API →
            </a>
          </span>
        }
        style={{ borderRadius: 10, marginBottom: 24, fontSize: 13 }}
      />

      <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
        <Form.Item
          name="apiKey"
          label={<span style={{ fontWeight: 600 }}>Clé API Resend</span>}
          rules={[{ required: true, message: 'La clé API est requise' }]}
          extra={<span style={{ fontSize: 11, color: '#6B7280' }}>Commence par <code>re_</code> — disponible sur resend.com/api-keys</span>}
        >
          <Input.Password
            placeholder="re_••••••••••••••••••••••••"
            autoComplete="off"
          />
        </Form.Item>

        <Divider orientation="left" style={{ fontSize: 12, color: '#6B7280' }}>Expéditeur</Divider>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="fromName" label="Nom de l'expéditeur" rules={[{ required: true }]}>
              <Input placeholder="Ex: SGSI — Lycée Excellence" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="fromEmail"
              label="Email expéditeur"
              rules={[{ required: true, type: 'email', message: 'Email invalide' }]}
              extra={<span style={{ fontSize: 11, color: '#6B7280' }}>Doit être un domaine vérifié sur Resend</span>}
            >
              <Input placeholder="noreply@votre-ecole.com" />
            </Form.Item>
          </Col>
        </Row>

        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
          Enregistrer la configuration
        </Button>
      </Form>

      {configured && (
        <>
          <Divider />
          <div>
            <Title level={5} style={{ marginBottom: 12 }}>Tester l'envoi</Title>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Votre email de test"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                type="email"
                style={{ flex: 1 }}
              />
              <Button loading={testing} icon={<CheckOutlined />} onClick={handleTest}>
                Envoyer un test
              </Button>
            </Space.Compact>
          </div>
        </>
      )}

      <Divider />

      <Alert
        type="success" showIcon
        message="Fonctionnement automatique"
        description={
          <ul style={{ margin: '6px 0', paddingLeft: 18, fontSize: 12, lineHeight: 2 }}>
            <li>Lors de la création d'un enseignant avec un email renseigné, un email est automatiquement envoyé avec ses identifiants et son mot de passe temporaire.</li>
            <li>L'email contient le nom de l'école, l'identifiant, le mot de passe et les instructions de première connexion.</li>
            <li>Si Resend n'est pas configuré ou si l'enseignant n'a pas d'email, le compte est créé normalement sans envoi.</li>
          </ul>
        }
        style={{ borderRadius: 10, fontSize: 12 }}
      />
    </div>
  )
}

// ─── Onglet Mises à jour ───────────────────────────────────────────────────────
function UpdateTab() {
  const [status, setStatus]     = useState<'idle'|'checking'|'available'|'downloading'|'ready'|'uptodate'|'error'>('idle')
  const [version, setVersion]   = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [errMsg, setErrMsg]     = useState<string | null>(null)
  const appVersion = (window as any).__APP_VERSION__ ?? '1.0.x'

  useEffect(() => {
    const electron = (window as any).electron
    if (!electron?.ipc) return
    const onAvailable  = (_: any, d: any) => { setStatus('available'); setVersion(d.version) }
    const onProgress   = (_: any, d: any) => { setStatus('downloading'); setProgress(d.percent) }
    const onReady      = (_: any, d: any) => { setStatus('ready'); setVersion(d.version) }
    const onNotAvail   = () => setStatus('uptodate')
    const onError      = (_: any, msg: string) => { setStatus('error'); setErrMsg(msg) }
    electron.ipc.on('update:available',     onAvailable)
    electron.ipc.on('update:progress',      onProgress)
    electron.ipc.on('update:ready',         onReady)
    electron.ipc.on('update:not-available', onNotAvail)
    electron.ipc.on('update:error',         onError)
    return () => {
      electron.ipc.removeListener?.('update:available',     onAvailable)
      electron.ipc.removeListener?.('update:progress',      onProgress)
      electron.ipc.removeListener?.('update:ready',         onReady)
      electron.ipc.removeListener?.('update:not-available', onNotAvail)
      electron.ipc.removeListener?.('update:error',         onError)
    }
  }, [])

  const handleCheck = () => {
    setStatus('checking'); setErrMsg(null)
    const electron = (window as any).electron
    electron?.ipc?.invoke('update:check').catch(() => setStatus('error'))
  }

  const handleDownload = () => {
    setStatus('downloading')
    const electron = (window as any).electron
    electron?.ipc?.invoke('update:download')
  }

  const handleInstall = () => {
    const electron = (window as any).electron
    electron?.ipc?.invoke('update:install')
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Title level={4}>Mises a jour</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong>Version installee</Text>
              <br />
              <Tag color="blue" style={{ marginTop: 4 }}>v{appVersion}</Tag>
            </div>
            <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
          </div>

          {status === 'idle' && (
            <Button type="primary" icon={<CloudDownloadOutlined />} onClick={handleCheck}>
              Verifier les mises a jour
            </Button>
          )}
          {status === 'checking' && <Button loading>Verification en cours...</Button>}
          {status === 'uptodate' && (
            <Alert type="success" message="Vous avez la derniere version" showIcon
              action={<Button size="small" onClick={handleCheck}>Re-verifier</Button>} />
          )}
          {status === 'available' && (
            <Alert type="info" showIcon
              message={`Version ${version} disponible`}
              description="Une nouvelle version est disponible. Telechargez-la maintenant."
              action={<Button type="primary" size="small" onClick={handleDownload}>Telecharger</Button>}
            />
          )}
          {status === 'downloading' && (
            <Alert type="info" showIcon message={`Telechargement : ${progress}%`}
              description={<div style={{ background: '#e6f7ff', height: 8, borderRadius: 4, marginTop: 8 }}>
                <div style={{ background: '#1677ff', width: `${progress}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>}
            />
          )}
          {status === 'ready' && (
            <Alert type="success" showIcon
              message={`Version ${version} prete a installer`}
              description="La mise a jour est telechargee. Redemarrez l'application pour l'installer."
              action={<Button type="primary" size="small" onClick={handleInstall}>Redemarrer et installer</Button>}
            />
          )}
          {status === 'error' && (
            <Alert type="error" showIcon message="Erreur lors de la verification"
              description={errMsg ?? 'Verifiez votre connexion internet.'}
              action={<Button size="small" onClick={handleCheck}>Reessayer</Button>}
            />
          )}
        </Space>
      </Card>

      <Text type="secondary" style={{ fontSize: 12 }}>
        Les mises a jour sont verifiees automatiquement au demarrage de l'application.
      </Text>
    </div>
  )
}

// ─── Page principale — Navigation verticale gauche (Stripe style) ─────────────
const SETTINGS_NAV: Array<{
  group: string
  items: Array<{ key: string; icon: React.ReactNode; label: string; subtitle: string }>
}> = [
  {
    group: 'École',
    items: [
      { key: 'school',      icon: <BankOutlined />,         label: 'Établissement',    subtitle: 'Nom, logo, adresse, contacts' },
      { key: 'years',       icon: <CalendarOutlined />,     label: 'Années scolaires', subtitle: 'Années académiques actives' },
      { key: 'classes',     icon: <TeamOutlined />,         label: 'Classes & Niveaux',subtitle: 'Structure pédagogique' },
      { key: 'subjects',    icon: <BookOutlined />,          label: 'Matières',         subtitle: 'Matières et coefficients' },
      { key: 'programme',   icon: <ReadOutlined />,         label: 'Programme',        subtitle: 'Contenus et objectifs' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { key: 'feeTypes',    icon: <DollarOutlined />,       label: 'Frais scolaires',  subtitle: 'Types de frais et montants' },
    ],
  },
  {
    group: 'Pédagogie',
    items: [
      { key: 'appreciation',icon: <StarOutlined />,         label: 'Appréciations',    subtitle: 'Plages de notes' },
    ],
  },
  {
    group: 'Gestion',
    items: [
      { key: 'users',       icon: <UserAddOutlined />,      label: 'Utilisateurs',     subtitle: 'Comptes et rôles' },
      { key: 'modules',     icon: <AppstoreOutlined />,     label: 'Modules',          subtitle: 'Fonctionnalités actives' },
      { key: 'email',       icon: <MailOutlined />,         label: 'Email (Brevo)',    subtitle: 'Envoi automatique' },
    ],
  },
  {
    group: 'Système',
    items: [
      { key: 'backup',       icon: <CloudDownloadOutlined />,        label: 'Sauvegarde',        subtitle: 'Backup et restauration' },
      { key: 'license',      icon: <SafetyCertificateOutlined />,    label: 'Licence',           subtitle: 'Informations de licence' },
      { key: 'auditlog',     icon: <HistoryOutlined />,              label: "Journal",            subtitle: 'Historique des actions' },
      { key: 'updates',      icon: <CloudDownloadOutlined />,        label: 'Mises a jour',      subtitle: 'Version et mises a jour' },
    ],
  },
]

const SETTINGS_CONTENT: Record<string, React.ReactNode> = {
  school:       <SchoolTab />,
  users:        <UsersTab />,
  years:        <AcademicYearsTab />,
  classes:      <ClassesTab />,
  subjects:     <SubjectsTab />,
  programme:    <ProgrammeTab />,
  feeTypes:     <FeeTypesTab />,
  modules:      <ModulesTab />,
  appreciation: <AppreciationTab />,
  email:        <ResendTab />,
  backup:       <BackupTab />,
  license:      <LicenseTab />,
  auditlog:     <AuditLogTab />,
  updates:      <UpdateTab />,
}

export function SettingsPage() {
  const [active, setActive] = useState('school')
  const { token } = theme.useToken()
  const themeMode = useSelector((s: any) => s.ui.theme)
  const isDark    = themeMode === 'dark'

  const activeItem = SETTINGS_NAV.flatMap(g => g.items).find(i => i.key === active)

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration de l'établissement" />

      <div style={{
        display: 'flex',
        background: token.colorBgContainer,
        borderRadius: 16,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden',
        minHeight: '72vh',
      }}>
        {/* ── Sidebar gauche ─────────────────────────────── */}
        <div style={{
          width: 230,
          flexShrink: 0,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          background: isDark ? 'rgba(0,0,0,0.12)' : '#F8FAFC',
          padding: '20px 10px 20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {SETTINGS_NAV.map((group, gi) => (
            <div key={gi}>
              {/* Group header */}
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: token.colorTextTertiary,
                padding: gi === 0 ? '0 10px 6px' : '14px 10px 6px',
                fontFamily: "'Inter', sans-serif",
              }}>
                {group.group}
              </div>

              {/* Nav items */}
              {group.items.map(item => {
                const isActive = active === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => setActive(item.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      letterSpacing: '-0.01em',
                      background: isActive
                        ? (isDark ? 'rgba(99,102,241,0.18)' : '#EEF2FF')
                        : 'transparent',
                      color: isActive
                        ? (isDark ? '#A5B4FC' : '#3730A3')
                        : token.colorTextSecondary,
                      transition: 'all 140ms cubic-bezier(0.16,1,0.3,1)',
                      marginBottom: 1,
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F1F0FF'
                        ;(e.currentTarget as HTMLButtonElement).style.color = token.colorText as string
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLButtonElement).style.color = token.colorTextSecondary as string
                      }
                    }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span style={{
                        position: 'absolute',
                        left: 0, top: '50%',
                        transform: 'translateY(-50%)',
                        width: 3, height: 18,
                        background: isDark ? '#818CF8' : '#6366F1',
                        borderRadius: '0 3px 3px 0',
                      }} />
                    )}
                    {/* Icon */}
                    <span style={{
                      fontSize: 14,
                      color: isActive ? (isDark ? '#818CF8' : '#6366F1') : token.colorTextTertiary,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'color 140ms',
                    }}>
                      {item.icon}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* ── Zone de contenu ────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* En-tête de section */}
          <div style={{
            padding: '22px 32px 18px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isDark ? '#818CF8' : '#6366F1', fontSize: 16, flexShrink: 0,
            }}>
              {activeItem?.icon}
            </div>
            <div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: token.colorText,
                fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.2,
              }}>
                {activeItem?.label}
              </div>
              <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 2 }}>
                {activeItem?.subtitle}
              </div>
            </div>
          </div>

          {/* Contenu scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 32px' }}>
            {SETTINGS_CONTENT[active]}
          </div>
        </div>
      </div>
    </div>
  )
}
