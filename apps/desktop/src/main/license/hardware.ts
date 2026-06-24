/**
 * hardware.ts — Secure Hardware ID Generator
 *
 * Combines multiple stable system identifiers:
 *   1. Windows Machine GUID (from Registry — very stable)
 *   2. CPU model string
 *   3. MAC addresses (physical interfaces only)
 *   4. Hostname
 *
 * Returns SHA-256 hash of the combination.
 * Stable across reboots. Difficult to spoof without admin access.
 */

import os     from 'os'
import crypto from 'crypto'
import { execSync } from 'child_process'

/** Read Windows Machine GUID from Registry */
function getWindowsMachineGuid(): string {
  try {
    // HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid — set once during Windows install
    const result = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: 'utf8', timeout: 3000, windowsHide: true }
    )
    const match = result.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/)
    return match?.[1]?.trim() ?? ''
  } catch {
    return ''
  }
}

/** Read Windows Product ID for extra entropy */
function getWindowsProductId(): string {
  try {
    const result = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ProductId',
      { encoding: 'utf8', timeout: 3000, windowsHide: true }
    )
    const match = result.match(/ProductId\s+REG_SZ\s+([^\r\n]+)/)
    return match?.[1]?.trim() ?? ''
  } catch {
    return ''
  }
}

/** Get stable physical MAC addresses (exclude virtual, loopback, VPN) */
function getPhysicalMacs(): string[] {
  const SKIP_PREFIXES = [
    '00:00:00', 'ff:ff:ff', '02:00:00',
    '00:50:56', '00:0c:29', '00:1c:42', // VMware, VirtualBox, Parallels
  ]

  return Object.values(os.networkInterfaces())
    .flat()
    .filter((ni): ni is os.NetworkInterfaceInfo =>
      !!ni && !ni.internal && ni.family === 'IPv4' && !!ni.mac && ni.mac !== '00:00:00:00:00:00'
    )
    .map(ni => ni.mac.toLowerCase())
    .filter(mac => !SKIP_PREFIXES.some(p => mac.startsWith(p)))
    .sort()
    .slice(0, 3) // Use up to 3 MACs
}

/** Get CPU identifier */
function getCpuId(): string {
  const cpus = os.cpus()
  if (!cpus.length) return 'unknown-cpu'
  return cpus[0].model.trim()
}

/**
 * Generate a stable, secure hardware fingerprint.
 * Returns a 64-character hex string (SHA-256).
 */
export function generateHardwareId(): string {
  const components = [
    getWindowsMachineGuid(),
    getWindowsProductId(),
    getCpuId(),
    os.hostname(),
    ...getPhysicalMacs(),
  ].filter(Boolean)

  if (components.length === 0) {
    // Minimal fallback — still somewhat stable
    components.push(os.hostname(), os.userInfo().username, os.homedir())
  }

  const raw = components.join('|')
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
}

/** Compact 16-char display ID for UI */
export function getShortHardwareId(): string {
  return generateHardwareId().slice(0, 16).toUpperCase()
}
