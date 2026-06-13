import { useEffect, useState } from 'react'
import {
  Tabs, Form, Input, Button, Table, Tag, Modal, Select,
  Card, Space, message, Popconfirm, Typography, Alert,
  DatePicker, Switch, Tooltip, Badge,
} from 'antd'
import {
  UserAddOutlined, EditOutlined, KeyOutlined, PlusOutlined,
  SaveOutlined, DatabaseOutlined, UploadOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
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

// ─── Onglet Établissement ──────────────────────────────────────────────────────
function SchoolTab() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ipc.settings.getSchool().then((s) => { form.setFieldsValue(s); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.updateSchool(values)
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

        <Title level={5}>Paramètres pédagogiques</Title>

        <Form.Item name="passingAverage" label="Moyenne de passage (/20)">
          <Input type="number" min={0} max={20} step={0.5} style={{ width: 120 }} addonAfter="/20" />
        </Form.Item>

        <Form.Item name="eliminatoryThreshold" label="Note éliminatoire (/20)">
          <Input type="number" min={0} max={20} step={0.5} style={{ width: 120 }} addonAfter="/20" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
          Enregistrer
        </Button>
      </Form>
    </Card>
  )
}

// ─── Onglet Utilisateurs ───────────────────────────────────────────────────────
function UsersTab() {
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
  const [levels, setLevels] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [years, setYears] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [levelModalOpen, setLevelModalOpen] = useState(false)
  const [classForm] = Form.useForm()
  const [levelForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [l, c, y] = await Promise.all([
        ipc.classes.listLevels(),
        ipc.classes.list(),
        ipc.settings.listAcademicYears(),
      ])
      setLevels(l); setClasses(c); setYears(y)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreateClass = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.createClass(values)
      message.success('Classe créée')
      setClassModalOpen(false)
      classForm.resetFields()
      load()
    } catch (e: any) { message.error(e.message) } finally { setSaving(false) }
  }

  const handleCreateLevel = async (values: any) => {
    setSaving(true)
    try {
      await ipc.settings.createLevel({ name: values.name, order: levels.length + 1 })
      message.success('Niveau créé')
      setLevelModalOpen(false)
      levelForm.resetFields()
      load()
    } catch (e: any) { message.error(e.message) } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} onClick={() => setLevelModalOpen(true)}>Nouveau niveau</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setClassModalOpen(true)}>Nouvelle classe</Button>
      </div>

      <Card title="Niveaux" size="small" style={{ marginBottom: 16 }} loading={loading}>
        <Space wrap>
          {levels.map((l) => <Tag key={l.id} style={{ padding: '4px 12px', fontSize: 13 }}>{l.name}</Tag>)}
          {levels.length === 0 && <Text type="secondary">Aucun niveau créé</Text>}
        </Space>
      </Card>

      <Table
        title={() => <Text strong>Classes</Text>}
        dataSource={classes}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
        columns={[
          { title: 'Nom', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
          { title: 'Niveau', key: 'level', render: (_: any, r: any) => r.level?.name ?? '—' },
          { title: 'Élèves', key: 'count', render: (_: any, r: any) => `${r._count?.enrollments ?? 0} / ${r.maxStudents ?? 50}` },
        ]}
        locale={{ emptyText: 'Aucune classe créée' }}
      />

      {/* Modal classe */}
      <Modal title="Nouvelle classe" open={classModalOpen} onCancel={() => { setClassModalOpen(false); classForm.resetFields() }} footer={null}>
        <Form form={classForm} layout="vertical" onFinish={handleCreateClass} requiredMark={false}>
          <Form.Item name="name" label="Nom de la classe" rules={[{ required: true }]}>
            <Input placeholder="Ex: 6ème A" />
          </Form.Item>
          <Form.Item name="levelId" label="Niveau" rules={[{ required: true }]}>
            <Select placeholder="Choisir un niveau">
              {levels.map((l) => <Option key={l.id} value={l.id}>{l.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="academicYearId" label="Année scolaire" rules={[{ required: true }]}>
            <Select placeholder="Choisir l'année">
              {years.map((y) => <Option key={y.id} value={y.id}>{y.label}{y.isCurrent ? ' (courante)' : ''}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="maxStudents" label="Capacité max">
            <Input type="number" min={1} max={100} defaultValue={50} style={{ width: 120 }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setClassModalOpen(false); classForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer</Button>
          </div>
        </Form>
      </Modal>

      {/* Modal niveau */}
      <Modal title="Nouveau niveau" open={levelModalOpen} onCancel={() => { setLevelModalOpen(false); levelForm.resetFields() }} footer={null} width={380}>
        <Form form={levelForm} layout="vertical" onFinish={handleCreateLevel} requiredMark={false}>
          <Form.Item name="name" label="Nom du niveau" rules={[{ required: true }]}>
            <Input placeholder="Ex: 6ème, 5ème, Terminale…" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setLevelModalOpen(false); levelForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Créer</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─── Onglet Sauvegarde ─────────────────────────────────────────────────────────
function BackupTab() {
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadBackups = () => {
    ipc.backup.list().then(setBackups).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { loadBackups() }, [])

  const handleBackup = async (format: 'db' | 'zip') => {
    setSaving(true)
    try {
      const res = await ipc.backup.create(format)
      message.success(`Sauvegarde créée : ${res.filePath}`)
      loadBackups()
    } catch (e: any) {
      message.error(e.message ?? 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0 }}>Créer une sauvegarde</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          La sauvegarde copie la base de données dans le dossier Documents/SGSI/backups.
          Copiez ensuite ce fichier sur une clé USB ou un disque externe.
        </Text>
        <Space>
          <Button
            type="primary"
            icon={<DatabaseOutlined />}
            loading={saving}
            onClick={() => handleBackup('db')}
          >
            Sauvegarder (.db)
          </Button>
          <Button
            icon={<DatabaseOutlined />}
            loading={saving}
            onClick={() => handleBackup('zip')}
          >
            Sauvegarder (.zip)
          </Button>
        </Space>
      </Card>

      <Table
        title={() => <Text strong>Sauvegardes existantes</Text>}
        dataSource={backups}
        rowKey="filePath"
        loading={loading}
        pagination={false}
        size="small"
        columns={[
          { title: 'Fichier', dataIndex: 'fileName', key: 'fileName' },
          { title: 'Date', dataIndex: 'createdAt', key: 'date', render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
          { title: 'Taille', dataIndex: 'size', key: 'size', render: (v: number) => `${(v / 1024).toFixed(0)} KB` },
        ]}
        locale={{ emptyText: 'Aucune sauvegarde' }}
      />
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export function SettingsPage() {
  const items = [
    { key: 'school', label: 'Établissement', children: <SchoolTab /> },
    { key: 'users', label: 'Utilisateurs', children: <UsersTab /> },
    { key: 'years', label: 'Années scolaires', children: <AcademicYearsTab /> },
    { key: 'classes', label: 'Classes & Niveaux', children: <ClassesTab /> },
    { key: 'backup', label: 'Sauvegarde', children: <BackupTab /> },
  ]

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration de l'établissement" />
      <Card bordered={false} style={{ borderRadius: 12 }}>
        <Tabs items={items} defaultActiveKey="school" />
      </Card>
    </div>
  )
}
