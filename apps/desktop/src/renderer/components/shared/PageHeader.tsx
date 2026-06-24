import { Typography, Space, theme } from 'antd'
import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  breadcrumb?: Array<{ label: string; href?: string }>
  actions?: ReactNode
  icon?: ReactNode
  color?: string
}

export function PageHeader({ title, subtitle, actions, icon, color = '#2563EB' }: Props) {
  const { token } = theme.useToken()

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 20,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {icon && (
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: `${color}14`,
              border: `1px solid ${color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color, fontSize: 18,
              boxShadow: `0 2px 8px ${color}20`,
            }}>
              {icon}
            </div>
          )}
          <div>
            <Typography.Title
              level={4}
              style={{
                margin: 0,
                fontSize: 'clamp(15px, 1.4vw, 20px)',
                fontWeight: 700,
                lineHeight: 1.2, letterSpacing: '-0.02em',
                color: token.colorText,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {title}
            </Typography.Title>
            {subtitle && (
              <Typography.Text
                type="secondary"
                style={{
                  fontSize: 12, display: 'block', marginTop: 3,
                  lineHeight: 1.5, color: token.colorTextTertiary,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {subtitle}
              </Typography.Text>
            )}
          </div>
        </div>
        {actions && <Space size={8}>{actions}</Space>}
      </div>
    </div>
  )
}
