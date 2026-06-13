import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, Result, Typography, Divider } from 'antd'
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { formatGNF, formatDate, numberToWordsFR } from '../../utils/formatters'

export function ReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    ipc.payments.getReceipt(id)
      .then(setPayment)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>
  if (notFound || !payment) {
    return (
      <Result
        status="404"
        title="Reçu introuvable"
        extra={<Button onClick={() => navigate('/payments')}>Retour aux paiements</Button>}
      />
    )
  }

  const student = payment.enrollment?.student
  const schoolClass = payment.enrollment?.class
  const year = payment.enrollment?.academicYear

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/payments')}>
          Retour
        </Button>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Imprimer
        </Button>
      </div>

      {/* Printable area — two copies on one A4 */}
      <div id="print-area">
        <ReceiptCopy payment={payment} student={student} schoolClass={schoolClass} year={year} copy="Original" />
        <div style={{ borderTop: '2px dashed #ccc', margin: '24px 0' }} />
        <ReceiptCopy payment={payment} student={student} schoolClass={schoolClass} year={year} copy="Duplicata" />
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}

function ReceiptCopy({
  payment, student, schoolClass, year, copy,
}: {
  payment: any
  student: any
  schoolClass: any
  year: any
  copy: string
}) {
  return (
    <div style={{
      border: '1px solid #d1d5db',
      borderRadius: 8,
      padding: '24px 32px',
      fontFamily: 'serif',
      maxWidth: 600,
      margin: '0 auto',
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>REÇU DE PAIEMENT</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {copy}
        </Typography.Text>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Receipt info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Text strong>N° Reçu : </Typography.Text>
          <Typography.Text code>{payment.receiptNo}</Typography.Text>
        </div>
        <div>
          <Typography.Text strong>Date : </Typography.Text>
          <Typography.Text>{payment.paidAt ? formatDate(payment.paidAt) : '—'}</Typography.Text>
        </div>
      </div>

      {/* Student info */}
      <div style={{ background: '#f9fafb', padding: '12px 16px', borderRadius: 6, marginBottom: 16 }}>
        <div><Typography.Text strong>Élève : </Typography.Text>{student ? `${student.lastName} ${student.firstName}` : '—'}</div>
        <div><Typography.Text strong>Matricule : </Typography.Text>{student?.matricule ?? '—'}</div>
        <div><Typography.Text strong>Classe : </Typography.Text>{schoolClass?.name ?? '—'}</div>
        <div><Typography.Text strong>Année scolaire : </Typography.Text>{year?.label ?? '—'}</div>
      </div>

      {/* Payment info */}
      <div style={{ marginBottom: 16 }}>
        <div><Typography.Text strong>Motif : </Typography.Text>{payment.feeType?.name ?? '—'}</div>
        <div><Typography.Text strong>Mode de paiement : </Typography.Text>{payment.method ?? '—'}</div>
      </div>

      {/* Amount */}
      <div style={{
        border: '2px solid #1E40AF',
        borderRadius: 8,
        padding: '16px',
        textAlign: 'center',
        marginBottom: 16,
      }}>
        <Typography.Title level={3} style={{ margin: 0, color: '#1E40AF' }}>
          {formatGNF(payment.amount ?? 0)}
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'capitalize' }}>
          {numberToWordsFR(payment.amount ?? 0)}
        </Typography.Text>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: 50, borderBottom: '1px solid #333', width: 140 }} />
          <Typography.Text style={{ fontSize: 11 }}>Caissier(ère)</Typography.Text>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: 50, borderBottom: '1px solid #333', width: 140 }} />
          <Typography.Text style={{ fontSize: 11 }}>Parent / Tuteur</Typography.Text>
        </div>
      </div>
    </div>
  )
}
