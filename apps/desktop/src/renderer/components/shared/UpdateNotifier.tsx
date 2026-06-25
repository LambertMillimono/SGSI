import { useEffect, useState } from 'react'
import { notification, Progress, Button, Space } from 'antd'
import { CloudDownloadOutlined, SyncOutlined } from '@ant-design/icons'

export function UpdateNotifier() {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress]       = useState(0)

  useEffect(() => {
    const electron = (window as any).electron
    if (!electron?.ipc) return

    const onAvailable = (_: any, info: { version: string }) => {
      notification.info({
        key:         'update-available',
        message:     `Mise a jour disponible — v${info.version}`,
        description: 'Une nouvelle version de SGSI est disponible. Telechargement en arriere-plan ?',
        duration:    0,
        icon:        <CloudDownloadOutlined style={{ color: '#1677ff' }} />,
        btn: (
          <Space>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                notification.destroy('update-available')
                setDownloading(true)
                electron.ipc.invoke('update:download')
              }}
            >
              Telecharger
            </Button>
            <Button size="small" onClick={() => notification.destroy('update-available')}>
              Plus tard
            </Button>
          </Space>
        ),
      })
    }

    const onProgress = (_: any, data: { percent: number }) => {
      setProgress(data.percent)
      notification.open({
        key:         'update-progress',
        message:     'Telechargement en cours...',
        description: <Progress percent={data.percent} size="small" />,
        duration:    0,
        icon:        <CloudDownloadOutlined style={{ color: '#1677ff' }} />,
      })
    }

    const onReady = (_: any, info: { version: string }) => {
      setDownloading(false)
      notification.destroy('update-progress')
      notification.success({
        key:         'update-ready',
        message:     `v${info.version} prete a installer`,
        description: 'La mise a jour est telechargee. Redemarrer maintenant pour l\'installer ?',
        duration:    0,
        icon:        <SyncOutlined style={{ color: '#52c41a' }} />,
        btn: (
          <Space>
            <Button
              type="primary"
              size="small"
              onClick={() => electron.ipc.invoke('update:install')}
            >
              Redemarrer et installer
            </Button>
            <Button size="small" onClick={() => notification.destroy('update-ready')}>
              Plus tard
            </Button>
          </Space>
        ),
      })
    }

    electron.ipc.on('update:available', onAvailable)
    electron.ipc.on('update:progress',  onProgress)
    electron.ipc.on('update:ready',     onReady)

    return () => {
      electron.ipc.removeListener?.('update:available', onAvailable)
      electron.ipc.removeListener?.('update:progress',  onProgress)
      electron.ipc.removeListener?.('update:ready',     onReady)
    }
  }, [])

  return null
}
