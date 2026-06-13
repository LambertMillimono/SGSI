import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider, useSelector } from 'react-redux'
import { ConfigProvider, theme as antdTheme } from 'antd'
import frFR from 'antd/locale/fr_FR'
import App from './App'
import { store } from './store'
import type { RootState } from './store'
import './styles/globals.css'

function ThemedApp() {
  const themeMode = useSelector((s: RootState) => s.ui.theme)

  return (
    <ConfigProvider
      locale={frFR}
      theme={{
        algorithm: themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1E40AF',
          colorSuccess: '#16A34A',
          colorWarning: '#D97706',
          colorError: '#DC2626',
          borderRadius: 6,
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        },
      }}
    >
      <App />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemedApp />
    </Provider>
  </React.StrictMode>
)
