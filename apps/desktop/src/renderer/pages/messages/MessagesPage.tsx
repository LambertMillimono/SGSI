import { useEffect, useState, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Select, Input, Typography, Tag, Space,
  Badge, Tooltip, Empty, Spin, Card, Avatar,
} from 'antd'
import {
  MailOutlined, SendOutlined, InboxOutlined, DeleteOutlined,
  ReloadOutlined, ArrowLeftOutlined, PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { useAuth } from '../../hooks/useAuth'
import { useAppMessage } from '../../hooks/useAppMessage'
import { PageHeader } from '../../components/shared/PageHeader'

const { Text, Title } = Typography
const { TextArea } = Input
const { Option } = Select

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'purple',
  DIRECTOR: 'blue',
  SECRETARY: 'cyan',
  ACCOUNTANT: 'green',
  TEACHER: 'orange',
}
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  DIRECTOR: 'Directeur',
  SECRETARY: 'Secrétaire',
  ACCOUNTANT: 'Comptable',
  TEACHER: 'Enseignant',
}

function userFullName(u: any) {
  return u ? `${u.lastName} ${u.firstName}` : '—'
}
function userInitials(u: any) {
  if (!u) return '?'
  return `${u.lastName[0]}${u.firstName[0]}`.toUpperCase()
}

export function MessagesPage() {
  const message = useAppMessage()
  const { userId } = useAuth()
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [messages, setMessages] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [form] = Form.useForm()
  const [replyForm] = Form.useForm()
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const msgs = tab === 'inbox'
        ? await ipc.messages.inbox(userId)
        : await ipc.messages.sent(userId)
      setMessages(msgs)
    } catch { setMessages([]) }
    finally { setLoading(false) }
  }, [userId, tab])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    ipc.settings.listUsers().then(setUsers).catch(() => {})
  }, [])

  const handleOpen = async (msg: any) => {
    setThreadLoading(true)
    setSelected(msg)
    try {
      const full = await ipc.messages.thread(msg.id, userId!)
      setSelected(full)
    } catch { } finally { setThreadLoading(false) }
    load() // refresh unread count
  }

  const handleSend = async (values: any) => {
    if (!userId) return
    setSending(true)
    try {
      await ipc.messages.send({
        fromUserId: userId,
        toUserId: values.toUserId,
        subject: values.subject,
        body: values.body,
      })
      message.success('Message envoyé')
      setComposeOpen(false)
      form.resetFields()
      load()
    } catch (e: any) { message.error(e.message) } finally { setSending(false) }
  }

  const handleReply = async (values: any) => {
    if (!userId || !selected) return
    setSending(true)
    const originalFromId = selected.fromUserId === userId ? selected.toUserId : selected.fromUserId
    try {
      await ipc.messages.send({
        fromUserId: userId,
        toUserId: originalFromId,
        subject: `Re: ${selected.subject}`,
        body: values.body,
        parentId: selected.id,
      })
      message.success('Réponse envoyée')
      setReplyOpen(false)
      replyForm.resetFields()
      // Reload thread
      const full = await ipc.messages.thread(selected.id, userId)
      setSelected(full)
      load()
    } catch (e: any) { message.error(e.message) } finally { setSending(false) }
  }

  const handleDelete = async (msgId: string) => {
    if (!userId) return
    try {
      await ipc.messages.delete(msgId, userId)
      message.success('Message supprimé')
      if (selected?.id === msgId) setSelected(null)
      load()
    } catch (e: any) { message.error(e.message) }
  }

  const otherUsers = users.filter(u => u.id !== userId)

  const columns = [
    {
      title: tab === 'inbox' ? 'Expéditeur' : 'Destinataire',
      key: 'contact',
      render: (_: any, r: any) => {
        const u = tab === 'inbox' ? r.fromUser : r.toUser
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={32} style={{ background: '#1E40AF', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {userInitials(u)}
            </Avatar>
            <div>
              <Text strong style={{ fontSize: 13, display: 'block' }}>{userFullName(u)}</Text>
              {u?.role && <Tag color={ROLE_COLORS[u.role] ?? 'default'} style={{ fontSize: 10, padding: '0 6px', height: 16, lineHeight: '16px' }}>{ROLE_LABELS[u.role] ?? u.role}</Tag>}
            </div>
          </div>
        )
      },
    },
    {
      title: 'Objet',
      key: 'subject',
      render: (_: any, r: any) => (
        <div>
          <Text strong={tab === 'inbox' && !r.isRead} style={{ fontSize: 13 }}>
            {r.subject}
          </Text>
          {r.replies?.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
              ({r.replies.length} réponse{r.replies.length > 1 ? 's' : ''})
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Date',
      key: 'date',
      width: 160,
      render: (_: any, r: any) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(r.createdAt).format('DD/MM/YYYY HH:mm')}
        </Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, r: any) => (
        <Space>
          {tab === 'inbox' && !r.isRead && <Badge dot />}
          <Tooltip title="Supprimer">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const unreadCount = messages.filter(m => tab === 'inbox' && !m.isRead).length

  return (
    <div>
      <PageHeader
        title="Messagerie interne"
        subtitle="Communication entre les membres du personnel"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setComposeOpen(true)}>
            Nouveau message
          </Button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, height: 'calc(100vh - 220px)' }}>
        {/* Liste messages */}
        <Card
          variant="borderless"
          style={{ borderRadius: 12, overflow: 'hidden', height: '100%' }}
          styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            {[
              { key: 'inbox', label: 'Boîte de réception', icon: <InboxOutlined /> },
              { key: 'sent', label: 'Envoyés', icon: <SendOutlined /> },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key as any); setSelected(null) }}
                style={{
                  flex: 1, padding: '12px 16px', border: 'none',
                  background: tab === t.key ? '#EFF6FF' : 'transparent',
                  borderBottom: tab === t.key ? '2px solid #1E40AF' : '2px solid transparent',
                  color: tab === t.key ? '#1E40AF' : '#6B7280',
                  cursor: 'pointer', fontWeight: tab === t.key ? 700 : 400, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {t.icon} {t.label}
                {t.key === 'inbox' && unreadCount > 0 && (
                  <Tag color="blue" style={{ height: 18, lineHeight: '18px', padding: '0 6px', fontSize: 10 }}>{unreadCount}</Tag>
                )}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px' }}>
              <Tooltip title="Actualiser">
                <Button size="small" icon={<ReloadOutlined />} onClick={load} />
              </Tooltip>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
            ) : (
              <Table
                columns={columns}
                dataSource={messages}
                rowKey="id"
                size="small"
                pagination={false}
                showHeader={false}
                onRow={(r) => ({
                  onClick: () => handleOpen(r),
                  style: {
                    cursor: 'pointer',
                    background: r.id === selected?.id ? '#EFF6FF' : (tab === 'inbox' && !r.isRead ? '#FAFAFA' : undefined),
                    fontWeight: tab === 'inbox' && !r.isRead ? 700 : 400,
                  },
                })}
                locale={{ emptyText: <Empty description="Aucun message" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              />
            )}
          </div>
        </Card>

        {/* Panneau de lecture */}
        <Card
          variant="borderless"
          style={{ borderRadius: 12, overflow: 'hidden', height: '100%' }}
          styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
        >
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
              <MailOutlined style={{ fontSize: 48, marginBottom: 12 }} />
              <Text type="secondary">Sélectionnez un message pour le lire</Text>
            </div>
          ) : threadLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin />
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
                <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => setSelected(null)}>
                  Retour
                </Button>
                <div style={{ flex: 1 }}>
                  <Title level={4} style={{ margin: 0 }}>{selected.subject}</Title>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12, color: '#6B7280' }}>
                    <span>De : <strong>{userFullName(selected.fromUser)}</strong></span>
                    <span>À : <strong>{userFullName(selected.toUser)}</strong></span>
                    <span>{dayjs(selected.createdAt).format('DD/MM/YYYY HH:mm')}</span>
                  </div>
                </div>
                <Button icon={<SendOutlined />} onClick={() => setReplyOpen(true)}>
                  Répondre
                </Button>
              </div>

              {/* Corps du message original */}
              <div style={{
                background: '#F9FAFB', borderRadius: 10, padding: '16px 20px',
                whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7,
                marginBottom: 16, border: '1px solid #E5E7EB',
              }}>
                {selected.body}
              </div>

              {/* Réponses */}
              {selected.replies && selected.replies.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 12, color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {selected.replies.length} réponse{selected.replies.length > 1 ? 's' : ''}
                  </Text>
                  {selected.replies.map((rep: any) => (
                    <div key={rep.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Avatar size={24} style={{ background: rep.fromUserId === userId ? '#1E40AF' : '#7C3AED', fontSize: 10, fontWeight: 700 }}>
                          {userInitials(rep.fromUser)}
                        </Avatar>
                        <Text strong style={{ fontSize: 12 }}>{userFullName(rep.fromUser)}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(rep.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                      </div>
                      <div style={{
                        background: rep.fromUserId === userId ? '#EFF6FF' : '#F5F3FF',
                        borderRadius: 10, padding: '12px 16px',
                        marginLeft: 32, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6,
                        border: `1px solid ${rep.fromUserId === userId ? '#BFDBFE' : '#DDD6FE'}`,
                      }}>
                        {rep.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Modale Nouveau message */}
      <Modal
        title={<span><PlusOutlined style={{ marginRight: 8 }} />Nouveau message</span>}
        open={composeOpen}
        onCancel={() => { setComposeOpen(false); form.resetFields() }}
        footer={null}
        width={580}
      >
        <Form form={form} layout="vertical" onFinish={handleSend} requiredMark={false}>
          <Form.Item name="toUserId" label="Destinataire" rules={[{ required: true, message: 'Requis' }]}>
            <Select
              showSearch
              placeholder="Choisir un destinataire…"
              optionFilterProp="label"
            >
              {otherUsers.map(u => (
                <Option key={u.id} value={u.id} label={`${u.lastName} ${u.firstName}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar size={22} style={{ background: '#1E40AF', fontSize: 10 }}>{userInitials(u)}</Avatar>
                    <span>{u.lastName} {u.firstName}</span>
                    <Tag color={ROLE_COLORS[u.role]} style={{ fontSize: 10 }}>{ROLE_LABELS[u.role] ?? u.role}</Tag>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="subject" label="Objet" rules={[{ required: true, message: 'Requis' }]}>
            <Input placeholder="Objet du message…" />
          </Form.Item>
          <Form.Item name="body" label="Message" rules={[{ required: true, message: 'Requis' }]}>
            <TextArea rows={6} placeholder="Votre message…" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setComposeOpen(false); form.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={sending} icon={<SendOutlined />}>
              Envoyer
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modale Répondre */}
      <Modal
        title={`Répondre à : ${selected?.subject ?? ''}`}
        open={replyOpen}
        onCancel={() => { setReplyOpen(false); replyForm.resetFields() }}
        footer={null}
        width={520}
      >
        <Form form={replyForm} layout="vertical" onFinish={handleReply} requiredMark={false}>
          <Form.Item name="body" label="Votre réponse" rules={[{ required: true, message: 'Requis' }]}>
            <TextArea rows={5} placeholder="Votre réponse…" autoFocus />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setReplyOpen(false); replyForm.resetFields() }}>Annuler</Button>
            <Button type="primary" htmlType="submit" loading={sending} icon={<SendOutlined />}>
              Envoyer la réponse
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
