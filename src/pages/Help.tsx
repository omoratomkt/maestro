import type { ReactNode } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Secao {
  titulo: string
  conteudo: ReactNode
}

const Lista = ({ itens }: { itens: ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5">
    {itens.map((i, n) => (
      <li key={n}>{i}</li>
    ))}
  </ul>
)

const SECOES_AJUDA: Secao[] = [
  {
    titulo: 'Como o Maestro trabalha',
    conteudo: (
      <Lista
        itens={[
          <>
            <b>Encontra</b> prospects nas fontes da campanha (Google, Apollo, Instagram, importação de planilha, formulários do site).
          </>,
          <>
            <b>Enriquece e pontua</b> cada um de 0 a 100 (contato, aderência ao seu público, presença digital, maturidade). Quem fica abaixo do mínimo da campanha é descartado.
          </>,
          <>
            <b>O agente propõe</b> a próxima ação olhando toda a conversa, em todos os canais: qual canal, qual mensagem e quando.
          </>,
          <>
            <b>Você aprova</b> na Fila de Supervisão. Nada sai sem a sua aprovação, a não ser um padrão que você mesmo tenha promovido a automático.
          </>,
          <>
            <b>Responde, qualifica e agenda:</b> quando o prospect confirma os critérios da campanha, vira lead com um resumo pronto, e a reunião é marcada pelo seu link de agenda.
          </>,
        ]}
      />
    ),
  },
  {
    titulo: 'Seu dia a dia (nesta ordem)',
    conteudo: (
      <Lista
        itens={[
          <>
            <b>Dashboard:</b> veja o que mudou hoje, os leads mais quentes e os sinais de timing (um prospect que acabou de abrir, um site que saiu do ar).
          </>,
          <>
            <b>Fila de Supervisão:</b> aprove, edite ou rejeite o que o agente propôs. Confira antes a razão que ele escreveu.
          </>,
          <>
            <b>Caixa de Entrada:</b> responda você mesmo o que estiver como &quot;Aguarda humano&quot;.
          </>,
          <>
            <b>Pipeline:</b> acompanhe os prospects por etapa e abra qualquer um para ver a conversa inteira.
          </>,
        ]}
      />
    ),
  },
  {
    titulo: 'Fila de Supervisão: os quatro botões',
    conteudo: (
      <Lista
        itens={[
          <>
            <b>Aprovar:</b> a mensagem é enviada agora pelo canal indicado. Se o envio falhar, a ação aparece em &quot;Falhas de envio&quot; no topo da fila, com o motivo e o botão &quot;Tentar de novo&quot;.
          </>,
          <>
            <b>Editar e aprovar:</b> você ajusta o texto e então envia. O Maestro guarda que a mensagem foi editada por você.
          </>,
          <>
            <b>Rejeitar:</b> a proposta é descartada e o agente pensa em outra coisa depois.
          </>,
          <>
            <b>Automatizar este padrão:</b> use quando um tipo de ação é sempre boa (por exemplo, o follow-up de 48 horas). A mensagem vira um modelo e passa a sair sozinha nesses casos, sem passar pela fila. Você pode pausar a qualquer momento em Automações. Respostas a prospects nunca viram automáticas.
          </>,
          <>
            Se a razão trouxer o aviso <b>⚠ ATENÇÃO: link</b>, a mensagem contém um link que não é o da sua agenda. Confira antes de aprovar.
          </>,
        ]}
      />
    ),
  },
  {
    titulo: 'Caixa de Entrada: o que cada etiqueta quer dizer',
    conteudo: (
      <Lista
        itens={[
          <>
            <b>Respondida:</b> já existe mensagem nossa depois da dele. Nada a fazer.
          </>,
          <>
            <b>Agente vai responder:</b> há uma resposta proposta esperando na Fila. Vá lá aprovar.
          </>,
          <>
            <b>Aguarda humano:</b> o agente não propõe nada (a pessoa pediu ligação ou proposta, ou perguntou algo que ele não sabe). Responda você.
          </>,
        ]}
      />
    ),
  },
  {
    titulo: 'Pipeline e painel do prospect',
    conteudo: (
      <Lista
        itens={[
          <>
            Etapas: <b>novo → em contato → engajado → qualificado → agendado → convertido</b> (e descartado ou pausado). Arraste o cartão para mudar de etapa. O Maestro também muda sozinho conforme a conversa.
          </>,
          <>
            Clique em um prospect: conversa completa em todos os canais, <b>como o score foi calculado</b>, o resumo do lead e a situação da reunião (marque como realizada ou não compareceu).
          </>,
          <>
            <b>Reenriquecer</b> refaz a busca de dados e o score (útil depois de corrigir o site ou o telefone).
          </>,
          <>
            <b>Baixar dados</b> e <b>Excluir prospect</b> atendem pedidos da LGPD. Ao excluir, deixe marcado &quot;impedir que volte&quot; para uma nova busca não trazer o contato de volta.
          </>,
        ]}
      />
    ),
  },
  {
    titulo: 'Campanhas',
    conteudo: (
      <Lista
        itens={[
          <>
            Crie pelo assistente de 5 passos (playbook, público, canais e fontes, persona, revisão). Os textos entre <b>[colchetes]</b> dos playbooks precisam ser trocados pelos seus dados antes de lançar.
          </>,
          <>
            <b>Lançar</b> ativa a campanha e já busca os primeiros prospects. <b>Pausar</b> faz o agente parar de propor ações para ela. <b>Encerrar</b> mantém o histórico.
          </>,
          <>
            A <b>cota semanal</b> limita quantos prospects novos entram por semana. <b>Buscar agora</b> roda a busca na hora, dentro dessa cota.
          </>,
          <>
            Os <b>critérios de qualificação obrigatórios</b> decidem quando um prospect vira lead: o agente só declara qualificado quando todos foram confirmados pela própria pessoa.
          </>,
        ]}
      />
    ),
  },
  {
    titulo: 'Métricas',
    conteudo: (
      <Lista
        itens={[
          <>
            Escolha o período e, se quiser, uma campanha. &quot;Campanhas lado a lado&quot; compara taxa de resposta e qualificação entre elas.
          </>,
          <>
            <b>Custo por lead qualificado</b> soma o gasto com inteligência artificial no período; custos de ferramentas externas (Apollo, Instantly...) não entram.
          </>,
          <>
            A evolução diária só aparece depois de dois dias de operação.
          </>,
        ]}
      />
    ),
  },
  {
    titulo: 'Proteções que funcionam sozinhas',
    conteudo: (
      <Lista
        itens={[
          <>
            <b>Horário comercial:</b> o agente só agenda o próximo contato de segunda a sexta, entre 9h e 18h (Brasília).
          </>,
          <>
            <b>Limite diário de envios</b> por canal (padrão: WhatsApp 100, email 150) e <b>teto diário de gasto com IA</b> (padrão: US$ 10). Ao atingir, o envio espera o dia seguinte, e isso aparece em &quot;Falhas de envio&quot; com o motivo.
          </>,
          <>
            <b>Lista de supressão:</b> quem pede para parar de receber mensagens entra nela automaticamente, e ninguém dessa lista é buscado, proposto ou contatado de novo, em nenhuma campanha.
          </>,
          <>
            <b>O agente não inventa preço, prazo ou resultado</b> e leva ao humano o que não sabe responder. Se perguntarem se é uma pessoa ou uma IA, ele responde com honestidade.
          </>,
        ]}
      />
    ),
  },
  {
    titulo: 'Quando algo não funciona',
    conteudo: (
      <Lista
        itens={[
          <>
            Mensagem aprovada que não saiu: veja &quot;Falhas de envio&quot; no topo da Fila de Supervisão. O texto do erro costuma dizer o que fazer.
          </>,
          <>
            Nada acontecendo há horas (nenhuma proposta nova, nenhuma resposta entrando): avise quem administra o Maestro. Há um vigia que também avisa por email.
          </>,
          <>
            Não achou uma tela ou um botão: peça ao administrador. Algumas configurações (integrações, lista de supressão, usuários) ficam no painel de Setup, só para administradores.
          </>,
        ]}
      />
    ),
  },
]

export default function Help() {
  return (
    <PageShell title="Ajuda" description="Como usar o Maestro no dia a dia">
      <div className="mx-auto max-w-3xl space-y-4">
        {SECOES_AJUDA.map((s) => (
          <Card key={s.titulo}>
            <CardHeader>
              <CardTitle>{s.titulo}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">{s.conteudo}</CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  )
}
