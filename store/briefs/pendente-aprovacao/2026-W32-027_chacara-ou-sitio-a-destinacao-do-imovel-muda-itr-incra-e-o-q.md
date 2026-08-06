---
brief_id: 2026-W32-027
slug: 2026-W32-027_chacara-ou-sitio-a-destinacao-do-imovel-muda-itr-incra-e-o-q
created_at: 2026-08-03T10:55:00-03:00
updated_at: 2026-08-03T10:55:00-03:00

# Origem — NÃO vem de scan. Pauta escolhida pelo humano na sessão de 2026-08-03.
scope: evergreen # ⚠️ fora do enum do manifest — ver review_notes
scan_id: null
source_finding_id: null
source_urls: []
source_excerpts: []
origin: content-bank
origin_refs:
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-1 — Matrícula vs escritura vs contrato"
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-3 — Como saber se um terreno tem documentação ok"
  - "strategy/content-bank/pilar-6-mercado-rmbh.md#tema-15 — Mudança de zoneamento: o que muda pro comprador"

# Match com empresa-alvo (spec 003)
pillar: "2-decisao"
icp: comprador
borderline: false
match_score: null
match_score_breakdown: null
source_relevance_hints: []
why_match: |
  Pilar 2 + ICP comprador, direto no foco editorial declarado da Avanz — "lotes, sítios
  e chácaras na RMBH". "Chácara" e "sítio" são palavras de anúncio, não categorias
  jurídicas: o que define o regime do imóvel é a destinação (rural ou urbana) registrada,
  e é ela que decide o imposto que você paga, o cadastro que você precisa manter e o que
  você pode construir ali.

  É o tipo de erro que só aparece na hora de financiar, de vender ou de aprovar projeto —
  quando já não dá pra desfazer. Nenhum dos 26 briefs do store trata da distinção
  rural/urbano, apesar de chácara e sítio estarem no foco declarado desde o manifest.

topic_hash: fad145dcefd7ca6ad7f4920ded00df42d7d3bc31

# Conteúdo proposto
format: post_feed_instagram
od_skill_ref: ad-creative
template_ref_avanz: post-mes
headline: "Chácara ou sítio? A destinação do imóvel muda ITR, INCRA e o que dá pra construir"
hook: "Chácara e sítio são palavras de anúncio. O que decide as suas obrigações é outra coisa."
caption_draft: |
  Chácara e sítio são palavras de anúncio. O que decide as suas obrigações é outra coisa: a destinação do imóvel.

  Imóvel com destinação rural paga ITR, que é federal, e precisa de cadastro no INCRA — é de lá que sai o CCIR, documento sem o qual não se lavra escritura nem se registra a transferência. Além disso existe a fração mínima de parcelamento: abaixo dela, o imóvel rural simplesmente não pode ser desmembrado, por mais que o vendedor diga que "dá pra dividir depois".

  Imóvel com destinação urbana paga IPTU, é do município e segue o plano diretor e o zoneamento da cidade: é a prefeitura que diz quanto você pode ocupar do terreno, o recuo, a altura e o uso permitido.

  O ponto que pega: um mesmo terreno com casa, pomar e piscina pode estar em qualquer um dos dois regimes. Não é o mato em volta que define, é o registro. E dá pra conferir antes de comprar — matrícula atualizada, carnê do imposto (é ITR ou é IPTU?) e, se for rural, CCIR e ITR em dia.

  Se a sua ideia é morar, construir ou dividir depois, essa é a primeira coisa a checar. Não a última.

  Quer que a gente confira a destinação da chácara que você está olhando? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580.
hashtags:
  [
    avanzimoveis,
    rmbh,
    chacara,
    sitio,
    documentacaoimobiliaria,
    esmeraldas,
    jaboticatubas,
    decisaointeligente,
  ]
cta: "Quer que a gente confira a destinação da chácara que você está olhando? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580."

hero_image_candidates: []
hero_choice: null

visual_brief:
  base_template: post-mes
  composition_notes: |
    Comparativo em duas colunas em 1:1 — "Destinação RURAL" vs "Destinação URBANA" —
    com as mesmas 4 linhas em cada lado: imposto (ITR federal / IPTU municipal),
    cadastro (INCRA + CCIR / prefeitura), quem manda no que se constrói (legislação
    rural + fração mínima / plano diretor e zoneamento) e "dá pra desmembrar?".
    Entre as colunas, uma faixa central com a pergunta que resolve: "o que a matrícula
    diz?". Nada de foto de fazenda idílica — se houver imagem de fundo, terreno real
    com cerca e portão, luz natural. Sem número em nenhuma célula. Paleta oficial.
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 9077-4580"
    - "as duas colunas nomeadas RURAL e URBANA, legíveis"
    - "ITR/INCRA de um lado e IPTU/prefeitura do outro, sem ambiguidade"
    - "faixa central remetendo à matrícula como fonte da verdade"
    - "paleta oficial Avanz (#0F172A + #F97316 destaque)"
    - "tipografia Inter/Montserrat"
  avoid_visual:
    - "QUALQUER número: alíquota de ITR/IPTU, hectares, valor de módulo fiscal ou fração mínima"
    - "citação de município específico como exemplo de regra"
    - "estética de revista rural / fazenda aspiracional"
    - "infográfico denso (ICP comprador)"
    - "selos de urgência"
    - "brasão, logo ou selo oficial de INCRA, Receita Federal ou prefeitura"

suggested_slot:
  week: 2026-W35
  day: quinta-feira
  rationale: "Pilar 2 na quinta. Terceiro da série de decisão — espaçado pra não empilhar três Pilar 2 seguidos."
ledger_ref: ./store/ledger.jsonl
review_notes: |
  PAUTA HUMANA (sessão 2026-08-03). Sem scan, `match_score: null`, `scope: evergreen`
  fora do enum — mesma pendência de sistema do W26-016.

  LIMITE DURO — NENHUM NÚMERO REGULATÓRIO. A fração mínima de parcelamento e o módulo
  fiscal variam por município, e alíquota de ITR varia por área e grau de utilização.
  O post cita os conceitos (fração mínima existe, CCIR é exigido pra transferência) sem
  nenhum valor. Se o Ivan quiser a versão com o módulo fiscal das cidades-foco, isso
  precisa ser conferido caso a caso na fonte oficial antes de virar arte — não sai daqui.

  BASE FACTUAL (regime estável, não notícia): imóvel rural → ITR (federal) + cadastro
  INCRA, do qual decorre o CCIR exigido pra escritura/registro de transferência; imóvel
  urbano → IPTU (municipal) + plano diretor e zoneamento. A destinação consta do registro,
  não da aparência do terreno. São regras estruturais do sistema, não dado datado — por
  isso o brief não precisa de `source_urls`.

  VERIFICAR ANTES DE PUBLICAR: vale o Ivan bater o olho na frase sobre CCIR e escritura.
  A regra é sólida, mas a redação da caption é assertiva e o assunto é jurídico — se
  houver qualquer dúvida, suavizar pra "costuma ser exigido".

  ANTI-REPETIÇÃO: o W23-002 (publicado) trata de "3 papéis que mudam tudo" na
  documentação de terreno. Recorte diferente — lá é o kit documental do lote urbano,
  aqui é a bifurcação rural/urbano e suas consequências. Sem sobreposição de headline
  nem de estrutura, mas os dois não devem ir ao ar na mesma semana.
---

# Chácara ou sítio? A destinação do imóvel muda ITR, INCRA e o que dá pra construir

Chácara e sítio são palavras de anúncio. O que decide as suas obrigações é outra coisa: a destinação do imóvel.

Imóvel com destinação rural paga ITR, que é federal, e precisa de cadastro no INCRA — é de lá que sai o CCIR, documento sem o qual não se lavra escritura nem se registra a transferência. Além disso existe a fração mínima de parcelamento: abaixo dela, o imóvel rural simplesmente não pode ser desmembrado, por mais que o vendedor diga que "dá pra dividir depois".

Imóvel com destinação urbana paga IPTU, é do município e segue o plano diretor e o zoneamento da cidade: é a prefeitura que diz quanto você pode ocupar do terreno, o recuo, a altura e o uso permitido.

O ponto que pega: um mesmo terreno com casa, pomar e piscina pode estar em qualquer um dos dois regimes. Não é o mato em volta que define, é o registro. E dá pra conferir antes de comprar — matrícula atualizada, carnê do imposto (é ITR ou é IPTU?) e, se for rural, CCIR e ITR em dia.

Se a sua ideia é morar, construir ou dividir depois, essa é a primeira coisa a checar. Não a última.

Quer que a gente confira a destinação da chácara que você está olhando? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580.

---

## Por que entra (decisão humana, sem matcher)

> Pilar 2 (Decisão Inteligente) · ICP comprador · `match_score: null` (não veio de scan)
>
> Pauta escolhida pelo humano em 2026-08-03. Cobre chácara/sítio — foco editorial declarado
> no manifest e sem nenhum brief no store até aqui.

## Visual brief (resumo)

- **Skill OD recomendada**: `ad-creative`
- **Hero**: sem foto → arte gerada (comparativo RURAL vs URBANA, 4 linhas)
- **`hero_choice`**: `null`
- **Proibido na arte**: qualquer alíquota, hectare ou módulo fiscal; brasão oficial de órgão
