import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { RootState } from '../store'
import { canAccess } from './permissions'

// Redirige vers /login si non authentifié
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Bloque l'accès à un module si le rôle n'y a pas droit
export function ModuleGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const role = useSelector((s: RootState) => s.auth.role)
  const navigate = useNavigate()

  if (!canAccess(role ?? '', module)) {
    return (
      <div style={{ padding: 60 }}>
        <Result
          status="403"
          title="Accès refusé"
          subTitle={`Votre rôle ne vous permet pas d'accéder à cette section.`}
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              Retour au tableau de bord
            </Button>
          }
        />
      </div>
    )
  }

  return <>{children}</>
}
