import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RoleGuard } from './utils/roleGuard'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { StudentListPage } from './pages/students/StudentListPage'
import { StudentCreatePage } from './pages/students/StudentCreatePage'
import { StudentProfilePage } from './pages/students/StudentProfilePage'
import { GradeEntryPage } from './pages/grades/GradeEntryPage'
import { PaymentListPage } from './pages/payments/PaymentListPage'
import { ReceiptPage } from './pages/payments/ReceiptPage'

function Stub({ name }: { name: string }) {
  return <div style={{ padding: 24 }}><h2>{name}</h2><p>En cours de développement...</p></div>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RoleGuard><AppLayout /></RoleGuard>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentListPage />} />
          <Route path="students/new" element={<StudentCreatePage />} />
          <Route path="students/:id" element={<StudentProfilePage />} />
          <Route path="grades" element={<GradeEntryPage />} />
          <Route path="grades/bulletins/:studentId" element={<Stub name="Bulletin PDF (P2-T10)" />} />
          <Route path="payments" element={<PaymentListPage />} />
          <Route path="payments/:id/receipt" element={<ReceiptPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}
