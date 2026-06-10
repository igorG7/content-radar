---
spec_id: 005-skill-scan
title: "content-radar — Skills radar-scan + radar-mv (orquestração e transição de estado)"
status: draft
version: 0.1.0
data: 2026-05-27
autor: claude
empresa_alvo: avanz-imoveis
escopo: definição das DUAS skills do Claude Code que fecham o 1º slice — radar-scan (orquestrador do pipeline) e radar-mv (transição de estado físico + ledger)
resolves:
  - "item 5 do roadmap §9 da spec 001 (Skill radar-scan + radar-mv)"
  - "item 1 e itens 4–5 do critério §10 da spec 001 (1º slice — fim-a-fim)"
related:
  - /srv/apps/content-radar/docs/specs/001-foundation.md
  - /srv/apps/content-radar/docs/specs/002-researcher.md
  - /srv/apps/content-radar/docs/specs/003-matcher.md
  - /srv/apps/content-radar/docs/specs/004-briefer.md
  - /srv/apps/content-radar/manifest.yaml
  - /srv/apps/content-radar/HANDOFF.md
  - /srv/apps/content-radar/INTEGRACAO-OPEN-DESIGN.md
  - /srv/apps/open-design/skills/ad-creative/SKILL.md
  - /srv/apps/open-design/skills/poster-hero/SKILL.md
changelog:
  - "v0.1.0 (2026-05-27): primeira versão; cobre frontmatter+fluxo das 2 skills, validação JSON inline, ledger canônico, dry-run, idempotência, fallbacks, 10 gotchas e critério de pronto."
---

# Spec 005 — Skills `radar-scan` + `radar-mv`

> Esta spec define as **duas skills do Claude Code** que fecham o
> primeiro slice vertical do `content-radar`:
>
> - **`radar-scan`** — orquestra o pipeline (researcher → matcher →
>   briefer), valida JSON entre estágios, materializa briefs em
>   `store/briefs/pendente-aprovacao/` e atualiza o ledger.
> - **`radar-mv`** — transição de estado físico
>   (`pendente-aprovacao/` → `pendente-publicacao/` | `rejeitado/`)
>   com escrita no ledger e remanejo de mídia conforme `hero_choice`.
>
> Não duplica conceitos já fixados na foundation. Aterra em
> [`001 §2`](./001-foundation.md#2-visão-do-sistema) (pipeline),
> [`001 §3.1`](./001-foundation.md#31-skills-claudeskills) (tabela de
> skills), [`001 §3.3`](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado)
> (storage), [`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta)
> (lifecycle), [`001 §5`](./001-foundation.md#5-anti-repetição)
> (anti-repetição) e [`001 §6`](./001-foundation.md#6-estrutura-de-dados)
> (schemas). Sintetiza os contratos de I/O das specs 002/003/004 num
> orquestrador linear.

---

# Parte A — Conceitos comuns

## 1. Objetivo e escopo

`radar-scan` e `radar-mv` são as **duas únicas peças do 1º slice
[§10](./001-foundation.md#10-primeiro-slice-vertical-escopo-do-primeiro-passo)**
que rodam no contexto do **session principal** do Claude Code (modelo
do usuário — provavelmente Sonnet 4.6 ou Opus 4.7), em contraste com
os subagentes das specs 002/003/004 que rodam em contexto isolado.

- `radar-scan` **inicia** o pipeline (estágio 1 → 4): invoca os 3
  subagentes via Task, valida cada JSON intermediário, materializa
  briefs e mídia, e escreve eventos no ledger.
- `radar-mv` **fecha o ciclo automatizado**: o editor humano abriu o
  `.md` em `pendente-aprovacao/`, preencheu `hero_choice`, e agora
  precisa mover o brief pra `pendente-publicacao/` (aprovado) ou
  `rejeitado/` (descartado). A skill faz `mv` do brief + remanejo de
  mídia + ledger.

`radar-handoff` (Cloudinary + package), `radar-mark-published` e
`radar-review` ficam **fora** desta spec — entram em 007/008/006
respectivamente. `editorial-planner` fica na spec 011.

## 2. Por que são skills, não subagentes

Decisão de design baseada nas restrições do Claude Code:

1. **Orquestração precisa do tool Task.** A skill `radar-scan`
   invoca `market-researcher`, `avanz-matcher` e `instagram-briefer`
   via `Task(subagent_type=..., prompt=...)`. Um subagente, por
   default, não pode spawnar outro subagente — quem orquestra é o
   contexto principal. Logo, orquestrador é **skill**, não subagente.
2. **Operação intensiva no FS da sessão.** As duas skills fazem
   `Read`/`Write`/`Bash` (mv, glob, jq) sobre `store/**`,
   `store/ledger.jsonl` e `store/briefs/**`. Subagente isolado
   atrapalha auditabilidade — a sessão precisa ver os efeitos.
3. **Operações curtas, sem necessidade de contexto isolado.** A
   janela de contexto da orquestração inteira (incluindo as 3 saídas
   JSON dos subagentes) cabe folgada no session principal. Não há
   ganho em isolar.
4. **Skills compõem com `argument-hint`.** O frontmatter de skill no
   Claude Code aceita `argument-hint`, que dirige a UI de invocação
   (`/radar-scan --scope=trends`). Subagente é invocado via Task,
   que aceita prompt livre — pior UX pro humano.

Resumindo a divisão de papel:

| Camada | Quem | Modelo | Contexto |
|---|---|---|---|
| Orquestração | Skill `radar-scan` | session (Opus 4.7 / Sonnet 4.6) | Principal |
| Descoberta web | Subagente `market-researcher` | Sonnet 4.6 (§11.A) | Isolado |
| Pontuação | Subagente `avanz-matcher` | Sonnet 4.6 (§11.A) | Isolado |
| Síntese editorial | Subagente `instagram-briefer` | Opus 4.7 (§11.A) | Isolado |
| Transição de estado | Skill `radar-mv` | session | Principal |

## 3. Padrão de arquivo `.claude/skills/<slug>/SKILL.md`

**Escolha:** **diretório dedicado** (`.claude/skills/radar-scan/SKILL.md`),
não arquivo flat (`.claude/skills/radar-scan.md`).

**Justificativa:**

- Espelha o padrão do projeto downstream Open Design
  ([`/srv/apps/open-design/skills/ad-creative/SKILL.md`,
   `poster-hero/SKILL.md`](/srv/apps/open-design/skills/)) — consistência
  entre os dois projetos da casa.
- Diretório dedicado abre espaço pra **arquivos auxiliares** colocalizados
  no futuro (templates de prompt longo, `_shared/stopwords-pt-br.txt`
  citado na spec 003 §8.2 e spec 004 §9.5, exemplos, etc) sem virar
  bagunça em `.claude/skills/`.
- A spec 004 §9.5 já assume esse caminho (`.claude/skills/_shared/`),
  então skill-como-arquivo-único entraria em conflito.

**Frontmatter** segue o padrão Claude Code:

```yaml
---
name: radar-scan
description: |
  <1–2 frases — palavra-chave + objetivo + quando invocar>
argument-hint: |
  <linha mostrando os args; ex.: "--scope=<trends|local|...> [--pillar=...] [--target-count=N] [--dry-run]">
---
```

Campos opcionais (`triggers`, `od:`, etc) **não** se aplicam aqui —
são convenção do Open Design. Mantemos minimal.

---

# Parte B — `radar-scan`

## 4. Argumentos

Frontmatter `argument-hint`:

```
--scope=<trends|competitors|seasonal|cases|local> [--pillar=<id>] [--target-count=N] [--dry-run] [--scan-id=<id>]
```

| Arg | Tipo | Obrigatório? | Default | Notas |
|---|---|---|---|---|
| `--scope` | enum | **sim** | — | Chave de [`manifest.search_scopes`](../../manifest.yaml). Valores: `trends`, `competitors`, `seasonal`, `cases`, `local`. Fora da lista → abort com erro claro. |
| `--pillar` | enum | não | `null` (sem filtro) | `1-imovel`, `2-decisao`, `3-inteligencia`, `5-quem-comprou`, `6-mercado-rmbh`. **`4-bastidor` rejeita com erro** (§9 da [001](./001-foundation.md) — Pilar 4 está fora do escopo do radar; reforça spec 003 §5.1 + spec 004 §13.3). |
| `--target-count` | int | não | `manifest.funnel.candidates_per_week_target` (= **10**) | Repassado ao researcher como `target_count`; este busca até `target_count * 1.5` (spec 002 §3). |
| `--dry-run` | flag | não | `false` | Roda todo o fluxo de **planejamento** (validação args, cálculo de `week_key`, `NNN`, paths) mas **não invoca subagentes** e **não escreve** nada (sem `Write`, sem ledger, sem mídia). Output: relatório do que seria feito. Ver §7. |
| `--scan-id` | string | não | auto: `<week_key>-scan-<NNN>` | Identificador da run pro ledger. Calculado contando `scan-started` events existentes no ledger pra `week_key`. |

**Edge cases de validação de args:**

- `--scope` ausente → erro fatal, mensagem `"--scope é obrigatório (valores: trends, competitors, seasonal, cases, local)"`.
- `--pillar=4-bastidor` → erro fatal, `"Pilar 4 (Bastidor) está fora do escopo do radar — ver CLAUDE.md e spec 001 CLAUDE.md"`.
- `--target-count <= 0` ou `> 50` → erro (proteção bobagem).
- `--scope` válido mas `--pillar` não está em `manifest.search_scopes[scope].pillars_alvo` → **warning** (não erro) — owner pode estar testando combinação fora do default.

## 5. Fluxo passo-a-passo

Algoritmo linear. Cada passo numerado:

### 5.1 Validação de args (sem side effects)

1. Parsear args do invocador (`/radar-scan --scope=trends ...`).
2. Validar enums conforme §4.
3. Carregar `manifest.yaml` via Read. Confirmar que `scope ∈ search_scopes`.
4. Confirmar que `target_company.manifest` existe e é legível (sanity check).
5. Em caso de erro: abort com mensagem pro humano. **Não toca ledger** (nenhum evento criado).

### 5.1.1 Passo 0 — sweep de housekeeping (piggyback, best-effort)

Após validar args (§5.1) e **antes** de preparar contexto (§5.2), dispara a
skill `radar-housekeeping` para purgar cache local expirado de
`media/publicado/` ([spec 009 §8](./009-housekeeping.md#8-piggyback-no-radar-scan-integração)):

1. Invocar `radar-housekeeping` — purga o elegível (30d após `published_at`,
   hero já no Cloudinary; **guarda anti-placeholder** da [009 §3.1](./009-housekeeping.md#31-guarda-anti-placeholder-crítica)).
2. **Best-effort**: falha do housekeeping **não aborta** o scan — loga warning
   e segue para §5.2.
3. **Herda `--dry-run`**: scan em `--dry-run` → `radar-housekeeping --dry-run`
   (nada apagado). Roda antes do early-return do §5.2 passo 6.
4. O sweep grava seu próprio `housekeeping-finished` no ledger
   (`trigger: "piggyback-radar-scan"`), distinto do `scan-started` (§5.3).

### 5.2 Preparação de contexto

1. **Calcular `week_key`** (ISO 8601):
   ```
   week_key = strftime("%G-W%V", today)   # ex.: 2026-W22
   ```
2. **Calcular `NNN` inicial** (contador de briefs já criados na semana, em todos os 4 dirs):
   ```bash
   COUNT=$(find /srv/apps/content-radar/store/briefs/{pendente-aprovacao,pendente-publicacao,publicado,rejeitado} \
     -maxdepth 1 -name "${week_key}-*.md" 2>/dev/null | wc -l)
   NEXT_NNN=$((COUNT + 1))
   ```
   Esse `NEXT_NNN` vai ser repassado ao briefer como `week_context.next_nnn` (spec 004 §3, §9.2). Cada briefer subsequente nesta scan recebe `NEXT_NNN + i` onde `i` é o índice do finding promovido (0-based).
3. **Compor `scan_id`** = `<week_key>-scan-<NNN_scan>`, onde `NNN_scan` = (count de events `scan-started` para `week_key` no ledger) + 1. Se humano passou `--scan-id`, usa esse valor literal.
4. **Snapshot do vault Avanz** (cache no contexto do session):
   - Ler `manifest.target_company.always_load` paths via Read.
   - Extrair os trechos pequenos que serão **injetados inline** no prompt do researcher (stateless — spec 002 §3). Pelo menos: `strategy.foco_principal`, `excecao_casas`, `geografia`, brief do pilar filtrado se houver.
   - Esse snapshot fica em variável do session pra duração da scan. Se vault mudar mid-scan, esta scan ignora — próxima scan pega novidade (§20 gotcha 5).
5. **Resolver `allowed_sources`** de `manifest.search_scopes[scope].sources`. Sem filtro adicional do pilar (pilar só serve pra direcionar queries, não pra cortar fontes).
6. **Em `--dry-run`**: parar aqui e emitir o relatório de plano (§7); **não** seguir pros próximos passos.

### 5.3 Ledger: `scan-started`

Append em `store/ledger.jsonl`:

```jsonl
{"ts":"<ISO 8601>","brief_id":null,"from_dir":null,"to_dir":null,"actor":"skill:radar-scan","extra":{"event":"scan-started","scan_id":"<scan_id>","scope":"<scope>","pillar_filter":"<pillar|null>","target_count":<N>,"week_key":"<week_key>"}}
```

### 5.4 Invoca `market-researcher` (estágio 1)

```
Task(
  subagent_type='market-researcher',
  prompt=<bloco YAML conforme spec 002 §3 com:
    - scope, pillar_filter, window_days (default 30), target_count, max_per_source (3)
    - allowed_sources (lista de source_key)
    - vault_paths (trechos do snapshot §5.2)
  >
)
```

Captura output como **última mensagem** do agente (JSON puro — spec 002 §4).

### 5.5 Validação JSON do researcher

1. Parse JSON.
2. Checks obrigatórios (validação ad-hoc inline — ver §6):
   - Top-level: chaves `findings` (array) e `meta` (object).
   - Cada finding: `finding_id`, `url`, `title`, `summary`, `published_at`, `fetched_at`, `source_key`, `source_domain`, `scope`, `language`, `content_type`, `image_candidates` (array), `geo_hints` (array), `raw_excerpts` (array), `relevance_hint`. (Schema completo: [spec 002 §4](./002-researcher.md#4-output-contract).)
   - Tipos básicos: `url` deve começar com `https://`, `published_at` deve parsear como ISO 8601, `image_candidates` deve ser array (vazio OK).
   - `meta.skipped_reasons` soma deve bater com `total_skipped`.
3. **Falha**: abort scan; ledger `scan-aborted` com `stage: researcher`, `error: schema-invalid`, `details`. **Não invoca matcher.**
4. **Sucesso mas `findings: []`**: continua o fluxo, mas o matcher vai receber array vazio → 0 promovidos → 0 briefs. Não é erro.

### 5.6 Invoca `avanz-matcher` (estágio 2)

```
Task(
  subagent_type='avanz-matcher',
  prompt=<bloco com:
    - scan_id
    - findings[] (saída do researcher, intacta)
    - paths absolutos do vault Avanz pra Read (do manifest)
    - paths absolutos dos 4 dirs de briefs (anti-repetição §8 da 003)
  >
)
```

Output: JSON conforme spec 003 §4 — `{ranked[], meta}`.

### 5.7 Validação JSON do matcher

Mesma rotina:

- Top-level: `ranked` (array) e `meta` (object).
- Cada `ranked[i]`: `finding` (object), `pillar`, `icp`, `match_score`, `match_score_breakdown`, `why_match`, `topic_hash`, `redundant`, `decision`, `decision_reason`.
- `decision ∈ {promote-to-brief, skip-redundant, skip-low-score, skip-out-of-scope}`.
- `pillar ∈ {1-imovel, 2-decisao, 3-inteligencia, 5-quem-comprou, 6-mercado-rmbh}` (pilar 4 nunca deve aparecer — defesa em profundidade).
- `match_score ∈ [0, 1]`.

**Falha**: abort scan, ledger `scan-aborted` com `stage: matcher`. **Output do researcher fica perdido** (não tem onde persistir no 1º slice — aceitar).

### 5.8 Parse + iteração: pra cada `promote-to-brief` (serial)

1. Filtrar `ranked[]` por `decision == "promote-to-brief"`. Lista resultante = `promoted[]`.
2. Pra cada `entry` em `promoted[]` (índice `i` 0-based):
   - **Calcular `next_nnn_i`** = `NEXT_NNN + i` (sem race, scan é serial — §10 gotcha 1, §20 gotcha 1).
   - Invocar:
     ```
     Task(
       subagent_type='instagram-briefer',
       prompt=<bloco conforme spec 004 §3:
         - ranked_entry = entry
         - week_context = {week_key, today_iso, slugs_created_this_week (do snapshot §5.2), next_nnn: next_nnn_i}
         - vault_paths.always = manifest.target_company.always_load (resolvidos)
         - vault_paths.per_pillar = manifest.target_company.per_pillar[entry.pillar]
         - vault_paths.visual_base = .../visual-base.json
         - briefs_dirs = {os 4 paths absolutos}
         - media_dir = .../store/media/pendente-aprovacao
         - windows = manifest.anti_repetition.windows
       >
     )
     ```
   - Captura output JSON conforme spec 004 §4.1, §12.
   - **Valida** contra schema do brief (spec 004 §4.2). Falha → ledger `brief-schema-invalid`, segue pro próximo finding (não aborta a scan inteira).
   - **Materializa** conforme `decision` do output:
     - `create-brief` → renderiza `.md` + frontmatter em `store/briefs/pendente-aprovacao/<slug>.md` (spec 004 §4.3). Confirma que mídia já está no `media_dir` (briefer baixou via Bash+curl — §20 gotcha 4); se algum `local_path` não existe, loga warning mas não invalida brief (§13.1 da spec 004 — `hero_image_candidates: []` é aceito).
     - `skip-redundant` → ledger `skip-redundant` (silencioso §11.J da 001). Sem .md.
     - `skip-validation-failed` → ledger `skip-validation-failed` com `skip_reason` e `attempts`. Sem .md.
   - Atualiza `store/ledger.jsonl` conforme §18.

### 5.9 Ledger: `scan-finished` + resumo

Append:

```jsonl
{"ts":"<ISO 8601>","brief_id":null,"from_dir":null,"to_dir":null,"actor":"skill:radar-scan","extra":{"event":"scan-finished","scan_id":"<scan_id>","summary":{"researcher":{"total_searched":N,"total_returned":N,"total_skipped":N},"matcher":{"total_in":N,"total_promoted":N,"skipped":{"redundant":N,"low_score":N,"out_of_scope":N}},"briefer":{"created":N,"skip_redundant":N,"skip_validation_failed":N,"schema_invalid":N},"briefs_created":[<slug1>,<slug2>,...]}}}
```

### 5.10 Resumo final ao humano

Imprime no terminal o template do §9.

## 6. Validação JSON

Esta seção fixa a política de validação entre estágios — primeiro slice
fica em validação **ad-hoc inline** (parse + checagem de campos
obrigatórios + tipos básicos), com **JSON-schemas formais deferidos pra
spec futura**.

### 6.1 Por que ad-hoc no 1º slice

- Spec 002 §4, spec 003 §4 e spec 004 §4.2 já especificam o schema em
  prosa + bloco YAML/JSON. Replicar como JSON-schema formal (Draft
  2020-12, `$id`, `$ref`) é trabalho não-trivial e pode atrasar o
  slice. Validação inline cobre 90% dos casos (campos faltantes,
  tipos errados, enums fora da lista).
- O **session principal já é um LLM** rodando a skill — checagem
  estruturada pode ser feita por bash + `jq` (`jq -e '.findings[0].url'`,
  etc) ou por reasoning direto do modelo lendo o JSON.

### 6.2 Política

- **Pos-researcher (§5.5)**: `jq -e '.findings'` (existe e é array), `jq -e '.meta'` (existe e é object), `jq -e '.findings[].url'` (toda entrada tem URL string), `jq -e '.findings[].published_at'` (parseável como data). Se algum check falha → abort.
- **Pos-matcher (§5.7)**: idem com chaves do spec 003 §4. `jq -e '.ranked[].decision'` deve estar no enum.
- **Pos-briefer (§5.8)**: schema do brief (spec 004 §4.2). Especialmente: `brief.brief_id` casa pattern `^\d{4}-W\d{2}-\d{3}$`; `brief.slug` casa pattern; `brief.headline` `length <= 90` (spec 004 §6.2); `brief.hashtags.length` ∈ [5, 8] (spec 004 §6.5); `brief.hero_image_candidates.length <= 3` (spec 004 §8.1); `brief.pillar` não pode ser `4-bastidor`.

### 6.3 Schemas formais — diferimento

Sugestão: numa **spec futura (006-housekeeping ou separada)** criar
`docs/schemas/finding.json`, `ranked-entry.json`, `brief.json` em
JSON-Schema Draft 2020-12 + um helper `scripts/validate.sh` invocando
`ajv` ou `jsonschema`. **Não bloqueia o 1º slice**.

### 6.4 Falha de validação → comportamento

| Estágio | Falha | Ação |
|---|---|---|
| Researcher | JSON inválido ou campo obrigatório faltando | Abort scan. Ledger `scan-aborted`. Mensagem clara pro humano com o erro de jq. |
| Matcher | idem | Idem. Output do researcher é perdido (1º slice). |
| Briefer | idem **OU** brief não passa pattern/enum | Pula este finding. Ledger `brief-schema-invalid` com `finding_id` + `errors`. Continua pro próximo finding. **Outros briefs criados nesta scan ficam preservados.** |

## 7. `--dry-run`

Em `--dry-run`, a skill executa **somente** §5.1 e §5.2 (validação +
preparação) e emite relatório:

```
🧪 radar-scan --dry-run --scope=trends --pillar=6-mercado-rmbh
Plano:
  Scan ID:           2026-W22-scan-001
  Week key:          2026-W22
  Próximo NNN:       005 (4 briefs já existentes na semana entre os 4 dirs)
  Scope:             trends
  Pillar filter:     6-mercado-rmbh
  Target count:      10 (→ researcher buscará até 15)
  Allowed sources:   fipezap, abrainc, valor, globo-rural-imoveis, exame-imoveis
  Vault snapshot:    ✅ 7 paths lidos do always_load
  Briefs dirs:       ✅ 4 paths verificados
  Media dir:         ✅ /srv/apps/content-radar/store/media/pendente-aprovacao (existe)

Seriam invocados (sem rodar):
  → market-researcher (Sonnet 4.6)        — 1x
  → avanz-matcher (Sonnet 4.6)            — 1x
  → instagram-briefer (Opus 4.7)          — 0..15 (depende da matcher)

Nenhum arquivo será escrito. Nenhum evento no ledger.
```

**Não invoca subagentes.** Não escreve em nenhum lugar. Não consome
créditos de WebSearch/WebFetch. Pode ser executado infinitas vezes em
sequência sem efeito colateral.

## 8. Idempotência e re-execução

### 8.1 Re-rodar mesmo scope no mesmo dia

Cenário comum: humano rodou `--scope=trends --pillar=6-mercado-rmbh`
de manhã, gerou 5 briefs em `pendente-aprovacao/`. À tarde, quer
rodar de novo (talvez por curiosidade, talvez porque saiu notícia
nova).

**Comportamento esperado:**

- Researcher faz outra rodada de WebSearch — pode achar findings
  novos (se houve notícia entre execuções) **e/ou** os mesmos
  findings da manhã (gotcha 5).
- Matcher recebe esses findings. **Anti-repetição** (spec 003 §8)
  vê os 5 briefs em `pendente-aprovacao/` da manhã e marca como
  `redundant: true` qualquer finding cujo `topic_hash` (title-based)
  ou `source_urls` overlap com eles → `skip-redundant`.
- Briefer só recebe **findings novos** (não-redundantes da manhã).
  Faz a 2ª checagem com headline (spec 004 §10). Materializa o que
  sobrar.
- Resultado: 0 a N briefs adicionados. Sem duplicar nada.

Anti-repetição garante idempotência.

### 8.2 `--dry-run`

Idempotente por construção — sem side effects. Garantido.

### 8.3 Interrupção mid-scan

Se a skill for interrompida (Ctrl-C, erro de rede, timeout) entre o
ledger `scan-started` e o `scan-finished`:

- Ledger fica com `scan-started` sem `scan-finished` — **isso é o
  sinal** pra identificar runs interrompidas (§18 e §20 gotcha 2).
- Briefs parcialmente criados em `pendente-aprovacao/` ficam intactos
  (não há rollback).
- Mídia parcialmente baixada idem.
- Nova execução: anti-repetição cobre o que já foi criado. Ledger
  fica com 2 `scan-started` (um sem `scan-finished`, outro com) —
  acceptable; não há rollback do ledger no 1º slice.

## 9. Modelo, custo, performance

### 9.1 Modelos

| Camada | Modelo | Origem |
|---|---|---|
| Session principal (a skill `radar-scan` em si) | Modelo do usuário (default = Opus 4.7 ou Sonnet 4.6 conforme contexto) | Claude Code config |
| `market-researcher` | `claude-sonnet-4-6` | spec 002 §2 |
| `avanz-matcher` | `claude-sonnet-4-6` | spec 003 §2 |
| `instagram-briefer` | `claude-opus-4-7` | spec 004 §2 |

### 9.2 Custo aproximado por scan

Estimativa rough (1º slice — ajustar com dados reais após 4 semanas
de operação, conforme §11 critério 9 da spec 003):

| Estágio | Custo dominado por |
|---|---|
| Researcher | ~6 WebSearch queries (spec 002 §6 #3) + N WebFetch (até ~15) + 1 prompt Sonnet ~5–10k tokens |
| Matcher | 1 prompt Sonnet — vault Avanz (~30 KB) + N findings (~3–5 KB cada). ~30–50k tokens. |
| Briefer × N | Pra cada finding promovido (N = 3 a 10 esperado): vault + 4 dirs de briefs + 1 finding. ~25–40k tokens Opus + Bash curl downloads. |
| Orquestrador | Mínimo — só roda Task() N vezes e valida JSON. |

Total esperado por scan completo: **~$2–6 USD** em uso normal
(rough, ajustar com observação real).

### 9.3 Serialização do briefer

**No 1º slice, briefers rodam serial** (1 finding por vez), não em
paralelo. Justificativa em §20 gotcha 1:

- Race condition no contador `NNN` (spec 004 §15 gotcha 2).
- Race condition no anti-repetição definitivo (spec 004 §10.3).
- Volume baixo (3–10 briefers por scan) torna latência aceitável
  (~3–8 min total).

Paralelismo entra como pendência futura quando volume justificar
(lock file ou contador no ledger).

## 10. Saída pro humano (template literal)

Ao final da scan (modo normal), a skill imprime:

```
📡 radar-scan <scope=trends, pillar=6-mercado-rmbh>
Scan ID: 2026-W22-scan-001
Iniciado: 2026-05-27T14:32:00-03:00
Finalizado: 2026-05-27T14:38:11-03:00 (6m 11s)

Estágio 1 — researcher (Sonnet 4.6):
  18 URLs pesquisadas → 12 findings extraídos
  Skipped: 6 (out_of_window 2, paywall 2, source_not_allowed 1, fetch_failed 1)

Estágio 2 — matcher (Sonnet 4.6):
  12 findings recebidos → 6 promovidos, 4 low-score, 2 out-of-scope, 0 redundant
  Threshold usado: 0.55
  Top-3 scores: 0.916, 0.78, 0.71

Estágio 4 — briefer (Opus 4.7):
  6 promovidos → 5 briefs criados, 1 skip-redundant, 0 schema-invalid

Briefs criados em store/briefs/pendente-aprovacao/:
  - 2026-W22-005_lote-em-rmbh-valorizou-8-4-no-q1-2026-onde-mais.md
  - 2026-W22-006_lote-em-mateus-leme-com-15-min-a-menos-pra-bh-mg-050.md
  - 2026-W22-007_mcmv-2026-o-teto-subiu-mas-a-simulacao-caixa-diz.md
  - 2026-W22-008_novo-zoneamento-permite-loteamento-em-esmeraldas.md
  - 2026-W22-009_juros-em-baixa-impacto-no-financiamento-de-lote.md

Mídia baixada: 9 arquivos em store/media/pendente-aprovacao/
Ledger: 14 eventos novos em store/ledger.jsonl

→ Próximo passo: abrir cada .md, preencher hero_choice, rodar `/radar-mv <slug> approve`.
```

Em modo `--dry-run`, ver §7.

## 11. Erros e fallbacks

Resumo tabelado dos casos não-felizes:

| Caso | Estágio | Ação |
|---|---|---|
| WebSearch sem resultados (researcher devolve `findings: []`) | researcher | Continua. Matcher recebe vazio. Saída final: 0 briefs criados. **Não é erro.** |
| Researcher devolve `findings: []` por erro de quota (`meta.error` setado) | researcher | Continua mas loga warning. 0 briefs criados. Humano decide se re-roda. |
| Matcher rejeita todos (0 `promote-to-brief`) | matcher | Continua, briefer não é invocado. Saída: 0 briefs. Não é erro. |
| Researcher JSON inválido | validação §5.5 | **Abort scan.** Ledger `scan-aborted`. Mensagem clara. |
| Matcher JSON inválido | validação §5.7 | **Abort scan.** Output do researcher perdido. |
| Briefer JSON inválido (1 finding) | validação §5.8 | **Pula este finding.** Outros briefs preservados. |
| Briefer `decision: skip-validation-failed` (guardrail) | spec 004 §13.4 | Ledger; sem .md. Outros findings continuam. |
| Briefer `decision: skip-redundant` | spec 004 §10 | Ledger silencioso (§11.J); sem .md. |
| Bash `curl` falha em todos candidatos de mídia | spec 004 §13.1 | Brief ainda válido com `hero_image_candidates: []`. |
| `Task()` retorna erro (rede, modelo, etc) | qualquer estágio | Abort scan se researcher/matcher; pula finding se briefer. Ledger registra. |

## 12. `SKILL.md` literal — `.claude/skills/radar-scan/SKILL.md`

> Conteúdo proposto. A implementação (fase pós-spec) criará o arquivo
> com exatamente este conteúdo. **Esta spec NÃO cria o arquivo** — só
> descreve o que ele deve conter (decisão de escopo no input desta
> spec).

````markdown
---
name: radar-scan
description: |
  Orquestra o pipeline de descoberta do content-radar (researcher → matcher → briefer) para a Avanz Imóveis.
  Invoca os 3 subagentes via Task, valida JSON entre estágios, materializa briefs em
  store/briefs/pendente-aprovacao/ + mídia em store/media/pendente-aprovacao/ e atualiza store/ledger.jsonl.
  Use sempre que quiser **gerar pautas novas de Instagram** sob demanda. Não publica, não chama Open Design API.
argument-hint: |
  --scope=<trends|competitors|seasonal|cases|local> [--pillar=<1-imovel|2-decisao|3-inteligencia|5-quem-comprou|6-mercado-rmbh>] [--target-count=N] [--dry-run] [--scan-id=<id>]
---

# radar-scan

> Orquestrador do content-radar (1º slice). Lê manifest.yaml, valida args, prepara contexto, invoca
> os subagentes `market-researcher`, `avanz-matcher` e `instagram-briefer` na sequência, materializa
> briefs em arquivos `.md` e mídia local, escreve eventos no ledger. **Nunca publica no IG. Nunca chama
> Open Design API.** Publicação fica com `radar-handoff` (spec 007) e operação humana.

## Princípios duros

1. **Sem Pilar 4.** `--pillar=4-bastidor` → erro fatal. Bastidor vive nos stories (decisão humana ad-hoc),
   fora do escopo do radar (CLAUDE.md + spec 001 §3 + spec 003 §5.1).
2. **`--dry-run` é sagrado.** Em dry-run, **não invoque** Task() pra nenhum subagente. **Não escreva** em
   `store/`. **Não toque** no ledger. Só relate o plano (§7 da spec 005).
3. **Anti-repetição é responsabilidade dos subagentes.** Você não decide o que é redundante; matcher
   (spec 003 §8) e briefer (spec 004 §10) já checam. Você só persiste o que o briefer devolveu.
4. **Validação JSON é obrigatória entre estágios.** Researcher inválido → abort. Matcher inválido →
   abort. Briefer inválido pra 1 finding → skip aquele finding, continua. Spec 005 §6.
5. **Serial, não paralelo.** Briefers rodam um por vez no 1º slice. Race em `NNN` e anti-repetição
   intra-batch (spec 005 §9.3, §20 gotchas 1 e 4).
6. **Snapshot do vault no início.** Mudanças no vault Avanz mid-scan são ignoradas (§20 gotcha 5).

## Antes de começar

Carregue (via Read):
1. `/srv/apps/content-radar/manifest.yaml` (para `target_company`, `search_scopes`, `anti_repetition`,
   `storage`, `funnel`)
2. Arquivos em `target_company.always_load` (lista de paths absolutos do vault Avanz) — extraia
   trechos curtos pra injetar no researcher (stateless, spec 002 §3).
3. Liste `store/briefs/{pendente-aprovacao,pendente-publicacao,publicado,rejeitado}/` (frontmatters)
   só pra contar `NNN` e pra opcionalmente exibir contexto pro humano. **Não precisa ler conteúdo**;
   matcher/briefer fazem isso por conta própria.

## Args

- `--scope` (obrig.): chave de `manifest.search_scopes`.
- `--pillar` (opc.): rejeitar `4-bastidor` com erro; outros valores OK.
- `--target-count` (opc.): default = `manifest.funnel.candidates_per_week_target`.
- `--dry-run` (opc.): plano apenas.
- `--scan-id` (opc.): auto se omitido.

## Fluxo

Segue spec 005 §5 (10 passos). Após cada passo:

- **Estágio 1**: `Task(subagent_type='market-researcher', prompt=<bloco com scope, pillar_filter, window_days,
  target_count, max_per_source, allowed_sources, vault_paths>)`. Validar JSON (§5.5).
- **Estágio 2**: `Task(subagent_type='avanz-matcher', prompt=<bloco com scan_id, findings[], paths absolutos
  do vault e dos 4 dirs de briefs>)`. Validar JSON (§5.7).
- **Estágio 4**: pra cada `promote-to-brief`, `Task(subagent_type='instagram-briefer', prompt=<bloco
  spec 004 §3>)`. Validar JSON (§5.8). Materializar `.md` + ledger.

## Saída

Relatório no formato do §10 da spec 005. **JSON estruturado pro stdout** não é necessário — esta skill
roda no session principal, output é pro humano.

## Ledger

Append `store/ledger.jsonl` (JSONL append-only). Eventos: `scan-started`, `scan-aborted`,
`scan-finished`, `brief-created`, `skip-redundant`, `skip-validation-failed`, `skip-low-score`,
`skip-out-of-scope`, `brief-schema-invalid`. Schema canônico em spec 005 §18.

## NÃO faça

- ❌ Publicar no IG.
- ❌ Chamar Open Design API (`/api/chat` etc).
- ❌ Subir foto pro Cloudinary (isso é `radar-handoff`, spec 007).
- ❌ Editar briefs existentes em `pendente-aprovacao/` (briefer nasce do zero; humano edita à mão).
- ❌ Rodar dois `radar-scan` em paralelo no mesmo `week_key` (race no `NNN` — §20 gotcha 1).
- ❌ Buscar fora de `manifest.search_scopes[scope].sources`.
- ❌ Inventar args novos sem atualizar a spec 005 primeiro.
````

---

# Parte C — `radar-mv`

## 13. Argumentos

Frontmatter `argument-hint`:

```
<slug> approve|reject [--reason=<string>] [--dry-run]
```

| Arg | Tipo | Obrigatório? | Default | Notas |
|---|---|---|---|---|
| `<slug>` | string posicional | **sim** | — | Slug completo ou **prefixo único** (ex.: `2026-W22-001` resolve `2026-W22-001_lote-em-rmbh-...` se único). Ambíguo → lista matches + abort (§16). |
| `approve\|reject` | enum posicional | **sim** | — | Determina a transição. Outro valor → erro. |
| `--reason` | string | não | `""` | Recomendado em `reject`. Vai pro `review_notes` do brief + ledger. |
| `--dry-run` | flag | não | `false` | Reporta o que seria feito; sem `mv`, sem ledger. |

## 14. Pré-condições

Validação antes de qualquer side effect:

### approve

1. Brief existe em `store/briefs/pendente-aprovacao/` (resolvido por slug/prefixo).
2. Slug resolve a **exatamente 1 arquivo** (§16).
3. Frontmatter parseia como YAML válido.
4. **`hero_choice` está setado explicitamente** (`null` é OK, `0|1|2|...` também). O campo precisa **existir** no frontmatter — não pode ser inferido por default. Justificativa: spec 001 §11.C ("uso EXPLÍCITO") + spec 004 §8.3 (briefer nunca preenche; humano sempre decide).
5. Se `hero_choice` é int N: validar que `N ∈ [0, len(hero_image_candidates)-1]`. Caso contrário, erro.
6. Se `hero_choice` é int N: validar que `media/pendente-aprovacao/<slug>__N.<ext>` existe no disco (qualquer extensão `.jpg|.png|.webp|.gif`).
7. Se `hero_choice` é null: **warning** ao humano ("brief aprovado sem foto — Open Design vai improvisar/template; confirma?"). No 1º slice, aceitar como válido (§20 gotcha 9).

### reject

1. Brief existe em `pendente-aprovacao/`. (Não permite reject de brief já em `pendente-publicacao/` ou `publicado/` — esses precisam de outra skill ou intervenção manual.)
2. Slug resolve a 1 arquivo (§16).
3. `--reason` é fortemente recomendado mas não obrigatório (warning se ausente).

## 15. Fluxo

### 15.1 approve

1. Resolver slug → path absoluto do brief.
2. Validar pré-condições (§14).
3. Ler frontmatter via Read; extrair `hero_choice` + `hero_image_candidates`.
4. **Mover brief**:
   ```
   mv  store/briefs/pendente-aprovacao/<slug>.md
       store/briefs/pendente-publicacao/<slug>.md
   ```
5. **Atualizar frontmatter** do `.md` movido (Edit ou Write):
   - `updated_at: <agora ISO 8601>`
   - (frontmatter resto preservado)
6. **Mídia**:
   - Se `hero_choice == N` (int): mover **apenas** `media/pendente-aprovacao/<slug>__N.<ext>` → `media/pendente-publicacao/<slug>__N.<ext>`. **Apagar** todos os outros candidatos `<slug>__*.<ext>` em `media/pendente-aprovacao/` (eles não vão mais ser usados). Justificativa: spec 001 §3.3 (apenas a escolhida sobrevive) + economia de cache.
   - Se `hero_choice == null`: **apagar todos** os `media/pendente-aprovacao/<slug>__*` (sem foto vai pro próximo estágio).
7. **Append no ledger**:
   ```jsonl
   {"ts":"<ISO>","brief_id":"<id>","from_dir":"briefs/pendente-aprovacao","to_dir":"briefs/pendente-publicacao","actor":"skill:radar-mv","extra":{"event":"mv-approved","hero_choice":<N|null>,"media_kept":"<slug>__N.<ext>|none","reason":"<--reason ou null>"}}
   ```
8. Reporta sucesso ao humano:
   ```
   ✅ approved: 2026-W22-001_lote-em-rmbh-valorizou-8-4-no-q1-2026
      brief → pendente-publicacao/
      hero  → __0.jpg (mantido); __1.jpg removido
      ledger: 1 evento novo
      próximo passo: rode /radar-handoff (spec 007) pra subir Cloudinary + gerar package
   ```

### 15.2 reject

1. Resolver slug.
2. Pré-condições (§14).
3. Ler frontmatter.
4. **Mover brief**:
   ```
   mv  store/briefs/pendente-aprovacao/<slug>.md
       store/briefs/rejeitado/<slug>.md
   ```
5. **Atualizar frontmatter** do `.md` movido:
   - `updated_at: <agora>`
   - Append em `review_notes`: `\n[REJECT @ <ts>] <--reason ou "(sem motivo)">`. Preserva conteúdo anterior.
6. **Mídia**: **apagar TODOS** os candidatos `media/pendente-aprovacao/<slug>__*` (§11.K da 001 + §3.3 — rejeitado não tem mídia).
7. **Append no ledger**:
   ```jsonl
   {"ts":"<ISO>","brief_id":"<id>","from_dir":"briefs/pendente-aprovacao","to_dir":"briefs/rejeitado","actor":"skill:radar-mv","extra":{"event":"mv-rejected","reason":"<--reason ou null>","media_purged":["<slug>__0.jpg","<slug>__1.jpg"]}}
   ```
8. Reporta:
   ```
   🗑  rejected: 2026-W22-002_lote-em-mateus-leme-com-15-min...
      brief → rejeitado/
      mídia → 2 arquivos apagados (rejeitado sem mídia, §3.3 da 001)
      review_notes atualizado
      anti-repetição: topic_hash agora bloqueia re-propor por 30 dias (spec 003 §8.3)
   ```

### 15.3 `--dry-run`

Roda §15.1 ou §15.2 até a validação de pré-condições + plano. Reporta:

```
🧪 radar-mv --dry-run 2026-W22-001 approve
Plano:
  brief: store/briefs/pendente-aprovacao/2026-W22-001_lote-em-rmbh-valorizou-8-4-no-q1-2026.md
  destino: store/briefs/pendente-publicacao/2026-W22-001_lote-em-rmbh-valorizou-8-4-no-q1-2026.md
  hero_choice: 0
  mídia que SERIA mantida: 2026-W22-001_..._0.jpg
  mídia que SERIA apagada: 2026-W22-001_..._1.jpg, 2026-W22-001_..._2.jpg
  ledger: 1 evento mv-approved seria appendado

Nada foi modificado.
```

## 16. Idempotência e edge cases

### 16.1 Brief já em outro estado

- `radar-mv <slug> approve` quando brief já está em `pendente-publicacao/`:
  ```
  ❌ erro: brief já está em pendente-publicacao/ — use /radar-mark-published (spec 008) pra ir pra publicado/
  ```
- `radar-mv <slug> approve` quando brief está em `publicado/` ou `rejeitado/`:
  ```
  ❌ erro: brief está em <dir>/ — esse diretório é terminal no 1º slice
  ```
- `radar-mv <slug> reject` quando brief não está em `pendente-aprovacao/`:
  ```
  ❌ erro: só aceito rejeitar briefs em pendente-aprovacao/ — encontrado em <dir>/
  ```

### 16.2 Slug ambíguo

```
❌ slug "2026-W22" resolve a 5 arquivos:
   - 2026-W22-001_lote-em-rmbh...
   - 2026-W22-002_lote-em-mateus-leme...
   - 2026-W22-003_...
   - ...
Desambiguar.
```

### 16.3 Slug não encontrado

```
❌ slug "2026-W22-099" não bate com nenhum brief em pendente-aprovacao/.
```

### 16.4 `mv` cru pelo humano (sem skill)

Owner pode fazer `mv` direto no shell sem invocar a skill (`mv store/briefs/pendente-aprovacao/foo.md store/briefs/pendente-publicacao/`). **A skill aceita isso silenciosamente** — não trava. Mas o ledger fica **inconsistente** (transição sem evento). Documentado como gotcha (§20).

Mitigação: o ledger é "best-effort" no 1º slice. Quem quer auditoria total usa a skill.

### 16.5 `hero_choice` int fora de range

```
❌ hero_choice = 3 mas hero_image_candidates só tem índices [0, 1].
   Edite o .md e ajuste hero_choice antes de aprovar.
```

### 16.6 Foto referenciada por `hero_choice` não existe no disco

```
⚠️  hero_choice = 0, esperava store/media/pendente-aprovacao/<slug>__0.<ext> — não encontrado.
    Mídia pode ter sido apagada manualmente. Aprovar mesmo assim?
    (responda 'sim' / 'não'; sem responder = abort)
```

No 1º slice, perguntar ao humano. Se aceitar, segue como se `hero_choice == null` (apaga o que sobrou — provavelmente nada — e segue).

## 17. `SKILL.md` literal — `.claude/skills/radar-mv/SKILL.md`

> Mesma observação da §12: spec descreve, não cria.

````markdown
---
name: radar-mv
description: |
  Transição de estado físico de um brief do content-radar: pendente-aprovacao/ → pendente-publicacao/ (approve)
  ou pendente-aprovacao/ → rejeitado/ (reject). Move o .md, remaneja mídia conforme hero_choice (mantém só a
  foto escolhida no approve; apaga todas no reject) e escreve evento no ledger. Não chama Open Design,
  não sobe foto, não publica.
argument-hint: |
  <slug> approve|reject [--reason="<motivo>"] [--dry-run]
---

# radar-mv

> Transição de estado pós-revisão humana. Lê o frontmatter do brief em pendente-aprovacao/, valida
> hero_choice (approve) ou aceita o reject, faz `mv` do .md, remaneja mídia, escreve no ledger.

## Princípios duros

1. **hero_choice EXPLÍCITO.** No `approve`, o campo `hero_choice` precisa existir no frontmatter
   (`null`, `0`, `1`, ...). null permitido com warning ao humano. Default implícito → erro. Spec
   001 §11.C + spec 004 §8.3.
2. **rejeitado/ é terminal e sem mídia.** No `reject`, apagar TODOS os arquivos
   `media/pendente-aprovacao/<slug>__*`. Spec 001 §3.3 + §11.K.
3. **Approve mantém só a foto escolhida.** No `approve`, mover `<slug>__N.<ext>` (N = hero_choice)
   pra `media/pendente-publicacao/` e apagar os outros candidatos. Economiza cache e deixa claro
   pro próximo estágio o que importa.
4. **Pendente-publicacao/, publicado/, rejeitado/ são read-only via esta skill.** Quem está nesses
   dirs não passa por radar-mv. Approve só funciona em pendente-aprovacao/.
5. **`--dry-run` é sagrado.** Sem `mv`, sem ledger.

## Args

- `<slug>` (obrig.): slug completo ou prefixo único (resolução por glob em `pendente-aprovacao/`).
- `approve|reject` (obrig.): direção.
- `--reason="<string>"` (opc.): vai pro `review_notes` (reject) ou pro `extra.reason` do ledger.
- `--dry-run` (opc.): plano apenas.

## Fluxo approve

Spec 005 §15.1 (8 passos). Resumo:
1. Resolver slug → path único em pendente-aprovacao/.
2. Validar `hero_choice` (null ou int ∈ range).
3. Validar arquivo de mídia escolhida existe (warning se não — §16.6).
4. `mv` brief: pendente-aprovacao/ → pendente-publicacao/.
5. Atualizar `updated_at` no frontmatter.
6. `mv` mídia escolhida; apagar candidatos restantes em pendente-aprovacao/.
7. Append no ledger (`event: mv-approved`).
8. Reportar pro humano.

## Fluxo reject

Spec 005 §15.2 (8 passos). Resumo:
1. Resolver slug.
2. Validar pré-condições (brief em pendente-aprovacao/).
3. Ler frontmatter.
4. `mv` brief: pendente-aprovacao/ → rejeitado/.
5. Atualizar `updated_at` + append em `review_notes` com `--reason`.
6. Apagar TODOS os `media/pendente-aprovacao/<slug>__*`.
7. Append no ledger (`event: mv-rejected`).
8. Reportar.

## Edge cases

Ver spec 005 §16:
- brief já em outro estado → erro com sugestão da skill correta.
- slug ambíguo → lista matches + abort.
- slug não encontrado → erro.
- hero_choice fora de range → erro.
- mídia ausente → warning + pergunta ao humano.
- `mv` cru sem skill → aceitar silenciosamente; ledger inconsistente (gotcha conhecido).

## NÃO faça

- ❌ Chamar Open Design API.
- ❌ Subir foto pro Cloudinary (radar-handoff faz).
- ❌ Re-mover brief de pendente-publicacao/ → publicado/ (radar-mark-published faz; spec 008).
- ❌ Apagar `.md` (rejeitado/ preserva o arquivo — anti-repetição precisa dele 30d).
- ❌ Confiar que humano fez `mv` cru — pode ter feito; ledger não tem evento.
````

---

# Parte D — Comum

## 18. Ledger — formato canônico

Refina e fixa [`001 §6.3`](./001-foundation.md#63-ledger-storeledgerjsonl).

### 18.1 Localização e formato

- Path: `/srv/apps/content-radar/store/ledger.jsonl`.
- Formato: **JSONL append-only** (1 evento por linha). Nunca reescrever; nunca remover linhas.
- Encoding: UTF-8.
- Não há `index`/`rotate` no 1º slice — arquivo cresce monotonicamente. Estimativa: ~15–50 eventos por scan × ~50 scans/ano ≈ ~1500 linhas/ano (negligível).

### 18.2 Schema de cada evento

```json
{
  "ts": "<ISO 8601 com timezone, -03:00>",
  "brief_id": "<id, ex 2026-W22-001>|null",
  "from_dir": "<relativo a store/, ex 'briefs/pendente-aprovacao'>|null",
  "to_dir":   "<idem>|null",
  "actor":    "skill:radar-scan|skill:radar-mv|agent:market-researcher|agent:avanz-matcher|agent:instagram-briefer",
  "extra":    { /* objeto opaco específico do evento */ }
}
```

`brief_id` pode ser null para eventos de scope da scan (start/finish) ou para `skip-*` sem brief gerado.

### 18.3 Eventos canônicos (1º slice)

| `extra.event` | Origem | `from_dir` | `to_dir` | `brief_id` |
|---|---|---|---|---|
| `scan-started` | skill:radar-scan | null | null | null |
| `scan-aborted` | skill:radar-scan | null | null | null |
| `scan-finished` | skill:radar-scan | null | null | null |
| `brief-created` | skill:radar-scan (após briefer) | null | `briefs/pendente-aprovacao` | setado |
| `brief-schema-invalid` | skill:radar-scan | null | null | null (sem brief) |
| `skip-redundant` | skill:radar-scan (matcher ou briefer) | null | null | null |
| `skip-low-score` | skill:radar-scan (matcher) | null | null | null |
| `skip-out-of-scope` | skill:radar-scan (matcher) | null | null | null |
| `skip-validation-failed` | skill:radar-scan (briefer guardrail) | null | null | null |
| `mv-approved` | skill:radar-mv | `briefs/pendente-aprovacao` | `briefs/pendente-publicacao` | setado |
| `mv-rejected` | skill:radar-mv | `briefs/pendente-aprovacao` | `briefs/rejeitado` | setado |

### 18.4 Eventos futuros (referenciados, não emitidos pelo 1º slice)

| `extra.event` | Origem | Spec |
|---|---|---|
| `cloudinary-uploaded` | skill:radar-handoff | 007 |
| `package-created` | skill:radar-handoff | 007 |
| `published` | skill:radar-mark-published | 008 |

### 18.5 Exemplos (uma scan completa)

```jsonl
{"ts":"2026-05-27T14:32:00-03:00","brief_id":null,"from_dir":null,"to_dir":null,"actor":"skill:radar-scan","extra":{"event":"scan-started","scan_id":"2026-W22-scan-001","scope":"trends","pillar_filter":"6-mercado-rmbh","target_count":10,"week_key":"2026-W22"}}
{"ts":"2026-05-27T14:35:11-03:00","brief_id":"2026-W22-005","from_dir":null,"to_dir":"briefs/pendente-aprovacao","actor":"skill:radar-scan","extra":{"event":"brief-created","slug":"2026-W22-005_lote-em-rmbh-valorizou-8-4-no-q1-2026","pillar":"6-mercado-rmbh","icp":"investidor","match_score":0.916,"media_files":["2026-W22-005_...__0.png"]}}
{"ts":"2026-05-27T14:36:02-03:00","brief_id":null,"from_dir":null,"to_dir":null,"actor":"skill:radar-scan","extra":{"event":"skip-redundant","reason":"topic_hash collision with 2026-W22-005 in pendente-aprovacao (in_flight_check)","finding_url":"https://valor.globo.com/.../fipezap-q1.ghtml"}}
{"ts":"2026-05-27T14:38:11-03:00","brief_id":null,"from_dir":null,"to_dir":null,"actor":"skill:radar-scan","extra":{"event":"scan-finished","scan_id":"2026-W22-scan-001","summary":{"briefs_created":["2026-W22-005","2026-W22-006","2026-W22-007"],"skip_redundant":1,"skip_validation_failed":0}}}
{"ts":"2026-05-27T15:01:00-03:00","brief_id":"2026-W22-005","from_dir":"briefs/pendente-aprovacao","to_dir":"briefs/pendente-publicacao","actor":"skill:radar-mv","extra":{"event":"mv-approved","hero_choice":0,"media_kept":"2026-W22-005_...__0.png","reason":null}}
```

## 19. Critério §10 da spec 001 — como esta spec contribui

A spec 005 fecha o **escopo do 1º slice** pegando carona nos critérios da [`001 §10`](./001-foundation.md#10-primeiro-slice-vertical-escopo-do-primeiro-passo):

| Item do critério da 001 §10 | Esta spec cobre? | Como |
|---|---|---|
| 1. `radar-scan --scope=trends --pillar=6-mercado-rmbh` roda sem erro | ✅ | Parte B inteira; em particular §5 + §11. |
| 2. Output do researcher passa validação JSON-schema | ✅ | §6 (validação ad-hoc inline). Schemas formais ficam pra spec futura. |
| 2a (spec 002 §8.3) — researcher devolve JSON estrito | ✅ | §5.5. |
| 3. Gera ≥3 briefs válidos com imagens baixadas | ✅ | §5.8 + spec 004 §8 (briefer já cobre download). Esta spec valida + materializa `.md`. |
| 4. Anti-repetição rejeita pauta com topic_hash colidente | ✅ | Indireto — anti-repetição mora nos subagentes (specs 003 §8 e 004 §10); esta spec só persiste o `skip-redundant` no ledger. **Sub-item satisfeito**: §5.8 + §18.3. |
| 5. Owner aprova brief via `radar-mv approve` | ✅ | Parte C — §15.1. |
| 6. Owner abre pacote no Smart Design (< 5 min) | ❌ | Fora — depende da spec 007 (`radar-handoff`). |

Os itens 1, 2, 2a, 3, 4 e 5 são **completamente cobertos** por esta
spec + 002/003/004. Item 6 é a próxima fronteira (spec 007).

## 20. Gotchas

| # | Caso | Mitigação |
|---|---|---|
| 1 | **Race condition em scans paralelos no mesmo `week_key`.** Duas execuções de `radar-scan` podem calcular `NEXT_NNN` idêntico → slugs colidem. | 1º slice: aceitar limitação — humano não roda 2 scans simultâneos. Documentado em `SKILL.md` (§12) na seção "NÃO faça". Solução futura: lock file `store/.scan.lock` ou contador atômico no ledger. |
| 2 | **Ledger não tem rollback.** Scan interrompida deixa `scan-started` sem `scan-finished`; briefs parciais ficam. | Sem rollback no 1º slice. Detectar runs interrompidas via `jq` no ledger ("scan-started sem scan-finished correspondente"). Próxima scan respeita anti-repetição e segue. §8.3. |
| 3 | **`hero_choice` precisa de input humano antes de `mv approve`.** Editor pode esquecer; skill precisa cobrar. | §14 (pré-condição obrigatória). null OK com warning; ausente → erro. |
| 4 | **Briefer já baixou as imagens.** Orquestrador NÃO baixa de novo. Spec 004 §8 cobre. Só valida que `local_path` existe. | §5.8 — orquestrador checa existência, mas não falha se `hero_image_candidates: []` (spec 004 §13.1). |
| 5 | **Vault Avanz pode mudar mid-scan.** Owner editando `positioning.md` enquanto researcher roda → matcher vê versão diferente. | Snapshot do vault no §5.2 fica em variável do session — mas o **matcher** e o **briefer** fazem Read próprio do vault (stateful, specs 003/004). Mitigação: 1ª scan que pega mudança "mistura versões" — aceitar. Owner deve evitar editar vault durante scan. Spec não força nada. |
| 6 | **`--dry-run` no `radar-scan` não invoca Task.** Não há modo "preview" nativo nos subagentes. | Decisão: dry-run só faz §5.1 + §5.2 + relatório. Não simula chamadas. Custo zero. Cobertura: validação de args, paths, snapshot vault. **Não cobre** falhas em runtime dos subagentes — humano só descobre rodando real. |
| 7 | **Skill não chama Open Design API.** No 1º slice é opção 1 da spec 001 §8.3 (package handoff manual). | Ambas as skills NÃO fazem `POST 127.0.0.1:7457/api/chat`. Reforçado no `SKILL.md` (§12 + §17 — seção "NÃO faça"). Opção 3 é spec 012, fora deste documento. |
| 8 | **Validação JSON antes do próximo estágio.** Erro de validação no researcher quebra matcher silenciosamente se não validar. | §6.4 — abort linear se researcher/matcher; skip de finding se briefer. Ledger registra. |
| 9 | **`hero_choice: null` no approve — válido ou exigir escolha?** Decisão: **null permitido com warning**. Justificativa: spec 001 §11.C aceita null (Open Design improvisa), e forçar escolha quando finding não tinha foto utilizável criaria fricção sem ganho. | §14 item 7. Warning ao humano confirma intenção. |
| 10 | **`mv` cru pelo humano (sem skill) deixa ledger inconsistente.** | §16.4 — aceitar; ledger é best-effort. Spec 003/004 anti-repetição leem **arquivos** (não ledger), então `mv` cru não quebra anti-rep — só perde auditoria. |
| 11 | **`Task()` pode retornar erro estranho (modelo indisponível, quota, timeout).** | §11 — abort se researcher/matcher; skip de finding se briefer. Mensagem clara pro humano. Sem retry automático no 1º slice (orçamento). |
| 12 | **Briefs criados em scan interrompida ficam "órfãos" de scan-finished.** Próxima scan os vê como `pendente-aprovacao/` e respeita anti-repetição normalmente — não há prejuízo, só o ledger fica esquisito. | Aceitar. §20 gotcha 2. |

## 21. Critérios de pronto da spec

1. **Arquivos `.claude/skills/radar-scan/SKILL.md` e `.claude/skills/radar-mv/SKILL.md`** existem com o conteúdo proposto nas §12 e §17 desta spec (literal, sem edição estrutural).
2. **`radar-scan --dry-run --scope=trends --pillar=6-mercado-rmbh`** reporta o plano (§7) sem escrever nada em disco — `store/ledger.jsonl` não recebe linhas novas; `store/briefs/` e `store/media/` ficam inalterados.
3. **Execução real** (`radar-scan --scope=trends --pillar=6-mercado-rmbh`) produz **≥1 brief** em `store/briefs/pendente-aprovacao/` com schema válido (spec 004 §4.2), e os eventos `scan-started`, `brief-created` (×N), `scan-finished` aparecem no ledger.
4. **`radar-mv <slug> approve`** (com `hero_choice` setado no frontmatter) move o `.md` para `pendente-publicacao/`, move **apenas** a foto escolhida, apaga os outros candidatos, atualiza `updated_at` e adiciona `mv-approved` ao ledger.
5. **`radar-mv <slug> reject --reason="..."`** move o `.md` para `rejeitado/`, **apaga todos** os arquivos de mídia em `pendente-aprovacao/<slug>__*`, atualiza `review_notes` no frontmatter e adiciona `mv-rejected` ao ledger.
6. **Validação JSON entre estágios funciona**: forçar (em teste) researcher a devolver JSON faltando `findings` → skill aborta com mensagem clara e `scan-aborted` no ledger.
7. **`radar-mv --dry-run`** não modifica nada (sem `mv`, sem ledger, sem alteração no `.md`).
8. **Slug ambíguo em `radar-mv`** lista os matches e aborta sem tocar em nada.

Itens 1–7 são pré-requisitos pro merge da spec; item 8 é UX
desejável mas não-bloqueante.

## 22. Decisões a registrar na 001 §11

_Nenhuma — todas as decisões resolvidas dentro da spec 005._

- **Skill como diretório dedicado** (`.claude/skills/<slug>/SKILL.md`) vs arquivo flat — resolvido em §3 (diretório dedicado). Convenção interna; não afeta nenhuma decisão estratégica da foundation.
- **Validação JSON ad-hoc** (não JSON-Schema formal) — resolvido em §6 (ad-hoc no 1º slice; schemas formais ficam pra spec futura, sem bloquear).
- **Briefers serial, não paralelo** — resolvido em §9.3 (serial). Pendência futura listada em §20 gotcha 1.
- **`--dry-run` não invoca Task** — resolvido em §20 gotcha 6 (não simula chamadas; custo zero).
- **`hero_choice: null` permitido no approve com warning** — resolvido em §20 gotcha 9 (alinhado a spec 001 §11.C).

Se owner discordar de qualquer um, abrir nova decisão `§11.Q` (próxima
letra livre) na foundation 001.

## 23. Glossário

Só termos novos introduzidos nesta spec:

- **`scan_id`**: identificador de uma execução do `radar-scan`. Formato: `<week_key>-scan-<NNN>` (ex.: `2026-W22-scan-001`). NNN cresce dentro da mesma semana, contando eventos `scan-started` no ledger.
- **`scan-started` / `scan-finished` / `scan-aborted`**: eventos canônicos do ledger marcando início, conclusão limpa e abort por falha (respectivamente) de uma execução do `radar-scan`. Schema em §18.
- **dry-run**: flag das duas skills que executa o caminho de validação + planejamento sem efeitos colaterais. Não invoca `Task`; não escreve em `store/`; não toca no ledger. Spec 005 §7 (`radar-scan`) e §15.3 (`radar-mv`).
- **prefixo único** (em `radar-mv <slug>`): forma curta do slug que resolve a exatamente 1 arquivo em `pendente-aprovacao/`. Ex.: `2026-W22-005` resolve `2026-W22-005_lote-em-rmbh-...md` se for o único brief 005 da semana W22. Spec 005 §13 + §16.2.
- **transição de estado físico**: ato de `mv` um brief entre os 4 diretórios físicos de `store/briefs/`. Convenção: cada transição é **um evento no ledger** (`mv-approved`, `mv-rejected`, `published`, etc). Esta spec implementa as 2 transições do 1º slice; spec 008 cobre `publicado`.
- **scan serial**: invocação dos briefers um por vez (não em paralelo) dentro de uma scan, conforme §9.3. Justificativa: race em `NNN` e na anti-repetição definitiva. Não-paralelismo é decisão do 1º slice; volume futuro pode justificar revisitar.
