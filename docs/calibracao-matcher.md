# Calibração do matcher — diagnóstico de escassez e plano

> **Status:** ✅ **APLICADO em 2026-07-03** (pacote cirúrgico §3, alavancas 1 + 2a + 2c).
> Registrado como decisão §11.V na [spec 001](./specs/001-foundation.md) + [spec 003 v0.3.0](./specs/003-matcher.md).
> Falta apenas **medir 2 ciclos** (§5) antes de consolidar/reverter.
> **Data diagnóstico:** 2026-07-01. **Data aplicação:** 2026-07-03. **Autor:** claude (a pedido do owner).
> **Problema:** volume de briefs baixo ("escassez") por causa das classificações;
> queremos **mais briefs mantendo qualidade e alinhamento editorial**.
>
> Fontes: [ledger](../store/ledger.jsonl) (14 scans), [avanz-matcher](../.claude/agents/avanz-matcher.md),
> [spec 003-matcher §5](./specs/003-matcher.md#5-algoritmo-de-match_score_breakdown--núcleo-da-spec),
> config em [manifest.yaml#anti_repetition](../manifest.yaml#L149-L170).

## 1. Diagnóstico (a partir do ledger real)

### 1.1 Funil — 14 scans, ~72 findings avaliados

| Decisão | Qtd | % |
|---|---|---|
| `promote-to-brief` | 18 | **25%** |
| `skip-low-score` | 28 | **39%** ← maior perda |
| `skip-out-of-scope` | 21 | 29% |
| `skip-redundant` | 5 | 7% |

Só 1 em cada 4 findings vira brief. A maior perda é `skip-low-score`.

### 1.2 Distribuição dos `skip-low-score` (22 com score registrado)

| Faixa de `match_score` | Qtd | Leitura |
|---|---|---|
| **0.50–0.549** | 5 | quase passaram (0.541, 0.519, 0.544, 0.538, 0.523) |
| **0.45–0.499** | 6 | recuperáveis com ajuste fino |
| 0.40–0.449 | 5 | borderline-baixo |
| < 0.40 | 6 | lixo real (feng shui, comercial, luxo SP) |

**~11 dos 22 estão na faixa 0.45–0.549** — metade da maior perda do funil a
menos de 0.10 do corte.

### 1.3 Causa raiz — `geografia_fit` mata conteúdo bom e reancorável

Os motivos dos near-misses apontam quase sempre pra **geografia**, não pra
qualidade:

- `0.538` — "pesquisa CBIC nacional sem âncora RMBH (geo 0.28)... **bom ângulo casa-de-rua mas geografia derruba**"
- `0.44` — "bom Pilar 3 mas dado nacional sem âncora RMBH (geo=0.25)" (crédito SBPE recorde histórico)
- `0.523` — "balanço amplo Seinfra RMBH; sem cidade-foco"
- `0.544` — "licenciamento ambiental digital; foco 0.35"

São dados imobiliários **nacionais bons** (SBPE, CBIC, MCMV, intenção de compra)
que não citam cidade da lista canônica → geo ≈ 0.25–0.40 → dimensão de peso 0.20
arrasta um finding forte pra baixo de 0.55.

**Contradição interna:** a spec ([003 §9 gotcha #3](./specs/003-matcher.md#3--fontes-globais-sem-geografia-clara))
manda o **briefer** reancorar exatamente esse tipo de conteúdo
("...e o que isso significa pra quem compra em Mateus Leme") — mas o matcher
mata o finding **antes** do briefer existir no pipeline.

### 1.4 O que NÃO é o problema (não mexer)

- **`skip-out-of-scope` (21):** kills majoritariamente **corretos** — Secovi-SP,
  imóvel comercial, MCMV Rural/Entidades, Dia dos Namorados com evidência dos EUA,
  condomínios. Afrouxar caps só traz lixo.
- **`skip-redundant` (5):** anti-repetição **não é gargalo**; janelas (90/30/14d)
  estão adequadas.

## 2. Onde está o volume

Duas fontes, em ordem de "preserva qualidade":

### Alavanca 1 — Alargar o topo do funil (ganho puro, zero tradeoff)

Hoje os scans rodam quase só `trends`/`local`. Ativar `cases` (Caixa / ABECIP /
Secovi educacional) e `seasonal`, e adicionar mais fontes por escopo, aumenta o
input bruto. Mais entrada × mesmos 25% = mais briefs **sem baixar a régua**.
É a alavanca mais segura.

### Alavanca 2 — Corrigir a sobre-penalização geográfica (cirúrgico, ataca a raiz)

Três sub-opções, da menor pra maior mudança:

- **2a — Piso de geo pra macro reancorável:** conteúdo nacional com implicação
  clara pra RMBH (financiamento, índices, intenção de compra) recebe
  `geografia_fit` mínimo **0.50** em vez de 0.40. Casa com a obrigação do briefer
  de localizar (gotcha #3).
- **2b — Rebalancear pesos:** `geografia_fit` 0.20 → **0.15**, realocando 0.05
  em `pillar_fit` (0.30→0.32) e `foco_editorial_fit` (0.25→0.28). Pilar+foco
  continuam dominando (qualidade preservada); geografia deixa de matar sozinha.
- **2c — Tier "borderline" pro humano:** findings em **0.48–0.549** não morrem
  silenciosos — vão pra `pendente-aprovacao/` com flag `borderline: true`, e o
  **editor decide**. Alinhado 100% com §11.H ("gerar 10, humano aprova 4–7"):
  o humano é o portão de qualidade, não o threshold. Converte escassez em
  throughput de revisão sem baixar régua.

### Alavanca 3 — Threshold 0.55 → 0.50 (contundente, reversível)

Já previsto na spec ([003 §5.7](./specs/003-matcher.md#57-threshold-escolhido--055-resolve-11i)):
"descer pra 0.50 se o scan vier vazio". Recupera a faixa 0.50–0.549 na hora,
mas é **cego** — deixa passar qualquer coisa em 0.50, inclusive itens fracos.
Usar como último recurso ou temporário.

## 3. Recomendação — pacote cirúrgico

Ganha volume mantendo qualidade, sem mexer nos caps:

1. **Alavanca 2c (borderline tier)** — melhor relação volume/qualidade; delega a
   decisão marginal ao humano. Estimativa: recuperar ~5–8 findings/mês dos ~11
   na faixa alta.
2. **Alavanca 2a (piso geo pra macro reancorável)** — resolve o padrão específico
   que os dados gritam.
3. **Alavanca 1 (ativar `cases`)** — abre escopo educacional hoje ocioso.
4. **Manter** threshold em 0.55, caps intactos, e **medir 2 ciclos**.

### Alternativa conservadora

Começar **só pela Alavanca 1** (zero risco de qualidade), medir 2 ciclos, e só
então mexer no matcher se o volume ainda não bastar.

## 4. Onde cada mudança é feita

| Alavanca | Arquivo | Natureza |
|---|---|---|
| 1 (escopos) | invocação do `radar-scan` / [manifest.yaml#search_scopes](../manifest.yaml#L48) | operacional |
| 2a (piso geo) | [avanz-matcher.md §5.4](../.claude/agents/avanz-matcher.md) + [spec 003 §5.4](./specs/003-matcher.md) | prompt + spec |
| 2b (pesos) | [manifest.yaml#match_score_weights](../manifest.yaml#L152) | config (pesos são config de propósito) |
| 2c (borderline) | manifest (nova faixa) + prompt do matcher + `radar-scan` (renderiza flag) | config + prompt + skill |
| 3 (threshold) | [manifest.yaml#match_score_min](../manifest.yaml#L151) | config (1 linha) |

## 5. Critério de sucesso (medir após 2 ciclos / ~4 semanas)

- `total_promoted` (via `brief-created` no ledger) sobe pra **8–14/semana**.
- Taxa de aprovação humana (`mv-approved` ÷ `brief-created`) permanece **≥ 60%**
  — se cair < 50%, afrouxamos demais; reverter/subir threshold.
- Nenhum aumento de reclamação de "fora de foco" do owner.

A instrumentação pra medir tudo isso já existe no [ledger](../store/ledger.jsonl).

## 6. Próximo passo

✅ **Feito (2026-07-03):** aplicado o **pacote cirúrgico** (§3, alavancas 1 + 2a + 2c).
Edições da §4 executadas; decisão registrada como §11.V na
[spec 001](./specs/001-foundation.md) e na [spec 003 v0.3.0](./specs/003-matcher.md)
(§5.4 piso geo + §5.7.1 tier borderline); `manifest.yaml` com `borderline_min: 0.48`
e `geografia_reframe_floor: 0.50`.

**Pendente:** rodar `radar-scan` incluindo o escopo `cases` na rotação e **medir
2 ciclos** (§5 + §7). A alavanca 1 é operacional — depende de disparar scans de
`cases`/`seasonal`, não de mais edição de código.

## 7. Previsão de resultados pós-calibração

> Modelo a partir das taxas reais do ledger (14 scans, 22 low-scores com nota).
> **Projeção com intervalos, não promessa** — n pequeno; ±20–30%, maior na Alavanca 1.

### 7.1 Baseline observado

| Métrica | Valor atual |
|---|---|
| Findings por scan | ~5,1 |
| Taxa de promoção | 25% |
| **Briefs gerados/semana** | **~3,6** (18 briefs / ~5 semanas W22–W26) |
| Aprovação humana (`mv-approved` ÷ `brief-created`) | ~67% (acima do piso de 60% → há folga de qualidade) |
| Aprovados/semana | ~2,4 |

### 7.2 Premissas por alavanca

- **2a (piso geo 0.40→0.50):** +0,02 a +0,044 no agregado; resgata ~3–4 findings
  hoje na faixa 0,50–0,549 (CBIC 0,538, Seinfra 0,523, licenciamento 0,544).
  Taxa de promoção 25% → **~29–30%**.
- **2c (tier borderline 0,48–0,549):** ~7–8 findings/período entram em
  `pendente-aprovacao` flagados; humano aprova ~40–55% deles. **+~10pp** na taxa
  que chega ao editor.
- **1 (ativar `cases`+`seasonal`):** +30–40% de findings brutos/scan; conteúdo
  educacional Pilar 2 promove a taxa igual/maior que a média.

### 7.3 Projeção

| Cenário | Briefs gerados/sem | Aprovados/sem | Δ vs hoje |
|---|---|---|---|
| **Hoje** | 3,6 | 2,4 | — |
| Conservador (só Alavanca 1) | ~4,9 | ~3,3 | +36% |
| **Pacote cirúrgico (1 + 2a + 2c)** | **~7–9** | **~4,5–6** | **+95–150%** |

O pacote leva a geração pra perto do alvo de **10/semana** (§11.H) e os aprovados
pra dentro da cadência Avanz de **4–7/sem** — onde o sistema foi desenhado pra operar.

### 7.4 Efeito na qualidade (o que a previsão preserva)

- Aprovação humana **blended** cai de ~67% → **~58–62%** (segue acima do piso de 50%).
  A queda vem do tier borderline, onde ~45% de reprovação é o *filtro humano funcionando*.
- **`skip-out-of-scope` inalterado** — caps intactos; nada de comercial/luxo SP/US furando.
- **`skip-redundant` inalterado** — anti-repetição igual.
- Mix de pilares mais equilibrado: Alavanca 1 alimenta **Pilar 2/3** (hoje subnutridos);
  2a resgata macro **Pilar 6/3**.

### 7.5 Sinais que confirmam/refutam (nos 2 ciclos)

1. `brief-created`/semana entra em **8–14**. < 6 → subdimensionado; > 16 → afrouxou demais.
2. Aprovação blended **≥ 58%**. < 50% → recuar 2c ou subir threshold.
3. Aprovação **só do tier pleno (≥0,55)** deve manter ~67%. Se cair, o problema não é o borderline.
4. Zero aumento de reclamação de "fora de foco" do owner.
