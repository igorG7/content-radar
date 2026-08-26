---
brief_id: 2026-W26-024
slug: 2026-W26-024_moradas-gerais-em-ribeirao-das-neves-sem-titulo-fica-fora
created_at: 2026-07-20T11:29:27-03:00
updated_at: 2026-07-20T11:29:27-03:00

scope: local
scan_id: 2026-W26-scan-014
source_finding_id: f_002
source_urls:
  - https://ribeiraodasneves.net/noticias/35-noticias/cidade/11875-governo-de-minas-gerais-realiza-mutirao-de-pre-cadastro-para-o-programa-moradas-gerais-nesta-terca-feira-16-em-ribeirao-das-neves
source_excerpts:
  - "atendimento concentrado no município de Ribeirão das Neves com restrição exclusiva aos bairros Jardim Colonial e Neviana."
  - "Inscrição no CadÚnico, renda per capita até meio salário mínimo, e comprovação de propriedade do imóvel são requisitos para participação no programa."

pillar: "6-mercado-rmbh"
icp: comprador
borderline: true
borderline_reason: "score 0.542 na faixa borderline; foco_editorial 0.35 (programa é sobre reforma de casa de baixa renda, não lote — a ponte 'regularização abre porta a benefício' é editorial) + freshness 0.311 (35 dias) + icp cap 0.45 — match marginal, editor decide"
match_score: 0.542
match_score_breakdown:
  pillar_fit: 0.62
  icp_fit: 0.45
  foco_editorial_fit: 0.35
  geografia_fit: 0.85
  freshness: 0.311
source_relevance_hints:
  - component: pillar_fit
    evidence: "Pilar 6 Categoria D (regulatório), tema 17 (regularização fundiária); ponte via requisito 'comprovação de propriedade' (0.62)"
  - component: foco_editorial_fit
    evidence: "programa é melhoria habitacional (reforma de casa baixa renda), não lote — conexão indireta (0.35)"
  - component: geografia_fit
    evidence: "Ribeirão das Neves (cidade-foco); fonte local dedicada (0.85)"
  - component: freshness
    evidence: "publicado 2026-06-15 (~35 dias) → 0.311; âncora educativa"
why_match: |
  Pilar 6 (Mercado RMBH), Categoria D (regulatório), tema 17 (regularização fundiária). Sedese-MG fez
  pré-cadastro do Moradas Gerais em Jardim Colonial e Neviana (Ribeirão das Neves, cidade-foco). BORDERLINE
  (0.542): o programa em si é melhoria habitacional pra baixa renda, NÃO lote/venda. A ponte editorial
  legítima é o REQUISITO "comprovação de propriedade" → ancora a mensagem Avanz: regularização (título,
  escritura, cadastro) destrava acesso a benefícios públicos, financiamento e valor de venda. Distinto de
  W23-002 (3 papéis) e W26-021 (IPTU/metragem). ⚠️ NÃO afirmar que Avanz inscreve no programa nem prometer
  benefício; é exemplo do "por que regularizar". Editor é o gate.

topic_hash: 584ef938ef1337593b937c9299915951d845cbfc

format: post_feed_instagram
od_skill_ref: ad-creative
od_skill_alternatives: [social-x-post-card, poster-hero]
template_ref_avanz: post-mes
headline: "Moradas Gerais em Ribeirão das Neves: sem título, você fica de fora"
hook: "Chegou um programa do Estado em Ribeirão das Neves. Um detalhe decide quem entra — e começa muito antes da inscrição."
caption_draft: |
  Chegou um programa do Estado em Ribeirão das Neves. Um detalhe decide quem entra — e começa muito antes da inscrição.

  O Governo de Minas fez mutirão de pré-cadastro do Programa Moradas Gerais nos bairros Jardim Colonial e Neviana. É um programa estadual de melhorias habitacionais (segundo o Governo de MG, até R$ 35 mil por imóvel) com três requisitos: CadÚnico, renda per capita até meio salário mínimo e comprovação de propriedade do imóvel.

  A Avanz não inscreve ninguém em programa público — mas essa notícia entrega um recado direto: sem prova de propriedade no seu nome, você fica de fora. E não é só do Moradas Gerais. É de financiamento, MCMV, herança, venda tranquila. Documentação em dia destrava direitos.

  Se o imóvel está no nome do avô, se você tem só contrato antigo, escritura sem registro ou nada além do recibo — o que existe hoje não é problema, é ponto de partida. Regularizar é técnico, mas é um passo a passo claro.

  Quer entender se o seu está em ordem pra pegar oportunidades — públicas ou privadas — quando aparecem? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente conversa sem compromisso.
hashtags:
  [
    avanzimoveis,
    ribeiraodasneves,
    rmbh,
    regularizacaofundiaria,
    documentacaoimobiliaria,
    moradasgerais,
  ]
cta: "Quer entender se o seu imóvel está em ordem pra pegar oportunidades — públicas ou privadas — quando aparecem? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente conversa sem compromisso."

hero_image_candidates:
  - index: 0
    source_url: https://ribeiraodasneves.net/noticias/35-noticias/cidade/11875-governo-de-minas-gerais-realiza-mutirao-de-pre-cadastro-para-o-programa-moradas-gerais-nesta-terca-feira-16-em-ribeirao-das-neves
    image_url: https://ribeiraodasneves.net/midia/imagens/2026-07/46-jardimcolonial.jpg
    local_path: null   # baixada era placa de entrada da cidade (genérica), não o mutirão — descartada
    cloud_url: null
    cloudinary_public_id: null
    alt: "candidato descartado — placa 'Ribeirão das Neves, volte sempre!' (portal de entrada), não retrata o fato"
    license_hint: "portal ribeiraodasneves.net; imagem genérica — não usar"
    extracted_from: inline
    mime_type: image/jpeg
    licensable: false
hero_choice: null

visual_brief:
  base_template: post-mes
  composition_notes: |
    Card educativo (1080x1350, 4:5). Fundo azul-marinho Avanz (#0F172A) com barra laranja (#F97316). Selo
    superior: "Ribeirão das Neves · Programa Moradas Gerais". Título enxuto (headline) em 2 linhas, Inter
    Bold. Bloco lateral com checklist dos 3 requisitos: (1) CadÚnico, (2) Renda per capita ≤ ½ SM,
    (3) Comprovação de propriedade do imóvel — este ÚLTIMO em destaque (contorno laranja / ícone de
    escritura). Ilustração vetorial suave: silhueta de escritura/matrícula + carimbo, sem estética de
    planilha. Rodapé com logo Avanz + telefone + atribuição "Fonte: Governo de MG / Sedese". Tom sereno,
    cívico, didático, aspiracional acolhedor.
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 9077-4580"
    - "paleta oficial Avanz: azul marinho #0F172A + laranja #F97316"
    - "tipografia Inter/Montserrat"
    - "menção textual 'Ribeirão das Neves · Programa Moradas Gerais'"
    - "checklist dos 3 requisitos com 'comprovação de propriedade' destacado"
    - "atribuição em corpo menor: 'Fonte: Governo de MG (Sedese)' — sem apropriar o programa"
  avoid_visual:
    - "infográficos densos / gráficos de barras-linhas"
    - "estética corporativa fria"
    - "sugerir que a Avanz inscreve/participa do programa"
    - "selo/timer de urgência ('última chance', 'imperdível')"
    - "estética de feirão imobiliário"
    - "família sorrindo em frente a casa reformada (implicaria promessa do benefício)"
    - "reproduzir logo/identidade do Governo de MG"

suggested_slot:
  week: 2026-W30
  day: quinta-feira
  rationale: "ângulo evergreen (regularização) tolera defasagem; alternar Pilar 6/2. Atenção à cadência vs W26-013 (mesmo pilar/ICP recente)"
ledger_ref: ./store/ledger.jsonl
review_notes: |
  ⚠️ BORDERLINE (0.542) — editor é o gate. Ponte "programa exige propriedade → regularize" é honesta mas
  indireta; público direto do Moradas Gerais é baixa renda (fora do ICP comprador nuclear). NÃO afirmar
  que Avanz inscreve/intermedeia; NÃO prometer benefício. R$35 mil/imóvel vem de f_003 (Hoje em Dia,
  atribuído ao Governo de MG); bairros e requisitos de f_002. Hero descartada (placa de entrada genérica)
  → arte gerada. CADÊNCIA: W26-013 (Pilar 6/comprador, publicado 2026-07-10) recente — editor pode adiar
  ou reframear como Pilar 2 (documentação).

handoff_at: null
package_path: null

published_at: null
ig_post_url: null
---

# Moradas Gerais em Ribeirão das Neves: sem título, você fica de fora

Chegou um programa do Estado em Ribeirão das Neves. Um detalhe decide quem entra — e começa muito antes da inscrição.

O Governo de Minas fez mutirão de pré-cadastro do Programa Moradas Gerais nos bairros Jardim Colonial e Neviana. É um programa estadual de melhorias habitacionais (segundo o Governo de MG, até R$ 35 mil por imóvel) com três requisitos: CadÚnico, renda per capita até meio salário mínimo e comprovação de propriedade do imóvel.

A Avanz não inscreve ninguém em programa público — mas essa notícia entrega um recado direto: sem prova de propriedade no seu nome, você fica de fora. E não é só do Moradas Gerais. É de financiamento, MCMV, herança, venda tranquila. Documentação em dia destrava direitos.

Se o imóvel está no nome do avô, se você tem só contrato antigo, escritura sem registro ou nada além do recibo — o que existe hoje não é problema, é ponto de partida. Regularizar é técnico, mas é um passo a passo claro.

Quer entender se o seu está em ordem pra pegar oportunidades — públicas ou privadas — quando aparecem? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente conversa sem compromisso.

---

## Por que entra (matcher)

> Score: **0.542** · Pilar 6 (Mercado RMBH, Categoria D) · ICP comprador · ⚠️ **`borderline: true`**
>
> Programa Moradas Gerais em RN exige "comprovação de propriedade" → ponte pra tese Avanz "regularização destrava direitos". Match marginal (foco 0,35 — programa é reforma de casa, não lote). Editor decide. ⚠️ Não apropriar o programa; não prometer benefício.

## Visual brief (resumo)

- **Skill OD recomendada**: `ad-creative`
- **Hero**: descartada (placa de entrada genérica) → arte gerada (checklist dos 3 requisitos)
- **`hero_choice`**: `null`
