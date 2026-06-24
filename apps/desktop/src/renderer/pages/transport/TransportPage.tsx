import { useEffect, useState } from 'react'
import {
  Card, Row, Col, Statistic, Table, Button, Modal, Form, Input,
  InputNumber, Typography, Space, Popconfirm, Tooltip, Tag,
} from 'antd'
import {
  CarOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { useAppMessage } from '../../hooks/useAppMessage'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text } = Typography

export function TransportPage() {
  const message = useAppMessage()
  const [buses, setBuses] = useState<any[]>([])
  const [stats, setStats] = useState<any>({ busCount: 0, routeCount: 0, totalCapacity: 0 })
  const [loading, setLoading] = useState(true)
  const [busModal, setBusModal] = useState(false)
  const [routeModal, setRouteModal] = useState<{ busId: string; busName: string } | null>(null)
  const [editBus, setEditBus] = useState<any>(null)
  const [busForm] = Form.useForm()
  const [routeForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [expandedBus, setExpandedBus] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [b, s] = await Promise.all([ipc.transport.listBuses(), ipc.transport.stats()])
      setBuses(b)
      setStats(s)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreateBus = () => {
    setEditBus(null)
    busForm.resetFields()
    setBusModal(true)
  }

  const openEditBus = (b: any) => {
    setEditBus(b)
    busForm.setFieldsValue({
      plate: b.plate,
      capacity: b.capacity,
      driver: b.driver,
      driverPhone: b.driverPhone ?? '',
    })
    setBusModal(true)
  }

  const handleBusSubmit = async (values: any) => {
    setSaving(true)
    try {
      if (editBus) {
        await ipc.transport.updateBus(editBus.id, values)
        message.success('Bus mis à jour')
      } else {
        await ipc.transport.createBus({ ...values, capacity: Number(values.capacity) })
        message.success('Bus ajouté')
      }
      setBusModal(false)
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBus = async (id: string) => {
    try {
      await ipc.transport.deleteBus(id)
      message.success('Bus supprimé')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const handleAddRoute = async (values: any) => {
    if (!routeModal) return
    setSaving(true)
    try {
      await ipc.transport.createRoute({
        busId: routeModal.busId,
        name: values.name,
        stops: values.stops,
      })
      message.success('Circuit ajouté')
      setRouteModal(null)
      routeForm.resetFields()
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRoute = async (id: string) => {
    try {
      await ipc.transport.deleteRoute(id)
      message.success('Circuit supprimé')
      load()
    } catch (e: any) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: 'Immatriculation',
      dataIndex: 'plate',
      key: 'plate',
      render: (v: string) => (
        <Space>
          <CarOutlined style={{ color: '#1E40AF' }} />
          <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Chauffeur',
      dataIndex: 'driver',
      key: 'driver',
      render: (v: string) => <Text>{v}</Text>,
    },
    {
      title: 'Téléphone',
      dataIndex: 'driverPhone',
      key: 'phone',
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Capacité',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 100,
      render: (v: number) => <Tag color="blue">{v} places</Tag>,
    },
    {
      title: 'Circuits',
      key: 'routes',
      width: 90,
      render: (_: any, r: any) => (
        <Tag
          color={r.routes?.length > 0 ? 'green' : 'default'}
          style={{ cursor: 'pointer' }}
          onClick={() => setExpandedBus(expandedBus === r.id ? null : r.id)}
        >
          {r.routes?.length ?? 0} circuit{(r.routes?.length ?? 0) !== 1 ? 's' : ''}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 130,
      render: (_: any, r: any) => (
        <Space>
          <Tooltip title="Ajouter un circuit">
            <Button
              size="small"
              icon={<EnvironmentOutlined />}
              onClick={() => { setRouteModal({ busId: r.id, busName: r.plate }); routeForm.resetFields() }}
            />
          </Tooltip>
          <Tooltip title="Modifier">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditBus(r)} />
          </Tooltip>
          <Popconfirm
            title="Supprimer ce bus ?"
            onConfirm={() => handleDeleteBus(r.id)}
            okText="Supprimer"
            okType="danger"
            cancelText="Annuler"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const expandedBusData = buses.find(b => b.id === expandedBus)

  return (
    <div>
      <PageHeader title="Transport scolaire" subtitle="Gestion des bus et circuits" />

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { title: 'Bus actifs', value: stats.busCount, color: '#1E40AF' },
          { title: 'Circuits', value: stats.routeCount, color: '#4F46E5' },
          { title: 'Capacité totale', value: `${stats.totalCapacity} élèves`, color: '#16A34A' },
        ].map(({ title, value, color }) => (
          <Col key={title} xs={8}>
            <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}` }}>
              <Statistic title={title} value={value} valueStyle={{ color, fontWeight: 700 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateBus}>
            Ajouter un bus
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={buses}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          locale={{ emptyText: 'Aucun bus enregistré' }}
        />
      </Card>

      {/* Détail circuits du bus sélectionné */}
      {expandedBusData && (
        <Card
          variant="borderless"
          style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
          title={<span><EnvironmentOutlined style={{ marginRight: 8, color: '#1E40AF' }} />Circuits — {expandedBusData.plate}</span>}
        >
          {(expandedBusData.routes ?? []).length === 0 ? (
            <Text type="secondary">Aucun circuit pour ce bus.</Text>
          ) : (
            <Table
              dataSource={expandedBusData.routes}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Nom du circuit',
                  dataIndex: 'name',
                  key: 'name',
                  render: (v: string) => <Text strong>{v}</Text>,
                },
                {
                  title: 'Arrêts',
                  dataIndex: 'stops',
                  key: 'stops',
                  render: (v: string) => (
                    <Space wrap size={4}>
                      {v.split(',').map((s: string, i: number) => (
                        <Tag key={i} style={{ fontSize: 11 }}>{s.trim()}</Tag>
                      ))}
                    </Space>
                  ),
                },
                {
                  title: '',
                  key: 'del',
                  width: 60,
                  render: (_: any, r: any) => (
                    <Popconfirm
                      title="Supprimer ce circuit ?"
                      onConfirm={() => handleDeleteRoute(r.id)}
                      okText="Supprimer"
                      okType="danger"
                      cancelText="Annuler"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ]}
            />
          )}
        </Card>
      )}

      {/* Modal bus */}
      <Modal
        title={editBus ? 'Modifier le bus' : 'Ajouter un bus'}
        open={busModal}
        onCancel={() => { setBusModal(false); busForm.resetFields() }}
        footer={null}
        width={440}
      >
        <Form form={busForm} layout="vertical" onFinish={handleBusSubmit} requiredMark={false}>
          <Form.Item name="plate" label="Immatriculation" rules={[{ required: true }]}>
            <Input placeholder="Ex: AC-1234-GN" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="driver" label="Chauffeur" rules={[{ required: true }]}>
                <Input placeholder="Nom du chauffeur" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="driverPhone" label="Téléphone">
                <Input placeholder="+224 6XX XXX XXX" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="capacity" label="Capacité (places)" rules={[{ required: true }]}>
            <InputNumber min={1} max={200} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setBusModal(false); busForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {editBus ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal circuit */}
      <Modal
        title={`Nouveau circuit${routeModal ? ` — Bus ${routeModal.busName}` : ''}`}
        open={!!routeModal}
        onCancel={() => { setRouteModal(null); routeForm.resetFields() }}
        footer={null}
        width={480}
      >
        <Form form={routeForm} layout="vertical" onFinish={handleAddRoute} requiredMark={false}>
          <Form.Item name="name" label="Nom du circuit" rules={[{ required: true }]}>
            <Input placeholder="Ex: Circuit Nord, Circuit Centre-ville…" />
          </Form.Item>
          <Form.Item
            name="stops"
            label="Arrêts (séparés par des virgules)"
            rules={[{ required: true }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Ex: École, Marché central, Quartier Madina, Terminus Cosa"
            />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setRouteModal(null); routeForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Ajouter le circuit</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
