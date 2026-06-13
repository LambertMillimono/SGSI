import { useSelector } from 'react-redux'
import type { RootState } from '../store'

type UserRole = 'SUPER_ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'ACCOUNTANT' | 'TEACHER'

export function useRole() {
  const role = useSelector((s: RootState) => s.auth.role)

  const hasRole = (...roles: UserRole[]) => role !== null && roles.includes(role as UserRole)
  const isDirecteur = () => hasRole('DIRECTOR', 'SUPER_ADMIN')
  const isSecretaire = () => hasRole('SECRETARY', 'DIRECTOR', 'SUPER_ADMIN')
  const isEnseignant = () => hasRole('TEACHER')

  return { role, hasRole, isDirecteur, isSecretaire, isEnseignant }
}
