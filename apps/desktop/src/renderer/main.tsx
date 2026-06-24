import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider, useSelector } from 'react-redux'
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd'
import frFR from 'antd/locale/fr_FR'
import App from './App'
import { store } from './store'
import type { RootState } from './store'
import { ModulesProvider } from './contexts/ModulesContext'
import './styles/globals.css'

function ThemedApp() {
  const themeMode = useSelector((s: RootState) => s.ui.theme)
  const isDark = themeMode === 'dark'

  return (
    <ConfigProvider
      locale={frFR}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1E40AF',
          colorSuccess: '#16A34A',
          colorWarning: '#D97706',
          colorError:   '#DC2626',
          borderRadius: 8,
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          // Dark mode: harmonise les surfaces avec notre palette navy
          ...(isDark && {
            colorBgLayout:          '#0F172A',
            colorBgContainer:       '#1E293B',
            colorBgElevated:        '#273549',
            colorBgSpotlight:       '#334155',
            colorBorderSecondary:   '#334155',
            colorBorder:            '#475569',
            colorText:              '#F1F5F9',
            colorTextSecondary:     '#94A3B8',
            colorTextTertiary:      '#64748B',
            colorTextQuaternary:    '#475569',
          }),
        },
        components: {
          Layout: {
            bodyBg:          isDark ? '#0F172A' : '#F1F5F9',
            siderBg:         '#0F172A',
            headerBg:        isDark ? '#1E293B' : '#ffffff',
            headerPadding:   '0 20px',
            headerHeight:    56,
          },
          Card: {
            colorBgContainer: isDark ? '#1E293B' : '#ffffff',
            borderRadiusLG: 12,
          },
          Table: {
            colorBgContainer: isDark ? '#1E293B' : '#ffffff',
            headerBg:         isDark ? '#273549' : '#F8FAFC',
            rowHoverBg:       isDark ? '#2D3F55' : '#EFF6FF',
            headerColor:      isDark ? '#94A3B8' : '#6B7280',
            borderColor:      isDark ? '#334155' : '#F3F4F6',
          },
          Menu: {
            darkItemBg:         '#0F172A',
            darkSubMenuItemBg:  '#0F172A',
            darkItemSelectedBg: 'rgba(255,255,255,0.12)',
          },
          Button: {
            primaryShadow: 'none',
            defaultShadow: 'none',
            dangerShadow:  'none',
          },
          Input: {
            activeShadow: '0 0 0 3px rgba(30,64,175,0.1)',
          },
          Tabs: {
            inkBarColor:       '#1E40AF',
            itemActiveColor:   '#1E40AF',
            itemSelectedColor: '#1E40AF',
          },
          Select: {
            optionSelectedBg: isDark ? '#2D3F55' : '#EFF6FF',
          },
          Modal: {
            borderRadiusLG: 12,
          },
        },
      }}
    >
      <AntdApp>
        <ModulesProvider>
          <App />
        </ModulesProvider>
      </AntdApp>
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
