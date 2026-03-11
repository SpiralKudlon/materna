import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { MainLayout } from "./components/layout/MainLayout"
import { Facilities } from "./pages/Facilities"
import { Users } from "./pages/Users"
import { CHVAssignments } from "./pages/CHVAssignments"
import { FeatureFlags } from "./pages/FeatureFlags"
import { AuditLogs } from "./pages/AuditLogs"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/facilities" replace />} />
          <Route path="facilities" element={<Facilities />} />
          <Route path="users" element={<Users />} />
          <Route path="assignments" element={<CHVAssignments />} />
          <Route path="features" element={<FeatureFlags />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
