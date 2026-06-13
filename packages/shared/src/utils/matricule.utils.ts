export function generateMatricule(params: {
  schoolSigle: string
  firstName: string
  lastName: string
  year: number
  sequence: number
}): string {
  const { schoolSigle, firstName, lastName, year, sequence } = params
  const initials = `${lastName.charAt(0).toUpperCase()}${firstName.charAt(0).toUpperCase()}`
  const seq = String(sequence).padStart(4, '0')
  return `${schoolSigle.toUpperCase()}${initials}-${year}-${seq}`
}
