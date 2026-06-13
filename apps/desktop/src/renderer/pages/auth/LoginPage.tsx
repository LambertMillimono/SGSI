import { useState } from 'react'
import { Form, Input, Button, Alert, Modal, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ipc } from '../../utils/ipcBridge'

export function LoginPage() {
  const [form] = Form.useForm()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
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
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #1D4ED8 100%)',
    }}>
      <div style={{
        width: 420,
        background: '#fff',
        borderRadius: 16,
        padding: '48px 40px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
      }}>
        {/* Logo + branding */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #1E40AF, #1D4ED8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Typography.Text style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>S</Typography.Text>
          </div>
          <Typography.Title level={2} style={{ color: '#1E40AF', margin: 0, fontSize: 28 }}>
            SGSI
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Le numérique au service de l'éducation
          </Typography.Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 20, borderRadius: 8 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form form={form} onFinish={handleLogin} layout="vertical" size="large" requiredMark={false}>
          <Form.Item
            name="username"
            label="Identifiant"
            rules={[{ required: true, message: 'Veuillez saisir votre identifiant' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#9CA3AF' }} />}
              placeholder="Identifiant ou email"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mot de passe"
            rules={[{ required: true, message: 'Veuillez saisir votre mot de passe' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9CA3AF' }} />}
              placeholder="Mot de passe"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              style={{ height: 48, fontSize: 16, borderRadius: 8 }}
            >
              Se connecter
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 20, borderTop: '1px solid #F3F4F6' }}>
          <Typography.Text style={{ fontSize: 12, color: '#9CA3AF' }}>
            SchoolManager Pro — v1.0.0
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
    </div>
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
      title="Changer votre mot de passe"
      open={open}
      footer={null}
      closable={false}
      maskClosable={false}
      width={420}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Votre mot de passe temporaire doit être changé avant de continuer.
      </Typography.Paragraph>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Form form={form} onFinish={handleSubmit} layout="vertical" requiredMark={false}>
        <Form.Item
          name="newPassword"
          label="Nouveau mot de passe"
          rules={[
            { required: true, message: 'Requis' },
            { min: 8, message: 'Minimum 8 caractères' },
          ]}
        >
          <Input.Password size="large" />
        </Form.Item>

        <Form.Item
          name="confirm"
          label="Confirmer le mot de passe"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Requis' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('Les mots de passe ne correspondent pas'))
              },
            }),
          ]}
        >
          <Input.Password size="large" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ marginTop: 8 }}>
          Confirmer le nouveau mot de passe
        </Button>
      </Form>
    </Modal>
  )
}
