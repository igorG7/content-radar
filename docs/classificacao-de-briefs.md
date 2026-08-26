# Classificação de briefs — parâmetros, escopo e redundância

> Referência-resumo de como o `content-radar` classifica um finding e decide
> se ele vira brief. Fonte canônica do algoritmo: [spec 003-matcher.md](./specs/003-matcher.md#5-algoritmo-de-match_score_breakdown--núcleo-da-spec);
> config: [manifest.yaml](../manifest.yaml#L149-L170); lifecycle e anti-repetição:
> [spec 001-foundation.md §5](./specs/001-foundation.md#5-anti-repetição).

A classificação é feita pelo subagente **`avanz-matcher`** (estágio 2 do
pipeline). Ele recebe findings brutos do `market-researcher` e, para cada um,
atribui: um **pilar**, um **ICP**, um **score de match** e uma **decisão final**.

## Os parâmetros que classificam um brief

Cada finding é pontuado em **5 dimensões independentes** [0..1], depois
combinadas por soma ponderada:

| Dimensão | Peso | O que mede | Decisor |
|---|---|---|---|
| **`pillar_fit`** | **0.30** | Encaixe em um pilar editorial Avanz (1, 2, 3, 5, 6 — nunca 4) | `title` + `summary` |
| **`foco_editorial_fit`** | **0.25** | Alinhamento com o produto Avanz: lotes/sítios/chácaras (alto), MCMV+simulação Caixa (médio), casa pronta/luxo (baixo) | menção a tipo de imóvel |
| **`geografia_fit`** | **0.20** | Aderência à RMBH (cidades canônicas > RMBH ampla > MG > Brasil > exterior). **Piso 0.50** pra macro nacional reancorável (calibração §11.V) | `geo_hints[]` + lista em `positioning.md` |
| **`icp_fit`** | **0.15** | Clareza do público (comprador/investidor/proprietario); default `comprador` | keywords/dores do overlay |
| **`freshness`** | **0.10** | Decay exponencial `exp(-dias/30)` desde `published_at` | data |

**Fórmula** ([003 §5.6](./specs/003-matcher.md#56-fórmula-de-agregação)):

```
match_score = 0.30·pillar_fit + 0.25·foco_editorial_fit + 0.20·geografia_fit + 0.15·icp_fit + 0.10·freshness
```

Além do score, o matcher atribui dois **rótulos estruturais**: `pillar` (qual
dos 6 pilares) e `icp` (qual persona). Esses dois definem *onde* a pauta vive;
o score define *se* ela vive.

## Como os parâmetros decidem dentro/fora de escopo

Há **duas camadas** de corte, e a ordem importa.

### 1. Caps rígidos (derrubam ANTES de agregar)

Ver [003 §5.6](./specs/003-matcher.md#56-fórmula-de-agregação), passo 3 do matcher:

- `pillar_fit < 0.30` → **`skip-out-of-scope`** (sem pilar não há onde alocar no calendário)
- `foco_editorial_fit < 0.20` **E** `geografia_fit < 0.50` → **`skip-out-of-scope`** (produto errado + região errada não vale reformatar)
- Finding mapeia pra **Pilar 4 (Bastidor)** → `pillar_fit = 0` → **`skip-out-of-scope`** (regra absoluta do `CLAUDE.md` — Bastidor é stories, decisão humana)

Esses caps são o que define "fora de escopo": um post sobre cobertura de luxo
em SP morre no cap de `pillar_fit`, sem nem calcular o agregado.

### 2. Threshold + tier borderline (depois de agregar)

Ver [003 §5.7 + §5.7.1](./specs/003-matcher.md#57-threshold-escolhido--055-resolve-11i):

- `match_score >= 0.55` → **`promote-to-brief`** (vira brief, `borderline: false`)
- `0.48 <= match_score < 0.55` e **sem cap** → **`promote-borderline`** (vira brief
  marcado `borderline: true` — o **editor humano** decide; calibração §11.V)
- `match_score < 0.48` sem cap → **`skip-low-score`**

**Detalhe de design:** `pillar_fit` + `foco_editorial_fit` somam **0.55** dos
pesos — exatamente o threshold. Logo, esses dois sozinhos, no máximo, empatam
com o corte; qualquer pauta precisa de **pelo menos mais uma dimensão decente**
(geo, icp ou freshness) pra passar. É o mecanismo que impede o radar de virar
"feed genérico de mercado imobiliário".

O tier **borderline** (calibração 2026-07-03, [docs/calibracao-matcher.md](./calibracao-matcher.md))
não relaxa esse filtro: caps continuam matando o que é fora de foco/geografia
**antes** de qualquer coisa. Ele só reabre a faixa 0.48–0.55 que morria por
*agregação* (não por cap), delegando a chamada marginal ao humano em vez de
descartá-la silenciosamente.

## Como decide redundante ou não

A anti-repetição roda **antes** do scoring (é o primeiro check — se redundante,
o score nem é calculado) e usa `topic_hash` = SHA1 da headline/título
normalizado (lowercase, sem stopwords PT-BR, sem pontuação, 200 chars).

Regras por diretório ([001 §5](./specs/001-foundation.md#5-anti-repetição) +
[003 §8.3](./specs/003-matcher.md#83-janelas-de-comparação-espelho-de-5-da-foundation)):

| Diretório | Janela | Gatilho de redundância |
|---|---|---|
| `pendente-aprovacao/` + `pendente-publicacao/` | qualquer | hit de `topic_hash` **ou** overlap de `source_urls` |
| `publicado/` | **90 dias** | hit de `topic_hash`; **ou** `pillar`+`icp` iguais nos últimos **14 dias** (anti-saturação) |
| `rejeitado/` | **30 dias** | hit de `topic_hash` (não re-propor o que o humano descartou) |

Qualquer hit → `redundant: true`, `decision: "skip-redundant"`, `match_score: 0`,
e **skip silencioso** (decisão §11.J do owner: redundante **não vira brief**, só
entra no ledger).

Dois refinamentos:

- **Dupla checagem** ([001 §5](./specs/001-foundation.md#5-anti-repetição)): o
  matcher checa com o `title` do finding (barato, pega ~80%); o **briefer**
  refaz com a `headline` final (definitivo). A colisão pode surgir só na segunda
  passada → vira `rejeitado/`.
- **Dedup intra-batch** ([003 §9 gotcha #7](./specs/003-matcher.md#7--findings-duplicados-na-mesma-resposta-do-researcher)):
  dois findings sobre o mesmo fato na mesma resposta → promove o de maior
  `match_score`, os outros viram `redundant`.

## As 5 decisões possíveis

Todo finding sai do matcher com uma de cinco etiquetas:

- **`promote-to-brief`** — score ≥ 0.55, não redundante → vira `.md` em `pendente-aprovacao/`
- **`promote-borderline`** — score 0.48–0.549, sem cap, não redundante → vira `.md` com `borderline: true` pro humano decidir (calibração §11.V)
- **`skip-redundant`** — colidiu com pauta existente (silencioso, §11.J)
- **`skip-out-of-scope`** — cap acionado (pilar/foco/geo/Pilar-4)
- **`skip-low-score`** — passou os caps mas ficou abaixo de 0.48

## Calibração

Os pesos e o threshold são **config** em
[manifest.yaml#anti_repetition](../manifest.yaml#L149-L170) (não hardcoded no
prompt), justamente pra permitir recalibração após 4 semanas de operação sem
tocar no agente. A spec prevê subir pra **0.60** se a aprovação humana ficar
< 50%, ou descer pra **0.50** se o scan vier vazio
([003 §5.7](./specs/003-matcher.md#57-threshold-escolhido--055-resolve-11i)).
