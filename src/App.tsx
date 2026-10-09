import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth, RequireSuperAdmin } from '@/components/layout/RouteGuards'
import { AuthProvider } from '@/lib/auth'
import Automations from '@/pages/Automations'
import Campaigns from '@/pages/Campaigns'
import Dashboard from '@/pages/Dashboard'
import Inbox from '@/pages/Inbox'
import Login from '@/pages/Login'
import SetPassword from '@/pages/SetPassword'
import Metrics from '@/pages/Metrics'
import Pipeline from '@/pages/Pipeline'
import Queue from '@/pages/Queue'
import Integrations from '@/pages/setup/Integrations'
import Playbooks from '@/pages/setup/Playbooks'
import SetupDashboard from '@/pages/setup/SetupDashboard'
import Suppressions from '@/pages/setup/Suppressions'
import Workspaces from '@/pages/setup/Workspaces'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="definir-senha" element={<SetPassword />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="fila" element={<Queue />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="campanhas" element={<Campaigns />} />
              <Route path="automacoes" element={<Automations />} />
              <Route path="metricas" element={<Metrics />} />
              <Route element={<RequireSuperAdmin />}>
                <Route path="setup" element={<SetupDashboard />} />
                <Route path="setup/workspaces" element={<Workspaces />} />
                <Route path="setup/playbooks" element={<Playbooks />} />
                <Route path="setup/integracoes" element={<Integrations />} />
                <Route path="setup/supressoes" element={<Suppressions />} />
              </Route>
            </Route>
          </Route>
        </Routes>
        <Toaster richColors />
      </AuthProvider>
    </BrowserRouter>
  )
}
