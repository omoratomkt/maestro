import {
  BarChart3,
  Building2,
  HelpCircle,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  Plug,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  LogOut,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { usePendingQueueCount } from '@/hooks/useQueue'
import { useAuth } from '@/lib/auth'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const operationalNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/fila', label: 'Fila de Supervisão', icon: ShieldCheck },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/inbox', label: 'Caixa de Entrada', icon: Inbox },
  { to: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { to: '/automacoes', label: 'Automações', icon: Zap },
  { to: '/metricas', label: 'Métricas', icon: BarChart3 },
  { to: '/ajuda', label: 'Ajuda', icon: HelpCircle },
]

const setupNav: NavItem[] = [
  { to: '/setup', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/setup/workspaces', label: 'Workspaces', icon: Building2 },
  { to: '/setup/playbooks', label: 'Playbooks', icon: Workflow },
  { to: '/setup/integracoes', label: 'Integrações', icon: Plug },
  { to: '/setup/supressoes', label: 'Lista de supressão', icon: ShieldBan },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const inSetup = pathname.startsWith('/setup')
  const items = inSetup ? setupNav : operationalNav
  const pending = usePendingQueueCount()
  const { isSuperAdmin, signOut, session, workspaces, workspaceId, setWorkspaceId } = useAuth()

  return (
    <UiSidebar>
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Maestro</p>
            <p className="text-xs text-muted-foreground">{inSetup ? 'Setup' : 'Painel operacional'}</p>
          </div>
        </div>
        {workspaces.length > 1 ? (
          <select
            aria-label="Cliente (workspace)"
            className="mt-3 h-8 w-full rounded-lg border bg-background px-2 text-sm"
            value={workspaceId ?? ''}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nome}
              </option>
            ))}
          </select>
        ) : workspaces[0] ? (
          <p className="mt-2 truncate text-xs font-medium">{workspaces[0].nome}</p>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{inSetup ? 'Configuração' : 'Operação'}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.end ? pathname === item.to : pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton isActive={active} render={<NavLink to={item.to} end={item.end} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.to === '/fila' && pending ? <SidebarMenuBadge>{pending}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {isSuperAdmin ? (
            <SidebarMenuItem>
              <SidebarMenuButton render={<NavLink to={inSetup ? '/' : '/setup'} />}>
                {inSetup ? <LayoutDashboard /> : <ShieldCheck />}
                <span>{inSetup ? 'Voltar ao painel' : 'Setup (admin)'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut />
              <span className="truncate">Sair{session?.user.email ? ` (${session.user.email})` : ''}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </UiSidebar>
  )
}
