---
spec_id: 001-foundation
title: "content-radar — Foundation: arquitetura, lifecycle e primeiro slice"
status: draft
version: 0.10.0
data: 2026-05-28
autor: claude (handoff p/ owner igorg7)
empresa_alvo: avanz-imoveis
escopo: foundation + 1º slice vertical (researcher → matcher → briefer manual, sem planner)
changelog:
  - "v0.10.0 (2026-05-28): audit cruzado pré-implementação resolve 5 incoerências detectadas entre specs/manifest/vault. (1 crítica) Schema 002↔003 alinhado: 002 v0.2.0 ganha `finding_id`, `fetched_at`, `geo_hints[]` + lista canônica de geo_keywords (§4.4) + `raw_excerpt` → `raw_excerpts` (array); 003 v0.2.0 renomeia `source` → `source_key` e documenta extras propagados. (2 média) Schema 003→004 alinhado: 003 v0.2.0 renomeia `topic_hash` → `topic_hash_matcher` no output do `ranked[]` e adiciona `source_relevance_hints[]` (derivado do breakdown). (3 média) Telefone Avanz canonicalizado: novo bloco `manifest.target_company.brand_facts` (phone_display, phone_e164, phone_secondary_e164, main_channel); 004 v0.1.2 e 007 v0.1.1 deixam de hardcodar — apontam pro manifest. (4 baixa) `manifest.target_company.per_pillar[\"1-imovel\"]` ganha `pilar-1-imovel-da-semana.md`. (5 baixa) Enum `od_skill_ref` em 004 §4.2 reduzido a 3 valores (skills sem atribuição na matriz §5 saem do enum). Implementação fica destravada."
  - "v0.9.0 (2026-05-27): spec 007 (`radar-handoff`) escrita (1320 linhas) — fecha a última peça do 1º slice. Cobre upload Cloudinary via signed POST em bash puro (curl + sha1sum + jq), modo placeholder pra rodar sem credenciais (sentinel `<PENDING_CLOUDINARY>`), template completo do README do package, brief simplificado pro humano operar no Smart Design, idempotência granular (sem `--force`: pula upload mas re-renderiza package). §3.1 marca radar-handoff ✅; §9 item 7 ✅; §12 reordenado. **TODAS as specs do 1º slice escritas** — implementação pode começar mesmo sem Cloudinary (via `--placeholder-mode`). Pendência menor herdada: confirmar signed vs unsigned upload (spec 007 §18). Nenhuma decisão §11 nova."
  - "v0.8.0 (2026-05-27): spec 005 (`radar-scan` + `radar-mv`) escrita (990 linhas) — fecha as duas skills de orquestração do 1º slice. §3.1 marca radar-scan e radar-mv ✅; §9 item 5 ✅; §12 reordenado (spec 005 sai dos pendentes). Pipeline fim-a-fim agora tem todas as specs escritas — só falta spec 007 (radar-handoff + Cloudinary, bloqueada por credenciais) pra completar o slice mínimo. Nenhuma decisão §11 nova."
  - "v0.7.0 (2026-05-27): spec 004 (`instagram-briefer`) escrita (1293 linhas) — fecha schema do brief (formaliza JSON-schema antes esboçado em §6.1), define matriz pilar→skill do Open Design (§5 da 004), descreve geração de copy/visual + hero handling via Bash+curl, anti-repetição definitiva headline-based, política §11.P agregadores. §3.2 e §9 atualizados marcando briefer ✅; §12 reordenado. Pendência menor herdada: confirmar headline `maxLength: 90` (spec 004 §17). Após este bump, 3/4 subagentes estão especificados (researcher, matcher, briefer); planner fica pra spec 011."
  - "v0.6.0 (2026-05-27): §11.O e §11.P resolvidas pelo owner. §11.O deferido pra spec 010 (baseDir do projeto Avanz no Open Design fica não setado até lá; cwd cai em PROJECTS_DIR/<id>/, suficiente pro 1º slice via opção 1). §11.P resolvido seguindo default: aceitar agregadores secundários, mas priorizar primárias via `source_key` canônico + marcar repasses no `relevance_hint`. Nenhuma decisão §11 fica pendente após este bump. §12 reordenado refletindo a resolução."
  - "v0.5.0 (2026-05-27): integra outputs das specs 002 (researcher) e 003 (matcher) escritas em paralelo. Resolve §11.I (match_score_min = 0.55, weights definidos); marca researcher stateless em §3.2; §5 ganha parágrafo sobre dupla checagem anti-repetição matcher+briefer; §6.1 ganha `source_relevance_hints[]` + exemplo de match_score_breakdown calibrado; §10 ganha critério de validação JSON do output do researcher; abre §11.P (política sobre agregadores como release ABRAINC republicada). Specs 002 e 003 referenciadas em §9 e §12."
  - "v0.4.0 (2026-05-27): incorpora INTEGRACAO-OPEN-DESIGN.md — opção 3 (API direta) agora tem endpoint concreto (`/api/chat` no daemon, SSE) e projeto Avanz existente (`00da0d59-836a-432f-8d78-23aa75b44115`); resolve §11.M (package handoff no 1º slice, API direta vira spec 011 viável) e §11.N (conta nova Cloudinary, aguarda provisionamento); clarifica semântica de §11.H (10 = alvo de GERAÇÃO de candidatos/sem, não publicação)."
  - "v0.3.0 (2026-05-27): correção crítica — sistema downstream é Open Design, não design-engine. Reescreve §8 inteira."
  - "v0.2.0 (2026-05-26): status vira diretórios físicos; hero_image_candidates + hero_choice; store/ versionado."
  - "v0.1.0 (2026-05-26): primeira versão da spec."
related:
  - /srv/apps/content-radar/manifest.yaml
  - /srv/apps/content-radar/INTEGRACAO-OPEN-DESIGN.md
  - /srv/apps/content-radar/docs/specs/002-researcher.md
  - /srv/apps/content-radar/docs/specs/003-matcher.md
  - /srv/apps/content-radar/docs/specs/004-briefer.md
  - /srv/apps/content-radar/docs/specs/005-skill-scan.md
  - /srv/apps/content-radar/docs/specs/007-handoff.md
  - /srv/my-mind/Empresas/avanz-imoveis/manifest.yaml
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md
  - /srv/apps/open-design/DEPLOY.md
  - /srv/apps/open-design/apps/daemon/src/server.ts
  - /srv/apps/open-design/skills/ad-creative/SKILL.md
  - /srv/apps/open-design/skills/poster-hero/SKILL.md
---

# Spec 001 — Foundation

> Este documento define **arquitetura, contratos de dados e o primeiro slice vertical**
> do `content-radar`. Decisões §11.A–P todas resolvidas (2026-05-27); nenhuma pendente.

## 1. Objetivo

Construir um **motor sob demanda** que:

1. **Pesquisa** conteúdo público relevante ao mercado imobiliário (5 escopos
   configuráveis em [`manifest.yaml`](../../manifest.yaml)).
2. **Cruza** o achado com o perfil/estratégia da empresa-alvo (Avanz Imóveis),
   atribuindo um score de match e justificativa.
3. **Planeja** distribuição dos achados aprovados ao longo da semana, respeitando
   a [`cadencia-editorial.md`](/srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md)
   da empresa.
4. **Briefa** cada pauta aprovada no formato esperado pelo **Open Design**
   (sistema downstream que roda em `design.consultorivandias.com.br` —
   ver §8), referenciando os prompts versionados da Avanz
   (`post-imovel.json`, `post-mes.json`, `icp-modifiers.json`) e apontando
   pra uma **skill do Open Design** que vai materializar o post.
5. **Persiste** pautas em arquivos legíveis (markdown + YAML frontmatter)
   organizadas em **diretórios físicos por estado** (`pendente-aprovacao` /
   `pendente-publicacao` / `publicado` / `rejeitado`). Brief e mídia caminham
   juntos pelo mesmo ciclo. Mídia hero vai pra **Cloudinary** após aprovação.

## 2. Visão do sistema

```
                        ┌──────────────────────────────────────────────────┐
                        │           skill: radar-scan <scope>              │
                        │  (Claude Code, cwd=/srv/apps/content-radar)      │
                        └──────────────────────────────────────────────────┘
                                          │
                                          ▼
       ┌────────────────────────────────────────────────────────────────┐
       │   1. researcher    WebSearch + WebFetch + (opcional) og:image  │
       │      → list of findings: {url, title, summary, date, source,   │
       │                           image_candidates: [{url, alt}]}      │
       └────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
       ┌────────────────────────────────────────────────────────────────┐
       │   2. matcher           lê vault.avanz/* + icp-modifiers.json   │
       │      → ranked findings: {finding, score, pillar, icp, why}     │
       │   (skip findings redundantes — §11.J)                          │
       └────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
       ┌────────────────────────────────────────────────────────────────┐
       │   3. planner           consulta cadencia-editorial.md +        │
       │                        store/calendar/<week>.md + archive      │
       │      → assigned slots: {finding, day, pillar, sequence_id}     │
       └────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
       ┌────────────────────────────────────────────────────────────────┐
       │   4. briefer           lê prompts/post-imovel.json etc;        │
       │                        baixa candidatos de imagem (local);     │
       │                        escolhe skill do Open Design (§8.3)     │
       │      → store/briefs/pendente-aprovacao/<slug>.md +             │
       │        store/media/pendente-aprovacao/<slug>__N.{jpg|png|webp} │
       └────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
       ╭──────── revisão humana (editor mexe direto no FS) ──────────╮
       │   • abre o .md, edita copy/headline/CTA                      │
       │   • marca `hero_choice: <N>` ou `null` (uso explícito)        │
       │   • `mv` brief + mídia →                                      │
       │       pendente-publicacao/   (aprova)                         │
       │       rejeitado/             (descarta)                       │
       ╰─────────────────────────────────────────────────────────────╯
                                          │
                       ┌──────────────────┴───────────────────┐
                       ▼                                      ▼
       briefs/pendente-publicacao/<slug>.md         briefs/rejeitado/<slug>.md
                       │                                      │
                       ▼                                      │ (anti-repetição)
       ┌─────────────────────────────────────┐
       │   skill: radar-handoff              │   ← era "publish"; mudou em v0.3.0
       │   1. upload hero pra Cloudinary     │      (Open Design não tem endpoint
       │      → grava cloud_url no brief     │       REST "POST e me devolve PNG")
       │   2. produz "package" pro humano    │
       │      operar no Smart Design (§8.3)  │
       │   3. grava package_path no brief    │
       └─────────────────────────────────────┘
                       │
            humano abre design.consultorivandias.com.br,
            cola brief + foto, agente gera artifact, publica no IG
                       │
                       ▼
       ┌─────────────────────────────────────┐
       │   skill: radar-mark-published       │
       │   mv brief+media → publicado/       │
       │   grava ig_post_url + published_at  │
       └─────────────────────────────────────┘
                       │
                       ▼
       briefs/publicado/<slug>.md   →   anti-repetição (90d)
```

## 3. Componentes

### 3.1 Skills (`.claude/skills/`)

| Slug                     | Função                                                              | Estado |
|--------------------------|---------------------------------------------------------------------|--------|
| `radar-scan`             | Orquestra pipeline (1)→(4); aceita `<scope>` e `<pillar_filter>`    | ✅ [spec 005](./005-skill-scan.md) |
| `radar-plan`             | Roda só estágio (3) sobre briefs em `pendente-publicacao`           | spec 011 |
| `radar-review`           | Lista briefs por diretório; filtra por semana, pilar                 | spec 006 |
| `radar-mv`               | Transição `pendente-aprovacao → pendente-publicacao | rejeitado` + ledger | ✅ [spec 005](./005-skill-scan.md) |
| `radar-handoff`          | Upload Cloudinary + gera pacote pro humano operar no Smart Design   | ✅ [spec 007](./007-handoff.md) |
| `radar-mark-published`   | Move brief+mídia `pendente-publicacao/ → publicado/`                 | spec 008 |

### 3.2 Subagentes (`.claude/agents/`)

| Slug                 | Estágio | Ferramentas                          | Modelo (§11.A) | Estado |
|----------------------|---------|--------------------------------------|----------------|--------|
| `market-researcher`  | (1)     | **WebSearch, WebFetch** (stateless — sem Read/Write/Bash) | Sonnet 4.6 | ✅ [spec 002](./002-researcher.md) |
| `avanz-matcher`      | (2)     | Read (vault.avanz/*)                 | Sonnet 4.6     | ✅ [spec 003](./003-matcher.md) |
| `editorial-planner`  | (3)     | Read, Write (store/calendar/*)       | Sonnet 4.6     | pendente (spec 011) |
| `instagram-briefer`  | (4)     | Read (vault + briefs/), Write (store/*), Bash (curl hero) | **Opus 4.7**   | ✅ [spec 004](./004-briefer.md) |

> **Stateless researcher** (definido na spec 002): o `market-researcher`
> não tem acesso a Read/Write/Bash. O orquestrador injeta trechos do vault
> Avanz inline no prompt; o agente devolve JSON estruturado puro. Reduz
> superfície de erro e força contrato explícito de input.

Cada subagente é um arquivo `.md` com frontmatter (`name`, `tools`, `model`) e
prompt definindo entrada/saída.

### 3.3 Storage (`./store/`) — diretórios físicos por estado

Resposta §11.G + §11.E + §11.K + §11.L aplicadas.

```
store/
├── briefs/
│   ├── pendente-aprovacao/<slug>.md       ← saída fresh do scan; aguarda editor
│   ├── pendente-publicacao/<slug>.md      ← aprovado; alimenta radar-handoff
│   ├── publicado/<slug>.md                ← publicado no IG (mv manual via skill)
│   └── rejeitado/<slug>.md                ← descartado (anti-repetição)
├── media/                                  ← GITIGNORED (§11.L); Cloudinary é fonte da verdade após upload
│   ├── pendente-aprovacao/<slug>__N.{jpg|png|webp}   ← N = índice do candidato
│   ├── pendente-publicacao/<slug>__N.{jpg|png|webp}  ← apenas a foto escolhida
│   ├── publicado/<slug>__N.{jpg|png|webp}            ← cache local (purga 30d)
│   └── rejeitado/  (vazio — sem mídia)
├── packages/                               ← pacotes gerados pelo radar-handoff
│   └── <slug>/                             ← markdown + URLs Cloudinary + instruções p/ humano
├── calendar/<YYYY-Www>.md                  ← plano semanal (1 arquivo/semana)
└── ledger.jsonl                            ← append-only: cada transição de estado
```

**Naming**:
- `<slug>` = kebab-case derivado da headline normalizada, prefixado por
  `<YYYY-Www-NNN>` pra ordenação estável.
  Ex: `2026-W22-001_fipezap-bh-lote-valorizacao-q1`.
- Candidatos de imagem têm sufixo `__N` (`__0`, `__1`, ...) onde `N`
  corresponde ao índice em `hero_image_candidates[]` do brief.
- Mídia local serve como buffer até upload Cloudinary; após `radar-handoff`,
  `cloud_url` no brief vira fonte da verdade. Cache local de `publicado/`
  é purgado após 30 dias (purga **lazy/on-demand** — spec 009, decisão §11.U;
  **não** cron de sistema).

## 4. Lifecycle de uma pauta

```
                radar-scan
                    │
                    ▼
       ┌────────────────────────────────┐
       │ briefs/pendente-aprovacao/     │
       │ media/pendente-aprovacao/      │
       └────────────────────────────────┘
                    │
        editor revisa + edita (hero_choice, copy)
                    │
            ┌───────┴────────┐
            │                │
       radar-mv approve   radar-mv reject
            │                │
            ▼                ▼
  ┌───────────────────┐  ┌─────────────────┐
  │ briefs/pendente-  │  │ briefs/         │
  │ publicacao/       │  │ rejeitado/      │──▶ anti-repetição
  │ media/pendente-   │  │ (sem media)     │
  │ publicacao/       │  └─────────────────┘
  └───────────────────┘
            │
   skill: radar-handoff
   (upload Cloudinary + gera package; brief permanece em pendente-publicacao)
            │
   humano opera no Smart Design e publica no IG
            │
   skill: radar-mark-published <slug> --ig-url=...
            │
            ▼
  ┌───────────────────┐
  │ briefs/publicado/ │──▶ anti-repetição (janela 90d)
  │ media/publicado/  │
  └───────────────────┘
```

**Regras de transição**:

- Toda transição grava evento em `store/ledger.jsonl`.
- Transições são feitas via skill (`radar-mv`, `radar-handoff`,
  `radar-mark-published`) ou `mv` cru. A skill grava ledger; `mv` cru não —
  evitar.
- `radar-handoff` é **idempotente**: re-rodar sobre brief com
  `cloudinary_public_id` já gravado pula upload (a menos que `--force`).
- `rejeitado/` é terminal — nunca move pra outro diretório.

## 5. Anti-repetição

**Regra**: antes de propor uma pauta nova, o `matcher` consulta:

1. `briefs/pendente-aprovacao/` e `briefs/pendente-publicacao/` — em vôo,
   com `source_urls` sobrepostos ou `topic_hash` igual → **descartar
   silenciosamente** (log no ledger).
2. `briefs/publicado/` — pauta nos últimos **90 dias** com `topic_hash`
   igual → **descartar**; com `pillar` + `icp` iguais nos últimos
   **14 dias** → marcar como `redundant: true`. Por **§11.J** (resposta do
   owner = "pular"), redundantes **NÃO viram brief** — descarta silencioso.
3. `briefs/rejeitado/` — pauta com `topic_hash` igual nos últimos **30 dias**
   → **descartar**.

`topic_hash`: SHA1 dos primeiros 200 chars da `headline` normalizada
(lowercase, sem stopwords PT-BR, sem pontuação). Determinístico, calculado
no momento do briefing e gravado no frontmatter.

**Dupla checagem (definida em spec 003 §8)**: anti-repetição roda **2x** no
pipeline:

1. **Matcher** (estágio 2) — checagem rápida usando `title` do finding
   como proxy de headline. Descarta antes de gastar tempo de scoring se
   sobreposição clara. Não é definitivo: o título do finding pode mudar até
   virar headline no brief.
2. **Briefer** (estágio 4) — checagem definitiva com a `headline` final
   já redigida. Pode ainda descartar (vira `rejeitado/`) se colisão real
   surgir nessa etapa. É o gate final antes do brief ir pra
   `pendente-aprovacao/`.

Justificativa: title-based no matcher é barato e elimina ~80% dos duplicatos;
headline-based no briefer pega o resto sem custo extra (briefer já está
escrevendo a headline).

## 6. Estrutura de dados

### 6.1 Brief (`store/briefs/<dir>/<slug>.md`)

```markdown
---
brief_id: 2026-W22-001
slug: 2026-W22-001_fipezap-bh-lote-valorizacao-q1
created_at: 2026-05-27T14:32:00-03:00
updated_at: 2026-05-27T14:32:00-03:00

# Origem
scope: trends
source_urls:
  - https://fipezap.org.br/.../q1-2026
  - https://valor.../mercado-mg-lotes
source_excerpts:
  - "Lotes em RMBH valorizaram 8.4% no Q1 2026..."

# Match com empresa-alvo (algoritmo + pesos: spec 003 §5)
pillar: "6-mercado-rmbh"
icp: investidor
match_score: 0.82                 # weighted sum dos 5 componentes abaixo
match_score_breakdown:
  pillar_fit: 0.90                # peso 0.30 — finding mapeia limpo no Pilar 6
  foco_editorial_fit: 0.85        # peso 0.25 — lotes/RMBH bate com foco declarado
  geografia_fit: 0.90             # peso 0.20 — Mateus Leme = núcleo RMBH
  icp_fit: 0.80                   # peso 0.15 — investidor, dados de valorização
  freshness: 0.70                 # peso 0.10 — Q1 2026 ainda relevante em maio
# threshold pra promover a brief = 0.55 (spec 003 §5, §11.I resolvido)
# fontes que enriqueceram o score (origem por componente)
source_relevance_hints:
  - component: pillar_fit
    evidence: "headline menciona explicitamente RMBH e valorização — bate Pilar 6"
  - component: foco_editorial_fit
    evidence: "fonte trata de lote (não casa pronta) — alinha foco declarado"
why_match: |
  Foco em valorização de lotes em RMBH bate direto com o foco editorial
  declarado pela Avanz (lotes/sítios/chácaras) + ICP investidor pede
  "potencial de revenda" e "análise técnica".

topic_hash: 7e3b4c2a1...

# Conteúdo proposto
format: post_feed_instagram       # único formato no 1º slice
od_skill_ref: ad-creative         # skill do Open Design que vai materializar
                                  # (alternativas: poster-hero, social-x-post-card;
                                  # spec 004 define matriz pilar→skill)
template_ref_avanz: post-mes      # prompts/post-mes.json do vault Avanz — alimenta
                                  # o briefer; vai pro package como contexto
headline: "Lote em RMBH valorizou 8.4% no Q1 2026 — onde mais subiu"
hook: "Não é boom. É movimento técnico. Vamos olhar o dado."
caption_draft: |
  [3 parágrafos curtos, registro analítico, fechando com CTA do icp-modifier
   investidor]
hashtags: [imoveisbh, rmbh, valorizacao, lotes, avanzimoveis]
cta: "Quer ver os números fechados da sua região? Manda 'AVZ-RMBH' no WhatsApp."

# Imagem hero — uso EXPLÍCITO (§11.C) + Cloudinary (§11.L)
hero_image_candidates:
  - index: 0
    source_url: https://valor.../mercado-mg-lotes
    image_url: https://valor.../images/og-image.jpg
    local_path: ./store/media/pendente-aprovacao/2026-W22-001_..._0.jpg
    cloud_url: null               # preenchido pela radar-handoff após upload
    cloudinary_public_id: null
    alt: "Aérea de loteamento em Mateus Leme"
    license_hint: "og:image — direito autoral do veículo Valor Econômico"
    licensable: false
  - index: 1
    source_url: https://commons.wikimedia.org/.../rmbh-aerial
    image_url: https://upload.wikimedia.org/...
    local_path: ./store/media/pendente-aprovacao/2026-W22-001_..._1.jpg
    cloud_url: null
    cloudinary_public_id: null
    alt: "RMBH vista aérea — Wikimedia Commons"
    license_hint: "CC BY-SA 4.0 — atribuição obrigatória"
    licensable: true
hero_choice: null                  # null = sem foto (Open Design gera/usa template);
                                   # 0|1|... = usa candidato N
                                   # PRECISA ser preenchido antes do mv approve

visual_brief:
  base_template: post-mes
  composition_notes: |
    Aérea de loteamento + overlay com número grande "+8.4%". Sem rosto,
    sem família — estética analítica (visual_mood.investidor no icp).
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 9077-4580"

# Distribuição (preenchido pelo planner)
suggested_slot:
  week: 2026-W22
  day: quinta-feira
  publish_window: "10h-14h"

# Histórico
ledger_ref: ./store/ledger.jsonl
review_notes: |
  (espaço pro editor escrever feedback ao reprovar ou ajustar)

# Quando handoff feito (Cloudinary + package)
handoff_at: null
package_path: null                 # ex: ./store/packages/2026-W22-001/README.md

# Quando publicado no Instagram
published_at: null
ig_post_url: null                  # preenchido manualmente após publicação via skill
---

# Lote em RMBH valorizou 8.4% no Q1 2026 — onde mais subiu

(Markdown legível por baixo do frontmatter — preview da copy/visual pro
editor ler sem parsear YAML. Conteúdo redundante com os campos acima,
mas em prosa.)
```

### 6.2 Calendário (`store/calendar/2026-W22.md`)

```markdown
---
week: 2026-W22
start: 2026-05-25
end: 2026-05-31
target_company: avanz-imoveis
cadence_ref: /srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md
target_per_week: 10                # §11.H — owner setou; > recomendação Avanz §4 (4–7)
---

# Plano editorial — semana 2026-W22

## Segunda 2026-05-25 — Pilar 3 (Inteligência Imobiliária)
- (slot vazio)

## Terça 2026-05-26 — Pilar 1 (Imóvel da semana)
- [2026-W22-003](../briefs/pendente-publicacao/2026-W22-003_avz-1247-sitio-mateus-leme.md)

## Quinta 2026-05-28 — Pilar 6 (Mercado RMBH) ← alterna com Pilar 2
- [2026-W22-001](../briefs/pendente-aprovacao/2026-W22-001_fipezap-bh-lote-valorizacao-q1.md)

## Sábado 2026-05-30 — Pilar 1 (Imóvel da semana)
- (slot vazio)

## Reativos (sem dia fixo)
- (nenhum nesta semana)
```

### 6.3 Ledger (`store/ledger.jsonl`)

```jsonl
{"ts":"2026-05-27T14:32:00-03:00","brief_id":"2026-W22-001","from_dir":null,"to_dir":"briefs/pendente-aprovacao","actor":"skill:radar-scan","extra":{"scope":"trends","candidates":2}}
{"ts":"2026-05-27T15:01:00-03:00","brief_id":"2026-W22-001","from_dir":"briefs/pendente-aprovacao","to_dir":"briefs/pendente-publicacao","actor":"skill:radar-mv","extra":{"hero_choice":1}}
{"ts":"2026-05-27T15:04:11-03:00","brief_id":"2026-W22-001","from_dir":null,"to_dir":null,"actor":"skill:radar-handoff","extra":{"event":"cloudinary-upload","public_id":"content-radar/avanz/2026-W22-001"}}
{"ts":"2026-05-27T18:42:00-03:00","brief_id":"2026-W22-001","from_dir":"briefs/pendente-publicacao","to_dir":"briefs/publicado","actor":"skill:radar-mark-published","extra":{"ig_post_url":"https://instagram.com/p/..."}}
```

## 7. Integração com vault Avanz

O `content-radar` **lê** os documentos da Avanz mas **não escreve** dentro de
`/srv/my-mind/Empresas/avanz-imoveis/` (vault é fonte da verdade da estratégia).

Cada subagente recebe a lista de paths em `manifest.target_company.always_load`
+ `per_pillar` e usa Read.

Se descobrirmos que uma decisão estratégica precisa virar update no vault
(ex.: pilar novo, source nova), o radar gera uma **proposta** em
`store/proposals-to-vault/<data>-<slug>.md`. Movimentação manual.

## 8. Integração com **Open Design** (Smart Design @ design.consultorivandias.com.br)

> ⚠️ **Importante** — Sistema downstream é **Open Design** (`/srv/apps/open-design`,
> rebrandado "Smart Design"), que substituiu o `design-engine` v1.0 em 2026-05-17.
> O design-engine velho ainda existe em `/srv/apps/design-engine/` mas está
> **desativado**. Toda integração nova é com Open Design.

### 8.1 Topologia real (lida do `DEPLOY.md`)

```
Browser
   │
   ▼
Cloudflare tunnel (cloudflared @ storage-web-server)
   │  design.consultorivandias.com.br → http://localhost:8081
   ▼
nginx (storage-web-server :8081)
   │  Basic Auth (bcrypt em /etc/nginx/.htpasswd_design) → proxy_pass 127.0.0.1:5175
   ▼
Next.js (open-design-web @ PM2, :5175, user ivandias)
   │  rewrites /api /artifacts /frames → 127.0.0.1:7457
   ▼
Express daemon (open-design-daemon @ PM2, :7457, user ivandias)
   │  spawn /usr/local/bin/claude · /usr/local/bin/codex
   ▼
~/.claude/.credentials.json (junioh2001@gmail.com OAuth)
```

### 8.2 O que o Open Design NÃO é

- **Não tem endpoint REST "POST brief + foto → recebo PNG"** como o
  design-engine velho tinha (`/api/generate/social-post`). Não existe.
- Open Design é uma **plataforma de design-loop**: o usuário abre a web UI,
  escolhe uma **skill** (`/srv/apps/open-design/skills/<skill>/SKILL.md`) e
  um **design system**, descreve o que quer no chat. O daemon spawna o
  `claude`/`codex` CLI no project folder; o agente lê a skill, escreve
  artifacts no FS, e a UI faz live-reload do iframe sandbox.
- API REST é orientada a **projects → conversations → messages**,
  não a "geração de criativo" como verbo único.

### 8.3 Três opções de integração

> Detalhes operacionais do daemon (endpoints, CORS, SSE, project ID Avanz)
> em [`INTEGRACAO-OPEN-DESIGN.md`](../../INTEGRACAO-OPEN-DESIGN.md). Esta seção
> resume e decide.

| # | Opção                                          | Como funciona                                      | Esforço | Quem opera | Recomendação |
|---|------------------------------------------------|----------------------------------------------------|---------|------------|--------------|
| 1 | **Package handoff manual**                     | `radar-handoff` gera `store/packages/<slug>/` com brief.md + URLs Cloudinary + instruções "abra Smart Design, escolha skill X, cole o brief, faça upload da foto Y". Humano executa o passo-a-passo. | Baixo   | Humano     | ✅ Primeiro slice |
| 2 | **Skill custom `avanz-instagram-post`**         | Criar skill em `/srv/apps/open-design/skills/avanz-instagram-post/SKILL.md` que lê briefs do content-radar via path absoluto. Humano abre Smart Design, escolhe a skill, daemon spawna agente que lê o brief direto do FS. | Médio   | Humano (1 clique) | Spec 010 |
| 3 | **API direta `/api/chat` (SSE) no daemon**     | `radar-handoff` faz `POST 127.0.0.1:7457/api/chat` com `agentId` + `message` + `projectId="00da0d59-836a-432f-8d78-23aa75b44115"` (projeto Avanz existente). Consome `text/event-stream` correlacionando por `runId`. Status final via `GET /api/runs/:id`. Sem auth nativa — proteção é loopback. | Médio-Alto | Automático | Spec 011 (viável, não-futuro-distante) |

**Decisão do primeiro slice (resposta §11.M)**: **opção 1** (package handoff manual).
Justificativa:
- Humano ainda precisa publicar no IG manualmente (Open Design não posta
  no Instagram).
- Pacote pronto + URLs Cloudinary já elimina 80% da fricção.
- Mantém ciclo de aprendizado curto antes de acoplar.

Opção 2 entra como spec 010. Opção 3 vira spec 011 (não mais "pendência
futura indefinida" — o caminho está mapeado em
`INTEGRACAO-OPEN-DESIGN.md`).

### 8.3.1 Projeto Avanz no Open Design — estado atual

| campo | valor |
|---|---|
| `id` | `00da0d59-836a-432f-8d78-23aa75b44115` |
| `name` | `Avanz Imoveis-final` |
| `metadata.kind` | `prototype` |
| `metadata.importedFrom` | `claude-design` (zip) |
| `metadata.entryFile` | `Avanz Brand Book v1.html` |
| `metadata.baseDir` | **não setado** ← decisão pendente §11.O |

Como `baseDir` não está setado, qualquer agente rodando dentro desse projeto
opera na pasta interna do daemon (`PROJECTS_DIR/<projectId>/`), **não** no
vault Avanz em `/srv/my-mind/Empresas/avanz-imoveis/`. Pra opções 2 e 3,
provavelmente queremos `PATCH /api/projects/00da0d59.../` setando
`metadata.baseDir = "/srv/my-mind/Empresas/avanz-imoveis"` ou
`/srv/apps/content-radar` — abrir §11.O.

### 8.4 Auth (resposta §11.B — REVISADA)

Auth é **Basic Auth via nginx** (`htpasswd -B /etc/nginx/.htpasswd_design`),
não JWT cookie como o design-engine velho. **Não existe API key.**

Pro primeiro slice (opção 1 de §8.3), `radar-handoff` **não precisa
autenticar no Open Design** — só faz upload pra Cloudinary e produz o
pacote. O humano usa as credenciais dele na web UI.

Pra opção 2 (skill custom): também sem auth — a skill roda dentro do daemon
que já está autenticado via Basic Auth do humano.

Pra opção 3 (API direta — futuro): `radar-handoff` precisa de credencial
Basic Auth dedicada → criar `radar-bot:<senha>` no `/etc/nginx/.htpasswd_design`
e persistir em `.local/open-design-basic-auth.txt` (chmod 600, gitignored).

### 8.5 Fluxo da `radar-handoff` (primeiro slice — opção 1)

```
1. Pra cada brief em briefs/pendente-publicacao/ sem handoff_at:
   a. Resolver foto:
      - Se hero_choice é null → pular upload (skill do OD vai gerar/usar template).
      - Se hero_choice == N → upload media/pendente-publicacao/<slug>__N.<ext>
        pra Cloudinary com public_id="content-radar/avanz/<slug>".
      - Gravar cloud_url + cloudinary_public_id no candidato N do brief.

   b. Resolver skill do Open Design:
      - Ler od_skill_ref do brief (ex: ad-creative, poster-hero).
      - Validar que existe em /srv/apps/open-design/skills/<skill>/SKILL.md.

   c. Gerar package em store/packages/<slug>/:
      - README.md com:
          • Resumo do brief (headline, hook, caption, hashtags, CTA)
          • Skill do Open Design escolhida + link
          • Design system sugerido
          • URL Cloudinary da hero (se houver)
          • Passo-a-passo "abra design.consultorivandias.com.br → New
            project → Choose skill <X> → Cole o brief → Upload foto (se
            necessário, baixe de <cloud_url>) → Gerar → Exportar → Publicar
            no IG"
      - brief.md (cópia do brief simplificada)
      - hero.<ext> (cópia local da foto escolhida, se houver)
      - hero.cloud-url.txt (URL Cloudinary)

   d. Atualizar brief: handoff_at, package_path.
   e. Log no ledger.
```

## 9. Componentes a construir — ordem

| #  | Componente                          | Bloqueia | Status |
|----|-------------------------------------|----------|--------|
| 1  | `manifest.yaml` final               | tudo     | ✅ foundation |
| 2  | Agente `market-researcher`          | scan     | ✅ [spec 002](./002-researcher.md) — impl pendente |
| 3  | Agente `avanz-matcher`              | scan     | ✅ [spec 003](./003-matcher.md) — impl pendente (resolveu §11.I) |
| 4  | Agente `instagram-briefer`          | scan     | ✅ [spec 004](./004-briefer.md) — impl pendente |
| 5  | Skill `radar-scan` + `radar-mv`     | uso fim-a-fim do 1º slice | ✅ [spec 005](./005-skill-scan.md) — impl pendente |
| 6  | Skill `radar-review`                | revisão  | spec → 006-skill-review.md |
| 7  | Skill `radar-handoff` + Cloudinary  | publicação | ✅ [spec 007](./007-handoff.md) — impl pendente; modo `--placeholder-mode` permite rodar sem credenciais |
| 8  | Skill `radar-mark-published`        | fechamento ciclo | spec → 008-mark-published.md |
| 9  | Purga lazy/on-demand de `media/publicado/` (30d) — skill `radar-housekeeping` | manutenção | spec → 009-housekeeping.md |
| 10 | Skill custom `avanz-instagram-post` no Open Design | reduzir fricção do humano | spec → 010-od-skill.md |
| 11 | Agente `editorial-planner` + skill `radar-plan` | distribuição multi-pauta | spec → 011-planner.md |
| 12 | API REST direta no daemon Open Design (§8.3 opção 3) | automação total | spec → 012-od-api-direct.md |
| 13 | Migração `monogâmico → multi-empresa` (§11.F) | expansão | pendência futura |

## 10. Primeiro slice vertical (escopo do "primeiro passo")

> Tudo abaixo entra nas specs 002–005 + 007.

**O que entra:**

- Skill `radar-scan` aceitando `scope=trends` e `pillar_filter=6-mercado-rmbh`.
- 3 subagentes (`market-researcher`, `avanz-matcher`, `instagram-briefer`).
- Saída em `briefs/pendente-aprovacao/` + candidatos de imagem em
  `media/pendente-aprovacao/`.
- Ledger funcionando.
- Skill `radar-mv <slug> approve|reject` (transição + ledger).
- Skill `radar-handoff` (upload Cloudinary + package) — primeira chamada
  ao Cloudinary aqui.
- Anti-repetição on (checa todos os 4 diretórios).
- **Nenhuma** chamada ao Open Design API (humano opera pelo web UI).

**O que NÃO entra:**

- `editorial-planner` (multi-pauta — só faz sentido com volume).
- `radar-mark-published` (entra na spec 008 — primeiro slice usa `mv` cru).
- `radar-review` UI bonitinha.
- Outros escopos (`competitors`, `seasonal`, `cases`, `local`).
- Outros pilares.
- Skill custom no Open Design (spec 010).
- API REST direta (§8.3 opção 3).

**Critério de pronto do primeiro slice:**

1. `radar-scan --scope=trends --pillar=6-mercado-rmbh` roda sem erro.
2. **Output do researcher passa validação JSON-schema** (schema em spec 002 §4):
   campos obrigatórios presentes, tipos corretos, `published_at` ISO 8601
   válido, `image_candidates[]` bem-formado.
3. Gera ≥ 3 briefs válidos com candidatos de imagem baixados.
4. Anti-repetição rejeita pauta com `topic_hash` colidente (qualquer
   diretório).
5. Owner: lê briefs, escolhe `hero_choice`, roda `radar-mv approve`,
   roda `radar-handoff` → pacote criado em `store/packages/<slug>/` com
   URL Cloudinary funcionando.
6. Owner consegue, em < 5 min, abrir o pacote no Smart Design e gerar
   o post seguindo o passo-a-passo do `README.md` do pacote.

## 11. Decisões abertas

### Resolvidas pelo owner

| # | Pergunta | Resolução |
|---|----------|-----------|
| A | Modelo Claude pros subagentes | ✅ Sonnet 4.6 (researcher/matcher/planner) + Opus 4.7 (briefer) |
| B | Auth no sistema downstream | ✅ **Basic Auth via nginx** (Open Design); primeiro slice nem autentica (humano opera) — ver §8.4 |
| C | Radar busca foto? | ✅ Sim, uso explícito (`hero_image_candidates[]` + `hero_choice`) |
| D | Onde rodar o radar | ✅ Local, sob demanda |
| E | Versionar `store/` no git | ✅ Texto sim, mídia gitignored (§11.L) |
| F | Plural-target | ✅ Monogâmico agora; multi-empresa fica no roadmap §9 item 13 |
| G | Auto-arquivamento | ✅ Substituído por diretórios físicos (4: pendente-aprovacao, pendente-publicacao, publicado, rejeitado) |
| H | Volume alvo / semana | ✅ **10/semana** = alvo de **GERAÇÃO de candidatos** (não publicação). Volume alto serve pra absorver reprovação/reaproveitamento/descarte; publicação efetiva fica alinhada à cadência da Avanz (4–7/sem) |
| I | `match_score` mínimo | ✅ **`0.55`** — definido na [spec 003 §5](./003-matcher.md). Pesos: `pillar_fit 0.30`, `foco_editorial_fit 0.25`, `geografia_fit 0.20`, `icp_fit 0.15`, `freshness 0.10`. Threshold revisitável após 4 semanas de operação. |
| J | Pautas redundantes | ✅ **Pular** (skip silencioso, não geram brief) |
| K | Manter `briefs/rejeitado/` | ✅ Sim; sem mídia |
| L | `store/media/` no git | ✅ **Gitignored + integração Cloudinary** — Cloudinary fonte da verdade após upload; local é cache |
| M | Estratégia de integração com Open Design | ✅ **Opção 1** (package handoff) no 1º slice; **Opção 2** vira spec 010; **Opção 3** vira spec 012 (com endpoint `/api/chat` mapeado em `INTEGRACAO-OPEN-DESIGN.md`) |
| N | Conta Cloudinary | ✅ Conta nova dedicada Avanz — owner provisiona, repassa credenciais — **superado em 2026-08-25**: as chaves vivem no `.env` de cada instalação |
| O | `metadata.baseDir` do projeto Avanz no Open Design (`00da0d59-836a-432f-8d78-23aa75b44115`) | ✅ **Deferido pra spec 010** — mantém como está (não setado → cwd cai em `PROJECTS_DIR/<id>/`). Não bloqueia o 1º slice (opção 1 = package handoff manual). Decisão final entra junto da spec 010, quando o contexto da skill custom `avanz-instagram-post` estiver concreto. |
| P | **Agregadores nas allowlists** (ex: `portas.com.br` republicando release ABRAINC) | ✅ **Aceitar secundárias**, mas priorizar primárias via `source_key` canônico + marcar repasses no `relevance_hint`. Researcher (spec 002) marca como repasse quando consegue inferir a fonte original; matcher (spec 003) usa `source_key` canônico para dedup intra-batch e dá menor peso a republicações. |
| Q | `handoff_at` ausente no `radar-mark-published` ([spec 008](./008-mark-published.md#21-por-que-handoff_at--null-é-só-warning-e-não-erro)) | ✅ **Warning + prossegue** (não bloqueia) — publicação é asserção humana, prevalece sobre instrumentação interna. Resolvido 2026-06-10. |
| R | Default de `published_at` ([spec 008 §3](./008-mark-published.md#3-argumentos-da-skill)) | ✅ **`now`** (`date -Iseconds`) com override via `--published-at` para publicação retroativa. Resolvido 2026-06-10. |
| S | Granularidade do registro do post publicado | ✅ Gravar **só `ig_post_url`** (+ `published_at`). `ig_post_id`/métricas/tipo ficam para futura `radar-metrics` ([spec 008 §11.1](./008-mark-published.md#111-o-que-não-entra-na-spec-008)). Resolvido 2026-06-10. |
| T | Timezone canônico de `published_at` | ✅ **`-03:00` (America/Sao_Paulo)**, alinhado ao frontmatter dos briefs. Resolvido 2026-06-10. |
| U | Mecanismo de purga de `media/publicado/` (esboço "cron simples" em §9/§3.3) | ✅ **Lazy/on-demand**: skill `radar-housekeeping` (manual + piggyback no `radar-scan`, passo 0 best-effort), com **guarda anti-placeholder** inviolável. **Sem** cron de sistema; `systemd --user` timer é fallback futuro. Coerente com §11.D (local, sob demanda). [Spec 009](./009-housekeeping.md). Resolvido 2026-06-10. |
| V | **Calibração anti-escassez do matcher** — volume de briefs baixo pelas classificações; queríamos mais briefs sem perder qualidade | ✅ **Pacote cirúrgico** (diagnóstico + previsão em [`docs/calibracao-matcher.md`](../calibracao-matcher.md)): (1) tier **`promote-borderline`** — findings em `[0.48, 0.55)` sem cap viram brief marcado `borderline: true` pro editor decidir (§11.H); (2) **piso `geografia_reframe_floor = 0.50`** pra macro nacional reancorável (SBPE/CBIC/MCMV com implicação RMBH), corrigindo bom conteúdo que morria em geo antes do briefer reancorar (gotcha #3 da 003); (3) ativar escopo `cases` na rotação (operacional). **Threshold 0.55, pesos e caps INALTERADOS.** Diagnóstico: 25% de aproveitamento, ~11/22 skip-low-score na faixa 0.45–0.549. Detalhes na [spec 003 §5.4 + §5.7.1](./003-matcher.md). **Medir 2 ciclos** antes de consolidar. Resolvido 2026-07-03. |

### Ainda pendentes

_(nenhuma — A–P resolvidas em 2026-05-27; Q–U em 2026-06-10 junto das specs 008/009; V em 2026-07-03 junto da calibração do matcher.)_

## 12. Próximos passos concretos

1. ✅ **Spec 002 — `market-researcher`** (feita 2026-05-27, [link](./002-researcher.md)).
2. ✅ **Spec 003 — `avanz-matcher`** (feita 2026-05-27, [link](./003-matcher.md)) — resolveu §11.I.
3. ✅ **§11.O e §11.P resolvidas** (2026-05-27): O deferido pra spec 010
   (mantém baseDir não setado por enquanto); P aceita secundárias mas
   prioriza primárias via `source_key` canônico + marca repasses no
   `relevance_hint`.
4. ✅ **Spec 004 — `instagram-briefer`** (feita 2026-05-27,
   [link](./004-briefer.md)) — formaliza JSON-schema do brief + matriz
   pilar→skill OD. `headline maxLength: 90` confirmado pelo owner
   (spec 004 §17, sem pendências em aberto).
5. ✅ **Spec 005 — `radar-scan` + `radar-mv`** (feita 2026-05-27,
   [link](./005-skill-scan.md)) — fecha as duas skills de orquestração;
   pipeline fim-a-fim totalmente especificado (exceto handoff).
6. ✅ **Spec 007 — `radar-handoff`** (feita 2026-05-27,
   [link](./007-handoff.md)) — fecha a última peça do 1º slice;
   inclui `--placeholder-mode` pra rodar sem credenciais Cloudinary.
7. **Owner provisiona conta Cloudinary** dedicada Avanz + repassa credenciais
   (resposta N) — **não bloqueia mais a implementação** (modo placeholder
   destrava); destrava upload real.
   > Feito. E o destino das chaves mudou em 2026-08-25: elas vivem no `.env` de
   > cada instalação, não em `.local/cloudinary.env`. O que separa dev de
   > produção na mesma conta é `CLOUDINARY_FOLDER`, que prefixa o `public_id`.
8. **Implementação do 1º slice** contra specs 002–005 + 007 (pode começar
   já em modo placeholder).
9. **Critério §10 atendido** → specs 006 (review), 008 (mark-published),
   009 (housekeeping).
10. (Depois) Spec **010** — skill custom `avanz-instagram-post` no Open Design;
    revisita §11.O e fecha `baseDir` definitivo.
11. (Depois) Spec **012** — API direta via `/api/chat` (opção 3 — viável,
    não pendência indefinida).

## 13. Glossário

- **Pilar**: categoria editorial da Avanz (1–6, ver `content-pillars.md`).
- **ICP**: Ideal Customer Profile — overlay por persona
  (`comprador|investidor|proprietario`), definido em `icp-modifiers.json`.
- **Slot**: dia/hora alocado pra uma pauta no calendário semanal.
- **Slice vertical**: corte fino que atravessa todos os estágios do pipeline
  com escopo mínimo.
- **Topic hash**: hash determinístico da headline normalizada usado pra
  anti-repetição.
- **Hero**: foto principal do post no Instagram. Pode ser provida pelo radar
  (`hero_choice: <N>`) ou nenhuma (`null` — skill do Open Design improvisa).
- **Open Design / Smart Design**: plataforma open-source de design loop
  (`/srv/apps/open-design`), rebrandada "Smart Design" pra Disparos
  Inteligentes, servindo `design.consultorivandias.com.br`. Substituiu o
  `design-engine` v1.0 em 2026-05-17.
- **Skill do Open Design**: prompt + design system + checklists em
  `/srv/apps/open-design/skills/<slug>/SKILL.md`. Roda dentro do daemon
  spawnando `claude`/`codex` CLI.
- **Package**: diretório `store/packages/<slug>/` com tudo que o humano
  precisa pra operar o Smart Design (brief, URLs Cloudinary, passo-a-passo).
