export type Gender = 'MALE' | 'FEMALE'
export type EnrollStatus = 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED' | 'EXPELLED'

export interface Student {
  id: string
  matricule: string
  firstName: string
  lastName: string
  gender: Gender
  birthDate: Date
  birthPlace?: string
  nationality?: string
  address?: string
  phone?: string
  email?: string
  photo?: string
  createdAt: Date
}

export interface Enrollment {
  id: string
  studentId: string
  classId: string
  academicYearId: string
  status: EnrollStatus
  enrolledAt: Date
}

export interface CreateStudentInput {
  firstName: string
  lastName: string
  gender: Gender
  birthDate: Date
  birthPlace?: string
  nationality?: string
  address?: string
  phone?: string
  email?: string
  photo?: string
}
