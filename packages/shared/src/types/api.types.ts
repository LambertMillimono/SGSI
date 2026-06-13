export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export function ok<T>(data: T): IpcResponse<T> {
  return { success: true, data }
}

export function fail(code: string, message: string): IpcResponse<never> {
  return { success: false, error: { code, message } }
}

export class ServiceError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'ServiceError'
  }
}
