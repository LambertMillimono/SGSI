type IpcOk<T> = { success: true; data: T }
type IpcFail = { success: false; error: { code: string; message: string } }
type IpcResult<T> = IpcOk<T> | IpcFail

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const electron = (window as any).electron
  if (!electron?.ipc) {
    // Preload not ready or running outside Electron — return rejected Promise
    // so callers' .catch() handlers fire instead of crashing the React tree
    return Promise.reject(new Error(`IPC non disponible (channel: ${channel})`))
  }
  return electron.ipc.invoke(channel, ...args).then((res: IpcResult<T>) => {
    if (!res.success) throw new Error((res as IpcFail).error?.message ?? 'IPC Error')
    return (res as IpcOk<T>).data
  })
}

export const ipc = {
  auth: {
    login: (username: string, password: string) =>
      invoke<{ token: string; user: { id: string; username: string; role: string; firstName: string; lastName: string } }>('auth:login', username, password),
    logout: () => invoke<null>('auth:logout'),
    changePassword: (userId: string, newPassword: string) =>
      invoke<null>('auth:changePassword', userId, newPassword),
    verifyToken: (token: string) =>
      invoke<{ userId: string; username: string; role: string }>('auth:verifyToken', token),
    findByUsername: (username: string) =>
      invoke<{ id: string; firstName: string; lastName: string; role: string }>('auth:findByUsername', username),
    sendResetEmail: (username: string) =>
      invoke<{ maskedEmail: string; userId: string }>('auth:sendResetEmail', username),
    resetByOtp: (userId: string, otp: string, newPassword: string) =>
      invoke<null>('auth:resetByOtp', userId, otp, newPassword),
    resetByRecovery: (username: string, recoveryCode: string, newPassword: string) =>
      invoke<null>('auth:resetByRecovery', username, recoveryCode, newPassword),
  },
  students: {
    list: (filters?: { search?: string; classId?: string }) =>
      invoke<any[]>('students:list', filters),
    getById: (id: string) =>
      invoke<any>('students:findById', id),
    create: (data: any, actorId: string) =>
      invoke<any>('students:create', data, actorId),
    update: (id: string, data: any, actorId: string) =>
      invoke<any>('students:update', id, data, actorId),
    delete: (id: string, actorId: string) =>
      invoke<null>('students:delete', id, actorId),
    enroll: (studentId: string, classId: string, yearId: string, actorId: string) =>
      invoke<any>('students:enroll', studentId, classId, yearId, actorId),
  },
  classes: {
    list: (yearId?: string) => invoke<any[]>('classes:list', yearId),
    listCycles: () => invoke<any[]>('cycles:list'),
    listLevels: () => invoke<any[]>('levels:list'),
  },
  grades: {
    list: (enrollmentId: string, period: number) =>
      invoke<any[]>('grades:list', enrollmentId, period),
    save: (data: any, actorId: string) =>
      invoke<any>('grades:save', data, actorId),
    upsert: (data: any, actorId: string) =>
      invoke<any>('grades:upsert', data, actorId),
    listByClass: (classId: string, subjectId: string, period: number, evalType: string) =>
      invoke<any[]>('grades:listByClass', classId, subjectId, period, evalType),
    getAverages: (enrollmentId: string, period: number) =>
      invoke<any>('grades:averages', enrollmentId, period),
    getRanking: (classId: string, period: number) =>
      invoke<any[]>('grades:ranking', classId, period),
    statsBySubject: (classId: string, period: number) =>
      invoke<any[]>('grades:statsBySubject', classId, period),
    parseCsv: () =>
      invoke<Array<{ lastName: string; firstName: string; matricule: string; value: number | null }> | null>('grades:parseCsv'),
  },
  bulletins: {
    generate: (enrollmentId: string, period: number, actorId: string) =>
      invoke<any>('bulletins:generate', enrollmentId, period, actorId),
    generateForClass: (classId: string, period: number, actorId: string) =>
      invoke<{ success: number; failed: number; total: number }>('bulletins:generateForClass', classId, period, actorId),
    validate: (bulletinId: string, directorId: string) =>
      invoke<any>('bulletins:validate', bulletinId, directorId),
    list: (enrollmentId: string) =>
      invoke<any[]>('bulletins:list', enrollmentId),
    countUnvalidated: () =>
      invoke<number>('bulletins:countUnvalidated'),
  },
  payments: {
    list: (enrollmentId: string) =>
      invoke<any[]>('payments:list', enrollmentId),
    listUnpaid: (classId?: string) =>
      invoke<any[]>('payments:unpaid', classId),
    record: (data: any, cashierId: string) =>
      invoke<any>('payments:record', data, cashierId),
    getReceipt: (id: string) => invoke<any>('payments:receipt', id),
    listFeeTypes: (levelId?: string) =>
      invoke<any[]>('feetypes:list', levelId),
    createFeeType: (data: { name: string; amount: number; levelId?: string; isRequired?: boolean }, actorId: string) =>
      invoke<any>('feetypes:create', data, actorId),
    updateFeeType: (id: string, data: { name?: string; amount?: number; isRequired?: boolean }, actorId: string) =>
      invoke<any>('feetypes:update', id, data, actorId),
    deleteFeeType: (id: string, actorId: string) =>
      invoke<null>('feetypes:delete', id, actorId),
    report: (year: number) => invoke<any>('payments:report', year),
    reportByFeeType: (year: number) => invoke<any[]>('payments:reportByFeeType', year),
  },
  subjects: {
    list: () => invoke<any[]>('subjects:list'),
    create: (data: { name: string; code: string }) => invoke<any>('subjects:create', data),
    delete: (id: string) => invoke<null>('subjects:delete', id),
    listByClass: (classId: string) => invoke<any[]>('classSubjects:list', classId),
    addToClass: (data: { classId: string; subjectId: string; coefficient: number; hoursPerWeek: number }) =>
      invoke<any>('classSubjects:add', data),
    updateInClass: (id: string, data: { coefficient?: number; hoursPerWeek?: number }) =>
      invoke<any>('classSubjects:update', id, data),
    removeFromClass: (id: string) => invoke<null>('classSubjects:remove', id),
    listByLevel: (levelId: string) => invoke<any[]>('levelSubjects:list', levelId),
    setForLevel: (data: { levelId: string; subjectId: string; coefficient: number; hoursPerWeek: number }) =>
      invoke<any>('levelSubjects:upsert', data),
    removeFromLevel: (id: string) => invoke<null>('levelSubjects:remove', id),
    applyLevelToClasses: (levelId: string) =>
      invoke<{ updated: number; classes: number; subjects: number }>('levelSubjects:applyToClasses', levelId),
  },
  absences: {
    getSheet: (classId: string, date: string) => invoke<any[]>('absences:getSheet', classId, date),
    saveSheet: (records: any[], date: string) => invoke<{ saved: number }>('absences:saveSheet', records, date),
    listByEnrollment: (enrollmentId: string) => invoke<any[]>('absences:listByEnrollment', enrollmentId),
    stats: (classId: string) => invoke<any[]>('absences:stats', classId),
  },
  backup: {
    create: (format: 'db' | 'zip') => invoke<{ filePath: string }>('backup:create', format),
    restore: (backupPath: string) => invoke<null>('backup:restore', backupPath),
    list: () => invoke<any[]>('backup:list'),
  },
  teachers: {
    list: () => invoke<any[]>('teachers:list'),
    getById: (id: string) => invoke<any>('teachers:getById', id),
    create: (data: any, actorId: string) => invoke<any>('teachers:create', data, actorId),
    update: (id: string, data: any, actorId: string) => invoke<any>('teachers:update', id, data, actorId),
    delete: (id: string, actorId: string) => invoke<null>('teachers:delete', id, actorId),
    listSalaries: (teacherId: string) => invoke<any[]>('teachers:listSalaries', teacherId),
    createSalary: (data: any, actorId: string) => invoke<any>('teachers:createSalary', data, actorId),
    markSalaryPaid: (salaryId: string, actorId: string) => invoke<any>('teachers:markSalaryPaid', salaryId, actorId),
  },
  schedules: {
    listByClass: (classId: string) => invoke<any[]>('schedules:listByClass', classId),
    listByTeacher: (teacherId: string) => invoke<any[]>('schedules:listByTeacher', teacherId),
    create: (data: any) => invoke<any>('schedules:create', data),
    delete: (id: string) => invoke<null>('schedules:delete', id),
    listRooms: () => invoke<any[]>('schedules:listRooms'),
    createRoom: (data: { name: string; capacity: number }) => invoke<any>('schedules:createRoom', data),
  },
  expenses: {
    list: (filters?: { year?: number; month?: number; category?: string }) =>
      invoke<any[]>('expenses:list', filters),
    create: (data: any) => invoke<any>('expenses:create', data),
    delete: (id: string) => invoke<null>('expenses:delete', id),
    summary: (year: number) => invoke<any>('expenses:summary', year),
    todayCash: () => invoke<any | null>('cash:today'),
    openCash: (openBalance: number, openedBy: string) => invoke<any>('cash:open', openBalance, openedBy),
    closeCash: (id: string, closeBalance: number, closedBy: string) => invoke<any>('cash:close', id, closeBalance, closedBy),
  },
  parents: {
    listByStudent: (studentId: string) => invoke<any[]>('parents:listByStudent', studentId),
    create: (data: any, studentId: string) => invoke<any>('parents:create', data, studentId),
    update: (id: string, data: any) => invoke<any>('parents:update', id, data),
    unlink: (parentId: string, studentId: string) => invoke<null>('parents:unlink', parentId, studentId),
    generateCode: (parentId: string) => invoke<string>('parents:generateCode', parentId),
  },
  auditlog: {
    list: (filters?: { userId?: string; entity?: string; limit?: number }) =>
      invoke<any[]>('auditlog:list', filters),
    entities: () => invoke<string[]>('auditlog:entities'),
  },
  library: {
    listBooks: (search?: string) => invoke<any[]>('library:listBooks', search),
    createBook: (data: any) => invoke<any>('library:createBook', data),
    updateBook: (id: string, data: any) => invoke<any>('library:updateBook', id, data),
    deleteBook: (id: string) => invoke<null>('library:deleteBook', id),
    listLoans: (filters?: { returned?: boolean; bookId?: string; studentId?: string }) =>
      invoke<any[]>('library:listLoans', filters),
    createLoan: (data: { bookId: string; studentId: string; dueDate: string }) =>
      invoke<any>('library:createLoan', data),
    returnLoan: (loanId: string, fine?: number) => invoke<any>('library:returnLoan', loanId, fine),
    stats: () => invoke<any>('library:stats'),
  },
  medical: {
    getRecord: (studentId: string) => invoke<any>('medical:getRecord', studentId),
    updateRecord: (id: string, data: any) => invoke<any>('medical:updateRecord', id, data),
    addConsultation: (medicalRecordId: string, data: any) => invoke<any>('medical:addConsultation', medicalRecordId, data),
    deleteConsultation: (id: string) => invoke<null>('medical:deleteConsultation', id),
    listRecent: (limit?: number) => invoke<any[]>('medical:listRecent', limit),
  },
  transport: {
    listBuses: () => invoke<any[]>('transport:listBuses'),
    createBus: (data: any) => invoke<any>('transport:createBus', data),
    updateBus: (id: string, data: any) => invoke<any>('transport:updateBus', id, data),
    deleteBus: (id: string) => invoke<null>('transport:deleteBus', id),
    createRoute: (data: any) => invoke<any>('transport:createRoute', data),
    updateRoute: (id: string, data: any) => invoke<any>('transport:updateRoute', id, data),
    deleteRoute: (id: string) => invoke<null>('transport:deleteRoute', id),
    stats: () => invoke<any>('transport:stats'),
  },
  dialog: {
    openImage: () => invoke<string | null>('dialog:openImage'),
    openAndCopyFile: (destDir: string, extensions?: string[]) =>
      invoke<{ filename: string; destPath: string } | null>('dialog:openAndCopyFile', destDir, extensions),
    openPath: (filePath: string) => invoke<null>('shell:openPath', filePath),
  },
  studentdocs: {
    list: (studentId: string) => invoke<any[]>('studentdocs:list', studentId),
    add: (studentId: string, type: string) => invoke<any | null>('studentdocs:add', studentId, type),
    open: (id: string) => invoke<null>('studentdocs:open', id),
    delete: (id: string) => invoke<null>('studentdocs:delete', id),
    types: () => invoke<string[]>('studentdocs:types'),
  },
  notifications: {
    list: (limit?: number) => invoke<any[]>('notifications:list', limit),
    countUnread: () => invoke<number>('notifications:countUnread'),
    markRead: (id: string) => invoke<any>('notifications:markRead', id),
    markAllRead: () => invoke<any>('notifications:markAllRead'),
    create: (data: { target: string; title: string; body: string; type: string }) =>
      invoke<any>('notifications:create', data),
    delete: (id: string) => invoke<null>('notifications:delete', id),
  },
  messages: {
    inbox: (userId: string) => invoke<any[]>('messages:inbox', userId),
    sent: (userId: string) => invoke<any[]>('messages:sent', userId),
    thread: (messageId: string, userId: string) => invoke<any>('messages:thread', messageId, userId),
    send: (data: { fromUserId: string; toUserId: string; subject: string; body: string; parentId?: string }) =>
      invoke<any>('messages:send', data),
    countUnread: (userId: string) => invoke<number>('messages:countUnread', userId),
    markRead: (messageId: string) => invoke<any>('messages:markRead', messageId),
    delete: (messageId: string, userId: string) => invoke<any>('messages:delete', messageId, userId),
  },
  reports: {
    exportFinancialExcel: (year: number) =>
      invoke<{ filePath: string } | null>('reports:exportFinancialExcel', year),
  },
  license: {
    get: () => invoke<any | null>('license:get'),
    activate: (key: string) => invoke<any>('license:activate', key),
    deactivate: () => invoke<any>('license:deactivate'),
    isValid: () => invoke<boolean>('license:isValid'),
  },
  settings: {
    getSchool: () => invoke<any>('settings:getSchool'),
    updateSchool: (data: any) => invoke<any>('settings:updateSchool', data),
    listUsers: () => invoke<any[]>('settings:listUsers'),
    createUser: (data: any) => invoke<any>('settings:createUser', data),
    updateUser: (id: string, data: any) => invoke<any>('settings:updateUser', id, data),
    resetUserPassword: (userId: string, requestedBy: string) => invoke<{ tempPassword: string }>('settings:resetUserPassword', userId, requestedBy),
    listAcademicYears: () => invoke<any[]>('settings:listAcademicYears'),
    createAcademicYear: (data: any) => invoke<any>('settings:createAcademicYear', data),
    setCurrentYear: (id: string) => invoke<any>('settings:setCurrentYear', id),
    createCycle: (data: { name: string }) => invoke<any>('settings:createCycle', data),
    createClass: (data: any) => invoke<any>('settings:createClass', data),
    createLevel: (data: { name: string; cycleId: string }) => invoke<any>('settings:createLevel', data),
    getModules: () => invoke<string[]>('settings:getModules'),
    setModules: (modules: string[]) => invoke<string[]>('settings:setModules', modules),
    getRecoveryCode: () => invoke<{ isSet: boolean }>('settings:getRecoveryCode'),
    setRecoveryCode: (code: string) => invoke<null>('settings:setRecoveryCode', code),
    getSmtpConfig: () => invoke<any | null>('settings:getSmtpConfig'),
    setSmtpConfig: (config: any) => invoke<null>('settings:setSmtpConfig', config),
    testSmtp: (testEmail: string) => invoke<null>('settings:testSmtp', testEmail),
  },
}
