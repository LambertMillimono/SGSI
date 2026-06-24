import { useEffect, useState, useCallback } from 'react'
import { Table, Input, Select, Button, Typography, Avatar, Tag, Space, Card, Row, Col, Statistic,
  Modal, Tooltip, Badge, Alert } from 'antd'
import {
  EyeOutlined, PlusOutlined, SearchOutlined, UserOutlined,
  ManOutlined, WomanOutlined, TeamOutlined, UploadOutlined,
  DownloadOutlined, FileExcelOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { PageHeader } from '../../components/shared/PageHeader'

const { Option } = Select
const { Text } = Typography

interface Student {
  id: string
  matricule: string
  firstName: string
  lastName: string
  gender: string
  photo?: string
  enrollments?: Array<{ class?: { name: string }; status: string; academicYear?: { label: string } }>
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function getInitials(first: string, last: string) {
  return `${last[0] ?? ''}${first[0] ?? ''}`.toUpperCase()
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE:      { label: 'Actif',         color: '#16A34A' },
  TRANSFERRED: { label: 'Transféré',     color: '#D97706' },
  GRADUATED:   { label: 'Diplômé',       color: '#7C3AED' },
  EXPELLED:    { label: 'Renvoyé',       color: '#DC2626' },
}

export function StudentListPage() {
  const navigate  = useNavigate()
  const { userId } = useAuth()
  const message   = useAppMessage()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [classFilter, setClassFilter]   = useState<string | undefined>()
  const [genderFilter, setGenderFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const pageSize = 20
  const debouncedSearch = useDebounce(search, 300)

  // ── Import Excel state ─────────────────────────────────────────
  const [importOpen, setImportOpen]       = useState(false)
  const [importRows, setImportRows]       = useState<any[]>([])
  const [importFile, setImportFile]       = useState('')
  const [importResult, setImportResult]   = useState<any>(null)
  const [importing, setImporting]         = useState(false)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ipc.students.list({ search: debouncedSearch || undefined, classId: classFilter })
      setStudents(data)
    } catch { setStudents([]) }
    finally { setLoading(false) }
  }, [debouncedSearch, classFilter])

  useEffect(() => { loadStudents() }, [loadStudents])
  useEffect(() => { ipc.classes.list().then(setClasses).catch(() => {}) }, [])

  // ── Import handlers ────────────────────────────────────────────
  const handlePickExcel = async () => {
    const res = await ipc.students.importExcel()
    if (!res) return
    setImportRows(res.rows ?? [])
    setImportFile(res.file ?? '')
    setImportResult(null)
    setImportOpen(true)
  }

  const handleConfirmImport = async () => {
    setImporting(true)
    try {
      const result = await ipc.students.confirmImport(importRows, userId ?? 'system')
      setImportResult(result)
      if (result.created > 0) {
        message.success(`${result.created} élève(s) importé(s) avec succès`)
        loadStudents()
      }
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setImporting(false)
    }
  }

  const filtered = genderFilter ? students.filter(s => s.gender === genderFilter) : students
  const males = students.filter(s => s.gender === 'MALE').length
  const females = students.filter(s => s.gender === 'FEMALE').length
  const actifs = students.filter(s => s.enrollments?.[0]?.status === 'ACTIVE').length

  const columns: ColumnsType<Student> = [
    {
      title: '#',
      key: 'idx',
      width: 48,
      render: (_, __, i) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{(page - 1) * pageSize + i + 1}</Text>
      ),
    },
    {
      title: 'Élève',
      key: 'name',
      sorter: (a, b) => a.lastName.localeCompare(b.lastName),
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {r.photo
            ? <Avatar src={r.photo} size={36} />
            : (
              <Avatar
                size={36}
                style={{
                  background: r.gender === 'MALE' ? '#1E40AF' : '#BE185D',
                  fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}
              >
                {getInitials(r.firstName, r.lastName)}
              </Avatar>
            )
          }
          <div>
            <Text strong style={{ fontSize: 14 }}>{r.lastName.toUpperCase()} {r.firstName}</Text>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
              {r.gender === 'MALE'
                ? <ManOutlined style={{ color: '#3B82F6', fontSize: 11 }} />
                : <WomanOutlined style={{ color: '#EC4899', fontSize: 11 }} />
              }
              <Text type="secondary" style={{ fontSize: 11 }}>
                {r.gender === 'MALE' ? 'Masculin' : 'Féminin'}
              </Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Matricule',
      dataIndex: 'matricule',
      key: 'matricule',
      width: 160,
      render: (v) => (
        <Text code style={{ fontSize: 11, background: '#F0F9FF', borderColor: '#BAE6FD', color: '#0369A1' }}>
          {v}
        </Text>
      ),
    },
    {
      title: 'Classe',
      key: 'class',
      width: 110,
      render: (_, r) => {
        const cls = r.enrollments?.[0]?.class?.name
        return cls
          ? <Tag color="blue" style={{ fontWeight: 600 }}>{cls}</Tag>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Année',
      key: 'year',
      width: 100,
      render: (_, r) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.enrollments?.[0]?.academicYear?.label ?? '—'}
        </Text>
      ),
    },
    {
      title: 'Statut',
      key: 'status',
      width: 110,
      render: (_, r) => {
        const s = r.enrollments?.[0]?.status ?? 'ACTIVE'
        const cfg = STATUS_CONFIG[s] ?? STATUS_CONFIG.ACTIVE
        return (
          <Tag
            style={{
              color: cfg.color,
              borderColor: cfg.color + '40',
              background: cfg.color + '12',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {cfg.label}
          </Tag>
        )
      },
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          ghost
          onClick={(e) => { e.stopPropagation(); navigate(`/students/${r.id}`) }}
          style={{ borderRadius: 6 }}
        >
          Profil
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Gestion des Élèves"
        subtitle={`${students.length} élève${students.length !== 1 ? 's' : ''} enregistré${students.length !== 1 ? 's' : ''}`}
        icon={<TeamOutlined />}
        actions={
          <Space size={8}>
            <Tooltip title="Télécharger le modèle Excel vide">
              <Button icon={<DownloadOutlined />} onClick={() => ipc.students.downloadTemplate()}>
                Modèle
              </Button>
            </Tooltip>
            <Tooltip title="Importer des élèves depuis un fichier Excel">
              <Button icon={<UploadOutlined />} onClick={handlePickExcel}>
                Importer Excel
              </Button>
            </Tooltip>
            <Tooltip title="Exporter la liste en Excel">
              <Button icon={<FileExcelOutlined />} onClick={() => ipc.students.exportExcel(classFilter)}>
                Exporter
              </Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/students/new')}>
              Inscrire un élève
            </Button>
          </Space>
        }
      />

      {/* ── Import Excel Modal ── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileExcelOutlined style={{ color: '#059669', fontSize: 18 }} />
            <div>
              <div style={{ fontWeight: 700 }}>Import Excel — {importFile}</div>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>
                {importRows.length} ligne(s) détectée(s) ·{' '}
                <span style={{ color: '#059669' }}>{importRows.filter(r => r.valid).length} valide(s)</span>
                {importRows.filter(r => !r.valid).length > 0 && (
                  <span style={{ color: '#DC2626' }}> · {importRows.filter(r => !r.valid).length} erreur(s)</span>
                )}
              </div>
            </div>
          </div>
        }
        open={importOpen}
        onCancel={() => { setImportOpen(false); setImportRows([]); setImportResult(null) }}
        footer={
          importResult ? (
            <Button type="primary" onClick={() => { setImportOpen(false); setImportRows([]); setImportResult(null) }}>
              Fermer
            </Button>
          ) : (
            <Space>
              <Button onClick={() => { setImportOpen(false); setImportRows([]); setImportResult(null) }}>Annuler</Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={importing}
                disabled={importRows.filter(r => r.valid).length === 0}
                onClick={handleConfirmImport}
                style={{ background: '#059669', borderColor: '#059669' }}
              >
                Importer {importRows.filter(r => r.valid).length} élève(s)
              </Button>
            </Space>
          )
        }
        width={720}
        destroyOnHidden
      >
        {importResult ? (
          <div style={{ padding: '8px 0' }}>
            <Alert
              type={importResult.created > 0 ? 'success' : 'warning'}
              showIcon
              message={
                <span>
                  <strong>{importResult.created}</strong> élève(s) créé(s) ·{' '}
                  <strong>{importResult.duplicates}</strong> doublon(s) ignoré(s) ·{' '}
                  <strong>{importResult.errors}</strong> erreur(s)
                </span>
              }
              style={{ borderRadius: 10, marginBottom: 16 }}
            />
          </div>
        ) : (
          <div>
            <Alert
              type="info" showIcon
              message="Vérifiez les données avant de confirmer l'import. Les lignes avec erreur seront ignorées."
              style={{ borderRadius: 10, marginBottom: 16, fontSize: 12 }}
            />
            <Table
              dataSource={importRows}
              rowKey="rowNum"
              size="small"
              pagination={{ pageSize: 10 }}
              rowClassName={r => r.valid ? '' : 'import-row-error'}
              columns={[
                {
                  title: '', key: 'status', width: 32,
                  render: (_, r) => r.valid
                    ? <CheckCircleOutlined style={{ color: '#059669' }} />
                    : <Tooltip title={r.errors?.join(', ')}>
                        <CloseCircleOutlined style={{ color: '#DC2626' }} />
                      </Tooltip>,
                },
                { title: 'Nom',     dataIndex: 'lastName',  key: 'ln', width: 110 },
                { title: 'Prénom',  dataIndex: 'firstName', key: 'fn', width: 110 },
                {
                  title: 'Sexe', dataIndex: 'genderRaw', key: 'g', width: 90,
                  render: (v, r) => r.gender
                    ? <Tag style={{ background: r.gender === 'MALE' ? '#DBEAFE' : '#FCE7F3', color: r.gender === 'MALE' ? '#1D4ED8' : '#BE185D', border: 'none', borderRadius: 20, fontSize: 10 }}>{v}</Tag>
                    : <Tag style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 20, fontSize: 10 }}>{v || 'Manquant'}</Tag>,
                },
                { title: 'Date naissance', dataIndex: 'birthDate', key: 'bd', width: 120,
                  render: v => v ? v : <span style={{ color: '#9CA3AF' }}>—</span> },
                { title: 'Classe', dataIndex: 'birthPlace', key: 'bp', width: 100,
                  render: v => v || <span style={{ color: '#9CA3AF' }}>—</span> },
                {
                  title: 'Erreurs', key: 'err',
                  render: (_, r) => r.errors?.length > 0
                    ? <span style={{ color: '#DC2626', fontSize: 11 }}>{r.errors.join(', ')}</span>
                    : <span style={{ color: '#059669', fontSize: 11 }}>OK</span>,
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Stats row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total élèves', value: students.length, color: '#1E40AF', icon: <TeamOutlined /> },
          { label: 'Garçons', value: males, color: '#2563EB', icon: <ManOutlined /> },
          { label: 'Filles', value: females, color: '#BE185D', icon: <WomanOutlined /> },
          { label: 'Actifs', value: actifs, color: '#16A34A', icon: <UserOutlined /> },
        ].map(({ label, value, color, icon }) => (
          <Col xs={12} sm={6} key={label}>
            <Card
              size="small"
              variant="borderless"
              style={{
                borderRadius: 10,
                borderLeft: `4px solid ${color}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <Statistic
                title={<span style={{ fontSize: 12 }}>{label}</span>}
                value={value}
                prefix={<span style={{ color, marginRight: 4, fontSize: 14 }}>{icon}</span>}
                valueStyle={{ fontSize: 20, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filtres */}
      <Card
        variant="borderless"
        style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
            placeholder="Rechercher par nom, prénom, matricule…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            style={{ width: 300, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Toutes les classes"
            value={classFilter}
            onChange={(v) => { setClassFilter(v); setPage(1) }}
            allowClear
            style={{ width: 170, borderRadius: 8 }}
          >
            {classes.map((c: any) => (
              <Option key={c.id} value={c.id}>{c.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Tous les genres"
            value={genderFilter}
            onChange={setGenderFilter}
            allowClear
            style={{ width: 140 }}
          >
            <Option value="MALE"><ManOutlined style={{ color: '#3B82F6', marginRight: 4 }} />Garçons</Option>
            <Option value="FEMALE"><WomanOutlined style={{ color: '#EC4899', marginRight: 4 }} />Filles</Option>
          </Select>
          {(search || classFilter || genderFilter) && (
            <Button
              size="small"
              onClick={() => { setSearch(''); setClassFilter(undefined); setGenderFilter(undefined) }}
              style={{ color: '#6B7280' }}
            >
              Réinitialiser
            </Button>
          )}
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </Text>
        </div>
      </Card>

      {/* Table */}
      <Card variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t) => `${t} élève${t !== 1 ? 's' : ''}`,
            style: { padding: '12px 16px' },
          }}
          onRow={(r) => ({
            onClick: () => navigate(`/students/${r.id}`),
            style: { cursor: 'pointer', transition: 'background 0.15s' },
          })}
          size="middle"
          locale={{
            emptyText: (
              <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <UserOutlined style={{ fontSize: 48, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text type="secondary" style={{ fontSize: 14 }}>
                  {search || classFilter ? 'Aucun élève ne correspond à cette recherche' : 'Aucun élève inscrit'}
                </Text>
                {!search && !classFilter && (
                  <Button
                    type="primary" style={{ marginTop: 16 }}
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/students/new')}
                  >
                    Inscrire le premier élève
                  </Button>
                )}
              </div>
            ),
          }}
          style={{ borderRadius: 10 }}
        />
      </Card>
    </div>
  )
}
