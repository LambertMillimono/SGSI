export type AppRole = 'SUPER_ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'ACCOUNTANT' | 'TEACHER'

// '*' = accès à tout
// Seuls SUPER_ADMIN et ACCOUNTANT ont accès aux modules financiers (payments, expenses)
export const ROLE_PERMISSIONS: Record<string, string[] | '*'> = {
  SUPER_ADMIN: '*',
  DIRECTOR:    ['dashboard', 'students', 'grades', 'absences', 'schedule', 'staff', 'payroll', 'reports', 'library', 'infirmerie', 'transport', 'messages', 'settings'],
  SECRETARY:   ['dashboard', 'students', 'absences', 'schedule', 'library', 'infirmerie', 'transport', 'messages'],
  ACCOUNTANT:  ['dashboard', 'students', 'payments', 'expenses', 'payroll', 'reports', 'messages'],
  TEACHER:     ['dashboard', 'grades', 'absences', 'schedule', 'library', 'messages'],
}

export function canAccess(role: string | undefined, module: string): boolean {
  if (!role) return false
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  if (perms === '*') return true
  // Check exact match OR parent module prefix (e.g. 'payments/plans' → also checks 'payments')
  const baseModule = module.split('/')[0]
  return perms.includes(module) || perms.includes(baseModule)
}

// Retourne la liste des modules accessibles pour un rôle donné
export function allowedModules(role: string | undefined): string[] | '*' {
  if (!role) return []
  return ROLE_PERMISSIONS[role] ?? []
}
