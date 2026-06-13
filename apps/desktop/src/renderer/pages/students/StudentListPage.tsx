import { useEffect, useState, useCallback } from 'react'
import { Table, Input, Select, Button, Space, Tooltip, Typography } from 'antd'
import {
  EyeOutlined,
  EditOutlined,
  DollarOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { ipc } from '../../utils/ipcBridge'
import { PageHeader } from '../../components/shared/PageHeader'
import { StatusBadge } from '../../components/shared/StatusBadge'

const { Option } = Select

interface Student {
  id: string
  matricule: string
  firstName: string
  lastName: string
  gender: string
  photo?: string
  enrollments?: Array<{ class?: { name: string }; status: string }>
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function StudentListPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const pageSize = 20

  const debouncedSearch = useDebounce(search, 300)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const data = await ipc.students.list({
        search: debouncedSearch || undefined,
        classId: classFilter,
      })
      setStudents(data)
    } catch {
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, classFilter])

  useEffect(() => { loadStudents() }, [loadStudents])
  useEffect(() => {
    ipc.classes.list().then(setClasses).catch(() => setClasses([]))
  }, [])

  const columns: ColumnsType<Student> = [
    {
      title: 'Nom complet',
      key: 'name',
      sorter: (a, b) => a.lastName.localeCompare(b.lastName),
      render: (_, r) => (
        <span style={{ fontWeight: 500 }}>
          {r.lastName} {r.firstName}
        </span>
      ),
    },
    {
      title: 'Matricule',
      dataIndex: 'matricule',
      key: 'matricule',
      width: 150,
      sorter: (a, b) => a.matricule.localeCompare(b.matricule),
      render: (v) => <Typography.Text code style={{ fontSize: 12 }}>{v}</Typography.Text>,
    },
    {
      title: 'Classe',
      key: 'class',
      width: 120,
      render: (_, r) => r.enrollments?.[0]?.class?.name ?? '—',
    },
    {
      title: 'Statut',
      key: 'status',
      width: 120,
      render: (_, r) => <StatusBadge status={r.enrollments?.[0]?.status ?? 'ACTIVE'} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Voir le profil">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/students/${r.id}`)}
            />
          </Tooltip>
          <Tooltip title="Modifier">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/students/${r.id}`)}
            />
          </Tooltip>
          <Tooltip title="Paiement">
            <Button
              type="text"
              size="small"
              icon={<DollarOutlined />}
              onClick={() => navigate('/payments')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Élèves"
        subtitle={`${students.length} élève${students.length !== 1 ? 's' : ''} au total`}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/students/new')}>
            Nouvel élève
          </Button>
        }
      />

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          placeholder="Rechercher par nom, prénom, matricule..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          placeholder="Toutes les classes"
          value={classFilter}
          onChange={(v) => { setClassFilter(v); setPage(1) }}
          allowClear
          style={{ width: 160 }}
        >
          {classes.map((c: any) => (
            <Option key={c.id} value={c.id}>{c.name}</Option>
          ))}
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={students}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total: students.length,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (total) => `${total} élève${total !== 1 ? 's' : ''}`,
        }}
        onRow={(r) => ({
          onDoubleClick: () => navigate(`/students/${r.id}`),
          style: { cursor: 'pointer' },
        })}
        size="middle"
        locale={{ emptyText: 'Aucun élève trouvé' }}
      />
    </div>
  )
}
