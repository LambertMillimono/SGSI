/** Shared license types */

export type LicensePlan = 'STANDARD' | 'PROFESSIONAL' | 'ULTIMATE'
export type LicenseStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED'
export type ValidationSource = 'server' | 'cache' | 'grace' | 'none'

export interface LicenseValidationResult {
  valid:           boolean
  source:          ValidationSource
  plan?:           LicensePlan
  planName?:       string
  maxStudents?:    number
  schoolName?:     string
  expiresAt?:      string | null
  daysLeft?:       number   // grace period remaining
  daysUntilExpiry?: number  // days until license expires
  serverValidated?:boolean
  reason?:         string   // if invalid
}

export interface ActivationRequest {
  licenseKey:  string
  hardwareId:  string
  schoolName?: string
}

export interface ActivationResponse {
  success:      boolean
  plan:         LicensePlan
  planName:     string
  maxStudents:  number
  schoolName:   string
  expiresAt:    string | null
  issuedAt:     string
  error?:       string
}

export interface LicenseInfo {
  isActivated:    boolean
  validation:     LicenseValidationResult
  hardwareId:     string
  shortHardwareId:string
  needsOnlineValidation: boolean
}
