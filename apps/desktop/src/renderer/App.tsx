import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RoleGuard } from './utils/roleGuard'

// Lazy imports will be added as pages are built
// For now just stubs
function Stub({ name }: { name: string }) {
  return <div style={{ padding: 24 }}><h2>{name}</h2><p>En cours de développement...</p></div>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Stub name="Login (P2-T4)" />} />
        <Route path="/" element={<RoleGuard><Stub name="AppLayout (P2-T3)" /></RoleGuard>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Stub name="Dashboard (P2-T5)" />} />
          <Route path="students" element={<Stub name="Students (P2-T6)" />} />
          <Route path="students/new" element={<Stub name="New Student (P2-T7)" />} />
          <Route path="students/:id" element={<Stub name="Student Profile (P2-T8)" />} />
          <Route path="grades" element={<Stub name="Grades (P2-T9)" />} />
          <Route path="grades/bulletins/:studentId" element={<Stub name="Bulletin (P2-T10)" />} />
          <Route path="payments" element={<Stub name="Payments (P2-T11)" />} />
          <Route path="payments/:id/receipt" element={<Stub name="Receipt (P2-T12)" />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}
