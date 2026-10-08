-- DEMO SEED — dados 100% fictícios para visualizar todas as telas do Maestro.
-- Tudo fica numa campanha "[DEMO] ..." no workspace "morato"; prospects têm fonte = 'demo'.
-- Para remover: supabase/sql/demo_cleanup.sql
-- Empresas, pessoas, telefones e emails são inventados (emails em .example, telefones 5511900000xxx).

DO $$
DECLARE
  ws   UUID;
  camp UUID;
  flow_a UUID;
  flow_b UUID;
BEGIN
  SELECT id INTO ws FROM workspaces WHERE slug = 'morato';
  IF ws IS NULL THEN RAISE EXCEPTION 'Workspace morato não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM campanhas WHERE workspace_id = ws AND nome LIKE '[DEMO]%') THEN
    RAISE EXCEPTION 'Dados de demonstração já existem. Rode demo_cleanup.sql antes.';
  END IF;

  INSERT INTO campanhas (workspace_id, status, nome, segmento, cargos_alvo, regioes, score_minimo, volume_semanal,
    fontes, canais, persona_nome, persona_tom, persona_produto, persona_argumentos, persona_objecoes, criterios_qualificacao)
  VALUES (ws, 'ativa', '[DEMO] Prospecção de exemplo', 'Serviços locais e PMEs',
    ARRAY['Sócio','Proprietário','Diretor'], ARRAY['Brasil'], 60, 50,
    ARRAY['google_places','apollo','csv'], ARRAY['whatsapp_evolution','email','linkedin','instagram'],
    'Arthur Morato', 'consultivo', 'Consultoria em automações, IA e melhoria de processos',
    ARRAY['Menos trabalho manual','Mais tempo para o que gera receita'],
    '[{"objecao":"Já tenho fornecedor","resposta":"Complementamos o que já existe."}]'::jsonb,
    '[{"campo":"e_decisor","pergunta":"Decide a contratação?","obrigatorio":true},{"campo":"dor_principal","pergunta":"Qual o principal gargalo?","obrigatorio":true}]'::jsonb)
  RETURNING id INTO camp;

  CREATE TEMP TABLE demo_p (id UUID, nome TEXT) ON COMMIT DROP;

  WITH v(nome_empresa, contato, cargo, cidade, estado, segmento, status, score, canal, dias, idx) AS (VALUES
    ('Clínica Aurora Estética','Marina Duarte','Sócia','São Paulo','SP','Clínicas de estética','engajado',88,'whatsapp',6,1),
    ('Studio Pilates Vértice','Rafael Nogueira','Proprietário','Campinas','SP','Pilates','qualificado',91,'whatsapp',9,2),
    ('Contabilidade Horizonte','Paulo Mendes','Sócio-diretor','Belo Horizonte','MG','Contabilidade','agendado',86,'email',11,3),
    ('Odonto Prime Bairro Alto','Letícia Faria','Sócia','Curitiba','PR','Odontologia','em_contato',79,'whatsapp',4,4),
    ('Auto Center Silva e Filhos','Jorge Silva','Proprietário','Goiânia','GO','Oficina mecânica','novo',64,NULL,2,5),
    ('Barros Advocacia','Camila Barros','Sócia','Porto Alegre','RS','Advocacia','engajado',83,'email',7,6),
    ('Padaria Trigo Dourado','Sérgio Lima','Dono','Recife','PE','Alimentação','em_contato',58,'whatsapp',3,7),
    ('Imobiliária Nova Casa','Fernanda Costa','Diretora','Salvador','BA','Imobiliária','qualificado',90,'linkedin',10,8),
    ('Verde Vida Orgânicos','Tatiana Rocha','Fundadora','Florianópolis','SC','E-commerce','engajado',77,'instagram',5,9),
    ('Transportadora Rota Sul','Anderson Pires','Gerente','Joinville','SC','Logística','novo',71,NULL,1,10),
    ('Academia Corpo em Movimento','Bruno Teixeira','Sócio','Fortaleza','CE','Academia','convertido',94,'whatsapp',14,11),
    ('Petshop Quatro Patas','Juliana Alves','Proprietária','Brasília','DF','Petshop','descartado',52,'whatsapp',8,12),
    ('Pessoas Mais Consultoria de RH','Eduardo Ramos','CEO','São Paulo','SP','RH','agendado',89,'linkedin',12,13),
    ('Clínica Veterinária Bicho Bom','Marcelo Dias','Sócio','Ribeirão Preto','SP','Veterinária','em_contato',74,'email',5,14),
    ('Estúdio Lumen Fotografia','Priscila Moura','Fundadora','Rio de Janeiro','RJ','Fotografia','novo',61,NULL,2,15),
    ('Escola de Idiomas Fala Mais','Gustavo Pereira','Diretor','Vitória','ES','Educação','pausado',68,'email',13,16),
    ('Marcenaria Artesanal Cedro','Antônio Freitas','Proprietário','Londrina','PR','Marcenaria','novo',55,NULL,0,17),
    ('Restaurante Sabor da Terra','Helena Martins','Sócia','Belém','PA','Restaurante','descartado',47,'whatsapp',9,18),
    ('Agência Pixel Norte','Lucas Andrade','Sócio','Manaus','AM','Marketing','em_contato',80,'instagram',3,19),
    ('Laboratório Vida Análises','Renata Cunha','Diretora','São José dos Campos','SP','Saúde','novo',85,NULL,0,20),
    ('Construtora Alicerce','Roberto Gomes','Diretor','Uberlândia','MG','Construção','novo',66,NULL,0,21),
    ('Centro de Estética Pele Viva','Carolina Nunes','Sócia','Niterói','RJ','Estética','engajado',82,'whatsapp',4,22),
    ('Ótica Visão Clara','Marcos Ribeiro','Proprietário','Natal','RN','Varejo','em_contato',62,'email',4,23)
  ), ins AS (
    INSERT INTO prospects (workspace_id, campanha_id, nome_empresa, nome_contato, cargo, cidade, estado, segmento,
      status, score, canal_principal, fonte, fonte_id, email, whatsapp, criado_em, atualizado_em)
    SELECT ws, camp, v.nome_empresa, v.contato, v.cargo, v.cidade, v.estado, v.segmento,
      v.status, v.score, v.canal, 'demo', 'demo-' || v.idx,
      'contato' || v.idx || '@demo-maestro.example',
      '5511900000' || lpad(v.idx::text, 3, '0'),
      now() - make_interval(days => v.dias, hours => 1), now()
    FROM v RETURNING id, nome_empresa
  )
  INSERT INTO demo_p SELECT id, nome_empresa FROM ins;

  -- Interações (horas atrás). Quem escreve: out = Maestro, in = prospect.
  INSERT INTO prospect_interacoes (prospect_id, canal, direcao, conteudo, status, enviado_em)
  SELECT (SELECT id FROM demo_p WHERE nome = i.nome), i.canal, i.direcao, i.conteudo,
         CASE WHEN i.direcao = 'out' THEN 'lido' END, now() - make_interval(hours => i.horas)
  FROM (VALUES
    ('Clínica Aurora Estética','whatsapp','out','Olá Marina, aqui é o Arthur Morato. Vi que a Clínica Aurora tem agenda cheia e muito atendimento manual pelo WhatsApp. Faz sentido conversarmos sobre automatizar isso sem perder o toque pessoal?',72),
    ('Clínica Aurora Estética','whatsapp','in','Oi Arthur! Faz sentido sim, hoje a recepção perde muito tempo confirmando horários.',70),
    ('Clínica Aurora Estética','whatsapp','out','Perfeito, Marina. Quantas pessoas cuidam do agendamento hoje, e é você quem decide sobre ferramentas novas?',69),
    ('Clínica Aurora Estética','whatsapp','in','Duas recepcionistas. Eu decido sim, sou sócia.',3),
    ('Studio Pilates Vértice','whatsapp','out','Oi Rafael, tudo bem? Sou o Arthur Morato. Ajudo estúdios a reduzir o trabalho manual de agenda e cobrança com automação. Posso te contar como?',200),
    ('Studio Pilates Vértice','whatsapp','in','Pode sim. Hoje faço tudo em planilha e perco muita aluna na renovação.',198),
    ('Studio Pilates Vértice','whatsapp','out','Entendi. Qual faixa de investimento faz sentido para resolver isso, e em quanto tempo você quer ver resultado?',196),
    ('Studio Pilates Vértice','whatsapp','in','Até uns 2 mil por mês, e queria começar no próximo mês.',120),
    ('Contabilidade Horizonte','email','out','Assunto: Menos retrabalho no fechamento mensal. Paulo, ajudo escritórios contábeis a automatizar a coleta de documentos dos clientes. Vale uma conversa rápida?',260),
    ('Contabilidade Horizonte','email','in','Olá Arthur, tenho interesse. Hoje cobramos documento por WhatsApp um a um.',250),
    ('Contabilidade Horizonte','email','out','Ótimo, Paulo. Posso te mostrar um fluxo em 30 minutos. Qual seu melhor horário?',248),
    ('Contabilidade Horizonte','email','in','Podemos conversar quinta às 15h.',100),
    ('Odonto Prime Bairro Alto','whatsapp','out','Olá Letícia, aqui é o Arthur Morato. Trabalho com automação de atendimento para clínicas odontológicas. Posso te mostrar como reduzir faltas em consultas?',48),
    ('Barros Advocacia','email','out','Camila, ajudo escritórios de advocacia a organizar a triagem de novos clientes com IA. Faz sentido conversarmos?',96),
    ('Barros Advocacia','email','in','Interessante, mas estou em audiência a semana toda. Me retorne semana que vem.',30),
    ('Padaria Trigo Dourado','whatsapp','out','Olá Sérgio, aqui é o Arthur Morato. Ajudo padarias a automatizar encomendas pelo WhatsApp. Posso te explicar rapidinho?',30),
    ('Imobiliária Nova Casa','linkedin','out','Fernanda, vi o crescimento da Nova Casa em Salvador. Ajudo imobiliárias a qualificar leads automaticamente. Vamos conversar?',300),
    ('Imobiliária Nova Casa','linkedin','in','Olá Arthur! Hoje meus corretores gastam horas com leads frios. Me conta mais.',290),
    ('Imobiliária Nova Casa','linkedin','out','Claro. Você decide sobre ferramentas para a equipe, e qual o prazo ideal para ter algo rodando?',288),
    ('Imobiliária Nova Casa','linkedin','in','Decido sim. Queria ver algo funcionando em 60 dias.',150),
    ('Verde Vida Orgânicos','instagram','out','Oi Tatiana! Adoro o trabalho da Verde Vida. Ajudo lojas online a automatizar o atendimento no Instagram. Posso te mostrar?',50),
    ('Verde Vida Orgânicos','instagram','in','Oi! Quem é você?',20),
    ('Academia Corpo em Movimento','whatsapp','out','Oi Bruno, sou o Arthur Morato. Ajudo academias a reduzir cancelamentos com automação de relacionamento. Topa conversar?',330),
    ('Academia Corpo em Movimento','whatsapp','in','Topo! Pode me ligar amanhã.',320),
    ('Academia Corpo em Movimento','whatsapp','in','Fechado, vamos seguir com o projeto!',60),
    ('Petshop Quatro Patas','whatsapp','out','Olá Juliana, aqui é o Arthur Morato. Posso te mostrar como automatizar agendamentos do petshop?',190),
    ('Pessoas Mais Consultoria de RH','linkedin','out','Eduardo, vi que a Pessoas Mais está crescendo. Ajudo consultorias de RH a automatizar triagem de candidatos. Vamos conversar?',280),
    ('Pessoas Mais Consultoria de RH','linkedin','in','Olá Arthur, faz sentido. Triagem é nosso maior gargalo hoje.',270),
    ('Pessoas Mais Consultoria de RH','linkedin','out','Ótimo, Eduardo. Podemos marcar 30 minutos para eu entender o processo?',268),
    ('Pessoas Mais Consultoria de RH','linkedin','in','Pode ser sexta às 10h.',90),
    ('Clínica Veterinária Bicho Bom','email','out','Marcelo, ajudo clínicas veterinárias a reduzir faltas e organizar retornos com automação. Podemos conversar?',120),
    ('Agência Pixel Norte','instagram','out','Oi Lucas! Ajudo agências a automatizar relatórios e onboarding de clientes. Faz sentido trocar uma ideia?',26),
    ('Centro de Estética Pele Viva','whatsapp','out','Olá Carolina, aqui é o Arthur Morato. Ajudo centros de estética a automatizar agendamento e pós-atendimento. Posso te contar mais?',60),
    ('Centro de Estética Pele Viva','whatsapp','in','Oi! Quanto custa algo assim?',5),
    ('Ótica Visão Clara','email','out','Marcos, ajudo óticas a reativar clientes antigos com automação de mensagens. Vale conversarmos?',80),
    ('Escola de Idiomas Fala Mais','email','out','Gustavo, ajudo escolas de idiomas a reduzir evasão com automação de relacionamento. Posso te explicar?',300),
    ('Restaurante Sabor da Terra','whatsapp','out','Olá Helena, aqui é o Arthur Morato. Posso te mostrar como automatizar reservas e pedidos no WhatsApp?',200)
  ) AS i(nome, canal, direcao, conteudo, horas);

  UPDATE prospects p SET
    primeiro_contato_em = s.primeiro, ultima_interacao_em = s.ultima
  FROM (SELECT prospect_id, min(enviado_em) FILTER (WHERE direcao = 'out') AS primeiro, max(enviado_em) AS ultima
        FROM prospect_interacoes GROUP BY prospect_id) s
  WHERE p.id = s.prospect_id AND p.id IN (SELECT id FROM demo_p);

  -- Estado do agente (próxima ação sempre no futuro).
  INSERT INTO prospect_estado (prospect_id, aguardando, proxima_acao_em, contexto_resumo, tentativas_whatsapp, tentativas_email, tentativas_linkedin, tentativas_instagram)
  SELECT (SELECT id FROM demo_p WHERE nome = e.nome), e.aguardando, now() + make_interval(hours => e.em), e.ctx, e.w, e.m, e.l, e.i
  FROM (VALUES
    ('Clínica Aurora Estética','aprovacao',2,'Sócia e decisora. Dor: confirmação manual de horários. Falta confirmar budget e prazo.',1,0,0,0),
    ('Odonto Prime Bairro Alto','resposta',24,'Primeira mensagem enviada há 2 dias, sem resposta.',1,0,0,0),
    ('Barros Advocacia','tempo',168,'Pediu retorno na semana que vem (em audiência).',0,1,0,0),
    ('Verde Vida Orgânicos','aprovacao',4,'Perguntou quem somos; precisa de resposta de apresentação.',0,0,0,1),
    ('Centro de Estética Pele Viva','aprovacao',1,'Perguntou preço; agente propôs resposta consultiva.',1,0,0,0),
    ('Padaria Trigo Dourado','resposta',48,'Follow-up automático já enviado.',2,0,0,0),
    ('Clínica Veterinária Bicho Bom','tempo',24,'Cinco dias sem resposta ao primeiro email.',0,1,0,0)
  ) AS e(nome, aguardando, em, ctx, w, m, l, i);

  -- Fluxos automáticos
  INSERT INTO fluxos_automaticos (workspace_id, campanha_id, nome, descricao, condicao, tipo_acao, canal_acao, template_mensagem, delay_horas, ativo, total_execucoes, total_respostas, taxa_sucesso)
  VALUES (ws, camp, 'Follow-up WhatsApp após 48h sem resposta', 'Padrão aprovado várias vezes na fila.',
    '{"evento":"acao_followup","canal":"whatsapp","delay_horas":48}'::jsonb, 'followup', 'whatsapp',
    'Oi {nome}, passando para saber se consegue ver minha mensagem anterior. Posso te mostrar em 10 minutos como isso funciona na prática?', 48, true, 14, 5, 35.71)
  RETURNING id INTO flow_a;
  INSERT INTO fluxos_automaticos (workspace_id, campanha_id, nome, descricao, condicao, tipo_acao, canal_acao, template_mensagem, delay_horas, ativo, total_execucoes, total_respostas, taxa_sucesso)
  VALUES (ws, camp, 'Email de reengajamento após 7 dias', 'Pausado para revisão do texto.',
    '{"evento":"acao_reengajamento","canal":"email","delay_horas":168}'::jsonb, 'reengajamento', 'email',
    'Olá {nome}, retomando nossa conversa. Ainda faz sentido olharmos como reduzir o trabalho manual aí na empresa?', 168, false, 6, 1, 16.67)
  RETURNING id INTO flow_b;

  -- Fila: pendentes
  INSERT INTO fila_acoes (workspace_id, prospect_id, campanha_id, tipo, canal, mensagem, razao, status, criado_em, expira_em)
  SELECT ws, (SELECT id FROM demo_p WHERE nome = f.nome), camp, f.tipo, f.canal, f.mensagem, f.razao, 'pendente',
         now() - make_interval(hours => f.horas), now() + interval '48 hours'
  FROM (VALUES
    ('Laboratório Vida Análises','primeira_mensagem','whatsapp','Olá Renata, aqui é o Arthur Morato. Ajudo laboratórios a reduzir o tempo de entrega de resultados e o atendimento repetitivo com automação. Posso te mostrar como em 10 minutos?','Score 85, decisora (diretora) e telefone fixo/celular encontrado. WhatsApp é o canal com mais chance de resposta para saúde.',1),
    ('Odonto Prime Bairro Alto','followup','whatsapp','Oi Letícia, passando para saber se conseguiu ver minha mensagem. Muitas clínicas reduzem faltas em consulta só com lembretes automáticos. Posso te mostrar?','48h sem resposta à primeira mensagem. Um follow-up curto no mesmo canal costuma reativar esse perfil.',2),
    ('Clínica Aurora Estética','resposta','whatsapp','Ótimo, Marina! Com duas recepcionistas, a confirmação automática de horários costuma liberar cerca de metade do tempo delas. Para eu entender o tamanho do projeto: qual faixa de investimento faria sentido para resolver isso?','A prospect confirmou que é decisora e descreveu a dor. Falta qualificar budget e prazo.',1),
    ('Centro de Estética Pele Viva','resposta','whatsapp','Oi Carolina! O valor depende do que precisa ser automatizado. Para eu te passar algo preciso: hoje o agendamento é feito por quantas pessoas e em quais canais?','Perguntou preço logo no início. Em vez de passar valor sem contexto, o agente propõe entender o escopo antes.',2),
    ('Clínica Veterinária Bicho Bom','reengajamento','email','Olá Marcelo, retomando minha mensagem anterior. Se fizer sentido, posso enviar um exemplo de como outras clínicas reduziram faltas com automação. Quer que eu mande?','5 dias sem resposta por email e nenhuma abertura registrada. Propõe oferecer conteúdo de baixo compromisso.',6)
  ) AS f(nome, tipo, canal, mensagem, razao, horas);

  -- Fila: execuções automáticas nas últimas 24h (alimentam o log de Automações)
  INSERT INTO fila_acoes (workspace_id, prospect_id, campanha_id, tipo, canal, mensagem, razao, status, executada_em, fluxo_automatico_id, criado_em)
  SELECT ws, (SELECT id FROM demo_p WHERE nome = x.nome), camp, x.tipo, x.canal, x.mensagem, x.razao, 'executada', now() - make_interval(hours => x.horas), x.fluxo, now() - make_interval(hours => x.horas)
  FROM (VALUES
    ('Padaria Trigo Dourado','followup','whatsapp','Oi Sérgio, passando para saber se consegue ver minha mensagem anterior. Posso te mostrar em 10 minutos como isso funciona na prática?','Fluxo automático: 48h sem resposta.',6, flow_a),
    ('Ótica Visão Clara','reengajamento','email','Olá Marcos, retomando nossa conversa. Ainda faz sentido olharmos como reduzir o trabalho manual aí na empresa?','Fluxo automático: 7 dias sem resposta.',18, flow_b)
  ) AS x(nome, tipo, canal, mensagem, razao, horas, fluxo);

  -- Leads qualificados
  INSERT INTO leads_qualificados (workspace_id, prospect_id, briefing, score_temperatura, proximo_passo, status_reuniao, reuniao_em, qualificado_em)
  SELECT ws, (SELECT id FROM demo_p WHERE nome = l.nome), l.briefing::jsonb, l.temp, l.passo, l.status, CASE WHEN l.dias_reuniao IS NULL THEN NULL ELSE now() + make_interval(days => l.dias_reuniao) END, now() - make_interval(hours => l.horas)
  FROM (VALUES
    ('Studio Pilates Vértice','{"dor_principal":"Controle de agenda e renovações em planilha, perda de alunas","budget":"Até R$ 2 mil/mês","timeline":"Próximo mês","e_decisor":true,"objecoes":[],"sentimento":"positivo","resumo_conversa":"Proprietário decide sozinho, dor clara e urgência.","pontos_chave":["Renovação de alunas","Cobrança recorrente"]}',9,'Agendar reunião de diagnóstico','pendente',NULL,118),
    ('Imobiliária Nova Casa','{"dor_principal":"Corretores gastam horas com leads frios","budget":"A definir","timeline":"60 dias","e_decisor":true,"objecoes":["Quer ver algo funcionando antes de contratar"],"sentimento":"positivo","resumo_conversa":"Diretora decide, quer prova de conceito em 60 dias.","pontos_chave":["Qualificação de leads","Prova de conceito"]}',8,'Propor piloto de 60 dias','pendente',NULL,148),
    ('Contabilidade Horizonte','{"dor_principal":"Cobrança manual de documentos dos clientes","budget":"Confirmado na reunião","timeline":"Trimestre","e_decisor":true,"objecoes":[],"sentimento":"positivo","resumo_conversa":"Sócio-diretor, reunião marcada para quinta 15h.","pontos_chave":["Coleta de documentos","Fechamento mensal"]}',8,'Reunião de apresentação','agendada',2,98),
    ('Pessoas Mais Consultoria de RH','{"dor_principal":"Triagem de candidatos","budget":"A confirmar","timeline":"Imediato","e_decisor":true,"objecoes":["Receio de IA errar na triagem"],"sentimento":"neutro","resumo_conversa":"CEO decide, reunião sexta 10h.","pontos_chave":["Triagem","Governança da IA"]}',7,'Reunião de diagnóstico','agendada',3,88),
    ('Academia Corpo em Movimento','{"dor_principal":"Cancelamentos de alunos","budget":"R$ 3 mil/mês","timeline":"Imediato","e_decisor":true,"objecoes":[],"sentimento":"positivo","resumo_conversa":"Fechou o projeto.","pontos_chave":["Retenção"]}',10,'Kickoff','realizada',NULL,300)
  ) AS l(nome, briefing, temp, passo, status, dias_reuniao, horas);
END $$;

-- Conferência
SELECT 'prospects' AS tabela, count(*) FROM prospects WHERE fonte = 'demo'
UNION ALL SELECT 'interacoes', count(*) FROM prospect_interacoes WHERE prospect_id IN (SELECT id FROM prospects WHERE fonte = 'demo')
UNION ALL SELECT 'fila pendente', count(*) FROM fila_acoes WHERE status = 'pendente' AND campanha_id IN (SELECT id FROM campanhas WHERE nome LIKE '[DEMO]%')
UNION ALL SELECT 'leads', count(*) FROM leads_qualificados WHERE prospect_id IN (SELECT id FROM prospects WHERE fonte = 'demo')
UNION ALL SELECT 'fluxos', count(*) FROM fluxos_automaticos WHERE campanha_id IN (SELECT id FROM campanhas WHERE nome LIKE '[DEMO]%');
