import { Typography, Space, Breadcrumb, theme } from 'antd'

interface Props {
  title: string
  subtitle?: string
  breadcrumb?: Array<{ label: string; href?: string }>
  actions?: React.ReactNode
  icon?: React.ReactNode
  color?: string
}

export function PageHeader({ title, subtitle, breadcrumb, actions, icon, color = '#1E40AF' }: Props) {
  const { token } = theme.useToken()

  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 8, fontSize: 12 }}
          items={breadcrumb.map(b => ({ title: b.label, href: b.href }))}
        />
      )}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {icon && (
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: `${color}18`,
              border: `1px solid ${color}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color, fontSize: 18,
            }}>
              {icon}
            </div>
          )}
          <div>
            <Typography.Title
              level={3}
              style={{ margin: 0, lineHeight: 1.2, fontSize: 20, fontWeight: 700, color: token.colorText }}
            >
              {title}
            </Typography.Title>
            {subtitle && (
              <Typography.Text
                type="secondary"
                style={{ marginTop: 3, display: 'block', fontSize: 13, lineHeight: 1.4 }}
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
