export type PayMethod = 'CASH' | 'ORANGE_MONEY' | 'WAVE' | 'MOBILE_MONEY' | 'BANK_CARD' | 'BANK_TRANSFER' | 'CHECK'

export interface Payment {
  id: string
  enrollmentId: string
  feeTypeId: string
  amount: number
  method: PayMethod
  receiptNo: string
  cashierId: string
  note?: string
  paidAt: Date
}

export interface FeeType {
  id: string
  name: string
  amount: number
  levelId?: string
  isRequired: boolean
}

export interface UnpaidStudent {
  studentId: string
  studentName: string
  matricule: string
  className: string
  totalDue: number
  totalPaid: number
  balance: number
}
