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
          /* === NEW BRAND: Indigo #6366F1 (NOT blue) === */
          colorPrimary: '#6366F1',
          colorSuccess: '#059669',
          colorWarning: '#F59E0B',
          colorError:   '#DC2626',
          colorInfo:    '#6366F1',

          /* === TYPOGRAPHY === */
          fontFamily:       "'Inter', -apple-system, system-ui, sans-serif",
          fontSize:         13,
          fontWeightStrong: 600,
          lineHeight:       1.6,

          /* === SHAPE === */
          borderRadius:   8,
          borderRadiusLG: 12,
          borderRadiusSM: 6,
          borderRadiusXS: 4,

          /* === CONTROL SIZES === */
          controlHeight:   36,
          controlHeightSM: 30,
          controlHeightLG: 44,

          /* === MOTION === */
          motionDurationFast: '120ms',
          motionDurationMid:  '180ms',
          motionDurationSlow: '280ms',
          motionEaseInOut:    'cubic-bezier(0.16, 1, 0.3, 1)',

          /* === SURFACES — Warm Indigo Dark (NOT cold blue-black) === */
          ...(isDark ? {
            colorBgLayout:        '#0F0F1A',
            colorBgContainer:     '#1A1A2E',
            colorBgElevated:      '#252540',
            colorBgSpotlight:     '#2E2E55',
            colorBorderSecondary: 'rgba(99,102,241,0.08)',
            colorBorder:          'rgba(99,102,241,0.15)',
            colorText:            '#F0EFFF',
            colorTextSecondary:   '#A0A0C0',
            colorTextTertiary:    '#6B6B8A',
            colorTextQuaternary:  '#3A3A58',
          } : {
            colorBgLayout:        '#ECEEF5',  /* Fond gris-bleu doux — pas de blanc aveuglant */
            colorBgContainer:     '#FFFFFF',  /* Cartes et surfaces blanches pour contraste */
            colorBgElevated:      '#FFFFFF',
            colorBgSpotlight:     '#F0F0F8',
            colorBorderSecondary: '#DDE1EC',
            colorBorder:          '#C8CDDF',
            colorText:            '#1A1B2E',  /* Quasi-noir avec légère teinte indigo */
            colorTextSecondary:   '#4A5070',
            colorTextTertiary:    '#8890B0',
            colorTextQuaternary:  '#B8BECE',
          }),
        },
        components: {
          Layout: {
            bodyBg:        isDark ? '#0F0F1A' : '#ECEEF5',
            siderBg:       isDark ? '#1A1A2E' : '#1E2140',  /* Sidebar sombre même en mode clair */
            headerBg:      isDark ? '#1A1A2E' : '#FFFFFF',
            headerPadding: '0 24px',
            headerHeight:  60,
          },
          Card: {
            colorBgContainer:     isDark ? '#1A1A2E' : '#FFFFFF',
            colorBorderSecondary: isDark ? 'rgba(99,102,241,0.15)' : '#DDE1EC',
            borderRadiusLG: 16,
            paddingLG: 20,
            boxShadowTertiary: isDark ? 'none' : '0 1px 4px rgba(30,33,64,0.06), 0 4px 16px rgba(30,33,64,0.04)',
          },
          Table: {
            colorBgContainer: isDark ? '#1A1A2E' : '#FFFFFF',
            headerBg:         isDark ? '#1A1A2E' : '#F2F3FA',
            rowHoverBg:       isDark ? 'rgba(99,102,241,0.08)' : '#EEF0FB',
            headerColor:      isDark ? '#6B6B8A' : '#4A5070',
            borderColor:      isDark ? 'rgba(99,102,241,0.08)' : '#E8EAEF',
            cellFontSize:     13,
          },
          Menu: {
            darkItemBg:         '#1A1A2E',
            darkSubMenuItemBg:  '#1A1A2E',
            darkItemSelectedBg: 'rgba(99,102,241,0.15)',
            darkItemHoverBg:    'rgba(99,102,241,0.06)',
          },
          Button: {
            primaryShadow:    'none',
            defaultShadow:    'none',
            dangerShadow:     'none',
            fontWeight:       500,
            borderRadius:     9999,   /* PILL */
            controlHeight:    36,
            controlHeightSM:  30,
            controlHeightLG:  44,
          },
          Input: {
            colorBgContainer:  isDark ? '#252540' : '#FFFFFF',
            colorBorder:       isDark ? 'rgba(99,102,241,0.2)' : '#E4E4E7',
            activeBorderColor: '#6366F1',
            hoverBorderColor:  '#818CF8',
            activeShadow:      '0 0 0 3px rgba(99,102,241,0.2)',
            borderRadius:      8,
          },
          InputNumber: {
            colorBgContainer: isDark ? '#252540' : '#FFFFFF',
            colorBorder:      isDark ? 'rgba(99,102,241,0.2)' : '#E4E4E7',
            activeBorderColor: '#6366F1',
            hoverBorderColor:  '#818CF8',
            activeShadow:      '0 0 0 3px rgba(99,102,241,0.2)',
            borderRadius:      8,
          },
          Select: {
            colorBgContainer:    isDark ? '#252540' : '#FFFFFF',
            colorBorder:         isDark ? 'rgba(99,102,241,0.2)' : '#E4E4E7',
            optionSelectedBg:    isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
            optionSelectedColor: isDark ? '#A5B4FC' : '#4338CA',
            borderRadius:        8,
          },
          DatePicker: {
            colorBgContainer:  isDark ? '#252540' : '#FFFFFF',
            colorBorder:       isDark ? 'rgba(99,102,241,0.2)' : '#E4E4E7',
            activeBorderColor: '#6366F1',
            borderRadius:      8,
          },
          Tabs: {
            inkBarColor:          '#6366F1',
            itemActiveColor:      isDark ? '#A5B4FC' : '#4338CA',
            itemSelectedColor:    isDark ? '#A5B4FC' : '#4338CA',
            itemHoverColor:       isDark ? '#C7D2FE' : '#6366F1',
            colorBorderSecondary: isDark ? 'rgba(99,102,241,0.1)' : '#E4E4E7',
          },
          Modal: {
            colorBgContainer:     isDark ? '#1A1A2E' : '#FFFFFF',
            colorBorderSecondary: isDark ? 'rgba(99,102,241,0.15)' : '#E4E4E7',
            borderRadiusLG:       16,
          },
          Drawer: {
            colorBgContainer: isDark ? '#1A1A2E' : '#FFFFFF',
          },
          Popover: {
            colorBgContainer: isDark ? '#252540' : '#FFFFFF',
            borderRadius: 12,
          },
          Tooltip: {
            colorBgSpotlight:    isDark ? '#252540' : '#18181B',
            colorTextLightSolid: '#F0EFFF',
            borderRadius: 8,
            fontSize: 12,
          },
          Tag: {
            borderRadius: 9999,
            fontSizeSM: 11,
          },
          Badge: {
            colorBgContainer: isDark ? '#1A1A2E' : '#FFFFFF',
          },
          Alert: { borderRadius: 12, fontSize: 13 },
          Form: {
            labelFontSize: 12,
            labelColor: isDark ? '#A0A0C0' : '#52525B',
            itemMarginBottom: 20,
          },
          Divider: {
            colorSplit: isDark ? 'rgba(99,102,241,0.1)' : '#E4E4E7',
          },
          Pagination: {
            colorBgContainer: isDark ? 'transparent' : '#FFFFFF',
            colorBorder:      isDark ? 'rgba(99,102,241,0.2)' : '#E4E4E7',
            borderRadius: 8,
          },
          Progress: {
            colorFillSecondary: isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF',
            remainingColor:     isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF',
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
