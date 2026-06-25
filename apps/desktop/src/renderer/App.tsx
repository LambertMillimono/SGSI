import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Spin, Modal } from 'antd'
import { RoleGuard, ModuleGuard } from './utils/roleGuard'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { clearAuth } from './store/authSlice'
import type { RootState, AppDispatch } from './store'
import { ipc } from './utils/ipcBridge'
import { LicenseActivationPage } from './pages/license/LicenseActivationPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { StudentListPage } from './pages/students/StudentListPage'
import { StudentCreatePage } from './pages/students/StudentCreatePage'
import { StudentProfilePage } from './pages/students/StudentProfilePage'
import { GradeEntryPage } from './pages/grades/GradeEntryPage'
import { BulletinPage } from './pages/grades/BulletinPage'
import { PaymentListPage } from './pages/payments/PaymentListPage'
import { PaymentPlanPage } from './pages/payments/PaymentPlanPage'
import { DiscountPage } from './pages/payments/DiscountPage'
import { DisciplinePage } from './pages/students/DisciplinePage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { ReceiptPage } from './pages/payments/ReceiptPage'
import { AbsencePage } from './pages/absences/AbsencePage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { StaffPage } from './pages/staff/StaffPage'
import { PayrollPage } from './pages/staff/PayrollPage'
import { DocumentsPage } from './pages/documents/DocumentsPage'
import { SchedulePage } from './pages/schedule/SchedulePage'
import { ExpensesPage } from './pages/expenses/ExpensesPage'
import { LibraryPage } from './pages/library/LibraryPage'
import { InfirmerePage } from './pages/medical/InfirmerePage'
import { TransportPage } from './pages/transport/TransportPage'
import { MessagesPage } from './pages/messages/MessagesPage'
import { RelancesPage } from './pages/relances/RelancesPage'
import { UpdateNotifier } from './components/shared/UpdateNotifier'

function G({ m, children }: { m: string; children: React.ReactNode }) {
  return <ModuleGuard module={m}>{children}</ModuleGuard>
}

/* ── License Guard — blocks access until license is valid ─────── */
function LicenseGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking')

  const check = async () => {
    try {
      const res = await ipc.license.validate()
      const valid = res?.data?.valid ?? res?.valid ?? false
      setStatus(valid ? 'valid' : 'invalid')
    } catch {
      // If IPC fails (dev mode), allow access
      setStatus('valid')
    }
  }

  useEffect(() => { check() }, [])

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0F0F1A' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (status === 'invalid') {
    return <LicenseActivationPage onActivated={() => setStatus('valid')} />
  }

  return <>{children}</>
}

// Vérifie le token au démarrage. Si expiré/invalide → déconnexion propre.
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>()
  const { token, isAuthenticated } = useSelector((s: RootState) => s.auth)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setReady(true)
      return
    }
    ipc.auth.verifyToken(token)
      .then(() => setReady(true))
      .catch(() => {
        dispatch(clearAuth())
        setReady(true)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return <>{children}</>
}

function AppInner() {
  const navigate = useNavigate()

  useEffect(() => {
    const electron = (window as any).electron
    if (!electron?.ipc) return

    const handleAlert = (_: any, data: { count: number; total: number; currency: string }) => {
      const dismissed = localStorage.getItem('relances-dismissed-until')
      if (dismissed && new Date(dismissed) > new Date()) return

      Modal.warning({
        title: `${data.count} parent(s) ont des impayes en retard`,
        content: `Total du : ${data.total.toLocaleString('fr-FR')} ${data.currency}`,
        okText: 'Voir les relances',
        cancelText: 'Plus tard',
        onOk: () => navigate('/relances'),
        onCancel: () => {
          const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          localStorage.setItem('relances-dismissed-until', until)
        },
      })
    }

    electron.ipc.on('relances:startup-alert', handleAlert)
    return () => { electron.ipc.removeListener?.('relances:startup-alert', handleAlert) }
  }, [])

  return (
    <LicenseGuard>
      <UpdateNotifier />
      <AuthBootstrap>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RoleGuard><AppLayout /></RoleGuard>}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard — accessible à tous */}
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Élèves */}
          <Route path="students"               element={<G m="students"><StudentListPage /></G>} />
          <Route path="students/new"           element={<G m="students"><StudentCreatePage /></G>} />
          <Route path="students/:id"           element={<G m="students"><StudentProfilePage /></G>} />
          <Route path="students/:id/documents" element={<G m="students"><DocumentsPage /></G>} />

          {/* Notes & Bulletins */}
          <Route path="grades"                        element={<G m="grades"><GradeEntryPage /></G>} />
          <Route path="grades/bulletins/:studentId"   element={<G m="grades"><BulletinPage /></G>} />

          {/* Paiements */}
          <Route path="payments"              element={<G m="payments"><PaymentListPage /></G>} />
          <Route path="payments/plans"         element={<G m="payments"><PaymentPlanPage /></G>} />
          <Route path="payments/discounts"     element={<G m="payments"><DiscountPage /></G>} />
          <Route path="payments/:id/receipt"  element={<G m="payments"><ReceiptPage /></G>} />

          {/* Absences */}
          <Route path="absences"   element={<G m="absences"><AbsencePage />  </G>} />

          {/* Emploi du temps */}
          <Route path="schedule"   element={<G m="schedule"><SchedulePage /></G>} />

          {/* Personnel */}
          <Route path="staff"       element={<G m="staff"><StaffPage /></G>} />
          <Route path="discipline"  element={<G m="students"><DisciplinePage /></G>} />
          <Route path="payroll"    element={<G m="staff"><PayrollPage /></G>} />

          {/* Dépenses */}
          <Route path="expenses"   element={<G m="expenses"><ExpensesPage /></G>} />

          {/* Relances */}
          <Route path="relances"   element={<RelancesPage />} />

          {/* Rapports */}
          <Route path="reports"    element={<G m="reports"><ReportsPage /></G>} />

          {/* Bibliothèque */}
          <Route path="library"    element={<G m="library"><LibraryPage /></G>} />

          {/* Infirmerie */}
          <Route path="infirmerie" element={<G m="infirmerie"><InfirmerePage /></G>} />

          {/* Transport */}
          <Route path="transport"  element={<G m="transport"><TransportPage /></G>} />

          {/* Messagerie */}
          <Route path="messages"   element={<G m="messages"><MessagesPage /></G>} />

          {/* Paramètres */}
          <Route path="settings"   element={<G m="settings"><SettingsPage /></G>} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </AuthBootstrap>
    </LicenseGuard>
  )
}

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppInner />
    </HashRouter>
  )
}
