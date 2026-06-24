import type { PrismaClient } from '@prisma/client'
import { registerAuthIpc } from './auth.ipc'
import { registerStudentsIpc } from './students.ipc'
import { registerGradesIpc } from './grades.ipc'
import { registerPaymentsIpc } from './payments.ipc'
import { registerBackupIpc } from './backup.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerSubjectsIpc } from './subjects.ipc'
import { registerAbsencesIpc } from './absences.ipc'
import { registerTeachersIpc } from './teachers.ipc'
import { registerSchedulesIpc } from './schedules.ipc'
import { registerExpensesIpc } from './expenses.ipc'
import { registerParentsIpc } from './parents.ipc'
import { registerAuditLogIpc } from './auditlog.ipc'
import { registerLibraryIpc } from './library.ipc'
import { registerMedicalIpc } from './medical.ipc'
import { registerTransportIpc } from './transport.ipc'
import { registerNotificationsIpc } from './notifications.ipc'
import { registerDialogIpc } from './dialog.ipc'
import { registerStudentDocumentIpc } from './studentdocument.ipc'
import { registerLicenseIpc } from './license.ipc'
import { registerMessagesIpc } from './messages.ipc'
import { registerReportsIpc } from './reports.ipc'
import path from 'path'

export function registerIpcHandlers(db: PrismaClient): void {
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production'
  const dbPath = process.env.NODE_ENV === 'development'
    ? path.resolve(process.cwd(), '../../packages/db/prisma/sgsi.db')
    : path.join(process.env.APPDATA ?? '', 'sgsi', 'sgsi.db')

  registerAuthIpc(db, jwtSecret)
  registerStudentsIpc(db)
  registerGradesIpc(db)
  registerPaymentsIpc(db)
  registerBackupIpc(db, dbPath)
  registerSettingsIpc(db)
  registerSubjectsIpc(db)
  registerAbsencesIpc(db)
  registerTeachersIpc(db)
  registerSchedulesIpc(db)
  registerExpensesIpc(db)
  registerParentsIpc(db)
  registerAuditLogIpc(db)
  registerLibraryIpc(db)
  registerMedicalIpc(db)
  registerTransportIpc(db)
  registerNotificationsIpc(db)
  registerDialogIpc()
  registerStudentDocumentIpc(db)
  registerLicenseIpc(db)
  registerMessagesIpc(db)
  registerReportsIpc(db)
}
