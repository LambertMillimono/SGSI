import { Typography, Space, Breadcrumb } from 'antd'

interface Props {
  title: string
  subtitle?: string
  breadcrumb?: Array<{ label: string; href?: string }>
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, breadcrumb, actions }: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={breadcrumb.map(b => ({ title: b.label, href: b.href }))}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0, lineHeight: 1.3 }}>
            {title}
          </Typography.Title>
          {subtitle && (
            <Typography.Text type="secondary" style={{ marginTop: 4, display: 'block' }}>
              {subtitle}
            </Typography.Text>
          )}
        </div>
        {actions && <Space>{actions}</Space>}
      </div>
    </div>
  )
}
