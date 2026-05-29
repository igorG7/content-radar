---
brief_id: 2026-W22-001
slug: 2026-W22-001_bh-aluguel-1-37-em-abril-e-8-40-em-12-meses-o-dobro-do-ipca
created_at: 2026-05-28T19:58:00-03:00
updated_at: 2026-05-29T13:42:00-03:00

# Origem
scope: trends
source_finding_id: f_004
source_urls:
  - https://exame.com/mercado-imobiliario/aluguel-residencial-tem-maior-alta-em-um-ano-nordeste-lidera-valorizacao/
source_excerpts:
  - "Em 12 meses, os aluguéis acumulam valorização de 8,40%, praticamente o dobro da inflação oficial medida pelo IPCA, que ficou em 4,39%."
  - "Fortaleza registrou alta de 1,54%, Rio de Janeiro de 1,51% e Belo Horizonte de 1,37%."

# Match com empresa-alvo (spec 003)
pillar: "6-mercado-rmbh"
icp: comprador
match_score: 0.62
match_score_breakdown:
  pillar_fit: 0.78
  icp_fit: 0.45
  foco_editorial_fit: 0.35
  geografia_fit: 0.82
  freshness: 0.63
source_relevance_hints:
  - component: pillar_fit
    evidence: "'Belo Horizonte de 1,37%' no raw_excerpt — dado local específico encaixa diretamente em Pilar 6 (Mercado RMBH)"
  - component: geografia_fit
    evidence: "geo_hints: ['Belo Horizonte', 'Brasil'] e raw_excerpt cita 'Belo Horizonte de 1,37%' — RMBH ampla confirmada"
  - component: foco_editorial_fit
    evidence: "'Índice FipeZAP de Locação Residencial' — locação residencial, não lotes/sítios/chácaras; adjacente ao portfólio Avanz via argumento de custo de oportunidade"
  - component: freshness
    evidence: "published_at 2026-05-14 → 14 dias antes de 2026-05-28 → freshness ≈ 0.63"
why_match: |
  "Belo Horizonte de 1,37%" aparece explicitamente no raw_excerpt com dado pontual mensurável —
  âncora RMBH forte para Pilar 6. "Aluguéis acumulam valorização de 8,40%, praticamente o dobro
  da inflação oficial medida pelo IPCA, que ficou em 4,39%" é argumento editorial direto para o
  ângulo "comprar vale mais que alugar na RMBH". foco_editorial_fit penalizado (0.35) pois o
  finding trata de aluguel residencial, não diretamente de lotes/sítios.

topic_hash: 8052c6ed0bd550fbcb79b60073e5ba4b9b4e7d56
topic_hash_matcher: d5b8e0c2a4f7d1b3e6c9a2f4d8b0e3c5a7f2d4b6

# Conteúdo proposto
format: post_feed_instagram
od_skill_ref: ad-creative
template_ref_avanz: post-mes
headline: "BH: aluguel +1,37% em abril e +8,40% em 12 meses — o dobro do IPCA"
hook: "Em BH, quem está no aluguel viu o reajuste subir quase o dobro do IPCA — e isso muda a conta de comprar."
caption_draft: |
  Em BH, quem está no aluguel viu o reajuste subir quase o dobro do IPCA — e isso muda a conta de comprar.

  O Índice FipeZAP de Locação Residencial mostrou que o aluguel em Belo Horizonte subiu 1,37% só em abril, entre os maiores reajustes do país. Em 12 meses, a alta dos aluguéis chega a 8,40% — quase o dobro do IPCA (4,39%) no mesmo período.

  Na prática: cada mês que você renova o contrato de aluguel, a parcela sobe mais que a inflação. E enquanto isso, o lote que você pensa em comprar na RMBH segue rendendo do outro lado da conta — o seu, não do proprietário.

  A gente não vende aluguel: ajuda você a entender se já está na hora de sair dele. O passo a passo começa com uma simulação simples, sem compromisso e com documentação ok desde o início.

  Quer entender se esse caminho é pra você? Manda no WhatsApp que a gente conversa sem compromisso.
hashtags:
  [
    avanzimoveis,
    mercadoimobiliario,
    rmbh,
    bh,
    bhmg,
    aluguelbh,
    fipezap,
    saindodoaluguel,
  ]
cta: "Quer entender se esse caminho é pra você? Manda no WhatsApp que a gente conversa sem compromisso. (ref: AVZ-RMBH)"

# Imagem hero (uso explícito §11.C + Cloudinary §11.L)
hero_image_candidates:
  - index: 0
    source_url: https://exame.com/mercado-imobiliario/aluguel-residencial-tem-maior-alta-em-um-ano-nordeste-lidera-valorizacao/
    image_url: https://classic.exame.com/wp-content/uploads/2026/05/a93bf9caa5ae96774321f3c1aa4df0f2.jpg
    local_path: ./store/media/pendente-publicacao/2026-W22-001_bh-aluguel-1-37-em-abril-e-8-40-em-12-meses-o-dobro-do-ipca__0.jpg
    cloud_url: "<PENDING_CLOUDINARY>"
    cloudinary_public_id: "<PENDING_CLOUDINARY>"
    alt: "Aluguel residencial"
    license_hint: "og:image — direito autoral do veículo Exame, uso editorial sob crédito"
    extracted_from: og:image
    mime_type: image/jpeg
    licensable: false
hero_choice: 0

visual_brief:
  base_template: post-mes
  composition_notes: |
    Composição premium, clean e institucional sobre fundo azul-marinho (#0F172A) com acento laranja (#F97316).
    Foco visual num bloco-dado central: "+1,37% abril" e "+8,40% em 12 meses" contrastando com "+4,39% IPCA"
    menor ao lado. Topo com selo discreto "Mercado RMBH — abril/2026". Silhueta sutil do skyline de BH ao
    fundo (baixa opacidade) reforça a âncora local sem competir com o dado. Tipografia Inter para os
    números (peso alto) e Montserrat para o microtexto. Respiro amplo, sem poluição, hierarquia clara:
    dado > contexto > marca.
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone <manifest.target_company.brand_facts.phone_display> em microtexto no rodapé"
    - "paleta oficial Azul Marinho #0F172A + Laranja #F97316"
    - "tipografia Inter (headline/dados) e Montserrat (apoio)"
    - "crédito/fonte FipeZAP visível em microtexto"
    - "âncora geográfica BH/RMBH no layout"
  avoid_visual:
    - "infográficos densos"
    - "gráficos de barras/linhas (avoid_visual do ICP comprador)"
    - "estética corporativa fria"
    - "famílias sorrindo genéricas"
    - "banners chamativos"
    - "selos de urgência ('última chance', 'imperdível')"
    - "emoji de fogo"
    - "layout de feirão de imóvel"

# Distribuição (planner futuro — null no 1º slice)
suggested_slot: null

# Histórico
ledger_ref: ./store/ledger.jsonl
review_notes: ""

# Handoff (preenchido pela radar-handoff, spec 007)
handoff_at: 2026-05-29T13:42:00-03:00
package_path: ./store/packages/2026-W22-001_bh-aluguel-1-37-em-abril-e-8-40-em-12-meses-o-dobro-do-ipca/README.md
handoff_mode: placeholder    # spec 007 §14 — Cloudinary não provisionado ainda

# Publicação (preenchido pela radar-mark-published, spec 008)
published_at: null
ig_post_url: null
---

# BH: aluguel +1,37% em abril e +8,40% em 12 meses — o dobro do IPCA

Em BH, quem está no aluguel viu o reajuste subir quase o dobro do IPCA — e isso muda a conta de comprar.

O Índice FipeZAP de Locação Residencial mostrou que o aluguel em Belo Horizonte subiu 1,37% só em abril, entre os maiores reajustes do país. Em 12 meses, a alta dos aluguéis chega a 8,40% — quase o dobro do IPCA (4,39%) no mesmo período.

Na prática: cada mês que você renova o contrato de aluguel, a parcela sobe mais que a inflação. E enquanto isso, o lote que você pensa em comprar na RMBH segue rendendo do outro lado da conta — o seu, não do proprietário.

A gente não vende aluguel: ajuda você a entender se já está na hora de sair dele. O passo a passo começa com uma simulação simples, sem compromisso e com documentação ok desde o início.

Quer entender se esse caminho é pra você? Manda no WhatsApp que a gente conversa sem compromisso.

---

## Por que entra (matcher)

> Score: **0.62** · Pilar 6 (Mercado RMBH) · ICP comprador
>
> "Belo Horizonte de 1,37%" aparece explicitamente no raw_excerpt com dado pontual mensurável — âncora RMBH forte para Pilar 6. O acumulado de 8,40% em 12 meses contra IPCA de 4,39% sustenta o ângulo editorial **"comprar vale mais que alugar na RMBH"**.

## Visual brief (resumo)

- **Skill OD recomendada**: `ad-creative`
- **Template base**: `post-mes`
- **Hero**: `./store/media/pendente-aprovacao/2026-W22-001_bh-aluguel-1-37-em-abril-e-8-40-em-12-meses-o-dobro-do-ipca__0.jpg` (3240×2160, og:image do Exame)
- **`hero_choice`**: `null` por default — **editor precisa marcar** antes do `radar-mv approve`.

## Source excerpts

- "Em 12 meses, os aluguéis acumulam valorização de 8,40%, praticamente o dobro da inflação oficial medida pelo IPCA, que ficou em 4,39%."
- "Fortaleza registrou alta de 1,54%, Rio de Janeiro de 1,51% e Belo Horizonte de 1,37%."

[Fonte original (Exame)](https://exame.com/mercado-imobiliario/aluguel-residencial-tem-maior-alta-em-um-ano-nordeste-lidera-valorizacao/)
