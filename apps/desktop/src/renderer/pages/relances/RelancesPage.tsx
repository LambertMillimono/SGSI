import { useEffect, useState } from 'react'
import { Table, Button, Checkbox, Tag, Tabs, Alert, Space, Select, message } from 'antd'
import { MailOutlined, PrinterOutlined, WarningOutlined } from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { PageHeader } from '../../components/shared/PageHeader'

interface OverdueRow {
  studentId:       string
  studentName:     string
  className:       string
  balance:         number
  daysOverdue:     number
  parentId:        string
  parentName:      string
  phone:           string | null
  email:           string | null
  channel:         'SMS' | 'EMAIL' | 'BOTH' | 'NONE'
  alreadyReminded: boolean
}

interface HistoryRow {
  id:        string
  sentAt:    string
  channel:   string
  status:    string
  amountDue: number
  parent:    { firstName: string; lastName: string }
  student:   { firstName: string; lastName: string }
}

export function RelancesPage() {
  const [rows, setRows]           = useState<OverdueRow[]>([])
  const [history, setHistory]     = useState<HistoryRow[]>([])
  const [selected, setSelected]   = useState<string[]>([])
  const [threshold, setThreshold] = useState(30)
  const [loading, setLoading]     = useState(false)
  const [sending, setSending]     = useState(false)
  const [printing, setPrinting]   = useState(false)
  const [tab, setTab]             = useState('overdue')

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await ipc.relances.list(threshold)
      setRows(data)
      setSelected([])
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const data = await ipc.relances.history()
      setHistory(data)
    } catch {}
  }

  useEffect(() => { loadData() }, [threshold])
  useEffect(() => { if (tab === 'history') loadHistory() }, [tab])

  const handleSend = async () => {
    if (selected.length === 0) { message.warning('Selectionnez au moins un parent'); return }
    setSending(true)
    try {
      const result = await ipc.relances.send(selected)
      message.success(`Envoye : ${result.sent} | Echec : ${result.failed} | Ignore : ${result.skipped}`)
      loadData()
      loadHistory()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSending(false)
    }
  }

  const handlePrint = async () => {
    if (selected.length === 0) { message.warning('Selectionnez au moins un parent'); return }
    setPrinting(true)
    try {
      const html = await ipc.relances.printLetters(selected)
      const win  = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        setTimeout(() => { win.print(); win.close() }, 500)
      }
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setPrinting(false)
    }
  }

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0)
  const selectableRows = rows.filter(r => r.channel !== 'NONE')

  const overdueColumns = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_: any, r: OverdueRow) => (
        <Checkbox
          disabled={r.channel === 'NONE'}
          checked={selected.includes(r.parentId)}
          onChange={e => setSelected(prev =>
            e.target.checked ? [...prev, r.parentId] : prev.filter(id => id !== r.parentId)
          )}
        />
      ),
    },
    { title: 'Eleve',     dataIndex: 'studentName', key: 'studentName' },
    { title: 'Classe',    dataIndex: 'className',   key: 'className' },
    { title: 'Parent',    dataIndex: 'parentName',  key: 'parentName' },
    { title: 'Telephone', dataIndex: 'phone',       key: 'phone', render: (v: any) => v ?? '-' },
    {
      title: 'Solde du',
      dataIndex: 'balance',
      key: 'balance',
      render: (v: number) => (
        <span style={{ color: '#dc2626', fontWeight: 700 }}>
          {v.toLocaleString('fr-FR')} GNF
        </span>
      ),
    },
    {
      title: 'Retard',
      dataIndex: 'daysOverdue',
      key: 'daysOverdue',
      render: (v: number) => (
        <Tag color={v > 60 ? 'red' : v > 30 ? 'orange' : 'gold'}>{v} jours</Tag>
      ),
    },
    {
      title: 'Canal',
      dataIndex: 'channel',
      key: 'channel',
      render: (v: string) => {
        const colors: Record<string, string> = { SMS: 'blue', EMAIL: 'purple', BOTH: 'green', NONE: 'default' }
        return <Tag color={colors[v]}>{v}</Tag>
      },
    },
    {
      title: 'Deja relance',
      dataIndex: 'alreadyReminded',
      key: 'alreadyReminded',
      render: (v: boolean) => v
        ? <Tag color="orange">Oui (&lt;7j)</Tag>
        : <Tag color="green">Non</Tag>,
    },
  ]

  const historyColumns = [
    {
      title: 'Date',
      dataIndex: 'sentAt',
      key: 'sentAt',
      render: (v: string) => new Date(v).toLocaleDateString('fr-FR'),
    },
    {
      title: 'Parent',
      key: 'parent',
      render: (_: any, r: HistoryRow) => `${r.parent.firstName} ${r.parent.lastName}`,
    },
    {
      title: 'Eleve',
      key: 'student',
      render: (_: any, r: HistoryRow) => `${r.student.firstName} ${r.student.lastName}`,
    },
    {
      title: 'Montant',
      dataIndex: 'amountDue',
      key: 'amountDue',
      render: (v: number) => `${v.toLocaleString('fr-FR')} GNF`,
    },
    { title: 'Canal',  dataIndex: 'channel', key: 'channel', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Statut',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={v === 'SENT' ? 'green' : 'red'}>{v === 'SENT' ? 'Envoye' : 'Echec'}</Tag>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader title="Relances Impayes" subtitle="Gerez les rappels de paiement aux parents" />

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'overdue',
            label: `Impayes (${rows.length})`,
            children: (
              <>
                {rows.length > 0 && (
                  <Alert
                    type="warning"
                    icon={<WarningOutlined />}
                    showIcon
                    message={`${rows.length} parent(s) en retard - Total : ${totalBalance.toLocaleString('fr-FR')} GNF`}
                    style={{ marginBottom: 16 }}
                  />
                )}
                {rows.length === 0 && !loading && (
                  <Alert
                    type="success"
                    message="Aucun impaye en retard. Bonne gestion !"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}
                <Space style={{ marginBottom: 16 }} wrap>
                  <span>Filtre retard :</span>
                  <Select
                    value={threshold}
                    onChange={setThreshold}
                    options={[
                      { value: 15, label: '> 15 jours' },
                      { value: 30, label: '> 30 jours' },
                      { value: 60, label: '> 60 jours' },
                    ]}
                  />
                  <Checkbox
                    checked={selectableRows.length > 0 && selected.length === selectableRows.length}
                    onChange={e =>
                      setSelected(e.target.checked ? selectableRows.map(r => r.parentId) : [])
                    }
                  >
                    Tout selectionner
                  </Checkbox>
                  <Button
                    type="primary"
                    icon={<MailOutlined />}
                    loading={sending}
                    disabled={selected.length === 0}
                    onClick={handleSend}
                  >
                    Envoyer SMS/Email ({selected.length})
                  </Button>
                  <Button
                    icon={<PrinterOutlined />}
                    loading={printing}
                    disabled={selected.length === 0}
                    onClick={handlePrint}
                  >
                    Imprimer les lettres ({selected.length})
                  </Button>
                </Space>
                <Table
                  rowKey="studentId"
                  columns={overdueColumns}
                  dataSource={rows}
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                  size="small"
                />
              </>
            ),
          },
          {
            key: 'history',
            label: 'Historique',
            children: (
              <Table
                rowKey="id"
                columns={historyColumns}
                dataSource={history}
                pagination={{ pageSize: 20 }}
                size="small"
              />
            ),
          },
        ]}
      />
    </div>
  )
}
