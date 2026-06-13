import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Select, Spin, Result, Typography,
  Divider, Card, Row, Col, Tag,
} from 'antd'
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { getAppreciationLabel } from '../../utils/formatters'

const { Option } = Select
const { Title, Text } = Typography

function getAppreciationColor(avg: number): string {
  if (avg >= 16) return 'success'
  if (avg >= 12) return 'processing'
  if (avg >= 10) return 'warning'
  return 'error'
}

export function BulletinPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<any>(null)
  const [bulletins, setBulletins] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    ipc.students.getById(studentId)
      .then(async (s) => {
        setStudent(s)
        const enrollId = s.enrollments?.[0]?.id
        if (enrollId) {
          const bs = await ipc.bulletins.list(enrollId).catch(() => [])
          setBulletins(bs)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [studentId])

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

  const currentBulletin = bulletins.find((b) => b.period === selectedPeriod)
  const enrollment = student.enrollments?.[0]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/grades')}>Retour</Button>
        <Title level={4} style={{ margin: 0, flex: 1 }}>
          Bulletin — {student.lastName} {student.firstName}
        </Title>
        <Select value={selectedPeriod} onChange={setSelectedPeriod} style={{ width: 160 }}>
          <Option value={1}>Trimestre 1</Option>
          <Option value={2}>Trimestre 2</Option>
          <Option value={3}>Trimestre 3</Option>
        </Select>
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          onClick={() => window.print()}
        >
          Imprimer
        </Button>
      </div>

      <div id="bulletin-print">
        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          {/* Header établissement */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={3} style={{ margin: 0 }}>BULLETIN DE NOTES</Title>
            <Text type="secondary">Trimestre {selectedPeriod} — Année scolaire {enrollment?.academicYear?.label ?? '—'}</Text>
          </div>

          <Divider />

          {/* Infos élève */}
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={12}>
              <Text strong>Nom : </Text><Text>{student.lastName} {student.firstName}</Text><br />
              <Text strong>Matricule : </Text><Text code>{student.matricule}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Classe : </Text><Text>{enrollment?.class?.name ?? '—'}</Text><br />
              <Text strong>Année : </Text><Text>{enrollment?.academicYear?.label ?? '—'}</Text>
            </Col>
          </Row>

          {/* Résultat bulletin */}
          {currentBulletin ? (
            <>
              <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col span={8}>
                  <Card size="small" style={{ textAlign: 'center', background: '#EFF6FF' }}>
                    <Title level={2} style={{ margin: 0, color: '#1E40AF' }}>
                      {currentBulletin.generalAverage?.toFixed(2)}
                    </Title>
                    <Text type="secondary">Moyenne générale /20</Text>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Title level={2} style={{ margin: 0 }}>
                      {currentBulletin.rank}<Text style={{ fontSize: 14 }}>/{currentBulletin.totalStudents}</Text>
                    </Title>
                    <Text type="secondary">Rang</Text>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ textAlign: 'center' }}>
                    <Tag
                      color={getAppreciationColor(currentBulletin.generalAverage ?? 0)}
                      style={{ fontSize: 14, padding: '4px 12px' }}
                    >
                      {getAppreciationLabel(currentBulletin.generalAverage ?? 0)}
                    </Tag>
                    <br />
                    <Text type="secondary">Appréciation</Text>
                  </Card>
                </Col>
              </Row>

              {currentBulletin.isValidated && (
                <Tag color="success" style={{ marginBottom: 16 }}>✓ Bulletin validé par le directeur</Tag>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
              <Text type="secondary">
                Aucun bulletin généré pour ce trimestre.
                Les notes doivent être saisies et validées par le professeur principal.
              </Text>
            </div>
          )}

          <Divider />

          {/* Signatures */}
          <Row gutter={16} style={{ marginTop: 40 }}>
            <Col span={8} style={{ textAlign: 'center' }}>
              <div style={{ height: 60, borderBottom: '1px solid #333', width: '80%', margin: '0 auto' }} />
              <Text style={{ fontSize: 12 }}>Le Directeur</Text>
            </Col>
            <Col span={8} style={{ textAlign: 'center' }}>
              <div style={{ height: 60, borderBottom: '1px solid #333', width: '80%', margin: '0 auto' }} />
              <Text style={{ fontSize: 12 }}>Professeur Principal</Text>
            </Col>
            <Col span={8} style={{ textAlign: 'center' }}>
              <div style={{ height: 60, borderBottom: '1px solid #333', width: '80%', margin: '0 auto' }} />
              <Text style={{ fontSize: 12 }}>Parent / Tuteur</Text>
            </Col>
          </Row>
        </Card>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #bulletin-print, #bulletin-print * { visibility: visible; }
          #bulletin-print { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}
