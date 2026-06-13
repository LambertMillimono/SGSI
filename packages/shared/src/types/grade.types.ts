export type EvalType = 'INTERROGATION' | 'DEVOIR' | 'CONTROLE' | 'TP' | 'EXAM'

export interface Grade {
  id: string
  enrollmentId: string
  subjectId: string
  period: number
  evalType: EvalType
  value: number
  maxValue: number
  weight: number
  isLocked: boolean
  enteredAt: Date
}

export interface SubjectAverage {
  subjectId: string
  subjectName: string
  coefficient: number
  average: number
  grades: Grade[]
}

export interface Ranking {
  enrollmentId: string
  studentId: string
  studentName: string
  generalAverage: number
  rank: number
  isEliminated: boolean
}

export interface EvalWeights {
  INTERROGATION: number
  DEVOIR: number
  CONTROLE: number
  TP: number
  EXAM: number
}

export const DEFAULT_EVAL_WEIGHTS: EvalWeights = {
  INTERROGATION: 1,
  DEVOIR: 2,
  CONTROLE: 2,
  TP: 1,
  EXAM: 3,
}
