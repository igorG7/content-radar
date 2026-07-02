# Calibração do matcher — diagnóstico de escassez e plano

> **Status:** proposta / diagnóstico. Ainda **não aplicado** — aguardando decisão.
> **Data:** 2026-07-01. **Autor:** claude (análise a pedido do owner).
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

Decisão pendente do owner: aplicar o **pacote cirúrgico** (§3) ou começar pela
**alternativa conservadora** (só Alavanca 1). Após decidir, aplicar edições da
§4 e registrar como decisão nova na [spec 003](./specs/003-matcher.md) (bump de
versão + changelog) e no `manifest.yaml`.
