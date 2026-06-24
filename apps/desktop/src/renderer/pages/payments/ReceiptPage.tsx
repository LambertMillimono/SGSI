import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, Result } from 'antd'
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { formatGNF, formatDate, numberToWordsFR } from '../../utils/formatters'

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  WAVE: 'Wave',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Virement bancaire',
}

export function ReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<any>(null)
  const [school, setSchool] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      ipc.payments.getReceipt(id),
      ipc.settings.getSchool(),
    ])
      .then(([p, s]) => { setPayment(p); setSchool(s) })
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
      {/* Barre contrôle (non imprimée) */}
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/payments')}>Retour</Button>
        <span style={{ flex: 1, fontWeight: 600 }}>
          Reçu N° {payment.receiptNo}
        </span>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Imprimer
        </Button>
      </div>

      {/* Zone imprimable — 2 exemplaires */}
      <div id="print-area">
        <ReceiptCopy payment={payment} student={student} schoolClass={schoolClass} year={year} school={school} copy="ORIGINAL" />
        <div style={{ borderTop: '2px dashed #aaa', margin: '20px 0', pageBreakInside: 'avoid' }} />
        <ReceiptCopy payment={payment} student={student} schoolClass={schoolClass} year={year} school={school} copy="DUPLICATA" />
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          .no-print { display: none !important; }
          #print-area {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important;
            padding: 6mm !important;
            background: #fff !important;
          }
        }
        @page { size: A4 portrait; margin: 6mm; }
      `}</style>
    </div>
  )
}

function ReceiptCopy({
  payment, student, schoolClass, year, school, copy,
}: {
  payment: any; student: any; schoolClass: any; year: any; school: any; copy: string
}) {
  const borderColor = '#1E40AF'

  return (
    <div style={{
      border: `2px solid ${borderColor}`,
      borderRadius: 8,
      maxWidth: 620,
      margin: '0 auto',
      fontFamily: '"Times New Roman", Times, serif',
      background: '#fff',
      overflow: 'hidden',
    }}>
      {/* En-tête bipartite */}
      <div style={{ display: 'flex', borderBottom: `2px solid ${borderColor}` }}>
        {/* Gauche : établissement */}
        <div style={{
          flex: 1, padding: '10px 16px',
          borderRight: `1px solid ${borderColor}`,
          fontSize: 11,
        }}>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>
            {school?.name ?? 'Établissement'}
          </div>
          {school?.address && <div style={{ color: '#555', marginTop: 2 }}>{school.address}</div>}
          {school?.phone && <div style={{ color: '#555' }}>Tél : {school.phone}</div>}
          {school?.email && <div style={{ color: '#555' }}>{school.email}</div>}
        </div>
        {/* Centre : sigle/logo */}
        <div style={{
          width: 90, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 8, borderRight: `1px solid ${borderColor}`,
        }}>
          {school?.logo
            ? <img src={school.logo} alt="Logo" style={{ width: 60, height: 60, objectFit: 'contain' }} />
            : (
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                border: `2px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 900, color: borderColor,
              }}>
                {(school?.sigle ?? 'S').slice(0, 2)}
              </div>
            )
          }
        </div>
        {/* Droite : titre reçu + copie */}
        <div style={{
          flex: 1, padding: '10px 16px',
          textAlign: 'center',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', color: borderColor, letterSpacing: 1 }}>
            Reçu de Paiement
          </div>
          <div style={{
            fontSize: 10, marginTop: 4,
            background: copy === 'ORIGINAL' ? borderColor : '#6B7280',
            color: '#fff', padding: '2px 10px', borderRadius: 4,
            display: 'inline-block', alignSelf: 'center',
          }}>
            {copy}
          </div>
          <div style={{ fontSize: 10, color: '#555', marginTop: 6 }}>
            Année scolaire : <strong>{year?.label ?? '—'}</strong>
          </div>
        </div>
      </div>

      {/* N° Reçu + Date */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: `1px solid #ddd`,
        fontSize: 12, background: '#f8fafc',
      }}>
        <span><strong>N° Reçu :</strong> <span style={{ fontFamily: 'monospace', color: borderColor, fontWeight: 700 }}>{payment.receiptNo}</span></span>
        <span><strong>Date :</strong> {payment.paidAt ? formatDate(payment.paidAt) : '—'}</span>
      </div>

      {/* Infos élève */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid #ddd`, fontSize: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '2px 0', width: '55%' }}>
                <strong>Élève :</strong> {student ? `${student.lastName.toUpperCase()} ${student.firstName}` : '—'}
              </td>
              <td style={{ padding: '2px 0' }}>
                <strong>Classe :</strong> {schoolClass?.name ?? '—'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '2px 0' }}>
                <strong>Matricule :</strong> <span style={{ fontFamily: 'monospace' }}>{student?.matricule ?? '—'}</span>
              </td>
              <td style={{ padding: '2px 0' }}>
                <strong>Mode de paiement :</strong> {METHOD_LABELS[payment.method] ?? payment.method ?? '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Motif */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid #ddd`, fontSize: 12 }}>
        <strong>Motif :</strong> {payment.feeType?.name ?? '—'}
        {payment.note && <span style={{ color: '#555', marginLeft: 12, fontStyle: 'italic' }}>({payment.note})</span>}
      </div>

      {/* Montant — zone bleue */}
      <div style={{
        margin: '14px 16px',
        border: `2px solid ${borderColor}`,
        borderRadius: 6,
        padding: '14px 16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: borderColor, letterSpacing: 1 }}>
          {formatGNF(payment.amount ?? 0)}
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 4, textTransform: 'capitalize', fontStyle: 'italic' }}>
          {numberToWordsFR(payment.amount ?? 0)}
        </div>
      </div>

      {/* Signatures */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '8px 24px 16px',
        borderTop: `1px solid #ddd`,
        fontSize: 11,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: 44, borderBottom: '1px solid #333', width: 140, marginBottom: 4 }} />
          <div style={{ fontWeight: 700 }}>Le Caissier(ère)</div>
          {school?.directorName && <div style={{ color: '#555', fontSize: 10 }}>{school.directorName}</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: 44, borderBottom: '1px solid #333', width: 140, marginBottom: 4 }} />
          <div style={{ fontWeight: 700 }}>Le Parent / Tuteur</div>
        </div>
      </div>

      {/* Pied */}
      <div style={{
        background: '#f0f4ff', padding: '5px 16px',
        fontSize: 9, color: '#555', textAlign: 'center',
        borderTop: `1px solid ${borderColor}`,
      }}>
        Ce reçu est un document officiel — Conservez-le précieusement
      </div>
    </div>
  )
}
