// Números de demonstração do Dashboard: o aspecto do Maestro em uso pleno. Tudo inventado (empresas e pessoas fictícias).
// Valem só na tela; nada disto é gravado no banco. O interruptor "Ver dados reais" do Dashboard desliga a demonstração neste navegador.

export interface LeadQuenteDemo {
  id: string
  empresa: string
  contato: string
  proximoPasso: string
  statusReuniao: 'pendente' | 'agendada'
  score: number
}

export interface DashboardDemo {
  pendentes: number
  novosHoje: number
  enviadasHoje: number
  respostasHoje: number
  qualificadosHoje: number
  leadsQuentes: LeadQuenteDemo[]
}

export const DASHBOARD_DEMO: DashboardDemo = {
  pendentes: 18,
  novosHoje: 64,
  enviadasHoje: 112,
  respostasHoje: 28,
  qualificadosHoje: 7,
  leadsQuentes: [
    { id: 'demo-1', empresa: 'Clínica Sorriso Pleno', contato: 'Ana Souza · Sócia-diretora', proximoPasso: 'Reunião quinta às 15h', statusReuniao: 'agendada', score: 9 },
    { id: 'demo-2', empresa: 'Studio Forma Academia', contato: 'Rafael Lima · Proprietário', proximoPasso: 'Enviar proposta', statusReuniao: 'pendente', score: 9 },
    { id: 'demo-3', empresa: 'Odonto Vitta', contato: 'Camila Prado · Gerente comercial', proximoPasso: 'Reunião amanhã às 10h', statusReuniao: 'agendada', score: 8 },
    { id: 'demo-4', empresa: 'Escritório Nogueira & Dias', contato: 'Marcos Dias · Sócio', proximoPasso: 'Aguardando horário do lead', statusReuniao: 'pendente', score: 8 },
    { id: 'demo-5', empresa: 'Pet Care Bairro Alto', contato: 'Juliana Reis · Proprietária', proximoPasso: 'Reunião sexta às 11h', statusReuniao: 'agendada', score: 7 },
  ],
}

const CHAVE = 'maestro:dashboard-demo'

/** Demonstração ligada por padrão; só o valor "off" no armazenamento do navegador a desliga. Nunca quebra se o armazenamento estiver bloqueado. */
export function demoLigada(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) !== 'off'
  } catch {
    return true
  }
}

export function gravarDemo(ligada: boolean) {
  try {
    window.localStorage.setItem(CHAVE, ligada ? 'on' : 'off')
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
}
