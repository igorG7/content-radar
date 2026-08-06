---
brief_id: 2026-W32-025
slug: 2026-W32-025_comprar-o-lote-agora-e-o-que-decide-se-a-fundacao-sai-antes
created_at: 2026-08-03T10:45:00-03:00
updated_at: 2026-08-03T10:45:00-03:00

# Origem — NÃO vem de scan. Pauta escolhida pelo humano na sessão de 2026-08-03
# a partir de lista de ideias derivada dos content banks da Avanz.
scope: seasonal
scan_id: null
source_finding_id: null
source_urls: []
source_excerpts: []
origin: content-bank
origin_refs:
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-14 — Solo, drenagem e o que aparece só na chuva"
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-28 — Da escolha ao registro: linha do tempo real"
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-19 — Quando NÃO é hora de comprar"

# Match com empresa-alvo (spec 003)
pillar: "2-decisao"
icp: comprador
borderline: false
match_score: null # sem finding pra pontuar — pauta humana, não descoberta externa
match_score_breakdown: null
source_relevance_hints: []
why_match: |
  Pilar 2 (Decisão Inteligente) + ICP comprador: gancho sazonal legítimo, não
  "calendário sem propósito". O período seco em Minas vai aproximadamente de maio a
  setembro, e a estação chuvosa concentra-se entre outubro e março — fato
  climatológico estável, não previsão. Quem fecha lote em agosto ainda tem janela
  de terraplanagem e fundação antes do período chuvoso; quem fecha em outubro
  normalmente espera.

  O post não cria urgência fabricada: ele explica uma restrição real de calendário
  de obra e diz explicitamente que esperar também é decisão válida. É o oposto do
  "compre antes que acabe" — é "entenda o que o calendário faz com o seu
  cronograma".

topic_hash: 0008a4265039428ed4dfb946cb460ec7a0f2c14d

# Conteúdo proposto
format: post_feed_instagram
od_skill_ref: ad-creative
template_ref_avanz: post-mes
headline: "Comprar o lote agora é o que decide se a fundação sai antes da chuva"
hook: "A conta que quase ninguém faz na hora de comprar lote não é de dinheiro. É de calendário."
caption_draft: |
  A conta que quase ninguém faz na hora de comprar lote não é de dinheiro. É de calendário.

  Em Minas, o período seco vai mais ou menos de maio a setembro. É nele que terraplanagem, movimentação de terra e fundação andam sem parar: solo firme, máquina que não atola, concreto que cura sem chuva em cima. Entre outubro e março, a mesma etapa vira cronograma refeito toda semana.

  Só que entre fechar a compra e a primeira máquina entrar no lote existe um caminho: contrato assinado, documentação conferida, projeto e aprovação na prefeitura, sondagem do terreno. Isso leva tempo — e é esse tempo que decide se você entra na obra agora ou em abril.

  Não estamos dizendo que agosto é a única hora de comprar. Estamos dizendo que quem compra agora escolhe entre começar em 2026 ou em 2027, e quem compra em outubro geralmente não tem essa escolha. Se o seu plano é construir, o calendário faz parte da conta.

  Quer entender se dá tempo de começar sua obra ainda neste ano? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente monta a linha do tempo com você.
hashtags:
  [
    avanzimoveis,
    rmbh,
    lotesrmbh,
    mateusleme,
    esmeraldas,
    construcao,
    decisaointeligente,
  ]
cta: "Quer entender se dá tempo de começar sua obra ainda neste ano? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente monta a linha do tempo com você."

hero_image_candidates: []
hero_choice: null

visual_brief:
  base_template: post-mes
  composition_notes: |
    Composição de linha do tempo horizontal em 1:1 cobrindo os meses do ano, com a
    faixa seca (mai–set) e a faixa chuvosa (out–mar) diferenciadas por cor sóbria —
    sem ícone de nuvem cartoon, sem "chuva" ilustrada. Sobre a régua de meses,
    marcar as etapas entre compra e obra: contrato → documentação → projeto/aprovação
    → sondagem → fundação. A leitura tem que ser "o caminho tem tempo próprio", não
    "corre que acaba". Headline no topo; faixa inferior com a pergunta do CTA. Luz
    natural quente se houver foto de fundo (terreno limpo, sem gente). Paleta oficial.
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 9077-4580"
    - "régua de meses legível com faixa seca vs chuvosa"
    - "etapas entre compra e fundação visíveis em sequência"
    - "paleta oficial Avanz (#0F172A + #F97316 destaque)"
    - "tipografia Inter/Montserrat"
  avoid_visual:
    - "contagem regressiva / relógio / ampulheta (urgência fabricada)"
    - "selos de 'última chance', 'imperdível', 'corre'"
    - "emoji de fogo"
    - "infográfico denso (ICP comprador — evitar gráfico de barras/linhas)"
    - "estética corporativa fria"
    - "qualquer previsão meteorológica com data ou volume de chuva"

suggested_slot:
  week: 2026-W33
  day: quinta-feira
  rationale: "Pilar 2 tem slot na quinta (alterna com 6-mercado-rmbh). Gancho sazonal perde valor a cada semana — publicar em agosto, não em setembro."
ledger_ref: ./store/ledger.jsonl
review_notes: |
  PAUTA HUMANA (sessão 2026-08-03). Não veio de scan; `match_score: null` e
  `scope: seasonal` — mesma pendência de sistema já registrada no W26-016
  (o pipeline modela só brief vindo de scan externo; o content bank tem ~50 temas
  perenes que não precisam de scan).

  ATRIBUIÇÃO DE PILAR — DIVERGE DO PEDIDO: o humano listou esta pauta como "Pilar 1".
  Foi materializada como `2-decisao` porque o Pilar 1 (Imóvel da semana) exige imóvel
  real do estoque — código AVZ-XXXX, localização, preço e 3 atributos — e o radar não
  tem acesso ao estoque da Avanz. Sem isso, o brief seria inventado. Se a intenção era
  de fato Pilar 1, o caminho é o humano informar o lote e a gente refaz com
  `template_ref_avanz: post-imovel` e `od_skill_ref: poster-hero`.

  LIMITE DURO: nenhuma previsão do tempo, nenhuma data de início de chuva, nenhum
  volume em mm. O post usa só o padrão climatológico estável de Minas (seco
  mai–set / chuvoso out–mar). Nenhum prazo de obra em dias/semanas foi afirmado —
  varia por lote, projeto e prefeitura.

  NÃO É URGÊNCIA FABRICADA: a copy afirma explicitamente que agosto não é a única
  hora de comprar. Guardrail de "compre antes que acabe" checado — sem violação.
---

# Comprar o lote agora é o que decide se a fundação sai antes da chuva

A conta que quase ninguém faz na hora de comprar lote não é de dinheiro. É de calendário.

Em Minas, o período seco vai mais ou menos de maio a setembro. É nele que terraplanagem, movimentação de terra e fundação andam sem parar: solo firme, máquina que não atola, concreto que cura sem chuva em cima. Entre outubro e março, a mesma etapa vira cronograma refeito toda semana.

Só que entre fechar a compra e a primeira máquina entrar no lote existe um caminho: contrato assinado, documentação conferida, projeto e aprovação na prefeitura, sondagem do terreno. Isso leva tempo — e é esse tempo que decide se você entra na obra agora ou em abril.

Não estamos dizendo que agosto é a única hora de comprar. Estamos dizendo que quem compra agora escolhe entre começar em 2026 ou em 2027, e quem compra em outubro geralmente não tem essa escolha. Se o seu plano é construir, o calendário faz parte da conta.

Quer entender se dá tempo de começar sua obra ainda neste ano? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente monta a linha do tempo com você.

---

## Por que entra (decisão humana, sem matcher)

> Pilar 2 (Decisão Inteligente) · ICP comprador · `scope: seasonal` · `match_score: null`
>
> Pauta escolhida pelo humano em 2026-08-03. Gancho de calendário com implicação real de
> decisão — não é "bom dia, segunda-feira". Ver `review_notes` para a divergência de pilar.

## Visual brief (resumo)

- **Skill OD recomendada**: `ad-creative`
- **Hero**: sem foto → arte gerada (régua de meses + etapas até a fundação)
- **`hero_choice`**: `null`
- **Proibido na arte**: relógio/contagem regressiva, selo de urgência, previsão do tempo
