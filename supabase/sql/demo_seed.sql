-- DEMO SEED — dados 100% fictícios para visualizar (e demonstrar) todas as telas do Maestro.
-- Tudo fica numa campanha "[DEMO] ..." no workspace "morato"; prospects têm fonte = 'demo'.
-- Para remover: supabase/sql/demo_cleanup.sql
-- Empresas, pessoas, telefones e emails são inventados (emails em .example, telefones 5511900000xxx).
--
-- Estados que a demo mostra:
--   conversas completas (agente responde, trata objeção, qualifica, agenda) · prospects novos com 1ª mensagem proposta ·
--   follow-up automático por fluxo · mudança de canal · pausa combinada · descarte educado · cliente convertido ·
--   3 respostas "agente vai responder" (na fila) e 1 "aguarda humano" (pediu ligação).

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
    '[{"objecao":"Já tenho fornecedor","resposta":"Complementamos o que já existe."},{"objecao":"Receio de a IA errar","resposta":"A IA sugere e uma pessoa sempre valida."}]'::jsonb,
    '[{"campo":"e_decisor","pergunta":"Decide a contratação?","obrigatorio":true},{"campo":"dor_principal","pergunta":"Qual o principal gargalo?","obrigatorio":true},{"campo":"budget","pergunta":"Qual faixa de investimento?","obrigatorio":false},{"campo":"timeline","pergunta":"Em quanto tempo precisa resolver?","obrigatorio":false}]'::jsonb)
  RETURNING id INTO camp;

  CREATE TEMP TABLE demo_p (id UUID, nome TEXT) ON COMMIT DROP;

  WITH v(nome_empresa, contato, cargo, cidade, estado, segmento, status, score, canal, dias, idx) AS (VALUES
    ('Clínica Aurora Estética','Marina Duarte','Sócia','São Paulo','SP','Clínicas de estética','engajado',88,'whatsapp',6,1),
    ('Studio Pilates Vértice','Rafael Nogueira','Proprietário','Campinas','SP','Pilates','qualificado',91,'whatsapp',11,2),
    ('Contabilidade Horizonte','Paulo Mendes','Sócio-diretor','Belo Horizonte','MG','Contabilidade','agendado',86,'email',14,3),
    ('Odonto Prime Bairro Alto','Letícia Faria','Sócia','Curitiba','PR','Odontologia','em_contato',79,'whatsapp',6,4),
    ('Auto Center Silva e Filhos','Jorge Silva','Proprietário','Goiânia','GO','Oficina mecânica','novo',64,NULL,2,5),
    ('Barros Advocacia','Camila Barros','Sócia','Porto Alegre','RS','Advocacia','engajado',83,'email',8,6),
    ('Padaria Trigo Dourado','Sérgio Lima','Dono','Recife','PE','Alimentação','engajado',58,'whatsapp',4,7),
    ('Imobiliária Nova Casa','Fernanda Costa','Diretora','Salvador','BA','Imobiliária','qualificado',90,'linkedin',14,8),
    ('Verde Vida Orgânicos','Tatiana Rocha','Fundadora','Florianópolis','SC','E-commerce','engajado',77,'instagram',5,9),
    ('Transportadora Rota Sul','Anderson Pires','Gerente','Joinville','SC','Logística','novo',71,NULL,1,10),
    ('Academia Corpo em Movimento','Bruno Teixeira','Sócio','Fortaleza','CE','Academia','convertido',94,'whatsapp',20,11),
    ('Petshop Quatro Patas','Juliana Alves','Proprietária','Brasília','DF','Petshop','descartado',52,'whatsapp',10,12),
    ('Pessoas Mais Consultoria de RH','Eduardo Ramos','CEO','São Paulo','SP','RH','agendado',89,'linkedin',13,13),
    ('Clínica Veterinária Bicho Bom','Marcelo Dias','Sócio','Ribeirão Preto','SP','Veterinária','em_contato',74,'email',7,14),
    ('Estúdio Lumen Fotografia','Priscila Moura','Fundadora','Rio de Janeiro','RJ','Fotografia','novo',61,NULL,2,15),
    ('Escola de Idiomas Fala Mais','Gustavo Pereira','Diretor','Vitória','ES','Educação','pausado',68,'email',15,16),
    ('Marcenaria Artesanal Cedro','Antônio Freitas','Proprietário','Londrina','PR','Marcenaria','novo',55,NULL,0,17),
    ('Restaurante Sabor da Terra','Helena Martins','Sócia','Belém','PA','Restaurante','descartado',47,'whatsapp',10,18),
    ('Agência Pixel Norte','Lucas Andrade','Sócio','Manaus','AM','Marketing','engajado',80,'instagram',3,19),
    ('Laboratório Vida Análises','Renata Cunha','Diretora','São José dos Campos','SP','Saúde','novo',85,NULL,0,20),
    ('Construtora Alicerce','Roberto Gomes','Diretor','Uberlândia','MG','Construção','novo',66,NULL,0,21),
    ('Centro de Estética Pele Viva','Carolina Nunes','Sócia','Niterói','RJ','Estética','engajado',82,'whatsapp',4,22),
    ('Ótica Visão Clara','Marcos Ribeiro','Proprietário','Natal','RN','Varejo','em_contato',62,'email',9,23)
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

  -- Conversas. direcao: out = Maestro, in = prospect. horas = quanto tempo atrás.
  -- autor (só out): agente (proposta aprovada na fila) · fluxo (automação) · humano (Arthur assumiu).
  INSERT INTO prospect_interacoes (prospect_id, canal, direcao, conteudo, status, metadata, enviado_em)
  SELECT (SELECT id FROM demo_p WHERE nome = i.nome), i.canal, i.direcao, i.conteudo,
         CASE WHEN i.direcao = 'out' THEN 'lido' END,
         CASE WHEN i.direcao = 'out' THEN jsonb_build_object('autor', i.autor) ELSE '{}'::jsonb END,
         now() - interval '1 hour' * i.horas
  FROM (VALUES
    -- Clínica Aurora: qualificada em conversa; última resposta (budget/prazo) aguarda a proposta do agente na fila
    ('Clínica Aurora Estética','whatsapp','out','Olá Marina, aqui é o Arthur Morato. Vi que a Clínica Aurora tem agenda cheia e muito atendimento manual pelo WhatsApp. Faz sentido conversarmos sobre automatizar isso sem perder o toque pessoal?',96,'agente'),
    ('Clínica Aurora Estética','whatsapp','in','Oi Arthur! Faz sentido sim, hoje a recepção perde muito tempo confirmando horários.',94,NULL),
    ('Clínica Aurora Estética','whatsapp','out','Imagino. Quantas pessoas cuidam do agendamento hoje, e é você quem decide sobre ferramentas novas por aí?',93.5,'agente'),
    ('Clínica Aurora Estética','whatsapp','in','Duas recepcionistas. Eu decido sim, sou sócia.',92,NULL),
    ('Clínica Aurora Estética','whatsapp','out','Perfeito, Marina. Mais ou menos quantos horários por semana vocês confirmam manualmente? Quero ter uma ideia do tamanho do problema.',91.5,'agente'),
    ('Clínica Aurora Estética','whatsapp','in','Uns 120 por semana, fora os remarcados. Quase meio período de uma recepcionista.',70,NULL),
    ('Clínica Aurora Estética','whatsapp','out','Faz sentido, é tempo que volta para atender melhor as clientes. Para eu desenhar algo na medida: existe uma faixa de investimento que você considera confortável para resolver isso?',69.5,'agente'),
    ('Clínica Aurora Estética','whatsapp','in','Pensei em algo até R$ 1.500 por mês. Queria resolver até o fim do trimestre.',3,NULL),

    -- Studio Pilates: fluxo completo de qualificação, agente fecha pedindo horário
    ('Studio Pilates Vértice','whatsapp','out','Oi Rafael, tudo bem? Sou o Arthur Morato. Ajudo estúdios a reduzir o trabalho manual de agenda e cobrança com automação. Posso te contar como?',240,'agente'),
    ('Studio Pilates Vértice','whatsapp','in','Pode sim. Hoje faço tudo em planilha e perco muita aluna na renovação.',238,NULL),
    ('Studio Pilates Vértice','whatsapp','out','Entendi, Rafael. Você é quem decide sobre ferramentas novas aí no estúdio?',237,'agente'),
    ('Studio Pilates Vértice','whatsapp','in','Sou eu mesmo, o estúdio é meu.',236,NULL),
    ('Studio Pilates Vértice','whatsapp','out','Ótimo. Quantas alunas ativas vocês têm e como é feita a cobrança da renovação hoje?',235,'agente'),
    ('Studio Pilates Vértice','whatsapp','in','Umas 90 alunas. Mando mensagem manual perto do vencimento e anoto em planilha.',200,NULL),
    ('Studio Pilates Vértice','whatsapp','out','Dá para automatizar o lembrete e o pagamento, e avisar você só quando a aluna não responde. Qual faixa de investimento faz sentido para isso?',199,'agente'),
    ('Studio Pilates Vértice','whatsapp','in','Até uns 2 mil por mês.',150,NULL),
    ('Studio Pilates Vértice','whatsapp','out','Perfeito. E em quanto tempo você gostaria de ver isso rodando?',149,'agente'),
    ('Studio Pilates Vértice','whatsapp','in','Queria começar no próximo mês.',120,NULL),
    ('Studio Pilates Vértice','whatsapp','out','Anotado, Rafael! Com isso consigo preparar uma proposta sob medida. Vou te sugerir dois horários para uma conversa de 30 minutos e você escolhe o melhor, combinado?',119,'agente'),

    -- Contabilidade Horizonte: email, reunião marcada e confirmada
    ('Contabilidade Horizonte','email','out','Assunto: Menos retrabalho no fechamento mensal. Paulo, ajudo escritórios contábeis a automatizar a coleta de documentos dos clientes. Vale uma conversa rápida?',300,'agente'),
    ('Contabilidade Horizonte','email','in','Olá Arthur, tenho interesse. Hoje cobramos documento por WhatsApp um a um.',290,NULL),
    ('Contabilidade Horizonte','email','out','Obrigado pelo retorno, Paulo. Quantos clientes vocês atendem e quantas pessoas cuidam dessa cobrança?',289,'agente'),
    ('Contabilidade Horizonte','email','in','Cerca de 180 clientes, 3 pessoas no administrativo.',270,NULL),
    ('Contabilidade Horizonte','email','out','Entendi. Você participa da decisão sobre sistemas e automações do escritório?',269,'agente'),
    ('Contabilidade Horizonte','email','in','Sim, decido junto com minha sócia.',260,NULL),
    ('Contabilidade Horizonte','email','out','Ótimo. Posso te mostrar em 30 minutos como outros escritórios reduziram esse retrabalho. Quais horários funcionam para você esta semana?',259,'agente'),
    ('Contabilidade Horizonte','email','in','Podemos conversar quinta às 15h.',100,NULL),
    ('Contabilidade Horizonte','email','out','Confirmado, Paulo: quinta às 15h. Envio o convite por email agora. Até lá!',99,'agente'),

    -- Odonto Prime: duas tentativas por WhatsApp sem resposta; agente propõe mudar para email (fila)
    ('Odonto Prime Bairro Alto','whatsapp','out','Olá Letícia, aqui é o Arthur Morato. Trabalho com automação de atendimento para clínicas odontológicas. Posso te mostrar como reduzir faltas em consultas?',120,'agente'),
    ('Odonto Prime Bairro Alto','whatsapp','out','Oi Letícia, passando para saber se conseguiu ver minha mensagem. Muitas clínicas reduzem faltas só com lembretes automáticos. Posso te mostrar?',72,'fluxo'),

    -- Barros Advocacia: pediu retorno semana que vem; agente confirmou e agendou o retorno
    ('Barros Advocacia','email','out','Camila, ajudo escritórios de advocacia a organizar a triagem de novos clientes com IA. Faz sentido conversarmos?',168,'agente'),
    ('Barros Advocacia','email','in','Interessante, mas estou em audiência a semana toda. Me retorne semana que vem.',150,NULL),
    ('Barros Advocacia','email','out','Sem problema, Camila! Retomo contato na segunda-feira da semana que vem. Bom trabalho nas audiências.',149,'agente'),

    -- Padaria: follow-up automático reativou; agente combinou horário; prospect pediu LIGAÇÃO -> só humano resolve
    ('Padaria Trigo Dourado','whatsapp','out','Olá Sérgio, aqui é o Arthur Morato. Ajudo padarias a automatizar encomendas pelo WhatsApp. Posso te explicar rapidinho?',60,'agente'),
    ('Padaria Trigo Dourado','whatsapp','out','Oi Sérgio, passando para saber se consegue ver minha mensagem anterior. Posso te mostrar em 10 minutos como isso funciona na prática?',6,'fluxo'),
    ('Padaria Trigo Dourado','whatsapp','in','Oi, tenho interesse sim, mas só consigo falar à noite.',4,NULL),
    ('Padaria Trigo Dourado','whatsapp','out','Combinado, Sérgio! Posso te chamar hoje depois das 19h?',3.5,'agente'),
    ('Padaria Trigo Dourado','whatsapp','in','Prefiro conversar por ligação, pode ser? Meu número é este mesmo.',1.5,NULL),

    -- Imobiliária Nova Casa: LinkedIn, qualificada, agente propõe piloto
    ('Imobiliária Nova Casa','linkedin','out','Fernanda, vi o crescimento da Nova Casa em Salvador. Ajudo imobiliárias a qualificar leads automaticamente. Vamos conversar?',310,'agente'),
    ('Imobiliária Nova Casa','linkedin','in','Olá Arthur! Hoje meus corretores gastam horas com leads frios. Me conta mais.',300,NULL),
    ('Imobiliária Nova Casa','linkedin','out','Faz sentido, Fernanda. Em geral automatizamos a primeira triagem e entregamos ao corretor só quem demonstrou interesse real. Você decide sobre ferramentas para a equipe?',299,'agente'),
    ('Imobiliária Nova Casa','linkedin','in','Decido sim, a imobiliária é minha.',290,NULL),
    ('Imobiliária Nova Casa','linkedin','out','Ótimo. Quantos leads novos chegam por mês e qual a taxa de conversão hoje, mais ou menos?',289,'agente'),
    ('Imobiliária Nova Casa','linkedin','in','Uns 400 por mês, converte uns 3%.',240,NULL),
    ('Imobiliária Nova Casa','linkedin','out','Há bastante espaço para melhorar. Em quanto tempo você gostaria de ver algo funcionando?',239,'agente'),
    ('Imobiliária Nova Casa','linkedin','in','Queria ver algo funcionando em 60 dias.',200,NULL),
    ('Imobiliária Nova Casa','linkedin','out','Entendido. E sobre investimento, existe um valor de referência para esse projeto?',199,'agente'),
    ('Imobiliária Nova Casa','linkedin','in','Ainda não defini, depende do que vocês propuserem.',150,NULL),
    ('Imobiliária Nova Casa','linkedin','out','Perfeito, vamos desenhar uma proposta com piloto de 60 dias e você avalia. Posso te enviar por aqui amanhã?',149,'agente'),

    -- Verde Vida: respondeu "quem é você?", agente se apresentou, prospect engajou; nova resposta aguarda proposta (fila)
    ('Verde Vida Orgânicos','instagram','out','Oi Tatiana! Adoro o trabalho da Verde Vida. Ajudo lojas online a automatizar o atendimento no Instagram. Posso te mostrar?',90,'agente'),
    ('Verde Vida Orgânicos','instagram','in','Oi! Quem é você?',60,NULL),
    ('Verde Vida Orgânicos','instagram','out','Oi Tatiana! Sou o Arthur Morato, consultor de automações e IA. Vi que a Verde Vida atende bastante pelo direct e queria te mostrar como responder mais rápido sem perder o jeito de vocês. Posso explicar?',59,'agente'),
    ('Verde Vida Orgânicos','instagram','in','Hmm, parece interessante. Quanto tempo leva para implementar?',40,NULL),
    ('Verde Vida Orgânicos','instagram','out','Depende do escopo, mas projetos de atendimento costumam estar rodando em 3 a 4 semanas. Hoje quem responde o direct é você mesma?',39,'agente'),
    ('Verde Vida Orgânicos','instagram','in','Sou eu e uma estagiária. A gente não dá conta nos finais de semana.',1,NULL),

    -- Academia: virou cliente (Arthur assumiu depois da qualificação)
    ('Academia Corpo em Movimento','whatsapp','out','Oi Bruno, sou o Arthur Morato. Ajudo academias a reduzir cancelamentos com automação de relacionamento. Topa conversar?',420,'agente'),
    ('Academia Corpo em Movimento','whatsapp','in','Topo! Pode me ligar amanhã.',410,NULL),
    ('Academia Corpo em Movimento','whatsapp','out','Combinado, Bruno! Te ligo amanhã às 10h. Só para chegar preparado: quantos alunos ativos vocês têm hoje?',409,'agente'),
    ('Academia Corpo em Movimento','whatsapp','in','Uns 350. E uns 30 cancelam por mês.',408,NULL),
    ('Academia Corpo em Movimento','whatsapp','out','Bruno, foi um prazer conversar hoje! Segue a proposta em anexo, como combinamos.',300,'humano'),
    ('Academia Corpo em Movimento','whatsapp','in','Recebi, vou analisar com meu sócio.',280,NULL),
    ('Academia Corpo em Movimento','whatsapp','out','Fico no aguardo. Qualquer dúvida é só chamar.',279,'humano'),
    ('Academia Corpo em Movimento','whatsapp','in','Fechado, vamos seguir com o projeto!',60,NULL),
    ('Academia Corpo em Movimento','whatsapp','out','Excelente notícia, Bruno! Vou enviar o contrato e já marcamos o kickoff. Obrigado pela confiança!',59,'humano'),

    -- Petshop: recusa educada, agente encerra
    ('Petshop Quatro Patas','whatsapp','out','Olá Juliana, aqui é o Arthur Morato. Posso te mostrar como automatizar agendamentos do petshop?',220,'agente'),
    ('Petshop Quatro Patas','whatsapp','in','Obrigada, mas não tenho interesse no momento.',200,NULL),
    ('Petshop Quatro Patas','whatsapp','out','Sem problema, Juliana! Agradeço a atenção. Se algo mudar, estou à disposição.',199,'agente'),

    -- RH Pessoas Mais: objeção tratada, reunião marcada
    ('Pessoas Mais Consultoria de RH','linkedin','out','Eduardo, vi que a Pessoas Mais está crescendo. Ajudo consultorias de RH a automatizar triagem de candidatos. Vamos conversar?',290,'agente'),
    ('Pessoas Mais Consultoria de RH','linkedin','in','Olá Arthur, faz sentido. Triagem é nosso maior gargalo hoje.',280,NULL),
    ('Pessoas Mais Consultoria de RH','linkedin','out','Entendo, Eduardo. Quantas vagas vocês triam por mês e quantas pessoas fazem isso?',279,'agente'),
    ('Pessoas Mais Consultoria de RH','linkedin','in','Umas 40 vagas, equipe de 4 recrutadoras.',260,NULL),
    ('Pessoas Mais Consultoria de RH','linkedin','out','Há bastante ganho possível. Você decide sobre esse tipo de ferramenta?',259,'agente'),
    ('Pessoas Mais Consultoria de RH','linkedin','in','Decido, sou o CEO. Só tenho receio de a IA errar na triagem.',250,NULL),
    ('Pessoas Mais Consultoria de RH','linkedin','out','Compreensível, Eduardo. Trabalhamos com a IA sugerindo e a recrutadora sempre validando, então a decisão final continua humana. Posso te mostrar isso numa conversa de 30 minutos?',249,'agente'),
    ('Pessoas Mais Consultoria de RH','linkedin','in','Pode ser sexta às 10h.',90,NULL),
    ('Pessoas Mais Consultoria de RH','linkedin','out','Fechado, sexta às 10h. Envio o convite por aqui. Até lá!',89,'agente'),

    -- Vet Bicho Bom: sem resposta ao primeiro email; agente propõe reengajamento (fila)
    ('Clínica Veterinária Bicho Bom','email','out','Marcelo, ajudo clínicas veterinárias a reduzir faltas e organizar retornos com automação. Podemos conversar?',150,'agente'),

    -- Pixel Norte: conversa em andamento, agente aguardando a próxima resposta
    ('Agência Pixel Norte','instagram','out','Oi Lucas! Ajudo agências a automatizar relatórios e onboarding de clientes. Faz sentido trocar uma ideia?',50,'agente'),
    ('Agência Pixel Norte','instagram','in','Oi! Pode mandar.',30,NULL),
    ('Agência Pixel Norte','instagram','out','Valeu, Lucas! Resumindo: ajudo agências a automatizar relatórios e o onboarding de clientes novos. Hoje isso consome muito tempo da sua equipe?',29,'agente'),
    ('Agência Pixel Norte','instagram','in','Bastante, principalmente relatório mensal.',8,NULL),
    ('Agência Pixel Norte','instagram','out','Faz sentido, é um dos processos que mais rende ao automatizar. Você é quem decide sobre ferramentas na agência?',7,'agente'),

    -- Pele Viva: perguntou preço; agente propôs resposta consultiva (fila)
    ('Centro de Estética Pele Viva','whatsapp','out','Olá Carolina, aqui é o Arthur Morato. Ajudo centros de estética a automatizar agendamento e pós-atendimento. Posso te contar mais?',80,'agente'),
    ('Centro de Estética Pele Viva','whatsapp','in','Oi! Me conta mais.',72,NULL),
    ('Centro de Estética Pele Viva','whatsapp','out','Claro, Carolina! Ajudamos centros de estética a automatizar agendamento e o pós-atendimento (lembretes, retorno, avaliação). Hoje como é feito o agendamento por aí?',71,'agente'),
    ('Centro de Estética Pele Viva','whatsapp','in','Pelo WhatsApp mesmo, eu e uma atendente.',50,NULL),
    ('Centro de Estética Pele Viva','whatsapp','out','Entendi. E você decide sobre ferramentas novas por aí?',49,'agente'),
    ('Centro de Estética Pele Viva','whatsapp','in','Sim. Quanto custa algo assim?',5,NULL),

    -- Ótica: primeiro email sem resposta; fluxo de reengajamento rodou ontem
    ('Ótica Visão Clara','email','out','Marcos, ajudo óticas a reativar clientes antigos com automação de mensagens. Vale conversarmos?',200,'agente'),
    ('Ótica Visão Clara','email','out','Olá Marcos, retomando nossa conversa. Ainda faz sentido olharmos como reduzir o trabalho manual aí na empresa?',18,'fluxo'),

    -- Escola de Idiomas: pausa combinada
    ('Escola de Idiomas Fala Mais','email','out','Gustavo, ajudo escolas de idiomas a reduzir evasão com automação de relacionamento. Posso te explicar?',320,'agente'),
    ('Escola de Idiomas Fala Mais','email','in','Interesse sim, mas agora estamos em período de matrículas. Podemos retomar em dois meses?',300,NULL),
    ('Escola de Idiomas Fala Mais','email','out','Claro, Gustavo! Marco para retomarmos daqui a dois meses. Boa temporada de matrículas!',299,'agente'),

    -- Restaurante: já tem solução, agente encerra com elegância
    ('Restaurante Sabor da Terra','whatsapp','out','Olá Helena, aqui é o Arthur Morato. Posso te mostrar como automatizar reservas e pedidos no WhatsApp?',210,'agente'),
    ('Restaurante Sabor da Terra','whatsapp','in','Já tenho um sistema que atende e não pretendo trocar.',190,NULL),
    ('Restaurante Sabor da Terra','whatsapp','out','Perfeito, Helena, obrigado pela sinceridade. Fico à disposição se precisar no futuro.',189,'agente')
  ) AS i(nome, canal, direcao, conteudo, horas, autor);

  UPDATE prospects p SET
    primeiro_contato_em = s.primeiro, ultima_interacao_em = s.ultima
  FROM (SELECT prospect_id, min(enviado_em) FILTER (WHERE direcao = 'out') AS primeiro, max(enviado_em) AS ultima
        FROM prospect_interacoes GROUP BY prospect_id) s
  WHERE p.id = s.prospect_id AND p.id IN (SELECT id FROM demo_p);

  -- Estado do agente (próxima ação sempre no futuro).
  INSERT INTO prospect_estado (prospect_id, aguardando, proxima_acao_em, contexto_resumo, tentativas_whatsapp, tentativas_email, tentativas_linkedin, tentativas_instagram)
  SELECT (SELECT id FROM demo_p WHERE nome = e.nome), e.aguardando, now() + make_interval(hours => e.em), e.ctx, e.w, e.m, e.l, e.i
  FROM (VALUES
    ('Clínica Aurora Estética','aprovacao',1,'Sócia e decisora. Dor: confirmação manual de horários (~120/semana). Budget até R$ 1.500/mês, prazo até o fim do trimestre. Todos os critérios confirmados: agendar reunião.',4,0,0,0),
    ('Odonto Prime Bairro Alto','aprovacao',3,'Duas tentativas por WhatsApp sem resposta. Agente propõe mudar para email.',2,0,0,0),
    ('Barros Advocacia','tempo',72,'Em audiência esta semana; pediu retorno na semana que vem. Retomada combinada para segunda-feira.',0,2,0,0),
    ('Padaria Trigo Dourado','nenhum',0,'Pediu para conversar por ligação. O agente não liga: aguardando você.',3,0,0,0),
    ('Verde Vida Orgânicos','aprovacao',2,'Dor confirmada (direct sem cobertura aos finais de semana). Falta confirmar quem decide e orçamento.',0,0,0,3),
    ('Agência Pixel Norte','resposta',24,'Dor confirmada (relatório mensal). Perguntei se é o decisor.',0,0,0,3),
    ('Centro de Estética Pele Viva','aprovacao',1,'Decisora confirmada. Perguntou preço; agente propôs entender o escopo antes de passar valor.',3,0,0,0),
    ('Clínica Veterinária Bicho Bom','aprovacao',5,'Seis dias sem resposta ao primeiro email e nenhuma abertura registrada.',0,1,0,0),
    ('Ótica Visão Clara','resposta',120,'Reengajamento automático enviado ontem. Aguardando resposta.',0,2,0,0),
    ('Escola de Idiomas Fala Mais','tempo',1440,'Pausa combinada: retomar após o período de matrículas (cerca de dois meses).',0,2,0,0)
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

  -- Fila: pendentes (o agente propôs, aguardando aprovação)
  INSERT INTO fila_acoes (workspace_id, prospect_id, campanha_id, tipo, canal, mensagem, razao, status, criado_em, expira_em)
  SELECT ws, (SELECT id FROM demo_p WHERE nome = f.nome), camp, f.tipo, f.canal, f.mensagem, f.razao, 'pendente',
         now() - interval '1 hour' * f.horas, now() + interval '48 hours'
  FROM (VALUES
    ('Clínica Aurora Estética','resposta','whatsapp','Combinado, Marina! Com cerca de R$ 1.500 por mês e prazo até o fim do trimestre, conseguimos desenhar algo na medida. O melhor próximo passo é uma conversa de 30 minutos para eu te mostrar como ficaria o fluxo de confirmação de horários. Prefere quinta às 10h ou sexta às 15h?',
      'A sócia confirmou os quatro pontos: é decisora, a dor é a confirmação manual (~120 horários por semana), o orçamento é até R$ 1.500 por mês e o prazo é o fim do trimestre. Todos os critérios foram atendidos: o próximo passo é marcar a reunião.',0.5),
    ('Verde Vida Orgânicos','resposta','instagram','Entendi, Tatiana, final de semana é justamente onde a automação mais ajuda: o direct continua sendo respondido mesmo quando vocês não estão. Só para eu desenhar certo: as decisões sobre ferramentas novas passam por você, ou existe sócio ou sócia nessa conversa?',
      'A prospect confirmou a dor (volume de direct sem cobertura aos finais de semana). Ainda falta confirmar se é a decisora, que é critério obrigatório da campanha.',0.8),
    ('Centro de Estética Pele Viva','resposta','whatsapp','Oi Carolina! O valor depende do que precisa ser automatizado, então prefiro te passar algo preciso. Hoje, mais ou menos quantos agendamentos por semana vocês fazem e por quais canais chegam (WhatsApp, Instagram, telefone)?',
      'Perguntou preço logo no início. Em vez de passar um valor sem contexto, o agente propõe entender o escopo primeiro e reforçar que ela já confirmou ser decisora.',4),
    ('Odonto Prime Bairro Alto','followup','email','Olá Letícia, tentei falar com você pelo WhatsApp e acredito que a mensagem tenha se perdido. Resumindo: ajudo clínicas odontológicas a reduzir faltas em consulta com lembretes e confirmações automáticas. Se fizer sentido, posso te enviar um exemplo prático. Quer que eu mande?',
      'Duas tentativas por WhatsApp (uma delas automática) sem resposta em cinco dias. O agente propõe trocar para email, onde há endereço corporativo disponível, em vez de insistir no mesmo canal.',2),
    ('Clínica Veterinária Bicho Bom','reengajamento','email','Olá Marcelo, retomando minha mensagem anterior. Se fizer sentido, posso te mandar um exemplo de como clínicas veterinárias reduziram faltas com automação. Quer que eu envie?',
      'Seis dias sem resposta ao primeiro email e nenhuma abertura registrada. Propõe oferecer conteúdo de baixo compromisso antes de desistir do prospect.',6),
    ('Laboratório Vida Análises','primeira_mensagem','whatsapp','Olá Renata, aqui é o Arthur Morato. Ajudo laboratórios a reduzir o tempo de entrega de resultados e o atendimento repetitivo com automação. Posso te mostrar como em 10 minutos?',
      'Score 85 e a Renata é diretora (decisora). Para o segmento de saúde, WhatsApp é o canal com mais chance de resposta, e há telefone disponível.',1),
    ('Transportadora Rota Sul','primeira_mensagem','email','Assunto: Menos tempo em roteirização manual. Anderson, ajudo transportadoras a automatizar a atualização de status de entrega para clientes e a triagem de ocorrências. Faz sentido conversarmos 15 minutos?',
      'Score 71, gerente de operações. Telefone não validado como WhatsApp, então o agente escolhe email, onde há endereço corporativo, para a primeira abordagem.',3)
  ) AS f(nome, tipo, canal, mensagem, razao, horas);

  -- Fila: execuções automáticas nas últimas 24h (alimentam o log de Automações)
  INSERT INTO fila_acoes (workspace_id, prospect_id, campanha_id, tipo, canal, mensagem, razao, status, executada_em, fluxo_automatico_id, criado_em)
  SELECT ws, (SELECT id FROM demo_p WHERE nome = x.nome), camp, x.tipo, x.canal, x.mensagem, x.razao, 'executada', now() - interval '1 hour' * x.horas, x.fluxo, now() - interval '1 hour' * x.horas
  FROM (VALUES
    ('Padaria Trigo Dourado','followup','whatsapp','Oi Sérgio, passando para saber se consegue ver minha mensagem anterior. Posso te mostrar em 10 minutos como isso funciona na prática?','Fluxo automático: 48h sem resposta. Resultado: o prospect respondeu em 2 horas.',6, flow_a),
    ('Ótica Visão Clara','reengajamento','email','Olá Marcos, retomando nossa conversa. Ainda faz sentido olharmos como reduzir o trabalho manual aí na empresa?','Fluxo automático: 7 dias sem resposta.',18, flow_b)
  ) AS x(nome, tipo, canal, mensagem, razao, horas, fluxo);

  -- Leads qualificados
  INSERT INTO leads_qualificados (workspace_id, prospect_id, briefing, score_temperatura, proximo_passo, status_reuniao, reuniao_em, qualificado_em)
  SELECT ws, (SELECT id FROM demo_p WHERE nome = l.nome), l.briefing::jsonb, l.temp, l.passo, l.status, CASE WHEN l.dias_reuniao IS NULL THEN NULL ELSE now() + make_interval(days => l.dias_reuniao) END, now() - interval '1 hour' * l.horas
  FROM (VALUES
    ('Studio Pilates Vértice','{"dor_principal":"Controle de agenda e renovações em planilha, perda de alunas","budget":"Até R$ 2 mil/mês","timeline":"Próximo mês","e_decisor":true,"objecoes":[],"sentimento":"positivo","resumo_conversa":"Proprietário decide sozinho, dor clara e urgência. Cerca de 90 alunas, cobrança manual na renovação.","pontos_chave":["Renovação de alunas","Cobrança recorrente"]}',9,'Aguardando ele escolher um dos dois horários para a reunião de diagnóstico','pendente',NULL,118),
    ('Imobiliária Nova Casa','{"dor_principal":"Corretores gastam horas com leads frios (400 leads/mês, 3% de conversão)","budget":"A definir conforme proposta","timeline":"60 dias","e_decisor":true,"objecoes":["Quer ver algo funcionando antes de contratar"],"sentimento":"positivo","resumo_conversa":"Diretora e dona decide, quer prova de conceito em 60 dias.","pontos_chave":["Qualificação de leads","Prova de conceito"]}',8,'Enviar proposta de piloto de 60 dias','pendente',NULL,148),
    ('Contabilidade Horizonte','{"dor_principal":"Cobrança manual de documentos de ~180 clientes por WhatsApp","budget":"A confirmar na reunião","timeline":"Trimestre","e_decisor":true,"objecoes":[],"sentimento":"positivo","resumo_conversa":"Sócio-diretor decide junto com a sócia. Reunião marcada para quinta 15h.","pontos_chave":["Coleta de documentos","Fechamento mensal"]}',8,'Reunião de apresentação','agendada',2,98),
    ('Pessoas Mais Consultoria de RH','{"dor_principal":"Triagem de ~40 vagas por mês com 4 recrutadoras","budget":"A confirmar","timeline":"Imediato","e_decisor":true,"objecoes":["Receio de a IA errar na triagem"],"sentimento":"neutro","resumo_conversa":"CEO decide. Objeção tratada: IA sugere e a recrutadora valida. Reunião sexta 10h.","pontos_chave":["Triagem","Governança da IA"]}',7,'Reunião de diagnóstico','agendada',3,88),
    ('Academia Corpo em Movimento','{"dor_principal":"Cancelamentos (~30/mês em 350 alunos)","budget":"R$ 3 mil/mês","timeline":"Imediato","e_decisor":true,"objecoes":[],"sentimento":"positivo","resumo_conversa":"Fechou o projeto após analisar a proposta com o sócio.","pontos_chave":["Retenção"]}',10,'Kickoff do projeto','realizada',NULL,400)
  ) AS l(nome, briefing, temp, passo, status, dias_reuniao, horas);
END $$;

-- Conferência
SELECT 'prospects' AS tabela, count(*) FROM prospects WHERE fonte = 'demo'
UNION ALL SELECT 'interacoes', count(*) FROM prospect_interacoes WHERE prospect_id IN (SELECT id FROM prospects WHERE fonte = 'demo')
UNION ALL SELECT 'fila pendente', count(*) FROM fila_acoes WHERE status = 'pendente' AND campanha_id IN (SELECT id FROM campanhas WHERE nome LIKE '[DEMO]%')
UNION ALL SELECT 'leads', count(*) FROM leads_qualificados WHERE prospect_id IN (SELECT id FROM prospects WHERE fonte = 'demo')
UNION ALL SELECT 'fluxos', count(*) FROM fluxos_automaticos WHERE campanha_id IN (SELECT id FROM campanhas WHERE nome LIKE '[DEMO]%');
