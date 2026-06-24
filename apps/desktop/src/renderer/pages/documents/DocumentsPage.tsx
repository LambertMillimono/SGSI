import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, Result, Select, Space, Typography, Divider } from 'antd'
import {
  ArrowLeftOutlined, PrinterOutlined, FileDoneOutlined,
  SolutionOutlined, IdcardOutlined, UserOutlined, CreditCardOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { ipc } from '../../utils/ipcBridge'
import { formatDate } from '../../utils/formatters'

const { Option } = Select
const { Text } = Typography

type DocType = 'certificat' | 'attestation' | 'releve' | 'carte' | 'transfert' | 'convocation' | 'reussite'

export function DocumentsPage() {
  const { id: studentId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<any>(null)
  const [school, setSchool] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState<DocType>('certificat')
  const [period, setPeriod] = useState(1)

  useEffect(() => {
    if (!studentId) return
    Promise.all([
      ipc.students.getById(studentId),
      ipc.settings.getSchool(),
    ]).then(([s, sc]) => {
      setStudent(s)
      setSchool(sc)
    }).finally(() => setLoading(false))
  }, [studentId])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!student) return <Result status="404" title="Élève introuvable" extra={<Button onClick={() => navigate('/students')}>Retour</Button>} />

  const enrollment = student.enrollments?.[0]
  const className = enrollment?.class?.name ?? '—'
  const yearLabel = enrollment?.academicYear?.label ?? dayjs().year().toString()

  return (
    <div>
      {/* Barre contrôle */}
      <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/students/${studentId}`)}>
          Retour au dossier
        </Button>
        <Space>
          <Select value={docType} onChange={setDocType as any} style={{ width: 220 }}>
            <Option value="certificat">
              <FileDoneOutlined style={{ marginRight: 6 }} />Certificat de scolarité
            </Option>
            <Option value="attestation">
              <SolutionOutlined style={{ marginRight: 6 }} />Attestation de fréquentation
            </Option>
            <Option value="releve">
              <IdcardOutlined style={{ marginRight: 6 }} />Relevé de notes
            </Option>
            <Option value="carte">
              <CreditCardOutlined style={{ marginRight: 6 }} />Carte scolaire
            </Option>
            <Option value="transfert">
              <ExportOutlined style={{ marginRight: 6 }} />Attestation de transfert
            </Option>
            <Option value="convocation">
              <SolutionOutlined style={{ marginRight: 6 }} />Convocation aux examens
            </Option>
            <Option value="reussite">
              <FileDoneOutlined style={{ marginRight: 6 }} />Attestation de réussite
            </Option>
          </Select>
          {docType === 'releve' && (
            <Select value={period} onChange={setPeriod} style={{ width: 150 }}>
              <Option value={1}>1er Trimestre</Option>
              <Option value={2}>2ème Trimestre</Option>
              <Option value={3}>3ème Trimestre</Option>
            </Select>
          )}
        </Space>
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Imprimer
        </Button>
      </div>

      {/* Zone imprimable */}
      <div id="doc-print">
        {docType === 'certificat' && (
          <CertificatScolarite student={student} school={school} className={className} yearLabel={yearLabel} />
        )}
        {docType === 'attestation' && (
          <AttestationFrequentation student={student} school={school} className={className} yearLabel={yearLabel} />
        )}
        {docType === 'releve' && (
          <ReleveNotes student={student} school={school} className={className} yearLabel={yearLabel} period={period} />
        )}
        {docType === 'carte' && (
          <CarteScolare student={student} school={school} className={className} yearLabel={yearLabel} />
        )}
        {docType === 'transfert' && (
          <AttestationTransfert student={student} school={school} className={className} yearLabel={yearLabel} />
        )}
        {docType === 'convocation' && (
          <ConvocationExamens student={student} school={school} className={className} yearLabel={yearLabel} />
        )}
        {docType === 'reussite' && (
          <AttestationReussite student={student} school={school} className={className} yearLabel={yearLabel} />
        )}
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          #doc-print, #doc-print * { visibility: visible !important; }
          .no-print { display: none !important; }
          #doc-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important;
            padding: 12mm !important;
            background: #fff !important;
          }
        }
        @page { size: A4 portrait; margin: 10mm; }
      `}</style>
    </div>
  )
}

// ─── Certificat de scolarité ──────────────────────────────────────────────────
function CertificatScolarite({ student, school, className, yearLabel }: any) {
  const borderColor = '#1E40AF'
  const qrData = `CERTIFICAT|${student.matricule}|${student.lastName} ${student.firstName}|${className}|${yearLabel}|${school?.name ?? ''}|${dayjs().format('DD/MM/YYYY')}`
  return (
    <div style={{
      maxWidth: 700, margin: '0 auto', fontFamily: '"Times New Roman", Times, serif',
      border: `2px solid ${borderColor}`, borderRadius: 8, padding: '32px 48px',
      background: '#fff',
    }}>
      <OfficialHeader school={school} title="CERTIFICAT DE SCOLARITÉ" borderColor={borderColor} />

      <p style={{ textAlign: 'center', fontSize: 14, margin: '28px 0' }}>
        Le soussigné, Directeur de l'établissement <strong>{school?.name ?? 'l\'établissement'}</strong>,
        certifie que :
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0' }}>
        <tbody>
          {[
            ['Nom et prénom', `${student.lastName.toUpperCase()} ${student.firstName}`],
            ['Né(e) le', student.birthDate ? `${formatDate(student.birthDate)} à ${student.birthPlace ?? '—'}` : '—'],
            ['Matricule', student.matricule],
            ['Nationalité', student.nationality ?? 'Guinéenne'],
            ['Classe', className],
            ['Année scolaire', yearLabel],
          ].map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '8px 0', fontWeight: 700, width: '40%', fontSize: 13 }}>{label}</td>
              <td style={{ padding: '8px 0', fontSize: 13 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 13, margin: '24px 0', lineHeight: 1.8 }}>
        est bien inscrit(e) et fréquente régulièrement notre établissement au titre de
        l'année scolaire <strong>{yearLabel}</strong>.
      </p>

      <p style={{ fontSize: 12, color: '#555', fontStyle: 'italic', margin: '8px 0' }}>
        Ce certificat est délivré à la demande de l'intéressé(e) pour servir et valoir ce que de droit.
      </p>

      <OfficialFooter school={school} qrData={qrData} />
    </div>
  )
}

// ─── Attestation de fréquentation ────────────────────────────────────────────
function AttestationFrequentation({ student, school, className, yearLabel }: any) {
  const borderColor = '#15803D'
  const qrData = `ATTESTATION|${student.matricule}|${student.lastName} ${student.firstName}|${className}|${yearLabel}|${school?.name ?? ''}|${dayjs().format('DD/MM/YYYY')}`
  return (
    <div style={{
      maxWidth: 700, margin: '0 auto', fontFamily: '"Times New Roman", Times, serif',
      border: `2px solid ${borderColor}`, borderRadius: 8, padding: '32px 48px',
      background: '#fff',
    }}>
      <OfficialHeader school={school} title="ATTESTATION DE FRÉQUENTATION" borderColor={borderColor} />

      <p style={{ textAlign: 'center', fontSize: 14, margin: '28px 0' }}>
        Je soussigné(e), Directeur de l'établissement <strong>{school?.name ?? 'l\'établissement'}</strong>,
        atteste que l'élève :
      </p>

      <div style={{
        border: `1px solid ${borderColor}`, borderRadius: 6, padding: '16px 24px',
        margin: '20px 0', background: '#f0fdf4',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          {student.lastName.toUpperCase()} {student.firstName}
        </div>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 13 }}>
          Matricule : {student.matricule} — {className} — {yearLabel}
        </div>
      </div>

      <p style={{ fontSize: 13, margin: '24px 0', lineHeight: 1.8 }}>
        a bien fréquenté notre établissement et suit régulièrement les cours
        en classe de <strong>{className}</strong> au titre de l'année scolaire <strong>{yearLabel}</strong>.
      </p>
      <p style={{ fontSize: 13, margin: '8px 0', lineHeight: 1.8 }}>
        Cette attestation est délivrée pour servir et valoir ce que de droit,
        notamment pour toute démarche administrative requérant la preuve de scolarisation.
      </p>

      <OfficialFooter school={school} borderColor={borderColor} qrData={qrData} />
    </div>
  )
}

// ─── Relevé de notes ─────────────────────────────────────────────────────────
function ReleveNotes({ student, school, className, yearLabel, period }: any) {
  const borderColor = '#7C3AED'
  const periodLabel = ['1er Trimestre', '2ème Trimestre', '3ème Trimestre'][period - 1]
  const qrData = `RELEVE|${student.matricule}|${student.lastName} ${student.firstName}|${className}|${periodLabel}|${yearLabel}|${school?.name ?? ''}|${dayjs().format('DD/MM/YYYY')}`

  return (
    <div style={{
      maxWidth: 700, margin: '0 auto', fontFamily: '"Times New Roman", Times, serif',
      border: `2px solid ${borderColor}`, borderRadius: 8, padding: '32px 48px',
      background: '#fff',
    }}>
      <OfficialHeader school={school} title={`RELEVÉ DE NOTES — ${periodLabel}`} borderColor={borderColor} />

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0 8px' }}>
        <tbody>
          {[
            ['Élève', `${student.lastName.toUpperCase()} ${student.firstName}`],
            ['Matricule', student.matricule],
            ['Classe', className],
            ['Année scolaire', yearLabel],
            ['Période', periodLabel],
          ].map(([l, v]) => (
            <tr key={l} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '6px 0', fontWeight: 700, width: '40%', fontSize: 12 }}>{l}</td>
              <td style={{ padding: '6px 0', fontSize: 12 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Divider style={{ margin: '16px 0', borderColor }} />

      <p style={{ fontSize: 12, color: '#555', textAlign: 'center', fontStyle: 'italic', margin: '8px 0 16px' }}>
        Pour consulter le relevé complet avec les notes, générez le bulletin depuis le module Notes.
      </p>

      <OfficialFooter school={school} borderColor={borderColor} qrData={qrData} />
    </div>
  )
}

// ─── Carte scolaire ───────────────────────────────────────────────────────────
function CarteScolare({ student, school, className, yearLabel }: any) {
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    const qrData = [
      student.matricule,
      `${student.firstName} ${student.lastName}`,
      className,
      yearLabel,
      school?.name ?? '',
    ].join('|')
    QRCode.toDataURL(qrData, { width: 80, margin: 1, color: { dark: '#1a3a8a', light: '#ffffff' } })
      .then(setQrUrl)
      .catch(() => {})
  }, [student.matricule, className])

  const father  = student.parents?.find((sp: any) => sp.parent?.relation === 'PERE')?.parent  ?? null
  const mother  = student.parents?.find((sp: any) => sp.parent?.relation === 'MERE')?.parent  ?? null
  const tuteur  = student.parents?.find((sp: any) => sp.parent?.relation === 'TUTEUR')?.parent ?? null
  const urgPhone = father?.phone ?? mother?.phone ?? tuteur?.phone ?? student.phone ?? ''
  const yearParts = String(yearLabel ?? '').split('-')
  const startYear = yearParts[0] ?? String(dayjs().year())
  const endYear   = yearParts[1] ?? String(Number(startYear) + 1)

  const CARD_W = 500
  const CARD_H = 315

  const cardBase = {
    width: CARD_W, height: CARD_H, flexShrink: 0,
    borderRadius: 10, overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
    fontFamily: '"Segoe UI", Arial, sans-serif',
    background: '#fff',
    display: 'flex', flexDirection: 'column' as const,
  }

  const blueBand = {
    background: 'linear-gradient(90deg, #1a3a8a 0%, #2d6dd4 100%)',
    padding: '7px 14px', flexShrink: 0,
    display: 'flex', alignItems: 'center' as const,
  }

  const Logo = ({ size }: { size: number }) => school?.logo ? (
    <img src={school.logo} alt="Logo" style={{ width: size, height: size, objectFit: 'contain', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: Math.round(size * 0.32), flexShrink: 0 }}>
      {(school?.sigle ?? 'S').slice(0, 2)}
    </div>
  )

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
      <span style={{ fontSize: 9.5, color: '#4B5563', fontWeight: 600, minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 9.5, color: '#6B7280', marginRight: 2 }}>:</span>
      <span style={{ fontSize: 9.5, color: '#111827' }}>{value || '—'}</span>
    </div>
  )

  // ── RECTO ──────────────────────────────────────────────────────────────────
  const recto = (
    <div style={cardBase}>
      {/* Header blue band */}
      <div style={{ ...blueBand, gap: 10 }}>
        <Logo size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
            {school?.name ?? "NOM DE L'ÉCOLE"}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 8.5 }}>
            {school?.address ?? "Adresse de l'établissement"}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', padding: '14px 16px', gap: 16 }}>
        {/* Photo */}
        {student.photo ? (
          <img src={student.photo} alt="Photo" style={{ width: 90, height: 112, objectFit: 'cover', border: '1px solid #D1D5DB', flexShrink: 0, display: 'block' }} />
        ) : (
          <div style={{ width: 90, height: 112, flexShrink: 0, border: '1px solid #CBD5E1', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 28 }}>
            <UserOutlined />
            <span style={{ fontSize: 7, marginTop: 4 }}>PHOTO</span>
          </div>
        )}

        {/* Info fields */}
        <div style={{ flex: 1, paddingTop: 4 }}>
          <Field label="N° Enrôlement"   value={student.matricule ?? ''} />
          <Field label="Identifiant"     value={student.matricule ? student.matricule.slice(-5) : ''} />
          <Field label="Nom & Prénom(s)" value={`${student.firstName} ${student.lastName}`} />
          <Field label="Nom du Père"     value={father  ? `${father.firstName} ${father.lastName}`   : (tuteur ? `${tuteur.firstName} ${tuteur.lastName}` : '')} />
          <Field label="Nom de la Mère"  value={mother  ? `${mother.firstName} ${mother.lastName}`   : ''} />
          <Field label="Classe"          value={className} />
          <Field label="Contact urgence" value={urgPhone} />
        </div>
      </div>

      {/* Footer blue band */}
      <div style={{ ...blueBand, justifyContent: 'space-between' }}>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 8, lineHeight: 1.7 }}>
          <div>School address : {school?.address ?? '—'}</div>
          <div>Telephone : {school?.phone ?? '—'}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.35)', width: 72, marginBottom: 3 }} />
          <div style={{ fontSize: 8, color: '#fff', fontStyle: 'italic' }}>
            {school?.directorName ?? 'Le Directeur'}
          </div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)' }}>Principal</div>
        </div>
      </div>
    </div>
  )

  // ── VERSO ──────────────────────────────────────────────────────────────────
  const terms = [
    "Cette carte est la propriété exclusive de l'établissement scolaire. Le titulaire est tenu de la présenter sur demande à tout membre du personnel, agent de sécurité ou responsable de l'école.",
    "En cas de perte, de vol ou de détérioration, le titulaire doit le signaler immédiatement à l'administration. Les frais de remplacement et toute responsabilité liée à l'usage frauduleux sont à la charge du titulaire.",
  ]

  const verso = (
    <div style={cardBase}>
      {/* Header blue band */}
      <div style={{ ...blueBand, justifyContent: 'space-between' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 12, letterSpacing: 0.5 }}>
          TERMES ET CONDITIONS
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', textAlign: 'right', lineHeight: 1.7 }}>
          <div>Joined Date&nbsp;&nbsp;: 01/09/{startYear}</div>
          <div>Expire Date&nbsp;&nbsp;: 30/06/{endYear}</div>
        </div>
      </div>

      {/* Terms body */}
      <div style={{ flex: 1, padding: '14px 18px' }}>
        {terms.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ color: '#2563EB', fontWeight: 900, fontSize: 13, lineHeight: 1.1, flexShrink: 0, marginTop: 1 }}>•</span>
            <span style={{ fontSize: 9.5, color: '#374151', lineHeight: 1.6 }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Footer blue band */}
      <div style={{ ...blueBand, justifyContent: 'space-between' }}>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 8, lineHeight: 1.7 }}>
          {school?.phone  && <div>Phone&nbsp;&nbsp;&nbsp;: {school.phone}</div>}
          {school?.email  && <div>Mail&nbsp;&nbsp;&nbsp;&nbsp;: {school.email}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <Logo size={26} />
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 7, marginTop: 2 }}>{school?.sigle}</div>
          </div>
          {/* QR Code */}
          {qrUrl ? (
            <img src={qrUrl} alt="QR" style={{ width: 48, height: 48, borderRadius: 4, background: '#fff', padding: 2 }} />
          ) : (
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8, textAlign: 'center', letterSpacing: 1 }}>— RECTO —</Text>
        {recto}
      </div>
      <div>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8, textAlign: 'center', letterSpacing: 1 }}>— VERSO —</Text>
        {verso}
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>
        Format carte bancaire (85.6 × 53.98 mm) · Imprimez en recto/verso et plastifiez
      </Text>
    </div>
  )
}

// ─── Attestation de transfert ─────────────────────────────────────────────────
function AttestationTransfert({ student, school, className, yearLabel }: any) {
  const borderColor = '#B45309'
  const qrData = `TRANSFERT|${student.matricule}|${student.lastName} ${student.firstName}|${className}|${yearLabel}|${school?.name ?? ''}|${dayjs().format('DD/MM/YYYY')}`
  return (
    <div style={{
      maxWidth: 700, margin: '0 auto', fontFamily: '"Times New Roman", Times, serif',
      border: `2px solid ${borderColor}`, borderRadius: 8, padding: '32px 48px',
      background: '#fff',
    }}>
      <OfficialHeader school={school} title="ATTESTATION DE TRANSFERT" borderColor={borderColor} />

      <p style={{ textAlign: 'center', fontSize: 14, margin: '28px 0' }}>
        Nous soussigné(e), Directeur de l'établissement <strong>{school?.name ?? 'l\'établissement'}</strong>,
        attestons que :
      </p>

      <div style={{
        border: `1px solid ${borderColor}`, borderRadius: 6, padding: '16px 24px',
        margin: '20px 0', background: '#FFFBEB',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          {student.lastName.toUpperCase()} {student.firstName}
        </div>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 13 }}>
          Matricule : {student.matricule}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0' }}>
        <tbody>
          {[
            ['Date de naissance', student.birthDate ? `${formatDate(student.birthDate)} à ${student.birthPlace ?? '—'}` : '—'],
            ['Nationalité', student.nationality ?? 'Guinéenne'],
            ['Classe fréquentée', className],
            ['Année scolaire', yearLabel],
          ].map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '8px 0', fontWeight: 700, width: '45%', fontSize: 13 }}>{label}</td>
              <td style={{ padding: '8px 0', fontSize: 13 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 13, margin: '24px 0', lineHeight: 1.8 }}>
        a bien été inscrit(e) dans notre établissement au titre de l'année scolaire <strong>{yearLabel}</strong>
        et a fréquenté régulièrement nos cours en classe de <strong>{className}</strong>.
        À sa demande et pour lui permettre de poursuivre sa scolarité dans un autre établissement,
        nous lui délivrons la présente attestation de transfert.
      </p>

      <div style={{
        border: '1px dashed #D97706', borderRadius: 6, padding: '12px 16px',
        margin: '20px 0', background: '#FEF9C3',
      }}>
        <Text style={{ fontWeight: 700, fontSize: 12, color: '#92400E', display: 'block', marginBottom: 6 }}>
          ÉTABLISSEMENT D'ACCUEIL
        </Text>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid #D97706', paddingBottom: 8, marginBottom: 4,
        }}>
          <span style={{ fontSize: 12, color: '#92400E', minWidth: 80 }}>Nom :</span>
          <div style={{ flex: 1, borderBottom: '1px dotted #D97706', height: 22 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
          <span style={{ fontSize: 12, color: '#92400E', minWidth: 80 }}>Classe :</span>
          <div style={{ flex: 1, borderBottom: '1px dotted #D97706', height: 22 }} />
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#555', fontStyle: 'italic', margin: '8px 0' }}>
        Ce document est délivré pour servir et valoir ce que de droit.
        Il annule et remplace toute inscription précédente dans notre établissement.
      </p>

      <OfficialFooter school={school} borderColor={borderColor} qrData={qrData} />
    </div>
  )
}

// ─── Convocation aux examens ──────────────────────────────────────────────────
function ConvocationExamens({ student, school, className, yearLabel }: any) {
  const borderColor = '#DC2626'
  const qrData = `CONVOCATION|${student.matricule}|${student.lastName} ${student.firstName}|${className}|${yearLabel}|${school?.name ?? ''}|${dayjs().format('DD/MM/YYYY')}`
  return (
    <div style={{
      maxWidth: 700, margin: '0 auto', fontFamily: '"Times New Roman", Times, serif',
      border: `2px solid ${borderColor}`, borderRadius: 8, padding: '32px 48px',
      background: '#fff',
    }}>
      <OfficialHeader school={school} title="CONVOCATION AUX EXAMENS" borderColor={borderColor} />

      <p style={{ textAlign: 'center', fontSize: 14, margin: '28px 0' }}>
        L'administration de l'établissement <strong>{school?.name ?? 'l\'établissement'}</strong> convoque l'élève :
      </p>

      <div style={{
        border: `2px solid ${borderColor}`, borderRadius: 6, padding: '16px 24px',
        margin: '20px 0', background: '#FEF2F2',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 6, color: '#991B1B' }}>
          {student.lastName.toUpperCase()} {student.firstName}
        </div>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 13 }}>
          Matricule : <strong>{student.matricule}</strong> — Classe : <strong>{className}</strong>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0' }}>
        <tbody>
          {[
            ['Année scolaire', yearLabel],
            ['Session', '________________'],
            ['Date de l\'examen', '________________'],
            ['Heure', '________________'],
            ['Salle / Centre', '________________'],
            ['N° de table', '________________'],
          ].map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '8px 0', fontWeight: 700, width: '45%', fontSize: 13 }}>{label}</td>
              <td style={{ padding: '8px 0', fontSize: 13, color: value === '________________' ? '#aaa' : 'inherit' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        border: `1px solid ${borderColor}`, borderRadius: 6, padding: '12px 16px',
        margin: '20px 0', background: '#FFF5F5',
      }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: '#991B1B', marginBottom: 8 }}>INSTRUCTIONS :</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
          <li>Se présenter muni(e) de cette convocation et d'une pièce d'identité.</li>
          <li>Être présent(e) 30 minutes avant le début de l'épreuve.</li>
          <li>Tout matériel non autorisé sera confisqué.</li>
          <li>Le téléphone portable doit être éteint et rangé pendant l'examen.</li>
        </ul>
      </div>

      <p style={{ fontSize: 11, color: '#555', fontStyle: 'italic', margin: '8px 0' }}>
        Cette convocation doit être conservée et présentée le jour de l'examen.
        Toute absence devra être justifiée auprès de l'administration dans les 48 heures.
      </p>

      <OfficialFooter school={school} borderColor={borderColor} qrData={qrData} />
    </div>
  )
}

// ─── Attestation de réussite ──────────────────────────────────────────────────
function AttestationReussite({ student, school, className, yearLabel }: any) {
  const borderColor = '#0D9488'
  const qrData = `REUSSITE|${student.matricule}|${student.lastName} ${student.firstName}|${className}|${yearLabel}|${school?.name ?? ''}|${dayjs().format('DD/MM/YYYY')}`
  return (
    <div style={{
      maxWidth: 700, margin: '0 auto', fontFamily: '"Times New Roman", Times, serif',
      border: `2px solid ${borderColor}`, borderRadius: 8, padding: '32px 48px',
      background: '#fff',
    }}>
      <OfficialHeader school={school} title="ATTESTATION DE RÉUSSITE" borderColor={borderColor} />

      <p style={{ textAlign: 'center', fontSize: 14, margin: '28px 0' }}>
        Le soussigné, Directeur de l'établissement <strong>{school?.name ?? 'l\'établissement'}</strong>,
        atteste que l'élève :
      </p>

      <div style={{
        border: `2px solid ${borderColor}`, borderRadius: 6, padding: '20px 24px',
        margin: '20px 0', background: '#F0FDFA', textAlign: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#0F766E', marginBottom: 6, letterSpacing: 1 }}>
          {student.lastName.toUpperCase()} {student.firstName}
        </div>
        <div style={{ color: '#555', fontSize: 13 }}>
          Matricule : <strong>{student.matricule}</strong>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0' }}>
        <tbody>
          {[
            ['Date de naissance', student.birthDate ? `${formatDate(student.birthDate)} à ${student.birthPlace ?? '—'}` : '—'],
            ['Nationalité', student.nationality ?? 'Guinéenne'],
            ['Classe', className],
            ['Année scolaire', yearLabel],
            ['Décision', '________________'],
            ['Mention obtenue', '________________'],
          ].map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '8px 0', fontWeight: 700, width: '45%', fontSize: 13 }}>{label}</td>
              <td style={{ padding: '8px 0', fontSize: 13, color: value === '________________' ? '#aaa' : 'inherit' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ fontSize: 13, margin: '24px 0', lineHeight: 1.8 }}>
        a satisfait aux épreuves de fin d'année scolaire <strong>{yearLabel}</strong>
        et a été déclaré(e) <strong>ADMIS(E)</strong> en classe de <strong>{className}</strong>.
        Il/Elle a accompli les obligations de scolarité avec succès.
      </p>

      <div style={{
        border: `1px solid ${borderColor}`, borderRadius: 6, padding: '12px 16px',
        margin: '20px 0', background: '#F0FDFA',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, fontWeight: 900, flexShrink: 0,
        }}>✓</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0F766E' }}>Document authentifié par l'administration</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
            Cette attestation est délivrée pour servir et valoir ce que de droit.
          </div>
        </div>
      </div>

      <OfficialFooter school={school} borderColor={borderColor} qrData={qrData} />
    </div>
  )
}

// ─── Composants partagés ─────────────────────────────────────────────────────
function OfficialHeader({ school, title, borderColor = '#1E40AF' }: any) {
  return (
    <>
      {/* En-tête tripartite */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 24 }}>
        {/* Gauche */}
        <div style={{ flex: 1, fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 13 }}>
            {school?.name ?? 'Établissement'}
          </div>
          {school?.address && <div style={{ color: '#555' }}>{school.address}</div>}
          {school?.phone && <div style={{ color: '#555' }}>Tél : {school.phone}</div>}
        </div>

        {/* Centre — logo */}
        <div style={{ width: 100, textAlign: 'center', flexShrink: 0 }}>
          {school?.logo
            ? (
              <img
                src={school.logo}
                alt={school?.sigle ?? 'Logo'}
                style={{ width: 80, height: 80, objectFit: 'contain', display: 'block', margin: '0 auto' }}
              />
            )
            : (
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                border: `2px solid ${borderColor}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 900, color: borderColor, margin: '0 auto',
                lineHeight: 1,
              }}>
                <span>{(school?.sigle ?? 'S').slice(0, 2)}</span>
                <span style={{ fontSize: 8, fontWeight: 400, marginTop: 2, letterSpacing: 0.5 }}>LOGO</span>
              </div>
            )
          }
        </div>

        {/* Droite — République de Guinée */}
        <div style={{ flex: 1, fontSize: 11, textAlign: 'right', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700 }}>République de Guinée</div>
          <div style={{ color: '#555' }}>Travail — Justice — Solidarité</div>
          <div style={{ color: '#555', marginTop: 4 }}>
            Année : {dayjs().year()}
          </div>
        </div>
      </div>

      {/* Titre */}
      <div style={{
        textAlign: 'center',
        borderTop: `2px solid ${borderColor}`,
        borderBottom: `2px solid ${borderColor}`,
        padding: '10px 0',
        margin: '0 0 8px',
      }}>
        <div style={{
          fontSize: 20, fontWeight: 900, letterSpacing: 2,
          textTransform: 'uppercase', color: borderColor,
        }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
          N° : ________________ / {dayjs().year()}
        </div>
      </div>
    </>
  )
}

function OfficialFooter({ school, borderColor = '#1E40AF', qrData }: any) {
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    if (!qrData) return
    QRCode.toDataURL(qrData, { width: 72, margin: 1 }).then(setQrUrl).catch(() => {})
  }, [qrData])

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 50, fontStyle: 'italic', color: '#555' }}>Fait à ________________</div>
          <div style={{ fontWeight: 700 }}>Le Directeur</div>
          {school?.directorName && <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{school.directorName}</div>}
          <div style={{ marginTop: 4, color: '#555', fontSize: 10 }}>Signature et cachet</div>
          <div style={{ height: 50, borderBottom: '1px solid #aaa', width: 160, marginTop: 4 }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          {qrUrl && <img src={qrUrl} alt="QR" style={{ width: 72, height: 72 }} />}
          {qrUrl && <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>Code de vérification</div>}
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#777' }}>
          <div>Fait le : {dayjs().format('DD/MM/YYYY')}</div>
          <div style={{ marginTop: 60, fontStyle: 'italic' }}>Ce document a été généré par SGSI</div>
        </div>
      </div>
    </div>
  )
}
