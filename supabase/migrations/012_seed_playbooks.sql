-- 012 — playbooks iniciais (PRD v1, seção 6). Só insere se a tabela estiver vazia.
-- ICP, persona e critérios ficam vazios: são definidos por Arthur em Setup > Playbooks.

INSERT INTO playbooks (nome, descricao, icone, fontes_padrao, canais_padrao)
SELECT * FROM (VALUES
  ('Negócios locais sem presença digital', 'Para agências de marketing e web: negócios locais sem site ou presença online.', 'store',
    ARRAY['google_places'], ARRAY['whatsapp_evolution']),
  ('Decisores B2B — serviços', 'Para consultores e serviços B2B: decisores encontrados por cargo e empresa.', 'briefcase',
    ARRAY['apollo','linkedin_scraper'], ARRAY['linkedin','email']),
  ('E-commerce em crescimento', 'Para ferramentas SaaS e logística: lojas online em expansão.', 'shopping-cart',
    ARRAY['apollo'], ARRAY['email','whatsapp_evolution']),
  ('Prestadores de serviço locais', 'Para consultores generalistas: prestadores de serviço locais, validados por CNPJ.', 'wrench',
    ARRAY['google_places','cnpj'], ARRAY['whatsapp_evolution']),
  ('Criadores e infoprodutores', 'Para ferramentas de criadores: perfis encontrados no Instagram.', 'sparkles',
    ARRAY['instagram_scraper'], ARRAY['instagram','whatsapp_evolution']),
  ('Lista fria', 'Qualquer segmento: lista própria importada por CSV.', 'list',
    ARRAY['csv'], ARRAY['email','linkedin'])
) AS v(nome, descricao, icone, fontes_padrao, canais_padrao)
WHERE NOT EXISTS (SELECT 1 FROM playbooks);
