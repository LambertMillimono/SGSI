import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import App from './App'
import { store } from './store'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider
        locale={frFR}
        theme={{
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
    </Provider>
  </React.StrictMode>
)
