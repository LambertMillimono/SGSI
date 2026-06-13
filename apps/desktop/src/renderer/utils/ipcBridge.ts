type IpcOk<T> = { success: true; data: T }
type IpcFail = { success: false; error: { code: string; message: string } }
type IpcResult<T> = IpcOk<T> | IpcFail

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return (window as any).electron.ipc.invoke(channel, ...args).then((res: IpcResult<T>) => {
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
    listLevels: () => invoke<any[]>('levels:list'),
  },
  grades: {
    list: (enrollmentId: string, period: number) =>
      invoke<any[]>('grades:list', enrollmentId, period),
    save: (data: any, actorId: string) =>
      invoke<any>('grades:save', data, actorId),
    getAverages: (enrollmentId: string, period: number) =>
      invoke<any>('grades:averages', enrollmentId, period),
    getRanking: (classId: string, period: number) =>
      invoke<any[]>('grades:ranking', classId, period),
  },
  bulletins: {
    generate: (enrollmentId: string, period: number, actorId: string) =>
      invoke<any>('bulletins:generate', enrollmentId, period, actorId),
    validate: (bulletinId: string, directorId: string) =>
      invoke<any>('bulletins:validate', bulletinId, directorId),
    list: (enrollmentId: string) =>
      invoke<any[]>('bulletins:list', enrollmentId),
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
  },
  backup: {
    create: (actorId: string) => invoke<any>('backup:create', actorId),
  },
}
