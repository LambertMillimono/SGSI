export type AppRole = 'SUPER_ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'ACCOUNTANT' | 'TEACHER'

// '*' = accès à tout
// Seuls SUPER_ADMIN et ACCOUNTANT ont accès aux modules financiers (payments, expenses)
export const ROLE_PERMISSIONS: Record<string, string[] | '*'> = {
  SUPER_ADMIN: '*',
  DIRECTOR:    ['dashboard', 'students', 'grades', 'absences', 'schedule', 'staff', 'reports', 'library', 'infirmerie', 'transport', 'messages', 'settings'],
  SECRETARY:   ['dashboard', 'students', 'absences', 'schedule', 'library', 'infirmerie', 'transport', 'messages'],
  ACCOUNTANT:  ['dashboard', 'students', 'payments', 'expenses', 'reports', 'messages'],
  TEACHER:     ['dashboard', 'grades', 'absences', 'schedule', 'library', 'messages'],
}

export function canAccess(role: string | undefined, module: string): boolean {
  if (!role) return false
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  if (perms === '*') return true
  return perms.includes(module)
}

// Retourne la liste des modules accessibles pour un rôle donné
export function allowedModules(role: string | undefined): string[] | '*' {
  if (!role) return []
  return ROLE_PERMISSIONS[role] ?? []
}
