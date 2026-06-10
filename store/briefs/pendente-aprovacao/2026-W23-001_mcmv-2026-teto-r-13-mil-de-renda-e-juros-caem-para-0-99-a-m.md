---
brief_id: 2026-W23-001
slug: 2026-W23-001_mcmv-2026-teto-r-13-mil-de-renda-e-juros-caem-para-0-99-a-m
created_at: 2026-06-01T11:51:00-03:00
updated_at: 2026-06-01T11:51:00-03:00

# Origem
scan_id: 2026-W23-scan-002
scope: cases
source_finding_id: f_001
source_urls:
  - https://caixanoticias.caixa.gov.br/Paginas/Noticias/2026/05-MAIO/CAIXA-debate-solucoes-para-habitacao-de-interesse-social-em-Recife-(PE).aspx
source_excerpts:
  - "O limite de renda mensal familiar, antes de até R$ 9,6 mil, passa a ser de até R$ 13 mil. Também reduzimos as taxas de juros para 0,99% ao mês."
  - "A iniciativa já alcançou 2,3 milhões de moradias contratadas, com meta de 3 milhões até fim de 2026."

# Match com empresa-alvo (algoritmo + pesos: spec 003 §5)
pillar: "2-decisao"
icp: comprador
match_score: 0.620
match_score_breakdown:
  pillar_fit: 0.80
  icp_fit: 0.80
  foco_editorial_fit: 0.55
  geografia_fit: 0.30
  freshness: 0.627
source_relevance_hints:
  - component: pillar_fit
    evidence: "Dado oficial de mudança de regra do MCMV (renda até R$13mil, juros 0,99% a.m.) — atualização que o Pilar 2 demanda pra educar o comprador."
  - component: icp_fit
    evidence: "ICP sair-do-aluguel/primeiro-comprador atingido diretamente pela mudança de teto de renda."
  - component: foco_editorial_fit
    evidence: "Exceção editorial casas MCMV+simulação Caixa acionada — Avanz aceita esse recorte mesmo fora do foco principal de lotes."
  - component: geografia_fit
    evidence: "Evento foi em Recife mas a regra é nacional — aplica à RMBH; geografia_fit baixo (0.30) porque a notícia em si não fala de RMBH."
why_match: |
  Dado oficial de mudança de regra do MCMV (renda até R$13mil, juros 0,99% a.m.)
  — exatamente o tipo de atualização que o Pilar 2 demanda pra educar o comprador.
  ICP sair-do-aluguel/primeiro-comprador. Exceção editorial casas MCMV+simulação
  Caixa acionada.

topic_hash: 826e5cafba4a050b8d0df602a9ff6d1610651949
topic_hash_matcher: caixa-debate-solucoes-habitacao-interesse-social-recife

# Conteúdo proposto
format: post_feed_instagram
od_skill_ref: ad-creative
od_skill_alternatives: [social-x-post-card, poster-hero]
template_ref_avanz: post-mes
headline: "MCMV 2026: teto subiu pra R$ 13 mil de renda e juros caíram pra 0,99% ao mês"
hook: "Mudou o MCMV em 2026: mais gente entra na conta — mas o que isso significa na prática pra quem sonha em sair do aluguel na RMBH?"
caption_draft: |
  Mudou o MCMV em 2026: mais gente entra na conta — mas o que isso significa na prática pra quem sonha em sair do aluguel na RMBH?

  A Caixa anunciou duas mudanças que pesam direto no bolso do primeiro comprador:

  • Teto de renda familiar subiu de R$ 9,6 mil pra R$ 13 mil/mês. Família que antes ficava de fora agora cabe.
  • Juros caíram pra 0,99% ao mês. Em financiamento longo, isso tira parcela do começo ao fim.

  O programa já passou de 2,3 milhões de moradias contratadas, com meta de 3 milhões até o fim de 2026. Volume é real — mas o que define se faz sentido pra você é a simulação, não a manchete.

  A gente trabalha casa MCMV com uma regra: simulação Caixa antes da visita. Você entra sabendo seu poder de compra real, sem perder tempo com imóvel fora do bolso.

  Quer entender se esse caminho serve pro seu perfil? Manda no WhatsApp que a gente conversa sem compromisso — código de referência AVZ-RMBH.
hashtags: [avanzimoveis, mcmv2026, primeiroimovel, sairdoaluguel, rmbh, mateusleme, esmeraldas, financiamentohabitacional]
cta: "Quer entender se esse caminho serve pro seu perfil? Manda no WhatsApp que a gente conversa sem compromisso — código de referência AVZ-RMBH."

# Imagem hero — uso EXPLÍCITO (§11.C) + Cloudinary (§11.L)
hero_image_candidates: []          # foto do evento Caixa (Recife) retornou 404 — descartada (§13.1)
hero_choice: null                  # PRECISA ser preenchido antes do mv approve (null = sem foto, OD improvisa/template)

visual_brief:
  base_template: post-mes
  composition_notes: |
    Post 1080x1080 em fundo azul marinho #0F172A com bloco-destaque branco arredondado
    centralizado. Tipografia Inter/Montserrat. Headline curta em duas linhas com
    '+R$ 13 MIL' e '0,99% a.m.' como números grandes em laranja #F97316. Sem foto
    humana — composição editorial limpa, estilo card de comunicação institucional.
    Sub-headline 'O que mudou no MCMV em 2026' em cinza claro. Header pequeno
    'Decisão Inteligente · Avanz' como marca de pilar editorial.
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 9077-4580 visível mas sem competir com a headline"
    - "paleta oficial: azul marinho #0F172A + laranja #F97316 nos números-destaque"
    - "tipografia Inter (primária) ou Montserrat (secundária)"
    - "respiro visual generoso — clareza antes de volume"
    - "marca da seção 'Decisão Inteligente' como header editorial discreto"
  avoid_visual:
    - "infográficos densos"
    - "gráficos de barras/linhas"
    - "estética corporativa fria"
    - "tons dourados, marrons, bege"
    - "estética de feirão imobiliário"
    - "selos de urgência tipo 'última chance'"
    - "tipografia serif clássica"
    - "famílias genéricas sorrindo posando pra foto"

# Distribuição (preenchido pelo planner — fora do 1º slice)
suggested_slot: null

# Histórico
ledger_ref: ./store/ledger.jsonl
review_notes: |
  (espaço pro editor escrever feedback ao reprovar ou ajustar)

# Quando handoff feito (Cloudinary + package)
handoff_at: null
package_path: null

# Quando publicado no Instagram
published_at: null
ig_post_url: null
---

# MCMV 2026: teto subiu pra R$ 13 mil de renda e juros caíram pra 0,99% ao mês

## Resumo da pauta

**Pilar 2 — Decisão Inteligente** | ICP: comprador (sair-do-aluguel / primeiro-comprador)

A Caixa anunciou no 73º Fórum Nacional de Habitação de Interesse Social mudanças no MCMV para 2026: teto de renda familiar passou de R$ 9,6 mil para R$ 13 mil/mês, e a taxa de juros caiu para 0,99% ao mês. O programa já alcançou 2,3 milhões de moradias contratadas, com meta de 3 milhões até o fim de 2026.

O gancho jornalístico é nacional, mas o ângulo Avanz é o comprador da RMBH que mira saída do aluguel via casa MCMV — sempre dentro da exceção editorial declarada: aceito **com simulação Caixa prévia**.

## Caption final (draft)

> Mudou o MCMV em 2026: mais gente entra na conta — mas o que isso significa na prática pra quem sonha em sair do aluguel na RMBH?
>
> A Caixa anunciou duas mudanças que pesam direto no bolso do primeiro comprador:
>
> • Teto de renda familiar subiu de R$ 9,6 mil pra R$ 13 mil/mês. Família que antes ficava de fora agora cabe.
> • Juros caíram pra 0,99% ao mês. Em financiamento longo, isso tira parcela do começo ao fim.
>
> O programa já passou de 2,3 milhões de moradias contratadas, com meta de 3 milhões até o fim de 2026. Volume é real — mas o que define se faz sentido pra você é a simulação, não a manchete.
>
> A gente trabalha casa MCMV com uma regra: simulação Caixa antes da visita. Você entra sabendo seu poder de compra real, sem perder tempo com imóvel fora do bolso.
>
> Quer entender se esse caminho serve pro seu perfil? Manda no WhatsApp que a gente conversa sem compromisso — código de referência AVZ-RMBH.

## Hashtags

#avanzimoveis #mcmv2026 #primeiroimovel #sairdoaluguel #rmbh #mateusleme #esmeraldas #financiamentohabitacional

## Brief visual pro Open Design

- **Skill OD:** `ad-creative` (texto-pesado, dado-suportado, sem foto hero — combina com o conteúdo)
- **Template Avanz:** `post-mes`
- **Composição:** card editorial 1080x1080 em azul marinho #0F172A com bloco-destaque branco. Os dois números (R$ 13 mil de renda; 0,99% a.m.) entram em laranja #F97316, formato grande, hierarquia clara. Header pequeno indicando o pilar: 'Decisão Inteligente · Avanz'. Sem foto humana ou ícone de casa estilizada — o dado é o protagonista.
- **Must-have:** logo Avanz canto inferior direito; telefone (31) 9 9077-4580; paleta oficial; tipografia Inter/Montserrat.
- **Avoid:** infográfico denso, gráfico de barra, urgência fabricada, estética de feirão, tons dourados/marrons.
- **Hero:** sem candidato baixado — a foto do evento da Caixa em Recife retornou 404 no servidor e mesmo se viesse não seria forte esteticamente nem ideal de licenciamento. Editor decide na revisão se inclui imagem própria ou deixa o card só-tipografia.

## Notas de produção

- **Não inventar números:** ficar restrito aos dados do finding (R$ 13 mil teto de renda, R$ 9,6 mil teto anterior, 0,99% a.m., 2,3 mi contratadas, meta 3 mi até fim 2026). Nada de '% de queda em parcela' calculado por simulação — só publicar se vier de simulação Caixa real.
- **Guardrail Avanz:** caption reforça regra interna 'simulação Caixa antes da visita' — não promete aprovação garantida.
- **CTA com placeholder regional:** mantido `AVZ-RMBH` (não tem código de imóvel específico — é post educativo).
- **Exceção editorial:** acionada explicitamente — Avanz aceita casa MCMV desde que com simulação prévia.
- **Anti-repetição (2ª checagem, headline-based):** topic_hash `826e5cafba4a050b8d0df602a9ff6d1610651949` distinto dos 2 briefs em pendente-publicacao (W22-001 sobre aluguel BH, W22-002 sobre preço imóvel BH). Pilar diferente (W22 é Pilar 6, este é Pilar 2), então a regra dos 14d/pillar+icp não dispara.
