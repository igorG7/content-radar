---
brief_id: 2026-W23-001
slug: 2026-W23-001_mcmv-2026-teto-r-13-mil-de-renda-e-juros-caem-para-0-99-a-m
created_at: 2026-06-01T11:51:00-03:00
updated_at: 2026-07-02T20:12:34-03:00

# Origem
scan_id: 2026-W23-scan-002
scope: cases
source_finding_id: f_001
source_urls:
  # URL original (Caixa/Recife) retornou 404 em 2026-06-22 — substituída por fontes vivas que confirmam os mesmos dados
  - https://www.infomoney.com.br/politica/renda-de-r-13-mil-e-imoveis-de-r-600-mil-as-novas-regras-do-minha-casa-minha-vida/
  - https://caixanoticias.caixa.gov.br/Paginas/Notícias/2026/04-ABRIL/CAIXA-inicia-operação-das-novas-condições-do-Minha-Casa,-Minha-Vida-na-próxima-quarta-feira-(22).aspx
  - https://istoedinheiro.com.br/mcmv-limites-taxas-juros
source_excerpts:
  - "Pela primeira vez, famílias com renda de até R$ 13 mil/mês têm acesso ao programa — a nova Faixa 4 (classe média) cobre renda bruta familiar de R$ 9.600,01 a R$ 13.000."
  - "Teto do imóvel na Faixa 4 subiu para R$ 600 mil (era R$ 500 mil); na Faixa 3, de R$ 350 mil para R$ 400 mil. Início em 22/04/2026 (Portaria MCID nº 333 + Conselho Curador do FGTS)."
  - "A atualização corrige uma distorção que excluía famílias próximas dos limites anteriores, num contexto de custo elevado do crédito fora do programa (Selic perto de 15%)."

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
    evidence: "Dado oficial de mudança de regra do MCMV (nova Faixa 4: renda até R$13mil, teto de imóvel R$600mil) — atualização que o Pilar 2 demanda pra educar o comprador."
  - component: icp_fit
    evidence: "ICP sair-do-aluguel/primeiro-comprador atingido diretamente pela mudança de teto de renda."
  - component: foco_editorial_fit
    evidence: "Exceção editorial casas MCMV+simulação Caixa acionada — Avanz aceita esse recorte mesmo fora do foco principal de lotes."
  - component: geografia_fit
    evidence: "Evento foi em Recife mas a regra é nacional — aplica à RMBH; geografia_fit baixo (0.30) porque a notícia em si não fala de RMBH."
why_match: |
  Dado oficial de mudança de regra do MCMV (nova Faixa 4: renda até R$13mil, teto de imóvel R$600mil)
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
headline: "MCMV 2026: teto de renda subiu pra R$ 13 mil e a classe média entrou no programa"
hook: "Mudou o MCMV em 2026 e dessa vez a classe média entrou na conta — mas por que mais famílias passaram a caber, e o que isso muda pra quem quer sair do aluguel na RMBH?"
caption_draft: |
  Mudou o MCMV em 2026 — e dessa vez a classe média entrou na conta.

  Até abril, quem ganhava acima de R$ 9,6 mil ficava num limbo: renda "alta demais" pro Minha Casa Minha Vida, mas espremido pelos juros de mercado (com a Selic perto de 15%, financiar fora do programa virou caro demais).

  A correção veio com a nova Faixa 4:

  • Teto de renda subiu de R$ 9,6 mil pra R$ 13 mil/mês — famílias que antes ficavam de fora agora têm porta de entrada.
  • Teto do imóvel subiu pra R$ 600 mil — mais opções cabem na regra.
  • Juros menores e prazos longos do MCMV no lugar das taxas de mercado.

  Na prática: o governo abriu uma faixa que não existia pra alcançar quem estava no meio do caminho — nem baixa renda, nem com folga pra crédito caro.

  Mas o que decide se vale pra você não é a manchete, é a conta. Por isso a gente trabalha casa MCMV com uma regra fixa: simulação Caixa antes da visita. Você entra sabendo seu poder de compra real, sem perder tempo com imóvel fora do bolso.

  Quer saber se você se encaixa na nova faixa? Manda no WhatsApp que a gente conversa sem compromisso — código de referência AVZ-RMBH.
hashtags: [avanzimoveis, mcmv2026, primeiroimovel, sairdoaluguel, rmbh, mateusleme, esmeraldas, financiamentohabitacional]
cta: "Quer saber se você se encaixa na nova faixa? Manda no WhatsApp que a gente conversa sem compromisso — código de referência AVZ-RMBH."

# Imagem hero — uso EXPLÍCITO (§11.C) + Cloudinary (§11.L)
hero_image_candidates: []          # foto do evento Caixa (Recife) retornou 404 — descartada (§13.1)
hero_choice: null                  # PRECISA ser preenchido antes do mv approve (null = sem foto, OD improvisa/template)

visual_brief:
  base_template: post-mes
  composition_notes: |
    Post 1080x1080 em fundo azul marinho #0F172A com bloco-destaque branco arredondado
    centralizado. Tipografia Inter/Montserrat. Headline curta em duas linhas com
    'R$ 13 MIL' (teto de renda) e 'R$ 600 MIL' (teto do imóvel) como números grandes
    em laranja #F97316 — sinalizar que são a NOVA Faixa 4 / classe média. Sem foto
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
handoff_at: 2026-06-22T13:26:00-03:00
package_path: ./store/packages/2026-W23-001_mcmv-2026-teto-r-13-mil-de-renda-e-juros-caem-para-0-99-a-m/README.md

# Quando publicado no Instagram
published_at: 2026-07-02T20:12:34-03:00
ig_post_url: "https://www.instagram.com/p/DZ7sehTAUIl/"
---

# MCMV 2026: teto de renda subiu pra R$ 13 mil e a classe média entrou no programa

## Resumo da pauta

**Pilar 2 — Decisão Inteligente** | ICP: comprador (sair-do-aluguel / primeiro-comprador)

Em 22/04/2026 entraram em vigor as novas regras do MCMV (Portaria MCID nº 333 + Conselho Curador do FGTS): foi criada a **Faixa 4 (classe média)**, cobrindo renda bruta familiar de R$ 9.600,01 a R$ 13.000/mês — antes o programa ia só até R$ 9,6 mil. O teto do imóvel nessa faixa subiu para R$ 600 mil (era R$ 500 mil) e, na Faixa 3, de R$ 350 mil para R$ 400 mil. Houve também redução de juros (a Faixa 1 caiu de 1,17% para 0,99%), com taxas e prazos diferenciados por faixa.

O motivo oficial: **corrigir uma distorção** — famílias logo acima do teto antigo ficavam de fora do programa mas, com a Selic perto de 15%, também eram espremidas pelo crédito caro de mercado. Por isso "mais famílias entram": criou-se uma porta de entrada onde antes não existia.

O gancho é nacional, mas o ângulo Avanz é o comprador da RMBH que mira saída do aluguel via casa MCMV — sempre dentro da exceção editorial declarada: aceito **com simulação Caixa prévia**.

## Caption final (draft)

> Mudou o MCMV em 2026 — e dessa vez a classe média entrou na conta.
>
> Até abril, quem ganhava acima de R$ 9,6 mil ficava num limbo: renda "alta demais" pro Minha Casa Minha Vida, mas espremido pelos juros de mercado (com a Selic perto de 15%, financiar fora do programa virou caro demais).
>
> A correção veio com a nova Faixa 4:
>
> • Teto de renda subiu de R$ 9,6 mil pra R$ 13 mil/mês — famílias que antes ficavam de fora agora têm porta de entrada.
> • Teto do imóvel subiu pra R$ 600 mil — mais opções cabem na regra.
> • Juros menores e prazos longos do MCMV no lugar das taxas de mercado.
>
> Na prática: o governo abriu uma faixa que não existia pra alcançar quem estava no meio do caminho — nem baixa renda, nem com folga pra crédito caro.
>
> Mas o que decide se vale pra você não é a manchete, é a conta. Por isso a gente trabalha casa MCMV com uma regra fixa: simulação Caixa antes da visita. Você entra sabendo seu poder de compra real, sem perder tempo com imóvel fora do bolso.
>
> Quer saber se você se encaixa na nova faixa? Manda no WhatsApp que a gente conversa sem compromisso — código de referência AVZ-RMBH.

## Hashtags

#avanzimoveis #mcmv2026 #primeiroimovel #sairdoaluguel #rmbh #mateusleme #esmeraldas #financiamentohabitacional

## Brief visual pro Open Design

- **Skill OD:** `ad-creative` (texto-pesado, dado-suportado, sem foto hero — combina com o conteúdo)
- **Template Avanz:** `post-mes`
- **Composição:** card editorial 1080x1080 em azul marinho #0F172A com bloco-destaque branco. Os dois números (R$ 13 mil de renda; R$ 600 mil de imóvel) entram em laranja #F97316, formato grande, hierarquia clara, sinalizados como a NOVA Faixa 4 / classe média. Header pequeno indicando o pilar: 'Decisão Inteligente · Avanz'. Sem foto humana ou ícone de casa estilizada — o dado é o protagonista.
- **Must-have:** logo Avanz canto inferior direito; telefone (31) 9 9077-4580; paleta oficial; tipografia Inter/Montserrat.
- **Avoid:** infográfico denso, gráfico de barra, urgência fabricada, estética de feirão, tons dourados/marrons.
- **Hero:** sem candidato baixado — a foto do evento da Caixa em Recife retornou 404 no servidor e mesmo se viesse não seria forte esteticamente nem ideal de licenciamento. Editor decide na revisão se inclui imagem própria ou deixa o card só-tipografia.

## Notas de produção

- **Não inventar números:** ficar restrito aos dados confirmados (R$ 13 mil teto de renda da nova Faixa 4; R$ 9,6 mil teto anterior; R$ 600 mil teto de imóvel Faixa 4; R$ 400 mil Faixa 3; início 22/04/2026). Nada de '% de queda em parcela' calculado por simulação — só publicar se vier de simulação Caixa real.
- **CUIDADO com a taxa de 0,99%:** as fontes confirmam 0,99% como juro da **Faixa 1**, não da classe média (Faixa 4 trabalha taxa anual ~10% a.a., não 0,99% ao mês). Por isso a legenda foi reescrita falando em "juros menores / condições do MCMV" sem cravar 0,99% a.m. para o ICP deste post. NÃO reintroduzir "0,99% ao mês" no card sem checar a faixa. O slug do arquivo ainda contém '0-99-a-m' por motivo histórico (não renomear — quebra package/ledger).
- **Guardrail Avanz:** caption reforça regra interna 'simulação Caixa antes da visita' — não promete aprovação garantida.
- **CTA com placeholder regional:** mantido `AVZ-RMBH` (não tem código de imóvel específico — é post educativo).
- **Exceção editorial:** acionada explicitamente — Avanz aceita casa MCMV desde que com simulação prévia.
- **Anti-repetição (2ª checagem, headline-based):** topic_hash `826e5cafba4a050b8d0df602a9ff6d1610651949` distinto dos 2 briefs em pendente-publicacao (W22-001 sobre aluguel BH, W22-002 sobre preço imóvel BH). Pilar diferente (W22 é Pilar 6, este é Pilar 2), então a regra dos 14d/pillar+icp não dispara.
