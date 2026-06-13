import type { Grade, SubjectAverage, Ranking, EvalWeights } from '../types/grade.types'

export function calcSubjectAverage(grades: Grade[], weights: EvalWeights): number {
  if (grades.length === 0) return 0
  const totalWeight = grades.reduce((sum, g) => sum + weights[g.evalType], 0)
  if (totalWeight === 0) return 0
  const weightedSum = grades.reduce((sum, g) => sum + g.value * weights[g.evalType], 0)
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

export function calcGeneralAverage(subjectAverages: SubjectAverage[]): number {
  if (subjectAverages.length === 0) return 0
  const totalCoeff = subjectAverages.reduce((sum, s) => sum + s.coefficient, 0)
  if (totalCoeff === 0) return 0
  const weightedSum = subjectAverages.reduce((sum, s) => sum + s.average * s.coefficient, 0)
  return Math.round((weightedSum / totalCoeff) * 100) / 100
}

export function calcRankings(averages: { enrollmentId: string; studentName: string; studentId: string; generalAverage: number; isEliminated: boolean }[]): Ranking[] {
  const sorted = [...averages].sort((a, b) => b.generalAverage - a.generalAverage)
  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }))
}

export function getAppreciation(average: number): string {
  if (average >= 18) return 'Excellent'
  if (average >= 16) return 'Très Bien'
  if (average >= 14) return 'Bien'
  if (average >= 12) return 'Assez Bien'
  if (average >= 10) return 'Passable'
  return 'Insuffisant'
}
