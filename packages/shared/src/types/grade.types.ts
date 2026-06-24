// DS1/DS2 = Devoirs Surveillés (coeff 1 chacun), COMPOSITION = double coeff
export type EvalType = 'DS1' | 'DS2' | 'COMPOSITION' | 'INTERRO' | 'TP' | 'EXAM'

export interface Grade {
  id: string
  enrollmentId: string
  subjectId: string
  period: number
  evalType: string
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
  [key: string]: number
}

export const DEFAULT_EVAL_WEIGHTS: EvalWeights = {
  DS1: 1,
  DS2: 1,
  COMPOSITION: 2,
  INTERRO: 0.5,
  TP: 0.5,
  EXAM: 3,
}

export const EVAL_LABELS: Record<string, string> = {
  DS1: 'Devoir 1',
  DS2: 'Devoir 2',
  COMPOSITION: 'Composition',
  INTERRO: 'Interrogation',
  TP: 'Travaux Pratiques',
  EXAM: 'Examen',
}
