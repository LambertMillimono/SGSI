import { useState } from 'react'
import { Form, Input, Button, Alert, Modal, Typography, Steps } from 'antd'
import {
  LockOutlined, UserOutlined, BookOutlined, TeamOutlined, TrophyOutlined, SafetyOutlined,
  KeyOutlined, CheckCircleOutlined, QuestionCircleOutlined, RiseOutlined, AuditOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ipc } from '../../utils/ipcBridge'

const STATS = [
  { value: '100%', label: 'Hors ligne', icon: <SafetyOutlined /> },
  { value: '∞',    label: 'Élèves',     icon: <TeamOutlined /> },
  { value: '0',    label: 'Perte data', icon: <RiseOutlined /> },
]

const FEATURES = [
  { icon: <TeamOutlined />,    text: 'Gestion complète des élèves & parents' },
  { icon: <BookOutlined />,    text: 'Notes, bulletins & absences' },
  { icon: <TrophyOutlined />,  text: 'Suivi des performances scolaires' },
  { icon: <AuditOutlined />,   text: 'Paiements, relances & rapports' },
]

export function LoginPage() {
  const [form] = Form.useForm()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [showForgotPwd, setShowForgotPwd] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      const result = await login(values.username, values.password)
      if ((result as any).mustChangePassword) {
        setPendingUserId((result as any).user?.id ?? null)
        setShowChangePwd(true)
      } else {
        navigate('/dashboard')
      }
    } catch (e: any) {
      setError(e.message ?? 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#070B14',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* ── Arrière-plan animé ─────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(79,70,229,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 80% at 80% 20%, rgba(245,158,11,0.10) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 50% 100%, rgba(30,58,138,0.25) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Grille subtile */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      {/* ── Panneau gauche ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 64px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 60 }}>
          <div style={{
            width: 56, height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(79,70,229,0.5)',
          }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>S</span>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>SGSI</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Gestion Scolaire Pro</div>
          </div>
        </div>

        {/* Titre principal */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 100,
            padding: '4px 14px',
            marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
            <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600, letterSpacing: 0.5 }}>
              v1.0.0 — Disponible maintenant
            </span>
          </div>

          <h1 style={{
            margin: 0,
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: -1.5,
            lineHeight: 1.1,
            background: 'linear-gradient(135deg, #FFFFFF 0%, rgba(255,255,255,0.6) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Le numérique<br />
            <span style={{
              background: 'linear-gradient(90deg, #818CF8, #A78BFA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              au service
            </span>
            <br />de l'éducation
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 16, fontSize: 15, lineHeight: 1.6 }}>
            Gérez votre établissement scolaire efficacement,<br />
            même sans connexion internet.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 48 }}>
          {STATS.map(s => (
            <div key={s.label} style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '20px 16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#818CF8', marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FEATURES.map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: 'rgba(79,70,229,0.2)',
                border: '1px solid rgba(79,70,229,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#818CF8', fontSize: 14,
              }}>
                {icon}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', paddingTop: 48 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            © 2026 Lambert Millimono — SGSI Gestion Scolaire Pro
          </span>
        </div>
      </div>

      {/* ── Panneau droit — formulaire ─────────────────────────────────── */}
      <div style={{
        width: 500,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 52px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Carte glassmorphique */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 28,
          padding: '44px 40px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}>
          {/* Header carte */}
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
              Connexion
            </h2>
            <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Bienvenue. Entrez vos identifiants pour continuer.
            </p>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{
                marginBottom: 24,
                borderRadius: 12,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#FCA5A5',
              }}
            />
          )}

          <Form form={form} onFinish={handleLogin} layout="vertical" size="large" requiredMark={false}>
            <Form.Item
              name="username"
              label={<span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13 }}>Identifiant</span>}
              rules={[{ required: true, message: 'Veuillez saisir votre identifiant' }]}
              style={{ marginBottom: 20 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                placeholder="Votre identifiant"
                autoComplete="username"
                style={{
                  height: 52,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  fontSize: 15,
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13 }}>Mot de passe</span>}
              rules={[{ required: true, message: 'Veuillez saisir votre mot de passe' }]}
              style={{ marginBottom: 28 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  height: 52,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  fontSize: 15,
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 54,
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  border: 'none',
                  boxShadow: '0 8px 24px rgba(79,70,229,0.45)',
                  letterSpacing: 0.3,
                }}
              >
                {loading ? 'Connexion en cours…' : 'Se connecter →'}
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Button
                type="link"
                icon={<QuestionCircleOutlined />}
                onClick={() => setShowForgotPwd(true)}
                style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}
              >
                Mot de passe oublié ?
              </Button>
            </div>
          </Form>

          {/* Badge sécurité */}
          <div style={{
            marginTop: 32,
            padding: '14px 18px',
            borderRadius: 14,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <SafetyOutlined style={{ color: '#10B981', fontSize: 18, flexShrink: 0 }} />
            <div>
              <div style={{ color: '#10B981', fontWeight: 700, fontSize: 12 }}>Application hors ligne sécurisée</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>
                Données stockées localement. Aucune connexion requise.
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingUserId && (
        <ChangePasswordModal
          open={showChangePwd}
          userId={pendingUserId}
          onSuccess={() => { setShowChangePwd(false); navigate('/dashboard') }}
        />
      )}
      <ForgotPasswordModal open={showForgotPwd} onClose={() => setShowForgotPwd(false)} />
    </div>
  )
}

// ─── Mot de passe oublié ───────────────────────────────────────────────────────
function ForgotPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep]               = useState(1)
  const [username, setUsername]       = useState('')
  const [userId, setUserId]           = useState<string | null>(null)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [loading, setLoading]         = useState(false)
  const [resending, setResending]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)
  const [useRecovery, setUseRecovery] = useState(false)
  const [form] = Form.useForm()

  const reset = () => {
    setStep(1); setUsername(''); setUserId(null); setMaskedEmail('')
    setError(null); setSuccess(false); setUseRecovery(false); form.resetFields()
  }
  const handleClose = () => { reset(); onClose() }

  const handleSendEmail = async () => {
    if (!username.trim()) return
    setLoading(true); setError(null)
    try {
      const result = await ipc.auth.sendResetEmail(username.trim())
      setUserId(result.userId); setMaskedEmail(result.maskedEmail); setStep(2)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleResetByOtp = async (values: { otp: string; newPassword: string }) => {
    if (!userId) return
    setLoading(true); setError(null)
    try { await ipc.auth.resetByOtp(userId, values.otp, values.newPassword); setSuccess(true) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleResetByRecovery = async (values: { recoveryCode: string; newPassword: string }) => {
    setLoading(true); setError(null)
    try { await ipc.auth.resetByRecovery(username.trim(), values.recoveryCode, values.newPassword); setSuccess(true) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleResend = async () => {
    if (!username.trim()) return
    setResending(true); setError(null)
    try { const result = await ipc.auth.sendResetEmail(username.trim()); setMaskedEmail(result.maskedEmail) }
    catch (e: any) { setError(e.message) }
    finally { setResending(false) }
  }

  const passwordFields = (
    <>
      <Form.Item name="newPassword" label={<span style={{ fontWeight: 600 }}>Nouveau mot de passe</span>}
        rules={[{ required: true, message: 'Requis' }, { min: 8, message: 'Minimum 8 caractères' }]}>
        <Input.Password size="large" style={{ borderRadius: 10 }} placeholder="Minimum 8 caractères" />
      </Form.Item>
      <Form.Item name="confirm" label={<span style={{ fontWeight: 600 }}>Confirmer</span>}
        dependencies={['newPassword']}
        rules={[{ required: true, message: 'Requis' }, ({ getFieldValue }) => ({
          validator(_, value) {
            if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
            return Promise.reject(new Error('Les mots de passe ne correspondent pas'))
          },
        })]}>
        <Input.Password size="large" style={{ borderRadius: 10 }} placeholder="Répétez le mot de passe" />
      </Form.Item>
    </>
  )

  return (
    <Modal title={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><KeyOutlined style={{ color: '#4F46E5' }} /><span>Mot de passe oublié</span></div>}
      open={open} onCancel={handleClose} footer={null} width={460}
      styles={{ body: { paddingTop: 8 } }} destroyOnHidden>
      {success ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 52, color: '#16A34A', display: 'block', marginBottom: 16 }} />
          <Typography.Title level={4} style={{ color: '#16A34A', margin: 0 }}>Mot de passe réinitialisé !</Typography.Title>
          <Typography.Text style={{ color: '#6B7280', display: 'block', marginTop: 8, marginBottom: 24 }}>
            Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
          </Typography.Text>
          <Button type="primary" size="large" style={{ borderRadius: 10 }} onClick={handleClose}>Se connecter</Button>
        </div>
      ) : (
        <>
          <Steps current={step - 1} size="small" style={{ marginBottom: 24 }}
            items={[{ title: 'Identifiant' }, { title: 'Vérification' }]} />
          {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} style={{ marginBottom: 16, borderRadius: 8 }} />}
          {step === 1 && (
            <>
              <Typography.Text style={{ display: 'block', color: '#6B7280', marginBottom: 16 }}>
                Entrez votre identifiant. Un code de vérification sera envoyé à votre email.
              </Typography.Text>
              <Input prefix={<UserOutlined style={{ color: '#9CA3AF' }} />} placeholder="Identifiant"
                size="large" value={username} onChange={e => { setUsername(e.target.value); setError(null) }}
                onPressEnter={handleSendEmail} style={{ borderRadius: 10, marginBottom: 16 }} autoFocus />
              <Button type="primary" block size="large" loading={loading} disabled={!username.trim()}
                onClick={handleSendEmail} style={{ borderRadius: 10 }}>Envoyer le code</Button>
            </>
          )}
          {step === 2 && !useRecovery && (
            <>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <Typography.Text style={{ fontWeight: 600, color: '#1E3A8A', display: 'block' }}>Code envoyé à {maskedEmail}</Typography.Text>
                <Typography.Text style={{ color: '#3B82F6', fontSize: 12 }}>
                  Vérifiez vos spams. Valable 15 min.{' '}
                  <Button type="link" size="small" loading={resending} style={{ padding: 0, fontSize: 12 }} onClick={handleResend}>Renvoyer</Button>
                </Typography.Text>
              </div>
              <Form form={form} layout="vertical" onFinish={handleResetByOtp} requiredMark={false}>
                <Form.Item name="otp" label={<span style={{ fontWeight: 600 }}>Code reçu par email</span>}
                  rules={[{ required: true, message: 'Requis' }, { len: 6, message: '6 chiffres' }]}>
                  <Input size="large" style={{ borderRadius: 10, letterSpacing: 8, fontWeight: 700, fontSize: 18 }}
                    placeholder="000000" maxLength={6} autoFocus />
                </Form.Item>
                {passwordFields}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => { setStep(1); setError(null) }} style={{ borderRadius: 10, flex: 1 }} size="large">Retour</Button>
                  <Button type="primary" htmlType="submit" loading={loading} style={{ borderRadius: 10, flex: 2 }} size="large">Réinitialiser</Button>
                </div>
              </Form>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Button type="link" size="small" style={{ color: '#9CA3AF', fontSize: 12 }}
                  onClick={() => { setUseRecovery(true); setError(null); form.resetFields() }}>
                  Utiliser le code de récupération
                </Button>
              </div>
            </>
          )}
          {step === 2 && useRecovery && (
            <>
              <Alert type="warning" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
                message="Code de récupération"
                description="Entrez le code défini dans Paramètres → Établissement." />
              <Form form={form} layout="vertical" onFinish={handleResetByRecovery} requiredMark={false}>
                <Form.Item name="recoveryCode" label={<span style={{ fontWeight: 600 }}>Code de récupération</span>}
                  rules={[{ required: true, message: 'Requis' }]}>
                  <Input.Password size="large" style={{ borderRadius: 10 }} autoFocus />
                </Form.Item>
                {passwordFields}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => { setUseRecovery(false); setError(null); form.resetFields() }} style={{ borderRadius: 10, flex: 1 }} size="large">Retour</Button>
                  <Button type="primary" htmlType="submit" loading={loading} style={{ borderRadius: 10, flex: 2 }} size="large">Réinitialiser</Button>
                </div>
              </Form>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

function ChangePasswordModal({ open, userId, onSuccess }: { open: boolean; userId: string; onSuccess: () => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: { newPassword: string }) => {
    setLoading(true); setError(null)
    try { await ipc.auth.changePassword(userId, values.newPassword); form.resetFields(); onSuccess() }
    catch (e: any) { setError(e.message ?? 'Erreur') }
    finally { setLoading(false) }
  }

  return (
    <Modal title={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><LockOutlined style={{ color: '#4F46E5' }} /><span>Changer votre mot de passe</span></div>}
      open={open} footer={null} closable={false} maskClosable={false} width={440}
      styles={{ body: { paddingTop: 8 } }}>
      <Alert type="info" showIcon message="Votre mot de passe temporaire doit être changé." style={{ marginBottom: 20, borderRadius: 8 }} />
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16, borderRadius: 8 }} />}
      <Form form={form} onFinish={handleSubmit} layout="vertical" requiredMark={false}>
        <Form.Item name="newPassword" label={<span style={{ fontWeight: 600 }}>Nouveau mot de passe</span>}
          rules={[{ required: true, message: 'Requis' }, { min: 8, message: 'Minimum 8 caractères' }]}>
          <Input.Password size="large" style={{ borderRadius: 8 }} placeholder="Minimum 8 caractères" />
        </Form.Item>
        <Form.Item name="confirm" label={<span style={{ fontWeight: 600 }}>Confirmer</span>}
          dependencies={['newPassword']}
          rules={[{ required: true, message: 'Requis' }, ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
              return Promise.reject(new Error('Mots de passe différents'))
            },
          })]}>
          <Input.Password size="large" style={{ borderRadius: 8 }} placeholder="Répétez le mot de passe" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block size="large"
          style={{ height: 48, borderRadius: 8, fontWeight: 600, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', border: 'none' }}>
          Confirmer le nouveau mot de passe
        </Button>
      </Form>
    </Modal>
  )
}
