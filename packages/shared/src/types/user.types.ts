export type Role = 'SUPER_ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'ACCOUNTANT' | 'TEACHER'

export interface User {
  id: string
  username: string
  role: Role
  firstName: string
  lastName: string
  phone?: string
  email?: string
  isActive: boolean
  mustChangePassword: boolean
  lastLogin?: Date
  createdAt: Date
}

export interface TokenPayload {
  userId: string
  username: string
  role: Role
  iat: number
  exp: number
}

export interface Permission {
  module: string
  actions: ('read' | 'write' | 'delete' | 'validate')[]
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [{ module: '*', actions: ['read', 'write', 'delete', 'validate'] }],
  DIRECTOR: [
    { module: 'students', actions: ['read'] },
    { module: 'grades', actions: ['read', 'validate'] },
    { module: 'bulletins', actions: ['read', 'validate'] },
    { module: 'payments', actions: ['read', 'validate'] },
    { module: 'staff', actions: ['read', 'write'] },
    { module: 'reports', actions: ['read'] },
    { module: 'school', actions: ['read', 'write'] },
  ],
  SECRETARY: [
    { module: 'students', actions: ['read', 'write'] },
    { module: 'absences', actions: ['read', 'write'] },
    { module: 'documents', actions: ['read', 'write'] },
  ],
  ACCOUNTANT: [
    { module: 'payments', actions: ['read', 'write'] },
    { module: 'expenses', actions: ['read', 'write'] },
    { module: 'reports', actions: ['read'] },
    { module: 'salary', actions: ['read', 'write'] },
  ],
  TEACHER: [
    { module: 'grades', actions: ['read', 'write'] },
    { module: 'absences', actions: ['read', 'write'] },
    { module: 'classes', actions: ['read'] },
  ],
}
