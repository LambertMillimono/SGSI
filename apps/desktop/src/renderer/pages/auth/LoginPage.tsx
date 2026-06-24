import { useState } from 'react'
import { Form, Input, Button, Alert, Modal, Typography, Steps } from 'antd'
import {
  LockOutlined, UserOutlined, BookOutlined, TeamOutlined, TrophyOutlined, SafetyOutlined,
  KeyOutlined, CheckCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ipc } from '../../utils/ipcBridge'

const FEATURES = [
  { icon: <TeamOutlined />, text: 'Gestion complète des élèves' },
  { icon: <BookOutlined />, text: 'Notes, bulletins & absences' },
  { icon: <TrophyOutlined />, text: 'Suivi des performances' },
  { icon: <SafetyOutlined />, text: 'Données sécurisées & hors ligne' },
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
      background: '#F8FAFC',
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 56px',
        background: 'linear-gradient(145deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 300, height: 300,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, right: -60,
          width: 400, height: 400,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />

        {/* Logo */}
        <div style={{ marginBottom: 48, position: 'relative' }}>
          <div style={{
            width: 72, height: 72,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>S</span>
          </div>
          <Typography.Title style={{ color: '#fff', margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>
            SGSI
          </Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, display: 'block', marginTop: 4 }}>
            SchoolManager Pro
          </Typography.Text>
        </div>

        <Typography.Title level={3} style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>
          Le numérique au service de l'éducation
        </Typography.Title>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, marginBottom: 40, display: 'block' }}>
          Gérez votre établissement scolaire efficacement, même sans connexion internet.
        </Typography.Text>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FEATURES.map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, flexShrink: 0,
              }}>
                {icon}
              </div>
              <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{text}</Typography.Text>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 48 }}>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            © 2026 SchoolManager Pro — v1.0.0
          </Typography.Text>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        width: 480,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 56px',
        background: '#fff',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: 40 }}>
          <Typography.Title level={2} style={{ margin: 0, color: '#111827', fontWeight: 800, fontSize: 28 }}>
            Connexion
          </Typography.Title>
          <Typography.Text style={{ color: '#6B7280', fontSize: 14 }}>
            Bienvenue. Veuillez vous identifier pour continuer.
          </Typography.Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 24, borderRadius: 10 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form form={form} onFinish={handleLogin} layout="vertical" size="large" requiredMark={false}>
          <Form.Item
            name="username"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Identifiant</span>}
            rules={[{ required: true, message: 'Veuillez saisir votre identifiant' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#9CA3AF' }} />}
              placeholder="Identifiant ou email"
              autoComplete="username"
              style={{ height: 48, borderRadius: 10 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ fontWeight: 600, color: '#374151' }}>Mot de passe</span>}
            rules={[{ required: true, message: 'Veuillez saisir votre mot de passe' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9CA3AF' }} />}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ height: 48, borderRadius: 10 }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{
                height: 52, fontSize: 16, fontWeight: 700,
                borderRadius: 12,
                background: 'linear-gradient(90deg, #1E40AF, #2563EB)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
              }}
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              type="link"
              icon={<QuestionCircleOutlined />}
              onClick={() => setShowForgotPwd(true)}
              style={{ color: '#6B7280', fontSize: 13 }}
            >
              Mot de passe oublié ?
            </Button>
          </div>
        </Form>

        <div style={{
          marginTop: 48,
          padding: '16px 20px',
          borderRadius: 10,
          background: '#F9FAFB',
          border: '1px solid #F3F4F6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <SafetyOutlined style={{ color: '#16A34A', fontSize: 14 }} />
            <Typography.Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              Application hors ligne sécurisée
            </Typography.Text>
          </div>
          <Typography.Text style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>
            Vos données sont stockées localement sur cet appareil. Aucune connexion internet requise.
          </Typography.Text>
        </div>
      </div>

      {pendingUserId && (
        <ChangePasswordModal
          open={showChangePwd}
          userId={pendingUserId}
          onSuccess={() => {
            setShowChangePwd(false)
            navigate('/dashboard')
          }}
        />
      )}

      <ForgotPasswordModal
        open={showForgotPwd}
        onClose={() => setShowForgotPwd(false)}
      />
    </div>
  )
}

// ─── Mot de passe oublié (OTP par email) ─────────────────────────────────────
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

  // Step 1 — send OTP email
  const handleSendEmail = async () => {
    if (!username.trim()) return
    setLoading(true); setError(null)
    try {
      const result = await ipc.auth.sendResetEmail(username.trim())
      setUserId(result.userId)
      setMaskedEmail(result.maskedEmail)
      setStep(2)
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  // Step 2 — verify OTP and set new password
  const handleResetByOtp = async (values: { otp: string; newPassword: string }) => {
    if (!userId) return
    setLoading(true); setError(null)
    try {
      await ipc.auth.resetByOtp(userId, values.otp, values.newPassword)
      setSuccess(true)
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  // Fallback — recovery code
  const handleResetByRecovery = async (values: { recoveryCode: string; newPassword: string }) => {
    setLoading(true); setError(null)
    try {
      await ipc.auth.resetByRecovery(username.trim(), values.recoveryCode, values.newPassword)
      setSuccess(true)
    } catch (e: any) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    if (!username.trim()) return
    setResending(true); setError(null)
    try {
      const result = await ipc.auth.sendResetEmail(username.trim())
      setMaskedEmail(result.maskedEmail)
    } catch (e: any) {
      setError(e.message)
    } finally { setResending(false) }
  }

  const passwordFields = (
    <>
      <Form.Item
        name="newPassword"
        label={<span style={{ fontWeight: 600 }}>Nouveau mot de passe</span>}
        rules={[{ required: true, message: 'Requis' }, { min: 8, message: 'Minimum 8 caractères' }]}
      >
        <Input.Password size="large" style={{ borderRadius: 10 }} placeholder="Minimum 8 caractères" />
      </Form.Item>
      <Form.Item
        name="confirm"
        label={<span style={{ fontWeight: 600 }}>Confirmer le mot de passe</span>}
        dependencies={['newPassword']}
        rules={[
          { required: true, message: 'Requis' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
              return Promise.reject(new Error('Les mots de passe ne correspondent pas'))
            },
          }),
        ]}
      >
        <Input.Password size="large" style={{ borderRadius: 10 }} placeholder="Répétez le mot de passe" />
      </Form.Item>
    </>
  )

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <KeyOutlined style={{ color: '#1E40AF' }} />
          <span>Mot de passe oublié</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={460}
      styles={{ body: { paddingTop: 8 } }}
      destroyOnHidden
    >
      {success ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 52, color: '#16A34A', display: 'block', marginBottom: 16 }} />
          <Typography.Title level={4} style={{ color: '#16A34A', margin: 0 }}>
            Mot de passe réinitialisé !
          </Typography.Title>
          <Typography.Text style={{ color: '#6B7280', display: 'block', marginTop: 8, marginBottom: 24 }}>
            Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
          </Typography.Text>
          <Button type="primary" size="large" style={{ borderRadius: 10 }} onClick={handleClose}>
            Se connecter
          </Button>
        </div>
      ) : (
        <>
          <Steps
            current={step - 1}
            size="small"
            style={{ marginBottom: 24 }}
            items={[{ title: 'Identifiant' }, { title: 'Vérification' }]}
          />

          {error && (
            <Alert message={error} type="error" showIcon closable onClose={() => setError(null)}
              style={{ marginBottom: 16, borderRadius: 8 }} />
          )}

          {/* ── Étape 1 : saisie du nom d'utilisateur ─────────────────────── */}
          {step === 1 && (
            <>
              <Typography.Text style={{ display: 'block', color: '#6B7280', marginBottom: 16 }}>
                Entrez votre identifiant. Un code de vérification sera envoyé à votre adresse email.
              </Typography.Text>
              <Input
                prefix={<UserOutlined style={{ color: '#9CA3AF' }} />}
                placeholder="Identifiant"
                size="large"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(null) }}
                onPressEnter={handleSendEmail}
                style={{ borderRadius: 10, marginBottom: 16 }}
                autoFocus
              />
              <Button type="primary" block size="large" loading={loading}
                disabled={!username.trim()} onClick={handleSendEmail} style={{ borderRadius: 10 }}>
                Envoyer le code par email
              </Button>
            </>
          )}

          {/* ── Étape 2 : code OTP + nouveau mot de passe ─────────────────── */}
          {step === 2 && !useRecovery && (
            <>
              <div style={{
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <CheckCircleOutlined style={{ color: '#2563EB', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <Typography.Text style={{ fontWeight: 600, color: '#1E3A8A', display: 'block' }}>
                    Code envoyé à {maskedEmail}
                  </Typography.Text>
                  <Typography.Text style={{ color: '#3B82F6', fontSize: 12 }}>
                    Vérifiez votre boîte mail (et les spams). Valable 15 min.{' '}
                    <Button type="link" size="small" loading={resending}
                      style={{ padding: 0, fontSize: 12 }} onClick={handleResend}>
                      Renvoyer
                    </Button>
                  </Typography.Text>
                </div>
              </div>

              <Form form={form} layout="vertical" onFinish={handleResetByOtp} requiredMark={false}>
                <Form.Item
                  name="otp"
                  label={<span style={{ fontWeight: 600 }}>Code reçu par email</span>}
                  rules={[{ required: true, message: 'Requis' }, { len: 6, message: 'Le code fait 6 chiffres' }]}
                >
                  <Input
                    size="large" style={{ borderRadius: 10, letterSpacing: 8, fontWeight: 700, fontSize: 18 }}
                    placeholder="000000" maxLength={6} autoFocus
                  />
                </Form.Item>
                {passwordFields}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => { setStep(1); setError(null) }} style={{ borderRadius: 10, flex: 1 }} size="large">
                    Retour
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading}
                    style={{ borderRadius: 10, flex: 2 }} size="large">
                    Réinitialiser
                  </Button>
                </div>
              </Form>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Button type="link" size="small" style={{ color: '#9CA3AF', fontSize: 12 }}
                  onClick={() => { setUseRecovery(true); setError(null); form.resetFields() }}>
                  Utiliser le code de récupération à la place
                </Button>
              </div>
            </>
          )}

          {/* ── Fallback : code de récupération ───────────────────────────── */}
          {step === 2 && useRecovery && (
            <>
              <Alert type="warning" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
                message="Code de récupération"
                description="Entrez le code de récupération défini par l'administrateur dans Paramètres → Établissement." />
              <Form form={form} layout="vertical" onFinish={handleResetByRecovery} requiredMark={false}>
                <Form.Item
                  name="recoveryCode"
                  label={<span style={{ fontWeight: 600 }}>Code de récupération</span>}
                  rules={[{ required: true, message: 'Requis' }]}
                >
                  <Input.Password size="large" style={{ borderRadius: 10 }} autoFocus />
                </Form.Item>
                {passwordFields}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => { setUseRecovery(false); setError(null); form.resetFields() }}
                    style={{ borderRadius: 10, flex: 1 }} size="large">
                    Retour
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading}
                    style={{ borderRadius: 10, flex: 2 }} size="large">
                    Réinitialiser
                  </Button>
                </div>
              </Form>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

interface ChangePasswordModalProps {
  open: boolean
  userId: string
  onSuccess: () => void
}

function ChangePasswordModal({ open, userId, onSuccess }: ChangePasswordModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: { newPassword: string }) => {
    setLoading(true)
    setError(null)
    try {
      await ipc.auth.changePassword(userId, values.newPassword)
      form.resetFields()
      onSuccess()
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du changement de mot de passe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LockOutlined style={{ color: '#1E40AF' }} />
          <span>Changer votre mot de passe</span>
        </div>
      }
      open={open}
      footer={null}
      closable={false}
      maskClosable={false}
      width={440}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Alert
        type="info"
        showIcon
        message="Votre mot de passe temporaire doit être changé avant de continuer."
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16, borderRadius: 8 }} />}

      <Form form={form} onFinish={handleSubmit} layout="vertical" requiredMark={false}>
        <Form.Item
          name="newPassword"
          label={<span style={{ fontWeight: 600 }}>Nouveau mot de passe</span>}
          rules={[
            { required: true, message: 'Requis' },
            { min: 8, message: 'Minimum 8 caractères' },
          ]}
        >
          <Input.Password size="large" style={{ borderRadius: 8 }} placeholder="Minimum 8 caractères" />
        </Form.Item>

        <Form.Item
          name="confirm"
          label={<span style={{ fontWeight: 600 }}>Confirmer le mot de passe</span>}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Requis' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                return Promise.reject(new Error('Les mots de passe ne correspondent pas'))
              },
            }),
          ]}
        >
          <Input.Password size="large" style={{ borderRadius: 8 }} placeholder="Répétez le mot de passe" />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          block
          size="large"
          style={{ marginTop: 8, height: 48, borderRadius: 8, fontWeight: 600 }}
        >
          Confirmer le nouveau mot de passe
        </Button>
      </Form>
    </Modal>
  )
}
