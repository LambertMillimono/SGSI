import { Tag } from 'antd'

type EnrollStatus = 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED' | 'EXPELLED'

const STATUS_CONFIG: Record<EnrollStatus, { color: string; label: string }> = {
  ACTIVE: { color: 'success', label: 'Inscrit' },
  TRANSFERRED: { color: 'warning', label: 'Transféré' },
  GRADUATED: { color: 'blue', label: 'Diplômé' },
  EXPELLED: { color: 'error', label: 'Radié' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as EnrollStatus] ?? { color: 'default', label: status }
  return <Tag color={config.color}>{config.label}</Tag>
}
