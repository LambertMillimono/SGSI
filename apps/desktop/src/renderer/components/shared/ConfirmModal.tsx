import { Modal } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'

interface ConfirmOptions {
  title: string
  content: string
  onConfirm: () => void | Promise<void>
  danger?: boolean
}

export function showConfirm({ title, content, onConfirm, danger = false }: ConfirmOptions) {
  Modal.confirm({
    title,
    content,
    icon: <ExclamationCircleOutlined />,
    okText: 'Confirmer',
    cancelText: 'Annuler',
    okButtonProps: { danger },
    onOk: onConfirm,
  })
}
