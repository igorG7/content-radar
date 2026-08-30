---
spec_id: 003-matcher
title: "content-radar — Subagente avanz-matcher: scoring, filtragem e enriquecimento"
status: draft
version: 0.3.0
data: 2026-07-03
autor: claude
empresa_alvo: avanz-imoveis
escopo: detalhamento do estágio (2) do pipeline — matcher
resolves:
  - "§11.I da spec 001 (match_score mínimo)"
  - "§11.V da spec 001 (calibração anti-escassez: tier borderline + piso geo reancorável)"
related:
  - /srv/apps/content-radar/docs/specs/001-foundation.md
  - /srv/apps/content-radar/docs/specs/002-researcher.md
  - /srv/apps/content-radar/docs/specs/004-briefer.md
  - /srv/apps/content-radar/manifest.yaml
  - /srv/my-mind/Empresas/avanz-imoveis/manifest.yaml
  - /srv/my-mind/Empresas/avanz-imoveis/identity/brand.md
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/positioning.md
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md
  - /srv/my-mind/Empresas/avanz-imoveis/prompts/icp-modifiers.json
  - /srv/my-mind/Empresas/avanz-imoveis/ops/guardrails.md
changelog:
  - "v0.3.0 (2026-07-03): calibração anti-escassez (resolve §11.V da 001; diagnóstico em docs/calibracao-matcher.md). (a) Novo tier de decisão `promote-borderline` (§5.7.1): findings em [0.48, 0.55) SEM cap acionado viram brief marcado `borderline: true`, delegando a decisão marginal ao editor humano (§11.H) em vez de descartar silencioso — ataca os ~11/22 skip-low-score observados na faixa 0.45–0.549. (b) Piso de geografia reancorável (§5.4): dado nacional imobiliário com implicação clara pra RMBH recebe `geografia_fit >= 0.50` (manifest `geografia_reframe_floor`) em vez de 0.40 — corrige o padrão em que macro nacional bom (SBPE/CBIC/MCMV) morria em geo antes do briefer poder reancorar (gotcha #3). Threshold 0.55, pesos e caps INALTERADOS. Enum de `decision` (§4) ganha `promote-borderline`. Medição prevista: 2 ciclos (§11 critério 3 + docs/calibracao-matcher.md §5)."
  - "v0.2.0 (2026-05-28): após audit cruzado, alinha input (§3.1) ao schema real do output da 002 — renomeia `source` → `source_key`; documenta os campos propagados intactos (source_domain, language, content_type, image_candidates, relevance_hint) vs os usados no scoring. No output (§4), renomeia `topic_hash` → `topic_hash_matcher` (deixa claro que é title-based, distinto do headline-based no brief) e adiciona `source_relevance_hints[]` (derivado do `match_score_breakdown`) — alinha ao input esperado pelo briefer (004 §3)."
  - "v0.1.0 (2026-05-27): primeira versão; cobre §5 (algoritmo de breakdown), §7 (5 exemplos calibrados), §8 (anti-repetição) e §11 (resolve threshold §11.I = 0.55)."
---

# Spec 003 — Subagente `avanz-matcher`

> Detalhamento do **estágio (2)** do pipeline definido na
> [`001-foundation.md`](./001-foundation.md). Esta spec **resolve §11.I**
> (threshold de `match_score`) e fecha o contrato de `match_score_breakdown`
> esboçado em §6.1 da foundation.

## 1. Objetivo

O `avanz-matcher` é o **filtro de pertinência editorial** do radar. Recebe uma
lista bruta de findings do `market-researcher` e, para cada finding, decide:

1. A que **pilar** Avanz pertence (1, 2, 3, 5, 6 — pilar 4 está fora do
   escopo do radar, ver §9 deste documento).
2. A que **ICP** fala (`comprador` / `investidor` / `proprietario` /
   `null` quando não-pessoal).
3. Que **score de match** (0..1) sintetiza 5 dimensões avaliadas
   independentemente (§5).
4. Que **decisão final** tomar: `promote-to-brief` (score ≥ 0.55),
   `promote-borderline` (0.48 ≤ score < 0.55, sem cap — vira brief marcado
   `borderline: true` pro humano decidir; §5.7.1, calibração §11.V),
   `skip-redundant` (anti-repetição), `skip-low-score` (abaixo de 0.48),
   `skip-out-of-scope` (geografia/foco editorial inviável — cap acionado).

Esta spec resolve **§11.I** da foundation (threshold) fixando-o em
**`0.55`** após o exercício de calibração com 5 exemplos reais em §7. Saída
do matcher alimenta diretamente o `instagram-briefer` (estágio 4 — sem
planner no primeiro slice).

## 2. Ferramentas e modelo

| Item | Valor | Justificativa |
|---|---|---|
| **Modelo** | `claude-sonnet-4-6` | Decisão §11.A da foundation. Matcher faz raciocínio classificatório repetitivo sobre N findings (alvo: 10/semana × 5 escopos = ~50/scan). Opus é overkill aqui; Sonnet 4.6 chega no patamar de qualidade exigido com 1/5 do custo. Briefer continua Opus pois faz síntese criativa de copy/visual. |
| **Tools** | `Read` | Único acesso a FS necessário — ler o vault Avanz (lista do §3) e os 4 diretórios de `store/briefs/` (anti-repetição §8). Matcher **não escreve**; saída vem como JSON no payload de resposta pro orquestrador (`radar-scan`) persistir. |
| **Sem WebSearch/WebFetch** | — | Findings já vêm com `summary`, `title`, `published_at` resolvidos pelo researcher (spec 001 §6.1). Matcher trabalha apenas em cima do que recebeu — qualquer ida à web aqui é signal de bug do researcher. |
| **Sem Write/Bash** | — | Isola o matcher de side-effects; orquestrador é responsável por persistência. Facilita testar o subagente isoladamente (replay determinístico). |

## 3. Input contract

### 3.1 Findings (vindos do `market-researcher`, schema completo em [spec 002 §4](./002-researcher.md#4-output-contract))

```json
{
  "scope": "trends" | "competitors" | "seasonal" | "cases" | "local",
  "scan_id": "2026-W22-scan-001",
  "findings": [
    {
      "finding_id": "f_001",
      "url": "https://fipezap.org.br/.../q1-2026",
      "title": "FipeZap Q1/2026: lotes em RMBH valorizam 8.4%",
      "summary": "Relatório trimestral mostra que terrenos na região metropolitana de Belo Horizonte tiveram alta de 8.4%, lideradas por Mateus Leme (+11.2%) e Esmeraldas (+9.1%).",
      "source_key": "fipezap",
      "source_domain": "fipezap.org.br",
      "scope": "trends",
      "language": "pt-BR",
      "content_type": "data-page",
      "published_at": "2026-05-22T00:00:00-03:00",
      "fetched_at": "2026-05-27T09:14:00-03:00",
      "image_candidates": [
        {"url": "https://fipezap.org.br/og.jpg", "alt": "Gráfico FipeZap Q1/2026"}
      ],
      "geo_hints": ["RMBH", "Mateus Leme", "Esmeraldas"],
      "raw_excerpts": [
        "Lotes em RMBH valorizaram 8.4% no Q1 2026...",
        "Mateus Leme lidera com alta de 11.2%."
      ],
      "relevance_hint": "Foco em lotes em RMBH bate direto com `mercado-rmbh` + foco editorial Avanz."
    }
  ]
}
```

**Campos que o matcher usa diretamente** no scoring: `title`, `summary`,
`source_key`, `published_at`, `geo_hints`, `raw_excerpts`. Os demais
(`source_domain`, `language`, `content_type`, `image_candidates`,
`relevance_hint`) são **propagados intactos** ao briefer (estágio 4)
via `finding` em [§4 output](#4-output-contract) — o matcher não decide
com base neles, mas o briefer pode usar (ex.: `image_candidates` viram
hero, `language ≠ pt-BR` orienta tradução do excerpt).

### 3.2 Vault Avanz (sempre carregar)

Lista vem de `manifest.yaml#target_company.always_load`:

- `/srv/my-mind/Empresas/avanz-imoveis/manifest.yaml`
  (lê `strategy.foco_principal`, `strategy.excecao_casas`,
  `strategy.destaque_home_criterios`, `ai_context.por_tarefa`)
- `/srv/my-mind/Empresas/avanz-imoveis/identity/brand.md`
- `/srv/my-mind/Empresas/avanz-imoveis/strategy/positioning.md`
- `/srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md`
- `/srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md`
- `/srv/my-mind/Empresas/avanz-imoveis/prompts/icp-modifiers.json`
- `/srv/my-mind/Empresas/avanz-imoveis/ops/guardrails.md`

### 3.3 Anti-repetição (consulta antes do scoring — §8)

- `store/briefs/pendente-aprovacao/*.md`
- `store/briefs/pendente-publicacao/*.md`
- `store/briefs/publicado/*.md`
- `store/briefs/rejeitado/*.md`

O matcher só lê frontmatter (`source_urls`, `topic_hash`, `pillar`, `icp`,
`created_at`, `published_at`) — não precisa do corpo do `.md`.

## 4. Output contract

```json
{
  "scan_id": "2026-W22-scan-001",
  "ranked": [
    {
      "finding": { "...original do researcher, intacto..." },
      "pillar": "mercado-rmbh",
      "icp": "investidor",
      "match_score": 0.82,
      "match_score_breakdown": {
        "pillar_fit": 0.90,
        "icp_fit": 0.80,
        "foco_editorial_fit": 0.85,
        "geografia_fit": 0.95,
        "freshness": 0.70
      },
      "why_match": "Relatório FipeZap sobre valorização de LOTES (foco_principal Avanz) em RMBH (Mateus Leme, Esmeraldas — área de atuação direta). Dado numérico fechado bate com tone_overlay.investidor (analítico, dado-suportado, comparativo).",
      "source_relevance_hints": [
        {"component": "pillar_fit", "evidence": "headline menciona explicitamente RMBH e valorização — bate `mercado-rmbh`"},
        {"component": "foco_editorial_fit", "evidence": "fonte trata de lote (não casa pronta) — alinha foco declarado"},
        {"component": "geografia_fit", "evidence": "Mateus Leme + Esmeraldas em geo_hints — núcleo RMBH"}
      ],
      "topic_hash_matcher": "7e3b4c2a1f9d8e0c5b3a2f1e0d9c8b7a6f5e4d3c",
      "redundant": false,
      "decision": "promote-to-brief",
      "decision_reason": "score >= threshold (0.55) e não-redundante."
      // decision ∈ {promote-to-brief, promote-borderline, skip-redundant,
      //             skip-low-score, skip-out-of-scope} — promote-borderline
      //             adicionado na calibração §11.V (0.48 ≤ score < 0.55, sem cap)
    }
  ],
  "meta": {
    "scan_id": "2026-W22-scan-001",
    "total_in": 14,
    "total_promoted": 5,
    "skipped": {
      "redundant": 3,
      "low_score": 4,
      "out_of_scope": 2
    },
    "threshold_used": 0.55,
    "weights_used": {
      "pillar_fit": 0.30,
      "icp_fit": 0.15,
      "foco_editorial_fit": 0.25,
      "geografia_fit": 0.20,
      "freshness": 0.10
    }
  }
}
```

**Notas:**
- Todos os findings da entrada aparecem em `ranked[]` (nenhum é silenciado
  na saída) — orquestrador é quem decide o que vira brief, baseado em
  `decision`. Isso facilita debug e ledger.
- `redundant: true` **implica** `decision: "skip-redundant"` (§8).
- Quando `decision != "promote-to-brief"`, o orquestrador grava evento no
  ledger e descarta sem gerar `.md` — exceto `skip-redundant` que é
  silencioso (§11.J da foundation).
- **`topic_hash_matcher` é title-based** (SHA1 do `finding.title` normalizado)
  — proxy barato pra anti-rep do estágio 2. Distinto do `topic_hash` no
  brief renderizado (spec 004 §9.5), que é **headline-based** (SHA1 da
  headline final). O briefer vai recomputar o hash com a headline.
- **`source_relevance_hints[]` é derivado** dos componentes do
  `match_score_breakdown` — não substitui o breakdown, complementa com
  evidências textuais por componente. O briefer (004 §3) propaga intacto
  pro `source_relevance_hints` do brief (001 §6.1 v0.5.0).

## 5. Algoritmo de `match_score_breakdown` — núcleo da spec

Cada dimensão é avaliada de forma **independente** em [0..1] e justificada
no `why_match`. As 5 dimensões e seus pesos finais:

| Dimensão | Peso | O que mede |
|---|---|---|
| `pillar_fit` | **0.30** | Quão claramente o finding mapeia pra um pilar editorial Avanz (1, 2, 3, 5, 6) |
| `icp_fit` | **0.15** | Quão claramente fala pra um ICP (`comprador`/`investidor`/`proprietario`) |
| `foco_editorial_fit` | **0.25** | Alinha com `foco_principal` da Avanz (lotes/sítios/chácaras) — penaliza casas prontas (exceto MCMV) |
| `geografia_fit` | **0.20** | RMBH em foco; resto do Brasil pesa menos; exterior penaliza forte |
| `freshness` | **0.10** | Decay por dias desde `published_at` |

**Soma dos pesos = 1.0.** Justificativa dos pesos abaixo de cada dimensão.

---

### 5.1 `pillar_fit` (peso 0.30)

**O que mede:** quão inequivocamente o finding cabe num pilar editorial
Avanz. Decisor principal: `title` + `summary`. Comparar com a tese e
estrutura de cada pilar em
[`content-pillars.md`](/srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md).

**Regras de pontuação:**

| Score | Critério |
|---|---|
| **0.95–1.00** | Finding é praticamente uma pauta pré-cozida — encaixe perfeito em 1 pilar, com gancho concreto (notícia + dado + implicação). Ex.: relatório FipeZap RMBH → `mercado-rmbh` direto. |
| **0.75–0.94** | Encaixa bem em 1 pilar, exige só rework editorial — ex.: artigo educacional Caixa sobre MCMV → `decisao-inteligente` (Decisão Inteligente). |
| **0.55–0.74** | Encaixa em 1 pilar, mas tema lateral — gancho exige bastante reframing. Ex.: notícia genérica sobre Selic → `decisao-inteligente` só se reframear pro impacto no financiamento. |
| **0.30–0.54** | Ambíguo entre 2 pilares ou tema "tangencia" os pilares Avanz — desempate via §9 (gotcha #1). |
| **0.00–0.29** | Nenhum pilar comporta — ex.: notícia sobre IPO de construtora SP, sem relação com curadoria RMBH; ou conteúdo genérico de "como ser feliz na casa nova". |

**Pesos no agregado: 0.30** — é o maior porque `pillar_fit` é o filtro
estrutural (sem pilar, não tem onde alocar no calendário; vira ruído).

**Edge cases:**
- **Cabe em 2 pilares** → escolher o de maior `pillar_fit`; empate vai pro
  pilar com **maior `cadence.pillars_by_day_base` underfill** na semana
  corrente (consultar `manifest.yaml#cadence`). Default: `imovel-da-semana`.
- **`bastidor` detectado** → forçar `pillar_fit = 0` e
  `decision = "skip-out-of-scope"` (§9 gotcha #6).
- **`quem-comprou` (Quem comprou)** → matcher quase nunca promove pra esse pilar,
  porque depoimento real exige consentimento e dados internos que o
  researcher web não tem. Se `pillar_fit` empata em 5, descer pra `imovel-da-semana`
  ou `decisao-inteligente`.

---

### 5.2 `icp_fit` (peso 0.15)

**O que mede:** quão claramente o finding fala pra um ICP específico,
seguindo overlays em
[`icp-modifiers.json`](/srv/my-mind/Empresas/avanz-imoveis/prompts/icp-modifiers.json).

**Regras de pontuação:**

| Score | Critério |
|---|---|
| **0.90–1.00** | Finding usa keywords/dores exatas do ICP — ex.: dado de valorização e ROI → `investidor`; "primeiro imóvel + sair do aluguel" → `comprador`; "plano de venda + posicionamento" → `proprietario`. |
| **0.70–0.89** | ICP claro, mas finding cobre só uma sub-dor (ex.: artigo sobre documentação de terreno serve `comprador` mas só na dor "documentação ok"). |
| **0.50–0.69** | ICP plausível mas mistura sinais (ex.: notícia que serve `comprador` e `investidor` igualmente — caso pra default `comprador`). |
| **0.30–0.49** | ICP ambíguo — default `comprador` aplicado com penalidade moderada (cap em 0.45 quando default acionado por ambiguidade). |
| **0.00–0.29** | Conteúdo institucional ou puramente macro (ex.: política monetária) sem ICP identificável — `icp = null`, score baixo. |

**Default ICP = `comprador`** quando ambíguo (decisão owner 2026-05-03,
registrada em
[`icp-modifiers.json#usage_notes[1]`](/srv/my-mind/Empresas/avanz-imoveis/prompts/icp-modifiers.json)).
Quando default acionado, score **capado em 0.45** (sinaliza pro briefer
que o ICP é fraco — pode pedir clarificação humana).

**Pesos no agregado: 0.15** — é o **menor** porque ICP é facilmente
reajustável no briefing (`instagram-briefer` pode reescrever caption pra
outro ICP sem refazer pauta), enquanto pilar/foco editorial são
estruturais. Mesmo um `icp_fit = 0.3` (ambíguo) não derruba um finding
que tem `pillar_fit = 0.95`.

**Edge cases:**
- **Conteúdo B2B/institucional** (ex.: lançamento de loteamento por outra
  imobiliária) → `icp = null`, `icp_fit = 0.30` (não penaliza brutalmente —
  pode virar `inteligencia-imobiliaria` ou 6 sem ICP-foco).
- **Tom inadequado pro ICP detectado** (ex.: "compre antes que acabe!"
  pra `proprietario`, cujo overlay diz `avoid: "urgência fabricada"`) →
  cap em 0.50 e flagar no `why_match`.

---

### 5.3 `foco_editorial_fit` (peso 0.25)

**O que mede:** alinhamento com `strategy.foco_principal` da Avanz
(`"lotes, sítios, chácaras"`) e respeito à `strategy.excecao_casas`
(`"Minha Casa Minha Vida — aceito mas exige simulação Caixa antes"`).
Esse é o **filtro de produto** — protege o radar de virar feed genérico
de "mercado imobiliário".

**Regras de pontuação:**

| Score | Critério |
|---|---|
| **0.95–1.00** | Lote / sítio / chácara / loteamento — direto no carro-chefe. Ex.: "valorização de lotes RMBH". |
| **0.75–0.94** | Adjacente — terra/financiamento de terreno/zoneamento/topografia. Ex.: "novo zoneamento permite loteamento em Esmeraldas". |
| **0.50–0.74** | MCMV (casa) **com** ângulo de simulação Caixa / poder de compra. Ex.: "novo teto MCMV 2026 + simulador Caixa atualizado". |
| **0.30–0.49** | Conteúdo genérico de imóvel residencial (apto, casa pronta de médio padrão) — Avanz não foca. Cap em 0.40 pra empurrar pra `skip-low-score`. |
| **0.10–0.29** | Casa de alto padrão / apartamento de luxo / mansão — explicitamente fora do foco. |
| **0.00–0.09** | Comercial / industrial / imóvel rural produtivo (fazendas grandes) / hotelaria — não-Avanz. |

**Pesos no agregado: 0.25** — alto porque ignorar foco editorial é o
modo de falha mais visível pro owner ("por que vocês estão me sugerindo
post sobre cobertura de luxo em SP?"). Junto com `pillar_fit`, soma 0.55
— acima do threshold sozinho, então um finding precisa de pelo menos
mais 1 dimensão decente pra passar.

**Edge cases:**
- **MCMV sem menção a simulação Caixa** → score 0.40–0.55 (passa borderline;
  briefer DEVE adicionar o gancho "antes de visitar, simule no Caixa" pra
  bater com `excecao_casas`).
- **Lote em região fora RMBH** (ex.: "loteamento na Grande SP") → `foco`
  alto (0.95) mas `geografia` baixa — o agregado decide; geralmente
  out-of-scope.
- **Conteúdo educacional sobre processo de compra sem produto específico**
  (ex.: "como funciona escritura") → 0.60 (assume aderência a `decisao-inteligente` com
  qualquer produto).

---

### 5.4 `geografia_fit` (peso 0.20)

**O que mede:** aderência geográfica ao perímetro de atuação Avanz. Lista
canônica de bairros em
[`positioning.md`](/srv/my-mind/Empresas/avanz-imoveis/strategy/positioning.md#área-de-atuação):
**Mateus Leme, Esmeraldas, Ribeirão das Neves, Juatuba, Jaboticatubas,
Caetanópolis**. RMBH ampla (incluindo Belo Horizonte, Contagem, Betim,
Sabará) entra como "raio operacional".

**Regras de pontuação:**

| Score | Critério |
|---|---|
| **0.95–1.00** | Cita explicitamente cidade da lista canônica (Mateus Leme, Esmeraldas, Ribeirão das Neves, Juatuba, Jaboticatubas, Caetanópolis). |
| **0.80–0.94** | RMBH ampla (BH, Contagem, Betim, Sabará, Nova Lima, Lagoa Santa, Vespasiano, Pedro Leopoldo, Santa Luzia, Ibirité). |
| **0.60–0.79** | Minas Gerais em geral (interior MG, Triângulo, Sul de Minas) — aplicável por proximidade/comparativo. |
| **0.40–0.59** | Brasil — dado nacional aplicável à RMBH com reframing (ex.: índice IGP-M, taxa Selic, Caixa nacional). |
| **0.20–0.39** | Outro estado brasileiro (SP, RJ, Sul) — só vira pauta se tem implicação clara pra RMBH (raro). |
| **0.00–0.19** | Exterior / não-Brasil — penaliza forte. |

**Pesos no agregado: 0.20** — segundo maior depois de `pillar_fit` e
`foco_editorial_fit`, porque audiência Avanz é hiperlocal
([content-pillars.md§Pilar-6](/srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md#pilar-6--mercado-rmbh):
"quem está em Mateus Leme/Esmeraldas/Juatuba **lê notícia local**").

**Edge cases:**
- **Geografia ausente** (notícia macro de Brasil sem ancoragem em região)
  → 0.40 default (espaço pra `decisao-inteligente` educacional reformatar).
- **Macro nacional REANCORÁVEL** (calibração §11.V — piso
  `geografia_reframe_floor = 0.50`): dado nacional imobiliário com implicação
  clara pra RMBH — financiamento (SBPE, taxa Caixa), índices de mercado
  (FipeZap/CBIC nacional), intenção de compra, política MCMV/Caixa — recebe
  `geografia_fit >= 0.50` (em vez do 0.40 de "Brasil amplo"). Justificativa:
  é exatamente o conteúdo que o briefer reancora via gotcha #3, e o diagnóstico
  (docs/calibracao-matcher.md §1.3) mostrou macro bom morrendo em geo antes de
  chegar ao briefer. **Não se aplica** a exterior nem a outro estado sem ponte
  RMBH (SP/RJ/Sul seguem a escala 0.20–0.39). O cap `foco_and_geo_combined_min`
  continua valendo por cima.
- **Múltiplas geografias** com pelo menos uma RMBH → usar a maior.
- **Geografia errada mas tema universal** (ex.: "Como evitar fraude em
  compra de terreno em SP") → cap em 0.55 (tema OK, geografia incidental,
  briefer reframe pra "...em Mateus Leme").

---

### 5.5 `freshness` (peso 0.10)

**O que mede:** quão recente é o conteúdo. Notícia velha (mesmo que
relevante) tem chance baixa de gerar engajamento orgânico no IG; pauta
educacional aguenta mais tempo.

**Função decay (exponencial simples):**

```
days = (now - published_at).days  // se published_at null → 30
freshness = exp(-days / TAU)
```

Com `TAU = 30` (meia-vida ~21 dias). Tabela de referência:

| Dias desde publicação | `freshness` |
|---|---|
| 0 (hoje) | 1.00 |
| 3 | 0.90 |
| 7 | 0.79 |
| 14 | 0.63 |
| 21 | 0.50 |
| 30 | 0.37 |
| 60 | 0.14 |
| 90+ | 0.05 |

**Justificativa do TAU=30:**
- IG hoje recompensa frescor: notícia de 7 dias ainda vira post relevante
  (0.79); de 30 dias precisa de boa razão (0.37).
- Pauta educacional (`decisao-inteligente`) — `freshness` baixo (~0.5) é OK porque
  contribuição da dimensão é só 10% do agregado; outros pesos compensam.
- Decisão é não-binária: nada é descartado **só** por freshness.

**Pesos no agregado: 0.10** — o **menor** porque pauta atemporal
(educação, depoimento, análise de mercado de longo prazo) deve poder
passar mesmo com `freshness` baixo. Quando `freshness < 0.3`, exigir
gancho explícito no `why_match` ("este dado de Q4/2025 ainda vale porque
a tendência se confirmou em Q1/2026").

**Edge cases:**
- **`published_at` ausente** → assumir 30 dias (`freshness = 0.37`).
- **Conteúdo perene** (página estática de "como funciona financiamento")
  → matcher detecta via heurística (URL com `/guia/`, `/como/`, `/o-que-e/`)
  e seta `freshness = 0.60` (não decay, mas também não premium).
- **Notícia futura** (`published_at > now`, ex.: matéria com data errada
  ou evento sazonal antecipado) → cap em `freshness = 1.0`.

---

### 5.6 Fórmula de agregação

**Weighted sum** (linear):

```
match_score =
    0.30 * pillar_fit
  + 0.15 * icp_fit
  + 0.25 * foco_editorial_fit
  + 0.20 * geografia_fit
  + 0.10 * freshness
```

**Por que weighted sum (e não, p.ex., min ou produto):**
- **Interpretável** — owner consegue ler o breakdown e bater com o
  agregado (auditável).
- **Tolera ICP fraco** — `icp_fit = 0.3` (default `comprador`) não derruba
  finding que é fortíssimo em pilar/foco/geo; produto/min derrubaria.
- **Não tolera ausência total de aderência** — soma `pillar_fit` +
  `foco_editorial_fit` (0.55 dos pesos) representa o filtro estrutural;
  se ambos forem ~0.2, agregado ~0.11 — já fica abaixo do threshold sem
  precisar de regra extra.

**Cap explícito:**
- Se `pillar_fit < 0.30` → `decision = "skip-out-of-scope"` independente
  do agregado. Sem pilar não há onde alocar no calendário Avanz.
- Se `foco_editorial_fit < 0.20` E `geografia_fit < 0.50` →
  `decision = "skip-out-of-scope"`. Combinação "produto errado + região
  errada" não vale reformatar.

### 5.7 Threshold escolhido — **`0.55`** (resolve §11.I)

**Defesa:**

1. **Comportamento nos exemplos de calibração (§7):**
   - 2 promote estrelados ficam acima de 0.75 (folga confortável).
   - 1 promote borderline (~0.62) passa com margem pequena — saudável,
     porque sinaliza ao briefer "investir mais em headline".
   - 1 skip-low-score em ~0.43 — abaixo do threshold mesmo com aderência
     parcial.
   - 1 skip-out-of-scope barrado por cap (§5.6) antes do threshold importar.

2. **Trade-off precision vs recall:**
   - Mais alto (0.65): perderíamos pautas `decisao-inteligente` educacionais com
     `freshness` ruim mas conteúdo bom; menos volume.
   - Mais baixo (0.45): briefer perderia tempo refinando pautas que o
     editor humano vai reprovar (lixo entra no funil).
   - 0.55 é o meio-termo que respeita o alvo de
     `funnel.candidates_per_week_target: 10` da
     [`manifest.yaml`](../../manifest.yaml). Com taxa de scan de
     ~50 findings/semana × ~35% passando = ~17/semana — folga sobre o
     alvo de 10 (absorve reprovação humana).

3. **Expectativa de volume calibrada:**
   - O alvo é geração de **10/semana** (não publicação — §11.H da
     foundation). Threshold mais permissivo enche `pendente-aprovacao/`
     e onera revisão humana; mais restritivo arrisca scan retornar
     vazio em semanas com baixa notícia local.

4. **Revisão prevista:** após 2 ciclos completos (4 semanas) com
   `radar-scan` operacional, comparar `meta.total_promoted` vs aprovações
   reais do editor. Se taxa de aprovação humana > 80% → ok; se < 50% →
   subir threshold pra 0.60; se editor reclamar de vazio → descer pra 0.50.

### 5.7.1 Tier `promote-borderline` — calibração anti-escassez (resolve §11.V)

**Contexto:** o diagnóstico em [`docs/calibracao-matcher.md`](../calibracao-matcher.md)
mostrou que ~11 dos 22 `skip-low-score` observados caíam na faixa **0.45–0.549**
— metade da maior perda do funil a menos de 0.10 do corte, morrendo
predominantemente em `geografia_fit` (dado nacional bom sem cidade-foco).
Baixar o threshold cego (0.55 → 0.50) recuperaria volume mas deixaria passar
itens fracos sem gate. A solução preserva o threshold e **delega a decisão
marginal ao humano**, coerente com §11.H da foundation ("gerar 10, humano
aprova 4–7 — o editor é o portão de qualidade").

**Regra:**

| Faixa de `match_score` | Cap acionado? | `decision` | Vira brief? |
|---|---|---|---|
| `>= 0.55` | não | `promote-to-brief` | sim (`borderline: false`) |
| `[0.48, 0.55)` | **não** | `promote-borderline` | sim (`borderline: true`) |
| `[0.48, 0.55)` | **sim** | `skip-out-of-scope` | não (cap manda) |
| `< 0.48` | não | `skip-low-score` | não |

- `borderline_min = 0.48` é config em
  [`manifest.yaml#anti_repetition.borderline_min`](../../manifest.yaml).
- `promote-borderline` segue **todo** o resto do fluxo de um promote: vai pro
  briefer, baixa mídia, materializa `.md` em `pendente-aprovacao/`. A única
  diferença é o frontmatter `borderline: true` + `borderline_reason` (qual
  dimensão segurou o score), carimbado pelo orquestrador (spec 005).
- **Caps têm precedência absoluta**: um finding fora de foco/geografia (cap
  `pillar_fit_min` ou `foco_and_geo_combined_min`) **nunca** vira borderline —
  continua `skip-out-of-scope`. O tier só reabre a faixa que morria por
  agregação, não a que morria por cap. Qualidade estrutural preservada.
- **Anti-repetição tem precedência**: redundante → `skip-redundant`, nunca
  borderline.

**Medição (2 ciclos / ~4 semanas):** separar no ledger a taxa de aprovação
humana de `promote-to-brief` (esperado manter ~67%) vs `promote-borderline`
(esperado 40–55% — a reprovação aqui é o filtro humano funcionando). Se a
aprovação do tier pleno cair, o problema não é o borderline. Critérios
completos em [`docs/calibracao-matcher.md`](../calibracao-matcher.md) §5.

## 6. Prompt do subagente — `.claude/agents/avanz-matcher.md`

> Texto literal (já formatado em frontmatter + markdown) que vai pro
> arquivo `.claude/agents/avanz-matcher.md` na implementação (spec 005).

```markdown
---
name: avanz-matcher
description: |
  Filtra e enriquece findings do market-researcher, classificando cada um por pilar editorial Avanz, ICP e
  pontuando match com a estratégia (pillar/icp/foco/geografia/freshness). Decide entre promover pra brief,
  pular por redundância, baixo score ou fora de escopo. Sempre justifica com evidência textual do finding.
tools: [Read]
model: claude-sonnet-4-6
---

# Você é o avanz-matcher

Persona: **editor sênior de conteúdo da Avanz Imóveis**, com 5+ anos curando pautas pro Instagram
da empresa. Você conhece de cor:

- Foco editorial: **lotes, sítios, chácaras na RMBH**. Casas prontas só se for MCMV com gancho de
  simulação Caixa (decisão owner 2026-05-03).
- 6 pilares editoriais (mas só promova pros pilares 1, 2, 3, 5, 6 — pilar 4 Bastidor está fora do
  escopo do radar; ver `CLAUDE.md` do content-radar).
- 3 ICPs com overlays (comprador, investidor, proprietario) em `prompts/icp-modifiers.json`.
- Default ICP = `comprador` quando ambíguo (decisão owner 2026-05-03).
- Anti-repetição: pauta com `topic_hash` igual nos últimos 90 dias em `publicado/`, ou 30 dias em
  `rejeitado/`, ou qualquer hit em `pendente-*` → pular silenciosamente.

## Antes de começar

Carregue (via Read):
1. `/srv/apps/content-radar/manifest.yaml`
2. `/srv/my-mind/Empresas/avanz-imoveis/manifest.yaml`
3. `/srv/my-mind/Empresas/avanz-imoveis/identity/brand.md`
4. `/srv/my-mind/Empresas/avanz-imoveis/strategy/positioning.md`
5. `/srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md`
6. `/srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md`
7. `/srv/my-mind/Empresas/avanz-imoveis/prompts/icp-modifiers.json`
8. `/srv/my-mind/Empresas/avanz-imoveis/ops/guardrails.md`
9. Frontmatters de `/srv/apps/content-radar/store/briefs/{pendente-aprovacao,pendente-publicacao,publicado,rejeitado}/*.md`
   (extraia `source_urls`, `topic_hash`, `pillar`, `icp`, `created_at`, `published_at`)

## Para cada finding recebido

1. **Anti-repetição primeiro**: compute `topic_hash = sha1(headline normalizada)` (lowercase, sem
   stopwords PT-BR, sem pontuação, primeiros 200 chars). Compare com store/briefs/* dentro das
   janelas (90d publicado, 30d rejeitado, qualquer hit em pendente-*). Match → `redundant: true`,
   `decision: "skip-redundant"`, score 0. Não avalie mais nada.

2. **Score por dimensão** [0..1] independentemente, seguindo §5 da spec 003:
   - `pillar_fit` (decisor: title + summary)
   - `icp_fit` (default comprador, cap 0.45 quando ambíguo)
   - `foco_editorial_fit` (lotes/sítios/chácaras = alto; casa pronta = baixo; MCMV+Caixa = médio)
   - `geografia_fit` (lista canônica RMBH no positioning.md; piso reancorável 0.50 pra macro
     nacional com implicação RMBH — calibração §11.V / §5.4)
   - `freshness` (exp decay TAU=30 a partir de published_at; ausente → 30 dias default)

3. **Caps obrigatórios**:
   - `pillar_fit < 0.30` → `decision = "skip-out-of-scope"`
   - `foco_editorial_fit < 0.20` AND `geografia_fit < 0.50` → `decision = "skip-out-of-scope"`
   - Finding mapeia pra `bastidor` → `pillar_fit = 0`, `decision = "skip-out-of-scope"`

4. **Agregação** (weighted sum):
   `match_score = 0.30*pillar_fit + 0.15*icp_fit + 0.25*foco_editorial_fit + 0.20*geografia_fit + 0.10*freshness`

5. **Decisão final** (tier borderline — calibração §11.V / §5.7.1):
   - `match_score >= 0.55` E não-redundante → `promote-to-brief`
   - `0.48 <= match_score < 0.55` E sem cap E não-redundante → `promote-borderline`
   - `match_score < 0.48` (sem cap acionado) → `skip-low-score`

6. **`why_match`**: 1–3 frases citando evidência **textual** do finding (trecho de `summary` ou
   `title`) que justifica o score. Nunca invente. Se a evidência não estiver no finding, baixe
   o score correspondente.

## Regras invioláveis

- **Nunca invente fato** que não esteja em `title`, `summary`, `raw_excerpts` ou `geo_hints`.
- **Sempre cite trecho** ao justificar — `why_match` deve referenciar texto do finding.
- **`bastidor` nunca** sai do matcher como promote (`promote-to-brief` nem `promote-borderline`; ver CLAUDE.md).
- **`decision` ∈** `{promote-to-brief, promote-borderline, skip-redundant, skip-low-score, skip-out-of-scope}`.
- **Default ICP = comprador** quando ambíguo (cap 0.45 no icp_fit).
- **Saída JSON estrita** no schema do §4 da spec 003. Sem markdown ao redor, sem comentários YAML.
- **Foco editorial declarado**: lotes/sítios/chácaras > MCMV-com-simulação > outros.
- **Persona = editor Avanz**: priorize coerência editorial sobre "fofura" ou "viralidade".
```

> **Nota (v0.3.0):** o arquivo `.claude/agents/avanz-matcher.md` é a fonte
> canônica do prompt em produção; este bloco §6 é o espelho documental. A
> calibração §11.V já está aplicada em ambos. Ao editar o agente, reflita aqui.

## 7. Calibração com exemplos reais

Aplicação do algoritmo §5 + threshold 0.55 a 5 findings plausíveis. Misturei
casos reais (URLs verificáveis) com 1 simulado pra cobrir anti-repetição.

### Exemplo 1 — PROMOTE estrelado (`mercado-rmbh`)

| Campo | Valor |
|---|---|
| URL | https://fipezap.org.br/relatorios/comerciais-residencial/ (FipeZap, relatório trimestral oficial) |
| Título | "FipeZap Comercial — Belo Horizonte Q1/2026: terrenos lideram com +8.4%" |
| Resumo | "Análise trimestral mostra valorização de 8.4% em lotes na RMBH; Mateus Leme +11.2%, Esmeraldas +9.1%, BH capital +6.3%. Tendência de movimento técnico de investidor." |
| `published_at` | 5 dias atrás |

**Scores:**
| Dimensão | Score | Por quê |
|---|---|---|
| `pillar_fit` | 0.95 | Mapeia direto em `mercado-rmbh` (Mercado RMBH) — fato + análise + implicação. |
| `icp_fit` | 0.85 | Linguagem analítica, dados fechados → `investidor` (overlay direto). |
| `foco_editorial_fit` | 0.95 | "lotes" + "terrenos" = carro-chefe Avanz. |
| `geografia_fit` | 0.98 | Cita Mateus Leme + Esmeraldas (lista canônica) + BH (RMBH). |
| `freshness` | 0.85 | 5 dias → exp(-5/30) = 0.85. |

**Agregado:** `0.30×0.95 + 0.15×0.85 + 0.25×0.95 + 0.20×0.98 + 0.10×0.85 = **0.916**`
**Decision:** `promote-to-brief`. Justificativa: muito acima do threshold,
sem cap acionado. Pauta-estrela; briefer recebe com `pillar: mercado-rmbh`,
`icp: investidor`.

---

### Exemplo 2 — PROMOTE borderline (`decisao-inteligente`)

| Campo | Valor |
|---|---|
| URL | https://www.caixa.gov.br/voce/habitacao/minha-casa-minha-vida/ (Caixa, página oficial MCMV) |
| Título | "Minha Casa Minha Vida 2026: novos tetos e simulador atualizado" |
| Resumo | "Caixa atualiza limites do MCMV em maio/2026; faixa 1 vai a R$ X, faixa 2 a R$ Y. Simulador online permite checar elegibilidade antes de buscar imóvel." |
| `published_at` | 22 dias atrás |

**Scores:**
| Dimensão | Score | Por quê |
|---|---|---|
| `pillar_fit` | 0.78 | `decisao-inteligente` (Decisão Inteligente) — encaixa em "5 perguntas antes de assinar contrato" / educacional. |
| `icp_fit` | 0.75 | `comprador` (primeiro imóvel, sair do aluguel). |
| `foco_editorial_fit` | 0.62 | MCMV (casa) — passa pela `excecao_casas` SÓ porque tem simulador Caixa explícito. Sem o simulador, cairia pra 0.40. |
| `geografia_fit` | 0.55 | Caixa Brasil (escopo nacional) — reframable pra RMBH no briefer. |
| `freshness` | 0.48 | 22 dias → exp(-22/30) = 0.48. |

**Agregado:** `0.30×0.78 + 0.15×0.75 + 0.25×0.62 + 0.20×0.55 + 0.10×0.48 = **0.660**`
**Decision:** `promote-to-brief`. Justificativa: passa por margem confortável;
briefer deve adicionar gancho "simule no Caixa antes de visitar" (alinha
`excecao_casas`). ICP `comprador` claro.

---

### Exemplo 3 — SKIP-REDUNDANT (simulado)

| Campo | Valor |
|---|---|
| URL | https://valor.globo.com/financas/noticia/2026/05/15/fipezap-rmbh-lotes-q1-2026.ghtml (Valor, repercussão do mesmo relatório do exemplo 1) |
| Título | "Valor repercute: lotes RMBH valorizam 8.4% no Q1/2026" |
| Resumo | "Reportagem do Valor reproduz dados FipeZap Q1/2026 sobre lotes em Mateus Leme (+11.2%) e Esmeraldas (+9.1%)." |
| `published_at` | 3 dias atrás |

**Anti-repetição:**
- `topic_hash` calculado bate com brief já gerado pelo exemplo 1 (mesma
  headline normalizada).
- Brief do exemplo 1 está em `pendente-aprovacao/` → hit em `in_flight_check: all`.

**Resultado:** `redundant: true`, `decision: "skip-redundant"`, `match_score = 0`.
Scoring nem é calculado. Log silencioso no ledger (§11.J da foundation).

---

### Exemplo 4 — SKIP-LOW-SCORE

| Campo | Valor |
|---|---|
| URL | https://exame.com/invest/financas-pessoais/feng-shui-sala-casa-sucesso/ (Exame, artigo lifestyle) |
| Título | "Feng shui na sala: 7 dicas pra atrair sucesso e dinheiro pra casa" |
| Resumo | "Especialista em feng shui ensina arranjo de móveis e cores que segundo a filosofia chinesa atraem prosperidade." |
| `published_at` | 12 dias atrás |

**Scores:**
| Dimensão | Score | Por quê |
|---|---|---|
| `pillar_fit` | 0.32 | Tangencia `decisao-inteligente` mas é o exato tipo de conteúdo excluído ("dica de feng shui" listada em `content-pillars.md#O-que-NÃO-entra`). |
| `icp_fit` | 0.40 | Vagamente `comprador` (família) — ambíguo, default aplicado, cap 0.45. |
| `foco_editorial_fit` | 0.30 | Casa pronta genérica, sem MCMV/Caixa. |
| `geografia_fit` | 0.40 | Brasil amplo, sem ancoragem. |
| `freshness` | 0.67 | 12 dias → exp(-12/30) = 0.67. |

**Caps:** nenhum acionado (`pillar_fit = 0.32 >= 0.30`,
`foco = 0.30 >= 0.20`). Segue pro agregado.

**Agregado:** `0.30×0.32 + 0.15×0.40 + 0.25×0.30 + 0.20×0.40 + 0.10×0.67 = **0.378**`
**Decision:** `skip-low-score` (0.378 < 0.55). Justificativa: tema explícitamente
proibido em `content-pillars.md` ("dica de feng shui") + ICP ambíguo. Log
no ledger; sem brief.

---

### Exemplo 5 — SKIP-OUT-OF-SCOPE (cap acionado)

| Campo | Valor |
|---|---|
| URL | https://exame.com/invest/mercado-imobiliario/cobertura-de-luxo-jardim-paulista-record-2026/ (Exame, lifestyle SP) |
| Título | "Cobertura de luxo no Jardim Paulista bate recorde de R$ 80mi em São Paulo" |
| Resumo | "Apartamento de 1.200m² com 4 vagas e piscina privativa foi vendido a empresário pelo maior valor histórico do bairro." |
| `published_at` | 1 dia atrás |

**Scores:**
| Dimensão | Score | Por quê |
|---|---|---|
| `pillar_fit` | 0.25 | Não cabe em nenhum pilar Avanz (não é imóvel-da-semana, nem decisão, nem inteligência, nem prova social, nem mercado RMBH). |
| `icp_fit` | 0.20 | Nenhum ICP Avanz; público é mercado de luxo SP. |
| `foco_editorial_fit` | 0.10 | Alto padrão / mansão = explicitamente fora do foco. |
| `geografia_fit` | 0.25 | São Paulo / outro estado. |
| `freshness` | 0.97 | 1 dia. |

**Cap acionado:** `pillar_fit = 0.25 < 0.30` → `decision = "skip-out-of-scope"`
(sem nem chegar a agregar). Adicionalmente: `foco = 0.10 < 0.20` AND
`geografia = 0.25 < 0.50` → também acionaria o 2º cap. Doublelock.

**Decision:** `skip-out-of-scope`. Log no ledger com motivo; sem brief.

---

### Sumário da calibração

| Ex. | Pilar | Agregado | Decision | Margem do threshold |
|---|---|---|---|---|
| 1 | mercado-rmbh | **0.916** | `promote-to-brief` | +0.366 |
| 2 | decisao-inteligente | **0.660** | `promote-to-brief` | +0.110 |
| 3 | (redundant) | n/a | `skip-redundant` | (anti-rep) |
| 4 | (low) | **0.378** | `skip-low-score` | -0.172 |
| 5 | (out) | (cap) | `skip-out-of-scope` | (cap) |

Threshold 0.55 separa cleanly os 2 promotes dos 3 skips. Borderline (ex.2)
fica 0.11 acima — saudável. Se calibração futura mostrar que ex.2 sempre
é reprovado pelo editor humano, subir threshold pra 0.65 (já discutido em §5.7).

## 8. Integração com anti-repetição

Referência: [`001-foundation.md#5`](./001-foundation.md#5-anti-repetição).

### 8.1 Quando o matcher consulta `store/briefs/**`

**Antes** de calcular o score, para **cada finding**. Anti-repetição é o
**primeiro check** — se redundante, score nem é computado (economiza
tokens; ledger reflete skip silencioso).

### 8.2 Como computa `topic_hash`

Determinístico, idêntico ao briefer (spec 004) e ao foundation §5:

```python
def topic_hash(headline: str) -> str:
    # 1. Lowercase
    s = headline.lower()
    # 2. Remove pontuação
    s = re.sub(r'[^\w\s]', '', s)
    # 3. Remove stopwords PT-BR (lista canônica: nltk pt-br stopwords ou
    #    fallback hardcoded em ../skills/_shared/stopwords-pt-br.txt
    #    se nltk não disponível no runtime)
    s = ' '.join(w for w in s.split() if w not in STOPWORDS_PT_BR)
    # 4. Trunca aos primeiros 200 chars
    s = s[:200]
    # 5. SHA1
    return hashlib.sha1(s.encode('utf-8')).hexdigest()
```

**No matcher**: headline ainda não existe (é trabalho do briefer). Usar
`title` do finding como proxy. O hash final no brief (pós-briefing) pode
ser diferente — mas isso não é problema porque a checagem do matcher
captura redundância **em nível de notícia**, não de pauta. Briefer faz
segundo check com headline finalizada.

### 8.3 Janelas de comparação (espelho de §5 da foundation)

| Diretório | Janela | Ação |
|---|---|---|
| `pendente-aprovacao/` | any | hit em `topic_hash` OU `source_urls` overlap → `redundant: true`, skip |
| `pendente-publicacao/` | any | mesmo |
| `publicado/` | 90 dias | hit em `topic_hash` → `redundant: true`, skip. Hit em `pillar+icp` (sem hash) nos últimos 14 dias → flag `redundant: true` (anti-saturação) e aplicar §11.J (skip silencioso) |
| `rejeitado/` | 30 dias | hit em `topic_hash` → `redundant: true`, skip (não re-propor o que humano descartou) |

### 8.4 Quando aplica §11.J (skip silencioso)

**Sempre** que `redundant: true`. Por decisão do owner (§11.J da foundation),
redundantes **não viram brief** e não retornam pro orquestrador como
candidatos — apenas ficam logados no ledger:

```jsonl
{"ts":"2026-05-27T14:32:00-03:00","scan_id":"2026-W22-scan-001","actor":"agent:avanz-matcher","event":"skip-redundant","finding_url":"https://valor.../...","reason":"topic_hash match com brief 2026-W22-001 em pendente-aprovacao"}
```

Diferença vs `skip-low-score` / `skip-out-of-scope`: estes geram entrada
no ledger **e** aparecem na `meta.skipped` da resposta. Redundantes
aparecem em `meta.skipped.redundant` mas com payload mínimo (sem score
calculado).

## 9. Gotchas e edge cases

### #1 — Finding ambíguo entre 2 pilares

**Sintoma:** ex. notícia sobre "novo loteamento em Mateus Leme com
financiamento próprio" pode mapear pra `imovel-da-semana` (Imóvel da semana) ou
`mercado-rmbh` (Mercado RMBH).

**Regra de desempate:**
1. Calcular `pillar_fit` pros 2 candidatos.
2. Se diferença ≥ 0.15 → escolher o maior.
3. Se diferença < 0.15 → escolher o pilar com **maior underfill** na
   semana corrente (consultar `manifest.yaml#cadence` + briefs já em
   `pendente-publicacao/`).
4. Default final (empate ainda): `imovel-da-semana` (Imóvel da semana — maior
   frequência base = 2x/sem, absorve excedente).

Documentar a escolha em `why_match`: "Encaixa em `imovel-da-semana` e 6 (Δ=0.05);
escolhido `mercado-rmbh` por underfill da semana W22."

### #2 — ICP ambíguo

**Sintoma:** notícia sobre "valorização da região X" pode falar pra
`comprador` (decidindo se vale comprar lá) ou `investidor` (decidindo se
vale investir lá).

**Regra:** default `comprador` (decisão owner 2026-05-03), `icp_fit`
capado em 0.45. Briefer pode re-escrever pra `investidor` se a copy bater
melhor — não é decisão crítica do matcher.

### #3 — Fontes globais sem geografia clara

**Sintoma:** dado macro Brasil/mundial sem ancoragem regional (ex.: "taxa
Selic cai 0.5pp"; "preço médio de imóvel no Brasil sobe X%").

**Regra:**
- `geografia_fit = 0.40` (Brasil amplo).
- Aceitar SE houver implicação clara pra financiamento/decisão de compra.
- Briefer DEVE reframer pra "...e o que isso significa pra quem está
  comprando em Mateus Leme" no copy.

### #4 — Conteúdo puramente educacional sem produto

**Sintoma:** "Como funciona escritura pública"; "Diferença entre matrícula
e registro".

**Regra:**
- `foco_editorial_fit = 0.60` (default neutro — tema é universal,
  aplicável a qualquer produto).
- Mapear pra `decisao-inteligente` (Decisão Inteligente) — exatamente o que o pilar
  pede.
- ICP default = `comprador`.

### #5 — `inteligencia-imobiliaria` (Inteligência) com risco "Ivan tirou foto bonita"

**Sintoma:** notícia sobre "imobiliária usa drone pra mostrar lote" ou
"app de assinatura digital agiliza vendas" — tecnologia genérica que pode
virar post raso (modo de falha explicitamente listado em
[`content-pillars.md#Pilar-3`](/srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md#pilar-3--inteligência-imobiliária-autoridade-tech-do-ivan-)).

**Regra:**
- Pra promover finding pra `inteligencia-imobiliaria`, exigir que `summary` ou `raw_excerpts`
  contenham **insight** (não só "feature"). Heurística simples:
  presença de números/comparativo/caso real → ok; só "novidade" → cap
  `pillar_fit` em 0.50 (vira `skip-low-score` no agregado).
- Flagar em `why_match`: "`inteligencia-imobiliaria` borderline — risco de raso se briefer
  não trouxer dado próprio Avanz."

### #6 — `bastidor` está **fora do escopo do radar**

**Regra absoluta** ([`CLAUDE.md`](../../CLAUDE.md) do content-radar):
matcher **nunca** promove pra `bastidor`. Bastidor vive nos stories e é
decisão humana ad-hoc (foto da equipe, visita técnica, atendimento — não
sai de notícia pública).

Se finding cheira a `bastidor` (raro — exigiria "bastidor de outra
imobiliária"), forçar `pillar_fit = 0` e `decision = "skip-out-of-scope"`,
com `decision_reason: "`bastidor` está fora do escopo do radar (CLAUDE.md)."`.

### #7 — Findings duplicados na mesma resposta do researcher

**Sintoma:** researcher retorna 2 reportagens diferentes sobre o mesmo
fato (ex.: G1 e Valor sobre FipeZap Q1).

**Regra:** matcher detecta `topic_hash` colidente **entre findings da
mesma resposta**. Promove o de **maior `match_score`** (ou, em empate, o
de fonte mais confiável segundo `manifest.search_scopes.*.sources`). Os
demais entram em `meta.skipped.redundant`. Importante porque
anti-repetição (§8) só checa contra `store/briefs/**` — duplicação intra-
batch escapa sem essa regra.

### #8 — `published_at` em formato não-ISO ou ausente

**Sintoma:** algumas fontes (especialmente blogs/IG) não devolvem data
estruturada — researcher pode mandar `published_at: null` ou string
livre ("ontem", "há 2 semanas").

**Regra:**
- `null` → assumir 30 dias atrás (freshness 0.37).
- String livre → researcher deveria normalizar (spec 002). Se mesmo
  assim chegar não-ISO, matcher assume 30 dias e flag no `why_match`:
  "published_at não-ISO; freshness assumida."

## 10. Updates needed in spec 001

> **Não edito a 001** — listo aqui pro owner aplicar.

| Path na 001 | Mudança proposta | Razão |
|---|---|---|
| **§6.1, bloco `match_score_breakdown`** | Substituir comentário `# detalhes do critério: spec 003` por `# definido em spec 003 §5` e atualizar exemplo do bloco pra incluir todas as 5 dimensões com valores realistas do exemplo 1 da spec 003 §7 (ex.: `pillar_fit: 0.95, icp_fit: 0.85, foco_editorial_fit: 0.95, geografia_fit: 0.98, freshness: 0.85`). | Schema do brief agora tem definição firme; exemplo deve refletir. |
| **§11.I (decisões resolvidas)** | Mover linha I da seção "DEFERIDA" pra seção "Resolvidas pelo owner". Texto: `I | match_score mínimo | ✅ **0.55** — definido na spec 003 §5.7 com calibração de 5 exemplos. Manifest atualizado: anti_repetition.match_score_min = 0.55.` | Esta spec resolve. |
| **`manifest.yaml#anti_repetition.match_score_min`** | Trocar `null` por `0.55`. Adicionar comentário: `# decidido em spec 003 §5.7`. | Espelhar decisão. |
| **`manifest.yaml#anti_repetition`** | Adicionar bloco `match_score_weights:` com `{pillar_fit: 0.30, icp_fit: 0.15, foco_editorial_fit: 0.25, geografia_fit: 0.20, freshness: 0.10}` e comentário `# spec 003 §5.6`. | Pesos viram config (pra calibração futura sem mudar prompt do agente). |
| **§5 (anti-repetição), fim da seção** | Acrescentar parágrafo: "Anti-repetição é executada **duas vezes** no pipeline: (a) no `avanz-matcher` contra `title` do finding como proxy de headline (spec 003 §8); (b) no `instagram-briefer` contra a headline finalizada. Segunda checagem é a definitiva." | Esclarece interação matcher × briefer. |
| **§3.2, linha do `avanz-matcher`** | Trocar coluna Estado de `spec` pra `spec → 003-matcher.md`. | Convenção da tabela. |
| **§9, linha 3 (`Agente avanz-matcher`)** | Trocar Status `spec → 003-matcher.md (define §11.I)` por `✅ spec 003-matcher.md — §11.I resolvido`. | Reflete conclusão. |
| **§12, item 3** | Pode marcar como **feito** ("Spec 003 — avanz-matcher ✅"). | Conclusão. |

## 11. Critério de pronto do subagente

Subagente é considerado pronto pra implementação quando:

1. **Arquivo `.claude/agents/avanz-matcher.md`** existe com frontmatter +
   prompt do §6 desta spec (literal, sem edição).
2. **Dry-run com 10 findings de teste** (curados manualmente cobrindo os
   5 casos do §7 + variações): matcher classifica corretamente em **≥ 80%
   dos casos** comparado a um gabarito feito pelo owner Ivan ou pelo Mary.
3. **Threshold validado**: rodando matcher contra 1 semana de scans reais,
   `meta.total_promoted` fica entre **8 e 18** (folga sobre alvo de 10).
   Se < 8 consistente → baixar threshold; se > 18 → subir.
4. **Anti-repetição funcional**: criar brief de teste em
   `pendente-aprovacao/`, rodar matcher contra finding similar — deve
   marcar `redundant: true` e não computar score.
5. **Saída JSON parseável**: `radar-scan` consegue ingerir output sem
   erro de schema (validação JSON Schema do contrato §4 — incluir em
   testes da spec 005).
6. **Sem invenção factual**: revisão manual de 20 `why_match` aleatórios
   — todo trecho citado existe literalmente em
   `finding.summary | finding.title | finding.raw_excerpts`. Zero
   tolerância a fabricação.
7. **Caps acionam corretamente**: teste explícito com finding "cobertura
   SP luxo" (§7 ex.5) → deve retornar `skip-out-of-scope` sem agregar score.
8. **Performance**: tempo médio < 4s por finding (Sonnet 4.6 streaming,
   já com vault carregado em cache de prompt). Lote de 50 findings:
   < 4 min total.
9. **Taxa de aprovação humana**: após 4 semanas (16 scans), taxa de
   aprovação pelo editor (mv approve) sobre `promote-to-brief` ≥ 60%.
   Se < 50%, voltar pro algoritmo (subir threshold, recalibrar pesos).

Itens 1–7 são pré-requisitos pro merge da spec; 8–9 são pós-deploy
(observação operacional).
