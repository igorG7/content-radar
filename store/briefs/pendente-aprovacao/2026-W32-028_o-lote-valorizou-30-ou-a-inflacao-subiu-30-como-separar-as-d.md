---
brief_id: 2026-W32-028
slug: 2026-W32-028_o-lote-valorizou-30-ou-a-inflacao-subiu-30-como-separar-as-d
created_at: 2026-08-03T11:00:00-03:00
updated_at: 2026-08-03T11:00:00-03:00

# Origem — NÃO vem de scan. Pauta escolhida pelo humano na sessão de 2026-08-03.
scope: evergreen # ⚠️ fora do enum do manifest — ver review_notes
scan_id: null
source_finding_id: null
source_urls: []
source_excerpts: []
origin: content-bank
origin_refs:
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-25 — Valorização média RMBH: dado bruto vs interpretação"
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-24 — O que faz um lote valorizar de verdade"
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-26 — Lote como reserva de valor"

# Match com empresa-alvo (spec 003)
pillar: "2-decisao"
icp: investidor
borderline: false
match_score: null
match_score_breakdown: null
source_relevance_hints: []
why_match: |
  Pilar 2 + ICP investidor. O post ensina um método aritmético — descontar a inflação do
  período pra separar ganho nominal de ganho real — e não afirma valorização nenhuma.
  É exatamente a postura que a Avanz já assumiu no store: o W22-002 (publicado) registra
  imóvel pronto em BH subindo +4% no Q1 2026 contra IPCA de 4,39%, ou seja, alta nominal
  com perda real. Este brief é a ferramenta que o cliente usa pra fazer essa leitura sozinho.

  É também conteúdo de autoridade por subtração: quase todo anúncio de lote vende
  percentual de valorização, e a Avanz aqui ensina o cliente a desconfiar do percentual —
  inclusive dos que aparecem em anúncio de concorrente.

topic_hash: d99cb89d768be284b0ed2955690b9ef177af1f2e

# Conteúdo proposto
format: post_feed_instagram
od_skill_ref: ad-creative
template_ref_avanz: post-mes
headline: "O lote valorizou 30% ou a inflação subiu 30%? Como separar as duas contas"
hook: "Todo anúncio mostra o quanto o lote subiu. Quase nenhum mostra o quanto o dinheiro caiu no mesmo período."
caption_draft: |
  Todo anúncio mostra o quanto o lote subiu. Quase nenhum mostra o quanto o dinheiro caiu no mesmo período.

  Subiu 30% em três anos é ganho nominal. Ganho real é o que sobra depois de descontar a inflação do mesmo intervalo. Se os preços em geral subiram na mesma proporção, o lote não valorizou — ele acompanhou. Você não ficou mais rico, só não ficou mais pobre.

  A conta é simples e você faz no celular: divida o valor de hoje pelo valor da compra, divida o índice de hoje pelo índice da data da compra, e compare os dois resultados. Exemplo só pra ilustrar a mecânica: um lote que sai de R$ 100 mil pra R$ 130 mil num período em que a inflação foi de 30% ganhou zero em termos reais.

  Qual índice usar depende do que você quer responder. Pra saber se o seu patrimônio cresceu, o IPCA — é ele que mede o custo de vida. Pra saber se ainda compensa construir, o INCC, que mede o custo da obra e costuma andar diferente do IPCA. São perguntas diferentes e dão respostas diferentes.

  Isso não torna lote um mau negócio. Torna você capaz de comparar duas ofertas sem depender do número que o vendedor escolheu mostrar.

  Quer fazer essa conta pro lote que você já tem ou pro que está avaliando? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente roda o comparativo com você.
hashtags:
  [
    avanzimoveis,
    rmbh,
    lotesrmbh,
    investimentoimobiliario,
    valorizacao,
    mateusleme,
    decisaointeligente,
  ]
cta: "Quer fazer essa conta pro lote que você já tem ou pro que está avaliando? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente roda o comparativo com você."

hero_image_candidates: []
hero_choice: null

visual_brief:
  base_template: post-mes
  composition_notes: |
    Composição analítica em 1:1, estética de inteligência de mercado (ICP investidor).
    Duas barras lado a lado partindo da mesma base: "quanto o lote subiu" e "quanto a
    inflação subiu" — e, entre elas, a diferença marcada como "ganho real". As barras
    devem ser claramente esquemáticas/ilustrativas, do mesmo tamanho ou quase, e SEM
    escala numérica: a lição é o método, não um dado de mercado. Fórmula em uma linha
    limpa no terço inferior. Headline no topo. Paleta oficial, marcação em laranja só
    no "ganho real".
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 9077-4580"
    - "as duas barras nomeadas (alta do lote / inflação do período)"
    - "a diferença rotulada como GANHO REAL"
    - "menção a IPCA e INCC como escolhas de índice para perguntas diferentes"
    - "paleta oficial Avanz (#0F172A + #F97316 destaque)"
    - "tipografia Inter/Montserrat"
  avoid_visual:
    - "QUALQUER percentual de valorização de lote apresentado como dado real de mercado (não existe índice público de lote na RMBH)"
    - "valor de IPCA ou INCC com número — só os nomes dos índices"
    - "eixo com escala numérica nas barras"
    - "seta ascendente estilo 'foguete' / estética de day trade"
    - "famílias sorrindo / estética de revista de decoração"
    - "selos de urgência ou de 'oportunidade'"

suggested_slot:
  week: 2026-W37
  day: quinta-feira
  rationale: "Pilar 2 na quinta, ICP investidor — alterna com os anteriores da série, que são ICP comprador."
ledger_ref: ./store/ledger.jsonl
review_notes: |
  PAUTA HUMANA (sessão 2026-08-03). Sem scan, `match_score: null`, `scope: evergreen`
  fora do enum — mesma pendência de sistema do W26-016.

  LIMITE DURO HERDADO DO W26-016 — NENHUM PERCENTUAL DE VALORIZAÇÃO DE LOTE COMO DADO
  REAL. Não existe índice público de valorização de lote na RMBH (FipeZap mede apto/casa,
  Secovi-MG mede residencial na capital, ABRAINC mede unidade incorporada). O "30%" da
  headline e do exemplo é HIPOTÉTICO e serve pra ensinar a aritmética — está marcado como
  "exemplo só pra ilustrar a mecânica" na caption e não pode virar número de mercado na
  arte. Se na revisão isso parecer ambíguo, trocar o exemplo por letras (valor A, valor B).

  TAMBÉM SEM VALOR DE ÍNDICE: IPCA e INCC aparecem só pelo nome, sem percentual. Qualquer
  número deles envelhece e precisaria de fonte datada — o brief não tem.

  ÂNCORA INTERNA: o W22-002 (publicado) já registrou +4% no Q1 2026 em BH contra IPCA de
  4,39% (Secovi-MG). Este brief é a generalização didática daquele caso, não uma repetição —
  não cita o dado, ensina a conta. Vale a pena, no story, linkar o post antigo.

  ANTI-REPETIÇÃO: o W26-019 (pendente-aprovacao) trata de FipeZap aluguel acima do IPCA.
  Mesma família conceitual (nominal vs real), recorte diferente (aluguel vs valorização de
  lote). Não publicar os dois na mesma quinzena.
---

# O lote valorizou 30% ou a inflação subiu 30%? Como separar as duas contas

Todo anúncio mostra o quanto o lote subiu. Quase nenhum mostra o quanto o dinheiro caiu no mesmo período.

Subiu 30% em três anos é ganho nominal. Ganho real é o que sobra depois de descontar a inflação do mesmo intervalo. Se os preços em geral subiram na mesma proporção, o lote não valorizou — ele acompanhou. Você não ficou mais rico, só não ficou mais pobre.

A conta é simples e você faz no celular: divida o valor de hoje pelo valor da compra, divida o índice de hoje pelo índice da data da compra, e compare os dois resultados. Exemplo só pra ilustrar a mecânica: um lote que sai de R$ 100 mil pra R$ 130 mil num período em que a inflação foi de 30% ganhou zero em termos reais.

Qual índice usar depende do que você quer responder. Pra saber se o seu patrimônio cresceu, o IPCA — é ele que mede o custo de vida. Pra saber se ainda compensa construir, o INCC, que mede o custo da obra e costuma andar diferente do IPCA. São perguntas diferentes e dão respostas diferentes.

Isso não torna lote um mau negócio. Torna você capaz de comparar duas ofertas sem depender do número que o vendedor escolheu mostrar.

Quer fazer essa conta pro lote que você já tem ou pro que está avaliando? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente roda o comparativo com você.

---

## Por que entra (decisão humana, sem matcher)

> Pilar 2 (Decisão Inteligente) · ICP investidor · `match_score: null` (não veio de scan)
>
> Pauta escolhida pelo humano em 2026-08-03. Ensina método, não afirma valorização —
> alinhado ao limite duro do W26-016. O "30%" é hipotético; ver `review_notes`.

## Visual brief (resumo)

- **Skill OD recomendada**: `ad-creative`
- **Hero**: sem foto → arte gerada (duas barras esquemáticas + ganho real)
- **`hero_choice`**: `null`
- **Proibido na arte**: percentual de lote como dado real, valor de IPCA/INCC, eixo com escala
