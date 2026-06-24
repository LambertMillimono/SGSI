# SGSI — Plan d'implémentation Phase 2 : Frontend React
**Date:** 2026-06-13  
**Spec:** `docs/superpowers/specs/2026-06-13-sgsi-frontend-phase2-design.md`  
**Dépend de:** Phase 1 Backend (Tasks 1-14)  
**Méthode:** Subagent-Driven Development (TDD)

---

## Ordre d'exécution

```
P2-T1  → Renderer setup (Vite + React + AntD + Router + Redux)
P2-T2  → IPC Bridge + store/api (RTK Query wrapper)
P2-T3  → AppLayout (Sidebar + Header + routing skeleton)
P2-T4  → LoginPage + AuthSlice (JWT flow)
P2-T5  → DashboardPage (3 rôles, composants KPI)
P2-T6  → StudentListPage (tableau + filtres + pagination)
P2-T7  → StudentCreatePage (formulaire 4 sections + validation)
P2-T8  → StudentProfilePage (header + 4 onglets)
P2-T9  → GradeEntryPage (saisie clavier + auto-save)
P2-T10 → BulletinPage (PDF @react-pdf/renderer)
P2-T11 → PaymentListPage + modal création
P2-T12 → ReceiptPage (PDF A5 deux exemplaires)
P2-T13 → Dark/Light theme + polish final
P2-T14 → Tests + validation finale Phase 2
```

---

## P2-T1 : Renderer setup

### Objectif
Configurer l'environnement React dans `apps/desktop/src/renderer/` : Vite, TypeScript strict, Ant Design 5, Tailwind (sans preflight), React Router v6 hash mode, Redux Toolkit.

### Dépendances à installer (dans `apps/desktop`)
```bash
npm install antd @ant-design/icons react react-dom react-router-dom @reduxjs/toolkit react-redux
npm install -D @vitejs/plugin-react vite typescript @types/react @types/react-dom tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/user-event jsdom
```

### Fichiers à créer

**`apps/desktop/vite.config.ts`**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/renderer') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/renderer/test-setup.ts'],
  },
})
```

**`apps/desktop/tailwind.config.ts`**
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/**/*.{ts,tsx}'],
  corePlugins: { preflight: false }, // évite conflits avec Ant Design
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
      },
    },
  },
} satisfies Config
```

**`apps/desktop/src/renderer/main.tsx`**
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { ConfigProvider, theme as antTheme } from 'antd'
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
```

**`apps/desktop/src/renderer/styles/globals.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Variables SGSI */
:root {
  --color-primary: #1E40AF;
  --sidebar-width: 200px;
  --sidebar-collapsed-width: 64px;
}

/* Dark mode overrides */
html.dark {
  background-color: #0F172A;
  color: #F1F5F9;
}
```

**`apps/desktop/src/renderer/App.tsx`**
```typescript
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { RoleGuard } from './utils/roleGuard'
// Pages importées ici au fur et à mesure

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RoleGuard><AppLayout /></RoleGuard>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<div>Dashboard (P2-T5)</div>} />
          <Route path="students" element={<div>Students (P2-T6)</div>} />
          <Route path="students/new" element={<div>New Student (P2-T7)</div>} />
          <Route path="students/:id" element={<div>Student Profile (P2-T8)</div>} />
          <Route path="grades" element={<div>Grades (P2-T9)</div>} />
          <Route path="grades/bulletins/:studentId" element={<div>Bulletin (P2-T10)</div>} />
          <Route path="payments" element={<div>Payments (P2-T11)</div>} />
          <Route path="payments/new" element={<div>New Payment (P2-T11)</div>} />
          <Route path="payments/:id/receipt" element={<div>Receipt (P2-T12)</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  )
}
```

**`apps/desktop/src/renderer/store/index.ts`**
```typescript
import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import uiReducer from './uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

**`apps/desktop/src/renderer/test-setup.ts`**
```typescript
import '@testing-library/jest-dom'
```

### Critères de succès
- [ ] `npm run dev -w apps/desktop` démarre sans erreur
- [ ] Page blanche s'affiche dans Electron (avant login)
- [ ] `tsc --noEmit` passe sans erreur
- [ ] Un test trivial passe (`1 + 1 === 2`)

### Commit
```
feat(renderer): bootstrap React renderer with AntD, Router, Redux
```

---

## P2-T2 : IPC Bridge + store auth/ui

### Objectif
Créer le bridge IPC typé (`ipcBridge.ts`), les slices Redux (`authSlice`, `uiSlice`), et les hooks customs (`useAuth`, `useRole`).

### Fichiers à créer

**`apps/desktop/src/renderer/utils/ipcBridge.ts`**

> **Note :** Canaux vérifiés contre le backend réel (Task 14 validation).
> Noms exacts des handlers IPC enregistrés dans `apps/desktop/src/main/ipc/`.

```typescript
// Types locaux (certains ne sont pas encore dans @sgsi/shared)
type IpcOk<T> = { success: true; data: T }
type IpcFail = { success: false; error: { code: string; message: string } }
type IpcResult<T> = IpcOk<T> | IpcFail

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return (window as any).electron.ipc.invoke(channel, ...args).then((res: IpcResult<T>) => {
    if (!res.success) throw new Error(res.error?.message ?? 'IPC Error')
    return res.data as T
  })
}

export const ipc = {
  auth: {
    // Canal: auth:login — args: (username, password)
    login: (username: string, password: string) =>
      invoke<{ token: string; user: { id: string; username: string; role: string; firstName: string; lastName: string } }>('auth:login', username, password),
    // Canal: auth:logout — no-op côté serveur (JWT stateless)
    logout: () => invoke<null>('auth:logout'),
    // Canal: auth:changePassword — args: (userId, newPassword)
    changePassword: (userId: string, newPassword: string) =>
      invoke<null>('auth:changePassword', userId, newPassword),
    // Canal: auth:verifyToken — args: (token)
    verifyToken: (token: string) =>
      invoke<{ userId: string; username: string; role: string }>('auth:verifyToken', token),
  },
  students: {
    // Canal: students:list — args: (filters?)
    list: (filters?: { search?: string; classId?: string }) =>
      invoke<any[]>('students:list', filters),
    // Canal: students:findById (pas getById) — args: (id)
    getById: (id: string) =>
      invoke<any>('students:findById', id),
    // Canal: students:create — args: (data, actorId)
    create: (data: any, actorId: string) =>
      invoke<any>('students:create', data, actorId),
    // Canal: students:update — args: (id, data, actorId)
    update: (id: string, data: any, actorId: string) =>
      invoke<any>('students:update', id, data, actorId),
    // Canal: students:delete — args: (id, actorId)
    delete: (id: string, actorId: string) =>
      invoke<null>('students:delete', id, actorId),
    // Canal: students:enroll — args: (studentId, classId, yearId, actorId)
    enroll: (studentId: string, classId: string, yearId: string, actorId: string) =>
      invoke<any>('students:enroll', studentId, classId, yearId, actorId),
  },
  classes: {
    // Canal: classes:list — args: (yearId?)
    list: (yearId?: string) => invoke<any[]>('classes:list', yearId),
    // Canal: levels:list
    listLevels: () => invoke<any[]>('levels:list'),
  },
  grades: {
    // Canal: grades:list — args: (enrollmentId, period)
    list: (enrollmentId: string, period: number) =>
      invoke<any[]>('grades:list', enrollmentId, period),
    // Canal: grades:save (pas upsert) — args: (data, actorId)
    save: (data: any, actorId: string) =>
      invoke<any>('grades:save', data, actorId),
    // Canal: grades:averages — args: (enrollmentId, period)
    getAverages: (enrollmentId: string, period: number) =>
      invoke<any>('grades:averages', enrollmentId, period),
    // Canal: grades:ranking — args: (classId, period)
    getRanking: (classId: string, period: number) =>
      invoke<any[]>('grades:ranking', classId, period),
  },
  bulletins: {
    // Canal: bulletins:generate — args: (enrollmentId, period, actorId)
    generate: (enrollmentId: string, period: number, actorId: string) =>
      invoke<any>('bulletins:generate', enrollmentId, period, actorId),
    // Canal: bulletins:validate — args: (bulletinId, directorId)
    validate: (bulletinId: string, directorId: string) =>
      invoke<any>('bulletins:validate', bulletinId, directorId),
    // Canal: bulletins:list — args: (enrollmentId)
    list: (enrollmentId: string) =>
      invoke<any[]>('bulletins:list', enrollmentId),
  },
  payments: {
    // Canal: payments:list — args: (enrollmentId)
    list: (enrollmentId: string) =>
      invoke<any[]>('payments:list', enrollmentId),
    // Canal: payments:unpaid — args: (classId?)
    listUnpaid: (classId?: string) =>
      invoke<any[]>('payments:unpaid', classId),
    // Canal: payments:record (pas create) — args: (data, cashierId)
    record: (data: any, cashierId: string) =>
      invoke<any>('payments:record', data, cashierId),
    // Canal: payments:receipt — args: (id)
    getReceipt: (id: string) => invoke<any>('payments:receipt', id),
    // Canal: feetypes:list — args: (levelId?)
    listFeeTypes: (levelId?: string) =>
      invoke<any[]>('feetypes:list', levelId),
  },
  backup: {
    // Canal: backup:create — args: (actorId)
    create: (actorId: string) => invoke<any>('backup:create', actorId),
  },
}
```

**`apps/desktop/src/renderer/store/authSlice.ts`**
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { AuthResult, UserRole } from '@sgsi/shared'

interface AuthState {
  token: string | null
  userId: string | null
  role: UserRole | null
  username: string | null
  isAuthenticated: boolean
  mustChangePassword: boolean
}

const initialState: AuthState = {
  token: null, userId: null, role: null, username: null,
  isAuthenticated: false, mustChangePassword: false,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<AuthResult>) => {
      state.token = action.payload.token
      state.userId = action.payload.userId
      state.role = action.payload.role
      state.username = action.payload.username
      state.isAuthenticated = true
      state.mustChangePassword = action.payload.mustChangePassword ?? false
    },
    clearAuth: () => initialState,
  },
})

export const { setAuth, clearAuth } = authSlice.actions
export default authSlice.reducer
```

**`apps/desktop/src/renderer/store/uiSlice.ts`**
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UiState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
}

const initialState: UiState = {
  sidebarCollapsed: false,
  theme: 'light',
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => { state.sidebarCollapsed = !state.sidebarCollapsed },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload
      document.documentElement.classList.toggle('dark', action.payload === 'dark')
    },
  },
})

export const { toggleSidebar, setTheme } = uiSlice.actions
export default uiSlice.reducer
```

**`apps/desktop/src/renderer/hooks/useAuth.ts`**
```typescript
import { useSelector, useDispatch } from 'react-redux'
import type { RootState, AppDispatch } from '../store'
import { setAuth, clearAuth } from '../store/authSlice'
import { ipc } from '../utils/ipcBridge'

export function useAuth() {
  const auth = useSelector((s: RootState) => s.auth)
  const dispatch = useDispatch<AppDispatch>()

  const login = async (username: string, password: string) => {
    const result = await ipc.auth.login(username, password)
    dispatch(setAuth(result))
    return result
  }

  const logout = async () => {
    await ipc.auth.logout()
    dispatch(clearAuth())
  }

  return { ...auth, login, logout }
}
```

**`apps/desktop/src/renderer/hooks/useRole.ts`**
```typescript
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import type { UserRole } from '@sgsi/shared'

export function useRole() {
  const role = useSelector((s: RootState) => s.auth.role)

  const hasRole = (...roles: UserRole[]) => role !== null && roles.includes(role)
  const isDirecteur = () => hasRole('DIRECTEUR')
  const isSecretaire = () => hasRole('SECRETAIRE', 'DIRECTEUR')
  const isEnseignant = () => hasRole('ENSEIGNANT')

  return { role, hasRole, isDirecteur, isSecretaire, isEnseignant }
}
```

**`apps/desktop/src/renderer/utils/roleGuard.tsx`**
```typescript
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

**`apps/desktop/src/renderer/utils/formatters.ts`**
```typescript
export function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-GN', {
    style: 'currency', currency: 'GNF', maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(date))
}

export function formatMatricule(
  schoolCode: string, lastName: string, firstName: string,
  year: number, seq: number
): string {
  const l = lastName[0]?.toUpperCase() ?? 'X'
  const f = firstName[0]?.toUpperCase() ?? 'X'
  const n = String(seq).padStart(4, '0')
  return `${schoolCode}${l}${f}-${year}-${n}`
}
```

### Tests à écrire
- `formatGNF(500000)` → `"500 000 GNF"`
- `formatMatricule('L', 'Diallo', 'Mamadou', 2024, 1)` → `"LDM-2024-0001"`
- `useRole` renvoie `isDirecteur() === true` pour rôle DIRECTEUR

### Critères de succès
- [ ] Types importés depuis `@sgsi/shared` sans erreur
- [ ] Tests formatters passent
- [ ] `tsc --noEmit` passe

### Commit
```
feat(renderer): add IPC bridge, auth/ui slices, role guard, formatters
```

---

## P2-T3 : AppLayout (Sidebar + Header)

### Objectif
Construire le layout persistant : sidebar fixe avec navigation, header avec titre + toggle thème + menu utilisateur.

### Fichiers à créer

**`apps/desktop/src/renderer/components/layout/AppLayout.tsx`**
```typescript
import { Outlet } from 'react-router-dom'
import { Layout } from 'antd'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useSelector } from 'react-redux'
import type { RootState } from '../../store'

export function AppLayout() {
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} />
      <Layout style={{ marginLeft: collapsed ? 64 : 200, transition: 'margin 0.2s' }}>
        <Header />
        <Layout.Content style={{ padding: 24, background: 'var(--bg-content)' }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
```

**`apps/desktop/src/renderer/components/layout/Sidebar.tsx`**
```typescript
import { Menu, Layout } from 'antd'
import {
  DashboardOutlined, TeamOutlined, ReadOutlined,
  DollarOutlined, SettingOutlined, LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const NAV_ITEMS = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/students', icon: <TeamOutlined />, label: 'Élèves' },
  { key: '/grades', icon: <ReadOutlined />, label: 'Notes' },
  { key: '/payments', icon: <DollarOutlined />, label: 'Paiements' },
]

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  const selectedKey = NAV_ITEMS.find(i => location.pathname.startsWith(i.key))?.key ?? '/dashboard'

  return (
    <Layout.Sider
      collapsed={collapsed}
      width={200}
      collapsedWidth={64}
      style={{ position: 'fixed', height: '100vh', left: 0, top: 0, bottom: 0, zIndex: 100 }}
      theme="dark"
    >
      {/* Logo */}
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: collapsed ? 14 : 18 }}>
          {collapsed ? 'S' : 'SGSI'}
        </span>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={NAV_ITEMS.map(item => ({
          ...item,
          onClick: () => navigate(item.key),
        }))}
      />

      {/* Bas de sidebar */}
      <div style={{ position: 'absolute', bottom: 0, width: '100%' }}>
        <Menu
          theme="dark"
          mode="inline"
          items={[
            { key: 'settings', icon: <SettingOutlined />, label: 'Paramètres' },
            { key: 'logout', icon: <LogoutOutlined />, label: 'Déconnexion',
              onClick: logout },
          ]}
        />
      </div>
    </Layout.Sider>
  )
}
```

**`apps/desktop/src/renderer/components/layout/Header.tsx`**
```typescript
import { Layout, Button, Dropdown, Avatar, Space, Typography } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined, BulbOutlined, UserOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '../../store'
import { toggleSidebar, setTheme } from '../../store/uiSlice'
import { useAuth } from '../../hooks/useAuth'

export function Header() {
  const dispatch = useDispatch<AppDispatch>()
  const { sidebarCollapsed, theme } = useSelector((s: RootState) => s.ui)
  const { username, role, logout } = useAuth()

  return (
    <Layout.Header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Button
        type="text"
        icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={() => dispatch(toggleSidebar())}
        style={{ color: '#fff' }}
      />

      <Space>
        <Button
          type="text"
          icon={<BulbOutlined />}
          onClick={() => dispatch(setTheme(theme === 'light' ? 'dark' : 'light'))}
          style={{ color: '#fff' }}
        />
        <Dropdown menu={{
          items: [
            { key: 'profile', label: 'Mon profil' },
            { key: 'logout', label: 'Déconnexion', onClick: logout },
          ]
        }}>
          <Space style={{ cursor: 'pointer', color: '#fff' }}>
            <Avatar icon={<UserOutlined />} size="small" />
            <Typography.Text style={{ color: '#fff' }}>{username}</Typography.Text>
          </Space>
        </Dropdown>
      </Space>
    </Layout.Header>
  )
}
```

**`apps/desktop/src/renderer/components/shared/PageHeader.tsx`**
```typescript
import { Typography, Space } from 'antd'

interface Props {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      {actions && <Space>{actions}</Space>}
    </div>
  )
}
```

### Critères de succès
- [ ] Sidebar affiche les 4 liens de navigation
- [ ] Lien actif mis en évidence (couleur primaire)
- [ ] Bouton ≡ collapse/expand la sidebar
- [ ] Toggle thème change la classe `.dark` sur `<html>`
- [ ] Menu utilisateur montre le nom + rôle
- [ ] Déconnexion redirige vers `/login`

### Commit
```
feat(renderer): add AppLayout with fixed sidebar, header, theme toggle
```

---

## P2-T4 : LoginPage

### Objectif
Page de connexion complète : formulaire, validation, gestion erreur, changement de mot de passe temporaire.

### Fichier : `apps/desktop/src/renderer/pages/auth/LoginPage.tsx`
```typescript
import { useState } from 'react'
import { Form, Input, Button, Alert, Modal, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ipc } from '../../utils/ipcBridge'

export function LoginPage() {
  const [form] = Form.useForm()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      const result = await login(values.username, values.password)
      if (result.mustChangePassword) {
        setShowChangePwd(true)
      } else {
        navigate('/dashboard')
      }
    } catch (e: any) {
      setError(e.message ?? 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
    }}>
      <div style={{ width: 400, background: '#fff', borderRadius: 12, padding: 40, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Typography.Title level={2} style={{ color: '#1E40AF', margin: 0 }}>SGSI</Typography.Title>
          <Typography.Text type="secondary">Le numérique au service de l'éducation</Typography.Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form form={form} onFinish={handleLogin} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: 'Identifiant requis' }]}>
            <Input prefix={<UserOutlined />} placeholder="Identifiant" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Mot de passe requis' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mot de passe" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Se connecter
            </Button>
          </Form.Item>
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          v1.0.0
        </Typography.Text>
      </div>

      {/* Modal changement mot de passe */}
      <ChangePasswordModal open={showChangePwd} onSuccess={() => { setShowChangePwd(false); navigate('/dashboard') }} />
    </div>
  )
}

function ChangePasswordModal({ open, onSuccess }: { open: boolean; onSuccess: () => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { oldPassword: string; newPassword: string }) => {
    setLoading(true)
    try {
      await ipc.auth.changePassword(values.oldPassword, values.newPassword)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Changer votre mot de passe" open={open} footer={null} closable={false}>
      <Typography.Paragraph type="secondary">
        Votre mot de passe temporaire doit être changé avant de continuer.
      </Typography.Paragraph>
      <Form form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item name="oldPassword" label="Mot de passe temporaire" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="newPassword" label="Nouveau mot de passe"
          rules={[{ required: true }, { min: 8, message: 'Minimum 8 caractères' }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="confirm" label="Confirmer"
          dependencies={['newPassword']}
          rules={[{ required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                return Promise.reject('Les mots de passe ne correspondent pas')
              }
            })]}>
          <Input.Password />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>Confirmer</Button>
      </Form>
    </Modal>
  )
}
```

### Tests
```typescript
// LoginPage.test.tsx
describe('LoginPage', () => {
  it('affiche une erreur si les identifiants sont incorrects')
  it('redirige vers /dashboard si connexion réussie')
  it('ouvre le modal si mustChangePassword = true')
})
```

### Critères de succès
- [ ] Login réussi → redirect `/dashboard`
- [ ] Login échoué → message d'erreur visible
- [ ] `mustChangePassword: true` → modal s'ouvre
- [ ] Validation des champs (vides)

### Commit
```
feat(renderer): add LoginPage with JWT auth flow and change-password modal
```

---

## P2-T5 : DashboardPage (3 rôles)

### Objectif
Dashboard qui charge les stats via IPC et affiche un layout différent selon le rôle de l'utilisateur connecté.

### Structure
```
DashboardPage
  └── useRole() → 'DIRECTEUR' | 'SECRETAIRE' | 'ENSEIGNANT'
  └── useEffect → ipc.dashboard.getStats(role)
  └── render → <DirecteurDashboard /> | <SecretaireDashboard /> | <EnseignantDashboard />
```

### Composants
- `KpiCard` : Ant Design `<Statistic>` dans une `<Card>` avec titre + icône + valeur + sous-titre
- `DirecteurDashboard` : 4 KPIs + BarChart Recharts (recettes mensuelles) + tableau derniers paiements + liste alertes impayés
- `SecretaireDashboard` : 3 KPIs + tableau paiements du jour + boutons accès rapide
- `EnseignantDashboard` : cartes de ses classes + alertes notes manquantes

### Dépendances additionnelles
```bash
npm install recharts
npm install -D @types/recharts
```

### Critères de succès
- [ ] Le rôle DIRECTEUR voit le BarChart des recettes
- [ ] Le rôle SECRÉTAIRE voit les paiements du jour
- [ ] Le rôle ENSEIGNANT voit ses classes
- [ ] Chargement avec spinner AntD pendant l'appel IPC
- [ ] État vide si aucune donnée

### Commit
```
feat(renderer): add role-based DashboardPage with KPI cards and charts
```

---

## P2-T6 : StudentListPage

### Objectif
Tableau dense des élèves avec recherche full-text (debounce 300ms), filtres (classe, statut, année), tri sur colonnes, pagination, actions par ligne, sélection multiple.

### Fonctionnalités clés
- Chargement initial via `ipc.students.list({ page: 1, pageSize: 20 })`
- Recherche : `onChange` → debounce 300ms → nouveau `ipc.students.list({ search, ... })`
- Colonnes triables via `sorter` AntD Table
- `StatusBadge` : tag coloré selon `enrollmentStatus`
- Double-clic ligne → `navigate('/students/:id')`
- Actions : icônes voir / modifier / ajouter paiement

### Composant `StatusBadge`
```typescript
// components/shared/StatusBadge.tsx
const STATUS_CONFIG = {
  ACTIVE: { color: 'success', label: 'Inscrit' },
  PENDING_PAYMENT: { color: 'warning', label: 'Impayé' },
  SUSPENDED: { color: 'error', label: 'Suspendu' },
  EXPELLED: { color: 'default', label: 'Radié' },
}
```

### Critères de succès
- [ ] Tableau affiche les données réelles depuis IPC
- [ ] Recherche filtre en temps réel (debounce)
- [ ] Filtres Classe + Statut fonctionnels
- [ ] Pagination : 20 par page, navigation entre pages
- [ ] Double-clic → profil élève
- [ ] Bouton "+ Nouvel élève" → `/students/new`

### Commit
```
feat(renderer): add StudentListPage with filterable, paginated table
```

---

## P2-T7 : StudentCreatePage

### Objectif
Formulaire page unique, 4 sections, avec validation Zod, génération automatique du matricule, upload photo, redirect vers profil après création.

### Validations
- Nom/Prénom : min 2 chars
- Date de naissance : ≤ aujourd'hui, format DD/MM/YYYY
- Téléphone : regex Guinée `^(00224|224|\+224)?[0-9]{9}$`
- Photo : type image/*, max 2MB
- Année scolaire + Classe : requis, Select peuplé depuis `ipc.classes.list()`

### Génération matricule
- Écouter `onChange` sur Nom + Prénom + Classe (sigle) + Année
- Appel `ipc.students.generateMatricule(...)` ou calcul local via `formatMatricule()`
- Afficher dans champ `readonly`

### Critères de succès
- [ ] Bouton "Enregistrer" désactivé si formulaire invalide
- [ ] Matricule se génère automatiquement en live
- [ ] Upload photo : preview affiché
- [ ] Succès → notification + redirect vers profil
- [ ] Erreur IPC → Alert message d'erreur

### Commit
```
feat(renderer): add StudentCreatePage with 4-section form and auto-matricule
```

---

## P2-T8 : StudentProfilePage

### Objectif
Page profil avec header (photo + infos clés) et 4 onglets AntD : Historique, Paiements, Notes, Documents.

### Onglets
1. **Historique scolaire** — tableau années/classes/résultats
2. **Paiements** — tableau avec colonne reçu + bouton "+ Paiement"
3. **Notes** — tableau matières/notes/coeff par période + bouton "Voir bulletin PDF"
4. **Documents** — liste fichiers uploadés, téléchargement via `ipc.invoke('files:download', ...)`

### Critères de succès
- [ ] `useParams('id')` charge l'élève depuis IPC
- [ ] Page 404 si élève non trouvé
- [ ] Chaque onglet charge ses données à la demande (lazy)
- [ ] Bouton "Modifier" → formulaire en mode édition (sections pré-remplies)

### Commit
```
feat(renderer): add StudentProfilePage with 4 tabbed sections
```

---

## P2-T9 : GradeEntryPage

### Objectif
Saisie des notes par classe/matière/période. Navigation clavier (Tab). Auto-save debounce 1s. Indicateur de progression.

### Comportement saisie
- `<Input type="number" min={0} max={20}>` dans chaque cellule
- `onBlur` → validation → `ipc.grades.upsert(...)` si valide
- Indicateur : `"23/32 notes saisies"` mis à jour en temps réel
- Colonne "Statut" : `✅ Sauvé` / `○ Non saisi` / `⚠️ Invalide`
- Si note invalide (> 20) : rouge + tooltip

### Critères de succès
- [ ] Tab navigue entre les cellules de note
- [ ] Auto-save 1s après chaque saisie
- [ ] Compteur de progression correct
- [ ] Données persistent si on quitte et revient

### Commit
```
feat(renderer): add GradeEntryPage with keyboard navigation and auto-save
```

---

## P2-T10 : BulletinPage (PDF)

### Objectif
Générer le bulletin PDF d'un élève pour une période donnée via `@react-pdf/renderer`.

### Installation
```bash
npm install @react-pdf/renderer
npm install -D @types/react-pdf
```

### Contenu bulletin
- En-tête : logo école + nom + adresse
- Infos élève : nom, prénom, matricule, classe, année
- Tableau matières : colonnes Matière / Coeff / Note / Note×Coeff / Rang / Professeur / Appréciation
- Totaux : Moyenne générale, Rang classe, Mention
- Absences : nombre d'absences justifiées/non justifiées
- Appréciation du directeur
- Signatures (3 cases : Directeur / Professeur principal / Parent)

### Rendu
- Prévisualisation dans `<PDFViewer>` intégré à la page
- Bouton "🖨 Imprimer" → `<PDFDownloadLink>` ou `window.print()`

### Critères de succès
- [ ] Bulletin s'affiche en prévisualisation
- [ ] Toutes les notes du trimestre apparaissent
- [ ] Moyenne calculée correctement (somme note×coeff / somme coeff)
- [ ] PDF téléchargeable

### Commit
```
feat(renderer): add BulletinPage PDF generator with @react-pdf/renderer
```

---

## P2-T11 : PaymentListPage + Modal création

### Objectif
Liste complète des paiements avec filtres (mois, classe, motif), total dynamique, et modal de création.

### Modal création paiement
- Champ élève : `Select` avec recherche (`showSearch`, appelle `ipc.students.list`)
- Motif : Select (Frais scolarité, Inscription, Tenue, Autre)
- Montant : Input number avec suffixe "GNF"
- Date : DatePicker (défaut : aujourd'hui)
- Reçu N° auto-généré : `REC-[MM]-[YYYY]-[seq]` — readonly
- Après création : modal se ferme + notification + ligne ajoutée au tableau

### Critères de succès
- [ ] Total visible en bas du tableau (recalculé à chaque filtre)
- [ ] Recherche élève dans le Select du modal
- [ ] Numéro de reçu auto-généré correctement
- [ ] Bouton "📄 Reçu" ouvre la page reçu

### Commit
```
feat(renderer): add PaymentListPage with creation modal and auto-receipt
```

---

## P2-T12 : ReceiptPage (PDF)

### Objectif
Reçu de paiement en PDF, format A5, deux exemplaires sur A4.

### Contenu reçu
- N° reçu : `REC-06-2026-042`
- École : nom + adresse + sigle
- Élève : nom + prénom + matricule + classe
- Motif paiement
- Montant en chiffres + en lettres (ex: "Cinq cent mille francs guinéens")
- Date
- Zone signature
- Mention "Duplicata" sur le 2ème exemplaire

### Montant en lettres
Implémenter `numberToWordsFR(amount: number): string` dans `formatters.ts`.

### Critères de succès
- [ ] Deux exemplaires sur une page A4
- [ ] Montant correctement converti en lettres (GNF)
- [ ] PDF téléchargeable + imprimable

### Commit
```
feat(renderer): add ReceiptPage PDF with A5 two-copy layout
```

---

## P2-T13 : Dark/Light theme + polish

### Objectif
Finaliser le toggle dark/light, assurer la cohérence visuelle dans tous les modules, corriger les gaps UI.

### Checklist
- [ ] Dark mode : sidebar sombre, tableaux sombres, inputs sombres
- [ ] `ConfigProvider` AntD mis à jour avec `algorithm: theme.darkAlgorithm` en mode dark
- [ ] Scrollbar custom CSS pour dark mode
- [ ] Transitions fluides (0.2s) sur tous les éléments qui changent de couleur
- [ ] States vides (no data) : illustration SVG + message dans chaque tableau
- [ ] Loading states : skeleton AntD sur les tableaux pendant chargement
- [ ] Responsive : layout fonctionne jusqu'à 1024px (sidebar auto-collapse)
- [ ] Favicon + titre fenêtre Electron : "SGSI — SchoolManager Pro"

### Commit
```
feat(renderer): finalize dark/light theme and polish empty/loading states
```

---

## P2-T14 : Tests + validation finale Phase 2

### Tests à écrire

**Composants critiques (React Testing Library)**
```
LoginPage.test.tsx          — login success, login error, change-pwd modal
StudentListPage.test.tsx    — rendu tableau, filtre recherche, pagination
StudentCreatePage.test.tsx  — validation formulaire, génération matricule
PaymentCreateModal.test.tsx — champs requis, calcul numéro reçu
formatters.test.ts          — formatGNF, formatDate, formatMatricule, numberToWordsFR
```

**Cible :** couverture > 70% sur les composants listés ci-dessus.

### Validation finale
```bash
# TypeScript strict
npx tsc --noEmit

# Tests
npm test -w apps/desktop

# Build renderer
npm run build -w apps/desktop

# Electron démarre avec renderer buildé
npm run desktop:dev
```

### Critères de succès
- [ ] `tsc --noEmit` → zéro erreur
- [ ] Tous les tests passent
- [ ] Build renderer (`dist/renderer/`) produit sans erreur
- [ ] Login → Dashboard → Liste élèves → Profil : flux complet fonctionne
- [ ] Création élève → paiement → reçu PDF : flux complet fonctionne
- [ ] Dark/Light toggle fonctionne partout
- [ ] Aucune régression sur le backend (tests Phase 1 toujours verts)

### Commit
```
test(renderer): add component tests, validate Phase 2 complete
```

---

## Résumé des tâches Phase 2

| Tâche | Description | Durée est. |
|-------|-------------|------------|
| P2-T1 | Renderer setup | 30 min |
| P2-T2 | IPC Bridge + Redux | 45 min |
| P2-T3 | AppLayout | 45 min |
| P2-T4 | LoginPage | 30 min |
| P2-T5 | DashboardPage | 1h |
| P2-T6 | StudentListPage | 1h |
| P2-T7 | StudentCreatePage | 1h30 |
| P2-T8 | StudentProfilePage | 1h |
| P2-T9 | GradeEntryPage | 1h |
| P2-T10 | BulletinPage PDF | 1h30 |
| P2-T11 | PaymentListPage | 1h |
| P2-T12 | ReceiptPage PDF | 45 min |
| P2-T13 | Theme + polish | 30 min |
| P2-T14 | Tests + validation | 1h |
| **Total** | | **~12h** |
