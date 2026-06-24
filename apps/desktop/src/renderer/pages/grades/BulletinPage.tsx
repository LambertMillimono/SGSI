import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Select, Spin, Result } from 'antd'
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { formatDate, getAppreciationLabel } from '../../utils/formatters'

const { Option } = Select

const PERIOD_LABELS: Record<number, string> = {
  1: '1er Trimestre',
  2: '2ème Trimestre',
  3: '3ème Trimestre',
}

const EVAL_COLS = [
  { key: 'DS1',         short: 'D.1' },
  { key: 'DS2',         short: 'D.2' },
  { key: 'COMPOSITION', short: 'Comp.' },
  { key: 'INTERRO',     short: 'Int.' },
  { key: 'TP',          short: 'T.P.' },
  { key: 'EXAM',        short: 'Exam.' },
]

function getDecisionColor(decision: string): string {
  if (!decision) return '#000'
  if (decision.toLowerCase().includes('admis')) return '#1a7a1a'
  if (decision.toLowerCase().includes('redouble')) return '#cc0000'
  return '#b87c00'
}

function getGradeColor(v: number): string {
  if (v >= 16) return '#15803d'
  if (v >= 10) return '#1e3a8a'
  return '#dc2626'
}

export function BulletinPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()

  const [student, setStudent] = useState<any>(null)
  const [school, setSchool] = useState<any>(null)
  const [bulletin, setBulletin] = useState<any>(null)
  const [averages, setAverages] = useState<any>(null)
  const [absences, setAbsences] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [qrUrl, setQrUrl] = useState('')

  // Load student + school
  useEffect(() => {
    if (!studentId) return
    Promise.all([
      ipc.students.getById(studentId),
      ipc.settings.getSchool(),
    ])
      .then(([s, sc]) => { setStudent(s); setSchool(sc) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [studentId])

  // Load period-specific data
  useEffect(() => {
    if (!student) return
    const enrollId = student.enrollments?.[0]?.id
    if (!enrollId) return
    Promise.all([
      ipc.bulletins.list(enrollId),
      ipc.grades.getAverages(enrollId, selectedPeriod),
      ipc.absences.listByEnrollment(enrollId),
    ]).then(([bs, avgs, abs]) => {
      setBulletin(bs.find((b: any) => b.period === selectedPeriod) ?? null)
      setAverages(avgs)
      setAbsences(abs)
    }).catch(() => {})
  }, [student, selectedPeriod])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (notFound || !student) {
    return (
      <Result
        status="404"
        title="Élève introuvable"
        extra={<Button onClick={() => navigate('/grades')}>Retour</Button>}
      />
    )
  }

  const enrollment = student.enrollments?.[0]
  const subjectAverages: any[] = averages?.subjectAverages ?? []
  // N'utiliser que les matières ayant des notes pour la moyenne affichée
  const gradedSubjects = subjectAverages.filter((s: any) => s.grades.length > 0)
  const computedAvg: number = averages?.generalAverage ?? 0
  const generalAverage: number = bulletin?.generalAverage ?? computedAvg
  const decision: string = bulletin?.decision ?? (computedAvg >= 10 ? 'Admis(e)' : computedAvg > 0 ? 'Insuffisant' : '—')
  const appreciation: string = bulletin?.appreciation ?? (computedAvg > 0 ? getAppreciationLabel(generalAverage) : '—')
  const rank: number = bulletin?.rank ?? 0
  const totalStudents: number = bulletin?.totalStudents ?? 0

  // QR code de vérification
  useEffect(() => {
    if (!student || !enrollment) return
    const data = `BULLETIN|${student.matricule}|${student.lastName} ${student.firstName}|${enrollment?.class?.name ?? ''}|${PERIOD_LABELS[selectedPeriod]}|${enrollment?.academicYear?.label ?? ''}|${generalAverage.toFixed(2)}|${new Date().toLocaleDateString('fr-FR')}`
    QRCode.toDataURL(data, { width: 80, margin: 1 }).then(setQrUrl).catch(() => {})
  }, [student, selectedPeriod, generalAverage])

  // Which evalTypes actually exist in the data?
  const usedEvalTypes = Array.from(
    new Set(subjectAverages.flatMap((s: any) => s.grades.map((g: any) => g.evalType)))
  )
  const activeCols = EVAL_COLS.filter((c) => usedEvalTypes.includes(c.key))

  // Absence stats
  const totalAbs = absences.length
  const justifiedAbs = absences.filter((a) => a.justified).length
  const unjustifiedAbs = totalAbs - justifiedAbs

  return (
    <div>
      {/* Barre de contrôle (non imprimée) */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', padding: '0 4px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Retour</Button>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>
          Bulletin — {student.lastName} {student.firstName}
        </span>
        <Select value={selectedPeriod} onChange={setSelectedPeriod} style={{ width: 170 }}>
          <Option value={1}>1er Trimestre</Option>
          <Option value={2}>2ème Trimestre</Option>
          <Option value={3}>3ème Trimestre</Option>
        </Select>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Imprimer
        </Button>
      </div>

      {/* ── BULLETIN IMPRIMABLE ─────────────────────────────────────── */}
      <div id="bulletin-print" style={{ background: '#fff', padding: 0 }}>
        <div style={{
          maxWidth: 780,
          margin: '0 auto',
          border: '2px solid #000',
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: 13,
          color: '#000',
          background: '#fff',
        }}>

          {/* ── EN-TÊTE ── */}
          <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
            {/* Colonne gauche : Ministère / École */}
            <div style={{
              flex: 1, padding: '10px 14px',
              borderRight: '1px solid #000',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.4 }}>
                Ministère de l'Éducation Nationale
              </div>
              <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>
                de l'Enseignement Technique et de la Formation Professionnelle
              </div>
              <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                {school?.name ?? 'École'}
              </div>
              {school?.address && (
                <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{school.address}</div>
              )}
              {school?.phone && (
                <div style={{ fontSize: 9, color: '#555' }}>Tél : {school.phone}</div>
              )}
            </div>

            {/* Centre : Logo / Sceau */}
            <div style={{
              width: 110,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '8px 6px',
              borderRight: '1px solid #000',
            }}>
              {school?.logo ? (
                <img src={school.logo} alt="Logo" style={{ width: 70, height: 70, objectFit: 'contain' }} />
              ) : (
                <div style={{
                  width: 70, height: 70, border: '2px solid #000',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 900, color: '#1E40AF',
                }}>
                  {(school?.sigle ?? 'S').slice(0, 2)}
                </div>
              )}
              <div style={{ fontSize: 8, marginTop: 4, textAlign: 'center', color: '#555' }}>
                {school?.sigle ?? ''}
              </div>
            </div>

            {/* Colonne droite : République + Photo */}
            <div style={{ flex: 1, display: 'flex' }}>
              <div style={{
                flex: 1, padding: '10px 14px',
                textAlign: 'center',
                borderRight: '1px solid #000',
              }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.4 }}>
                  République de Guinée
                </div>
                <div style={{ fontSize: 9, fontStyle: 'italic', marginTop: 4, color: '#333' }}>
                  Travail — Justice — Solidarité
                </div>
              </div>
              {/* Zone photo */}
              <div style={{
                width: 80, padding: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {student.photo ? (
                  <img
                    src={student.photo}
                    alt="Photo"
                    style={{ width: 66, height: 80, objectFit: 'cover', border: '1px solid #000' }}
                  />
                ) : (
                  <div style={{
                    width: 66, height: 80, border: '1px solid #000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: '#888', textAlign: 'center',
                  }}>
                    Photo
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── TITRE ── */}
          <div style={{
            textAlign: 'center', padding: '10px 16px',
            borderBottom: '2px solid #000',
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2 }}>
              Bulletin de Notes
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
              {PERIOD_LABELS[selectedPeriod]} — Année Scolaire {enrollment?.academicYear?.label ?? '—'}
            </div>
          </div>

          {/* ── INFOS ÉLÈVE ── */}
          <div style={{ borderBottom: '1px solid #000', padding: '8px 14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '2px 0', width: '50%' }}>
                    <b>Élève :</b> {student.lastName.toUpperCase()} {student.firstName}
                  </td>
                  <td style={{ padding: '2px 0', width: '25%' }}>
                    <b>Classe :</b> {enrollment?.class?.name ?? '—'}
                  </td>
                  <td style={{ padding: '2px 0', width: '25%', textAlign: 'right' }}>
                    <b>Effectif :</b> {totalStudents > 0 ? `${totalStudents} élèves` : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '2px 0' }}>
                    <b>Né(e) le :</b> {student.birthDate ? formatDate(student.birthDate) : '—'}
                    &nbsp;&nbsp;<b>à</b> {student.birthPlace ?? '—'}
                  </td>
                  <td style={{ padding: '2px 0' }}>
                    <b>Matricule :</b> {student.matricule}
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right' }}>
                    <b>Sexe :</b> {student.gender === 'MALE' ? 'Masculin' : 'Féminin'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── RÉSULTAT ── */}
          <div style={{
            borderBottom: '2px solid #000',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8,
          }}>
            {/* Décision */}
            <div style={{ textAlign: 'center', flex: '0 0 auto', minWidth: 160, maxWidth: 220 }}>
              <div style={{
                fontSize: 17, fontWeight: 900, textTransform: 'uppercase',
                letterSpacing: 1, color: getDecisionColor(decision),
                border: `2px solid ${getDecisionColor(decision)}`,
                padding: '6px 12px',
                lineHeight: 1.3, wordBreak: 'break-word',
                textAlign: 'center',
              }}>
                {decision}
              </div>
            </div>
            {/* Mention */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Mention :</div>
              <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {appreciation.toUpperCase()}
              </div>
            </div>
            {/* MGA */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>M.G.A. :</div>
              <div style={{
                fontSize: 22, fontWeight: 900,
                color: computedAvg > 0 ? getDecisionColor(decision) : '#888',
              }}>
                {computedAvg > 0 ? generalAverage.toFixed(2) : '—'}
                {computedAvg > 0 && <span style={{ fontSize: 13, fontWeight: 400 }}> /20</span>}
              </div>
              {gradedSubjects.length < subjectAverages.length && subjectAverages.length > 0 && (
                <div style={{ fontSize: 9, color: '#e67e22', marginTop: 2 }}>
                  ({gradedSubjects.length}/{subjectAverages.length} mat.)
                </div>
              )}
            </div>
            {/* Rang */}
            {rank > 0 && (
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>Rang :</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {rank}<span style={{ fontSize: 12, fontWeight: 400 }}>/{totalStudents}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── TABLEAU DES MATIÈRES ── */}
          <div style={{ borderBottom: '1px solid #000' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#e8e8e8' }}>
                  <th style={{ ...thStyle, textAlign: 'left', width: '32%', padding: '5px 10px' }}>
                    Matières
                  </th>
                  <th style={{ ...thStyle, width: 60 }}>Coeff.</th>
                  {activeCols.map((c) => (
                    <th key={c.key} style={{ ...thStyle, width: 50 }}>{c.short}</th>
                  ))}
                  <th style={{ ...thStyle, width: 60 }}>Moy.</th>
                  <th style={{ ...thStyle, textAlign: 'left', padding: '5px 8px' }}>Appréciation</th>
                </tr>
              </thead>
              <tbody>
                {subjectAverages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + activeCols.length}
                      style={{ textAlign: 'center', padding: 16, color: '#888', fontStyle: 'italic' }}
                    >
                      Aucune note saisie pour ce trimestre
                    </td>
                  </tr>
                ) : (
                  subjectAverages.map((s: any, i: number) => {
                    const gradeMap: Record<string, number> = {}
                    s.grades.forEach((g: any) => {
                      gradeMap[g.evalType] = (g.value / g.maxValue) * 20
                    })
                    const avg: number = s.average
                    const rowBg = i % 2 === 0 ? '#fff' : '#f9f9f9'
                    return (
                      <tr key={s.subjectId} style={{ background: rowBg }}>
                        <td style={{ ...tdStyle, textAlign: 'left', padding: '4px 10px', fontWeight: 600 }}>
                          {s.subjectName}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{s.coefficient}</td>
                        {activeCols.map((c) => (
                          <td key={c.key} style={{ ...tdStyle, textAlign: 'center' }}>
                            {gradeMap[c.key] != null ? (
                              <span style={{ color: getGradeColor(gradeMap[c.key]), fontWeight: 500 }}>
                                {gradeMap[c.key].toFixed(1) === gradeMap[c.key].toString()
                                  ? gradeMap[c.key].toFixed(0)
                                  : gradeMap[c.key].toFixed(2)}
                              </span>
                            ) : (
                              <span style={{ color: '#bbb' }}>—</span>
                            )}
                          </td>
                        ))}
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>
                          {s.grades.length > 0 ? (
                            <span style={{ color: getGradeColor(avg), fontWeight: 700 }}>
                              {avg.toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ color: '#bbb' }}>—</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'left', padding: '4px 8px', fontSize: 11 }}>
                          {s.grades.length > 0 ? getAppreciationLabel(avg) : ''}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {subjectAverages.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#e8e8e8', fontWeight: 700 }}>
                    <td style={{ ...tdStyle, textAlign: 'left', padding: '5px 10px' }}>
                      Moyenne Générale
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {subjectAverages.reduce((s: number, sa: any) => s + sa.coefficient, 0)}
                    </td>
                    {activeCols.map((c) => (
                      <td key={c.key} style={{ ...tdStyle }} />
                    ))}
                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: 14, color: getDecisionColor(decision) }}>
                      {generalAverage.toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', padding: '5px 8px', fontSize: 12 }}>
                      {appreciation}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ── ABSENCES + OBSERVATION ── */}
          <div style={{
            display: 'flex', borderBottom: '1px solid #000', fontSize: 11,
          }}>
            <div style={{ flex: 1, padding: '7px 14px', borderRight: '1px solid #000' }}>
              <b>Absences :</b>&nbsp;
              {totalAbs} jour(s) dont {justifiedAbs} justifié(s) et {unjustifiedAbs} non justifié(s)
            </div>
            <div style={{ flex: 2, padding: '7px 14px' }}>
              <b>Observation du Directeur :</b>
              <div style={{ minHeight: 28, borderBottom: '1px dotted #aaa', marginTop: 4 }} />
            </div>
          </div>

          {/* ── LÉGENDE ── */}
          {activeCols.length > 0 && (
            <div style={{ padding: '4px 14px', borderBottom: '1px solid #000', fontSize: 9, color: '#555' }}>
              <b>Légende :</b>&nbsp;
              {activeCols.map((c, i) => (
                <span key={c.key}>
                  {c.short} = {c.key === 'DS1' ? 'Devoir 1' : c.key === 'DS2' ? 'Devoir 2' : c.key === 'COMPOSITION' ? 'Composition' : c.key === 'INTERRO' ? 'Interrogation' : c.key === 'TP' ? 'Travaux Pratiques' : 'Examen'}
                  {i < activeCols.length - 1 ? '  |  ' : ''}
                </span>
              ))}
              &nbsp;&nbsp;• Moyenne saisie sur 20 points
            </div>
          )}

          {/* ── SIGNATURES ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
            {[
              { label: 'Le Directeur', name: school?.directorName ?? '' },
              { label: 'Le Professeur Principal', name: '' },
              { label: 'Le Parent / Tuteur', name: '' },
            ].map((sig, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 8px 14px',
                  borderRight: i < 2 ? '1px solid #000' : undefined,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 40 }}>{sig.label}</div>
                {sig.name && (
                  <div style={{ fontSize: 10, fontStyle: 'italic', color: '#444' }}>{sig.name}</div>
                )}
                <div style={{ borderBottom: '1px solid #333', width: '70%', margin: '0 auto' }} />
                <div style={{ fontSize: 9, color: '#777', marginTop: 3 }}>Signature et cachet</div>
              </div>
            ))}
          </div>

          {/* ── PIED DE PAGE ── */}
          <div style={{
            padding: '5px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 9, color: '#555',
          }}>
            <span>
              Édité le {new Date().toLocaleDateString('fr-FR')}
              {bulletin?.isValidated && (
                <span style={{ color: '#15803d', fontWeight: 700, marginLeft: 8 }}>✓ Validé</span>
              )}
            </span>
            <div style={{ textAlign: 'center' }}>
              {qrUrl && <img src={qrUrl} alt="QR" style={{ width: 56, height: 56, display: 'block' }} />}
              {qrUrl && <div style={{ fontSize: 7, color: '#aaa', marginTop: 1 }}>Vérification</div>}
            </div>
            <span>SGSI — Système de Gestion Scolaire Intégré</span>
          </div>

        </div>
      </div>

      {/* ── STYLES D'IMPRESSION ── */}
      <style>{`
        @media print {
          /* Couleurs forcées */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Masquer TOUT sauf le bulletin */
          body * { visibility: hidden !important; }
          #bulletin-print,
          #bulletin-print * { visibility: visible !important; }

          /* Positionner le bulletin en pleine page */
          #bulletin-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            z-index: 9999 !important;
          }
          #bulletin-print > div {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            border: 2px solid #000 !important;
          }
        }
        @page { size: A4 portrait; margin: 8mm; }
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  border: '1px solid #000',
  textAlign: 'center',
  padding: '5px 4px',
  fontWeight: 700,
  fontSize: 11,
}

const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc',
  padding: '4px 4px',
}
