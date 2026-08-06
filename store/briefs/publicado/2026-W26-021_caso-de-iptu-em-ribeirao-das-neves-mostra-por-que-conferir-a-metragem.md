---
brief_id: 2026-W26-021
slug: 2026-W26-021_caso-de-iptu-em-ribeirao-das-neves-mostra-por-que-conferir-a-metragem
created_at: 2026-07-08T16:20:16-03:00
updated_at: 2026-07-23T12:00:00-03:00

scope: local
scan_id: 2026-W26-scan-013
source_finding_id: f_003
source_urls:
  - https://ribeiraodasneves.net/35-noticias/cidade/11774-contribuinte-de-ribeirao-das-neves-denuncia-aumento-abusivo-e-erro-em-metragem-do-iptu-2026
source_excerpts:
  - "O valor do imposto saltou de aproximadamente R$ 400,00 em anos anteriores para R$ 1.128,74 em 2026 – um aumento superior a 180%."
  - "O contribuinte afirma que seu lote possui 360 m², porém, na notificação enviada pela Prefeitura de Ribeirão das Neves, a área total do terreno consta como 429,06 m²."

pillar: "6-mercado-rmbh"
icp: comprador
borderline: false
match_score: 0.765
match_score_breakdown:
  pillar_fit: 0.85
  icp_fit: 0.75
  foco_editorial_fit: 0.80
  geografia_fit: 0.90
  freshness: 0.177
source_relevance_hints:
  - component: pillar_fit
    evidence: "Categoria D (regulatório) do Pilar 6, tema 18 ('IPTU em alta no bairro X — causa, efeito, o que fazer')"
  - component: foco_editorial_fit
    evidence: "IPTU incide no terreno; metragem cadastral é atributo de lote/chácara — foco Avanz"
  - component: geografia_fit
    evidence: "Ribeirão das Neves (bairro Justinópolis) — cidade-foco Avanz; fonte é portal local dedicado"
  - component: freshness
    evidence: "publicado 2026-05-12 (~57 dias) → 0.177; compensado por enquadramento evergreen (serviço)"
why_match: |
  Pilar 6 (Mercado RMBH), Categoria D regulatório. Um caso de IPTU 2026 em Justinópolis (Ribeirão das
  Neves), relatado pelo portal ribeiraodasneves.net, expõe dois vetores úteis ao comprador de lote:
  (1) valor venal em alta = prefeitura reconhecendo valorização do solo (leitura de mercado);
  (2) erro cadastral de metragem (429,06 m² registrados vs 360 m² afirmados) infla imposto e pode travar
  negócio. Ângulo distinto de W23-002 (matrícula/escritura) — aqui é cadastro municipal + metragem.
  ⚠️ É UM caso relatado, NÃO reajuste citywide comprovado. Prazo de contestação (15/06) já passou →
  enquadramento EVERGREEN de serviço, sem urgência.

topic_hash: 9105bb423188a77a106e6e13f0192995eb50b3a5

format: post_feed_instagram
od_skill_ref: ad-creative
od_skill_alternatives: [social-x-post-card, poster-hero]
template_ref_avanz: post-mes
headline: "Caso de IPTU em Ribeirão das Neves mostra por que conferir a metragem do lote"
hook: "Um contribuinte em Justinópolis relatou IPTU +180% em 2026. Parte da conta era a metragem cadastral do lote."
caption_draft: |
  Um contribuinte em Justinópolis relatou IPTU +180% em 2026. Parte da conta era a metragem cadastral do lote.

  Segundo o portal ribeiraodasneves.net, o imposto saltou de cerca de R$ 400 nos anos anteriores para R$ 1.128,74 em 2026 — um caso, um bairro. Junto veio um detalhe importante: o cadastro da prefeitura registrou o lote como 429,06 m², mas o proprietário afirma que a área real é de 360 m².

  Um caso não vira regra. Mas escancara dois pontos que a gente vê no dia a dia na RMBH. Primeiro: quando a prefeitura reavalia valor venal, é sinal de que o solo da região está sendo reconhecido como ativo com valor maior — o efeito colateral é que o imposto acompanha. Segundo: cadastro com metragem errada infla imposto e pode travar negócio quando você for vender ou financiar.

  Antes de comprar ou vender lote, a Avanz confere três fontes: a área na matrícula (cartório), o cadastro imobiliário da prefeitura e a medição real do terreno. Quando os três não batem, a gente para tudo e resolve — passo a passo, com documentação ok, antes de qualquer assinatura. É esse tipo de checagem tranquila que segura a decisão certa.

  Quer entender se esse caminho é pra você? Manda no WhatsApp que a gente conversa sem compromisso.
hashtags:
  [
    avanzimoveis,
    iptu,
    ribeiraodasneves,
    rmbh,
    lote,
    terrenormbh,
    mercadormbh,
  ]
cta: "Quer entender se esse caminho é pra você? Manda no WhatsApp (31) 9 9077-4580 que a gente conversa sem compromisso."

hero_image_candidates: []
hero_choice: null

visual_brief:
  base_template: post-mes
  composition_notes: |
    Fundo azul marinho #0F172A com bloco central didático de dois marcadores lado a lado: "valor venal"
    e "metragem cadastral" — Inter, hierarquia clara, respiro amplo. Overlay grande em laranja #F97316
    com "+180%" seguido de rodapé pequeno em cinza claro ("caso relatado em Ribeirão das Neves, 2026")
    pra atribuir e evitar leitura citywide. Estética acolhedora tipo carta explicativa, não corporativa
    fria; sem gráfico de barras/linhas. Bloco institucional inferior com logo Avanz e telefone.
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 9077-4580"
    - "paleta oficial: azul marinho #0F172A + laranja #F97316"
    - "tipografia Inter (primária) / Montserrat (secundária)"
    - "dois marcadores didáticos: 'valor venal' e 'metragem cadastral'"
    - "rodapé de atribuição: 'caso relatado em Ribeirão das Neves — portal ribeiraodasneves.net'"
  avoid_visual:
    - "infográficos densos"
    - "gráficos de barras/linhas"
    - "estética corporativa fria"
    - "fotos stock de calculadora/moedas/casa-de-papel (era o candidato descartado)"
    - "elementos de urgência (selo 'contesta agora', prazo vencido)"

suggested_slot: null
ledger_ref: ./store/ledger.jsonl
review_notes: |
  Enquadramento EVERGREEN — prazo de contestação (15/06/2026) já passou; usa o caso como gancho de
  serviço (checagem cadastral), sem urgência. Reforçar "um caso em Justinópolis" na arte pra não sugerir
  reajuste citywide comprovado. Imagem-candidata era stock ilustrativo (casa de papel + calculadora) →
  descartada; arte gerada.

handoff_at: 2026-07-20T12:27:27-03:00
package_path: ./store/packages/2026-W26-021_caso-de-iptu-em-ribeirao-das-neves-mostra-por-que-conferir-a-metragem/README.md

published_at: 2026-07-23T12:00:00-03:00
ig_post_url: https://www.instagram.com/p/DbJAchdgY4B/
---

# Caso de IPTU em Ribeirão das Neves mostra por que conferir a metragem do lote

Um contribuinte em Justinópolis relatou IPTU +180% em 2026. Parte da conta era a metragem cadastral do lote.

Segundo o portal ribeiraodasneves.net, o imposto saltou de cerca de R$ 400 nos anos anteriores para R$ 1.128,74 em 2026 — um caso, um bairro. Junto veio um detalhe importante: o cadastro da prefeitura registrou o lote como 429,06 m², mas o proprietário afirma que a área real é de 360 m².

Um caso não vira regra. Mas escancara dois pontos que a gente vê no dia a dia na RMBH. Primeiro: quando a prefeitura reavalia valor venal, é sinal de que o solo da região está sendo reconhecido como ativo com valor maior — o efeito colateral é que o imposto acompanha. Segundo: cadastro com metragem errada infla imposto e pode travar negócio quando você for vender ou financiar.

Antes de comprar ou vender lote, a Avanz confere três fontes: a área na matrícula (cartório), o cadastro imobiliário da prefeitura e a medição real do terreno. Quando os três não batem, a gente para tudo e resolve — passo a passo, com documentação ok, antes de qualquer assinatura. É esse tipo de checagem tranquila que segura a decisão certa.

Quer entender se esse caminho é pra você? Manda no WhatsApp que a gente conversa sem compromisso.

---

## Por que entra (matcher)

> Score: **0.765** (maior do scan-013) · Pilar 6 (Mercado RMBH, Categoria D) · ICP comprador · `borderline: false`
>
> Primeiro brief com âncora real em **Ribeirão das Neves** (cidade-foco antes sem cobertura — via fonte nova ribeiraodasneves.net). Ativo é lote (foco 0,80), geografia máxima (0,90). Freshness baixa (57d) compensada por ângulo evergreen de serviço. ⚠️ É um caso relatado, não citywide.

## Visual brief (resumo)

- **Skill OD recomendada**: `ad-creative`
- **Hero**: descartada (stock ilustrativo) → arte gerada (dois marcadores: valor venal + metragem)
- **`hero_choice`**: `null`
