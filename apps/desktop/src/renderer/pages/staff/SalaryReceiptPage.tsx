import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, Result } from 'antd'
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { formatGNF, formatDate, numberToWordsFR } from '../../utils/formatters'

const MONTHS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

export function SalaryReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [salary, setSalary] = useState<any>(null)
  const [school, setSchool]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      ipc.teachers.getSalaryReceipt(id),
      ipc.settings.getSchool(),
    ])
      .then(([s, sc]) => { setSalary(s); setSchool(sc) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>
  if (notFound || !salary) {
    return (
      <Result
        status="404"
        title="Bulletin introuvable"
        extra={<Button onClick={() => navigate('/payroll')}>Retour à la paie</Button>}
      />
    )
  }

  const teacher = salary.teacher
  const user    = teacher?.user
  const fullName = user ? `${user.lastName} ${user.firstName}` : 'Inconnu'
  const monthLabel = MONTHS[(salary.month ?? 1) - 1] ?? ''
  const receiptNo = `SAL-${salary.year}-${String(salary.month).padStart(2,'0')}-${salary.id.slice(-4).toUpperCase()}`
  const schoolName = school?.name ?? 'École'
  const schoolAddr = school?.address ?? ''
  const schoolPhone = school?.phone ?? ''
  const schoolEmail = school?.email ?? ''
  const directorName = school?.directorName ?? 'Le Directeur'
  const currency = school?.currency ?? 'GNF'

  const brut     = (salary.baseSalary ?? 0) + (salary.bonuses ?? 0)
  const deductions = (salary.advances ?? 0) + (salary.deductions ?? 0)
  const net      = salary.netSalary ?? 0
  const netWords = numberToWordsFR ? numberToWordsFR(net) : `${net.toLocaleString('fr-FR')} ${currency}`

  const printDate = salary.paidAt
    ? new Date(salary.paidAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')

  const ReceiptCopy = ({ label }: { label: string }) => (
    <div style={{
      width: '100%', maxWidth: 680, margin: '0 auto 32px',
      border: '1px solid #D1D5DB', borderRadius: 12,
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      fontSize: 13, color: '#111827',
      pageBreakInside: 'avoid',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#1E3A8A 0%,#1D4ED8 100%)',
        color: '#fff', borderRadius: '11px 11px 0 0',
        padding: '20px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{schoolName}</div>
          {schoolAddr && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 3 }}>{schoolAddr}</div>}
          {schoolPhone && <div style={{ fontSize: 11, opacity: 0.8 }}>Tél: {schoolPhone}</div>}
          {schoolEmail && <div style={{ fontSize: 11, opacity: 0.8 }}>{schoolEmail}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>BULLETIN DE SALAIRE</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>N° {receiptNo}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Émis le {printDate}</div>
          <div style={{
            marginTop: 8, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: 600,
          }}>{label}</div>
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        {/* Period */}
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <div><span style={{ color: '#6B7280', fontSize: 11 }}>PÉRIODE</span><br/><strong>{monthLabel} {salary.year}</strong></div>
          <div style={{ textAlign: 'right' }}><span style={{ color: '#6B7280', fontSize: 11 }}>STATUT</span><br/>
            <span style={{
              background: salary.paidAt ? '#D1FAE5' : '#FEF3C7',
              color: salary.paidAt ? '#065F46' : '#92400E',
              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            }}>
              {salary.paidAt ? 'Payé' : 'En attente'}
            </span>
          </div>
        </div>

        {/* Employee info */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <tbody>
            <tr style={{ background: '#F9FAFB' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', width: '40%', fontSize: 12 }}>Enseignant</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>{fullName}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', fontSize: 12 }}>Matricule</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>{teacher?.matricule ?? '—'}</td>
            </tr>
            <tr style={{ background: '#F9FAFB' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', fontSize: 12 }}>Contrat</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>{teacher?.contractType ?? '—'}</td>
            </tr>
            {user?.email && (
              <tr>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', fontSize: 12 }}>Email</td>
                <td style={{ padding: '8px 12px', fontSize: 12 }}>{user.email}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Salary breakdown */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Détail de la rémunération
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ background: '#1E3A8A', color: '#fff' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600 }}>Libellé</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600 }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 12 }}>Salaire de base</td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', textAlign: 'right', fontSize: 12 }}>{formatGNF(salary.baseSalary ?? 0)}</td>
            </tr>
            {(salary.bonuses ?? 0) > 0 && (
              <tr>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 12, color: '#059669' }}>Primes / Bonus (+)</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', textAlign: 'right', fontSize: 12, color: '#059669' }}>+{formatGNF(salary.bonuses)}</td>
              </tr>
            )}
            <tr style={{ background: '#F0FDF4' }}>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #D1FAE5', fontSize: 12, fontWeight: 600 }}>Salaire brut</td>
              <td style={{ padding: '8px 12px', borderBottom: '1px solid #D1FAE5', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{formatGNF(brut)}</td>
            </tr>
            {(salary.advances ?? 0) > 0 && (
              <tr>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 12, color: '#DC2626' }}>Avances (-)</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', textAlign: 'right', fontSize: 12, color: '#DC2626' }}>-{formatGNF(salary.advances)}</td>
              </tr>
            )}
            {(salary.deductions ?? 0) > 0 && (
              <tr>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 12, color: '#DC2626' }}>Retenues (-)</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', textAlign: 'right', fontSize: 12, color: '#DC2626' }}>-{formatGNF(salary.deductions)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1E3A8A', color: '#fff' }}>
              <td style={{ padding: '10px 12px', fontWeight: 800, fontSize: 13 }}>NET À PAYER</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, fontSize: 14 }}>{formatGNF(net)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Net in words */}
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 12 }}>
          <span style={{ color: '#92400E', fontWeight: 600 }}>Arrêté à la somme de : </span>
          <span style={{ fontStyle: 'italic' }}>{netWords}</span>
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px dashed #E5E7EB' }}>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 40 }}>Signature de l'employé</div>
            <div style={{ borderTop: '1px solid #374151', paddingTop: 6, fontSize: 11 }}>{fullName}</div>
          </div>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 40 }}>Signature et cachet de la direction</div>
            <div style={{ borderTop: '1px solid #374151', paddingTop: 6, fontSize: 11 }}>{directorName}</div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Toolbar (non-printable) */}
      <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center', padding: '0 16px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/payroll')}>Retour</Button>
        <span style={{ flex: 1, fontWeight: 600 }}>Bulletin de salaire — {fullName} — {monthLabel} {salary.year}</span>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimer</Button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      {/* Two copies */}
      <ReceiptCopy label="ORIGINAL" />
      <div className="no-print" style={{ textAlign: 'center', margin: '8px 0', color: '#9CA3AF', fontSize: 12 }}>
        — Couper ici —
      </div>
      <div style={{ borderTop: '2px dashed #D1D5DB', margin: '8px 0' }} />
      <ReceiptCopy label="DUPLICATA" />
    </div>
  )
}
