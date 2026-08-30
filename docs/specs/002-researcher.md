---
spec_id: 002-researcher
title: "content-radar — Subagente market-researcher (estágio 1 do pipeline)"
status: draft
version: 0.2.0
data: 2026-05-28
autor: claude
empresa_alvo: avanz-imoveis
escopo: definição do subagente que abre o pipeline (descoberta + curadoria de fontes)
related:
  - /srv/apps/content-radar/docs/specs/001-foundation.md
  - /srv/apps/content-radar/docs/specs/003-matcher.md
  - /srv/apps/content-radar/manifest.yaml
  - /srv/apps/content-radar/INTEGRACAO-OPEN-DESIGN.md
  - /srv/my-mind/Empresas/avanz-imoveis/manifest.yaml
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md
changelog:
  - "v0.2.0 (2026-05-28): alinha schema do output ao input esperado pelo matcher (003 §3.1) após audit cruzado. Adiciona `finding_id` (sequencial `f_001`, ...), `fetched_at` (ISO 8601), `geo_hints[]` (array de keywords extraídas via lista canônica em §4.4). Renomeia `raw_excerpt` (string) → `raw_excerpts` (array de 1–3 strings literais). Tabela §4.1 + 3 exemplos JSON (§7.1, §7.2) atualizados."
  - "v0.1.0 (2026-05-27): primeira versão; cobre input/output contracts, prompt
    literal do agente, gotchas (10) e exemplos validados (FipeZap, ABRAINC)."
---

# Spec 002 — `market-researcher`

> Define o **subagente que abre o pipeline** do `content-radar`. Lê escopo +
> contexto da empresa-alvo, sai com uma lista de **findings** brutos (URL +
> resumo + candidatos de imagem). Não decide pilar, não decide hero, não
> escreve brief — quem faz isso é o `avanz-matcher` (spec 003) e o
> `instagram-briefer` (spec 004).

## 1. Objetivo

O `market-researcher` é o **estágio 1** do pipeline definido na
[`001-foundation.md §2`](./001-foundation.md). Recebe um `scope` (ex.
`trends`, `local`) + filtro opcional de pilar do orquestrador
(`radar-scan`), executa buscas web nas fontes permitidas pelo
[`manifest.yaml#search_scopes`](../../manifest.yaml), faz fetch de cada
URL relevante pra extrair título/resumo/data/candidatos de imagem
(`og:image` etc.) e devolve uma lista de **findings** em JSON estrito
pro `avanz-matcher` consumir.

Não pontua match, não dedupica via `topic_hash` (isso é do matcher), não
baixa arquivo de imagem pro disco (isso é do `instagram-briefer` na hora
de gerar o brief). Apenas **descobre, normaliza e devolve URLs com
metadados suficientes pra etapas downstream tomarem decisão**.

## 2. Ferramentas e modelo

| Recurso | Escolha | Justificativa |
|---|---|---|
| **WebSearch** | obrigatório | Único meio de descobrir conteúdo novo sem hardcodar URLs. Filtragem de domínio (allow/block) é feita pelo prompt + validação programática downstream. |
| **WebFetch** | obrigatório | Pra cada URL achada, extrai título, data, og:image, primeira `<img>` grande. Sem isso o output fica incompleto. |
| **Modelo** | `claude-sonnet-4-6` | Decisão §11.A da 001 — tarefa de extração estruturada + julgamento de relevância editorial; não exige raciocínio de Opus. Sonnet 4.6 é mais rápido e barato. |

Sem Read/Write/Bash — o researcher não toca FS. Outputs voltam pro
orquestrador via stdout estruturado.

## 3. Input contract

Estrutura que o `radar-scan` (spec 005) passa pro agente via prompt
("aqui está o JSON de input — siga rigorosamente"):

```yaml
scope: trends                # obrigatório; chave de manifest.search_scopes
pillar_filter: "mercado-rmbh"   # opcional; prioriza tema deste pilar
window_days: 30              # default 30; descarta findings mais antigos
target_count: 10             # default = manifest.funnel.candidates_per_week_target.
                             # agente busca até ~target_count * 1.5 pra dar margem ao matcher
max_per_source: 3            # default 3; cap por domínio
allowed_sources:             # de manifest.search_scopes[scope].sources;
  - fipezap                  # agente NÃO pode buscar fora desta lista
  - abrainc
  - valor
  - globo-rural-imoveis
  - exame-imoveis
vault_paths:                 # trechos extraídos pelo orquestrador (agente não tem Read);
                             # só o que importa pra decidir relevância
  company_focus:
    foco_principal: "lotes, sítios, chácaras"
    excecao_casas: "MCMV com simulação Caixa prévia"
    geografia: "RMBH (Mateus Leme, Esmeraldas, Juatuba prioritários)"
  pillar_brief:              # só se pillar_filter setado
    id: "mercado-rmbh"
    tese: "Mateus Leme/Esmeraldas/Juatuba lê notícia local; Avanz vira referência"
    nao_fazer: "repostar notícia sem agregar análise"
```

Tudo num único bloco do prompt — agente não acessa arquivo. Mapa
slug→domínio também é prefixado no prompt (ver §5).

## 4. Output contract

JSON estrito devolvido como **última mensagem** do agente (orquestrador
parseia). Sem markdown ao redor; sem comentários; sem prosa.

Schema esquemático (exemplo completo populado em §7.1):

```json
{
  "findings": [
    { "finding_id": "f_001",
      "url": "...", "title": "...", "summary": "...", "published_at": "ISO8601",
      "fetched_at": "ISO8601",
      "source_key": "fipezap|abrainc|...", "source_domain": "...",
      "scope": "trends|local|...", "language": "pt-BR",
      "content_type": "article|report-pdf|release|blog-post|news|data-page",
      "image_candidates": [
        { "url": "...", "alt": "...", "license_hint": "...",
          "extracted_from": "og:image|og:secure_url|twitter:image|inline-img|wikimedia|pdf-parent-og",
          "width_hint": 1200, "height_hint": 630 }
      ],
      "geo_hints": ["RMBH","Mateus Leme"],
      "raw_excerpts": ["..."],
      "relevance_hint": "..." }
  ],
  "meta": {
    "scope": "...", "pillar_filter": "...|null",
    "window_days": 30, "target_count": 10,
    "total_searched": N, "total_returned": N, "total_skipped": N,
    "skipped_reasons": { "out_of_window": N, "duplicate_url": N, "fetch_failed": N,
                          "paywall": N, "source_not_allowed": N, "no_date": N,
                          "language_out_of_scope": N },
    "executed_at": "ISO8601"
  }
}
```

### 4.1 Campos por finding

| Campo | Tipo | Notas |
|---|---|---|
| `finding_id` | string | Id sequencial atribuído pelo agente: `f_001`, `f_002`, ... — usado pelo matcher (spec 003 §3.1) pra rastrear o finding ao longo do pipeline. |
| `url` | URL canônica | Sem fragment; remover `utm_*`/`fbclid`/`gclid`; `http→https`. |
| `title` | string | `<title>` → `og:title` → `<h1>`. Máx 200 chars. |
| `summary` | string | 1–3 frases PT-BR, **escritas pelo agente** (não copy-paste). 80–400 chars. |
| `published_at` | ISO 8601 | Sem data extraível → **descarta** (gotcha 5). |
| `fetched_at` | ISO 8601 | Quando o `WebFetch` da URL retornou — facilita debug e cache. |
| `source_key` | string | Chave de `manifest.search_scopes[scope].sources`. Fora da lista → descarta. |
| `source_domain` | string | Domínio raiz (sem `www.`). |
| `scope` | string | Ecoa input. |
| `language` | string | `pt-BR`, `pt-PT`, `en`, `es`. ≠ pt-BR não descarta — matcher decide. |
| `content_type` | enum | `article`, `report-pdf`, `release`, `blog-post`, `news`, `data-page`. |
| `image_candidates` | array | Até 3, em ordem de prioridade. `[]` é válido. |
| `geo_hints` | array<string> | Palavras-chave geográficas extraídas de `title`+`summary`+`raw_excerpts` por match contra lista canônica (§4.3). Vazio (`[]`) é válido. Matcher (spec 003 §5.4) usa pra `geografia_fit`. |
| `raw_excerpts` | array<string> | 1–3 trechos literais (200–800 chars cada) — auditáveis. Plural intencional: um finding pode ter múltiplos trechos relevantes (ex.: dado de RMBH + dado de Mateus Leme). |
| `relevance_hint` | string | 1–2 frases PT-BR sobre por que pode interessar — pista, não veredicto. |

### 4.2 Campos por `image_candidates[i]`

Ordem de prioridade na extração (parar quando encontrar 3 ou esgotar):

1. `<meta property="og:image">` e `<meta property="og:image:secure_url">`
2. `<meta name="twitter:image">` e `<meta name="twitter:image:src">`
3. Primeira `<img>` com `width >= 600` (ou `naturalWidth` se atributo
   ausente) que **não** esteja em `<header>`, `<nav>`, `<footer>`, ou
   tenha `class`/`id` contendo `logo|avatar|icon|tracking`.
4. Para PDFs: usar o thumbnail do site (`og:image` da página pai onde
   o PDF foi linkado), não tentar extrair página 1.
5. Para domínios Wikimedia Commons: usar a versão "Full resolution" do
   `<a class="internal">`.

Cada candidato:

| Campo | Tipo | Notas |
|---|---|---|
| `url` | string | URL absoluta. Resolver `//` e paths relativos. |
| `alt` | string | `alt` → `og:image:alt` → fallback `"<title> — imagem"`. |
| `license_hint` | string | Origem + licença provável. Nunca `null`. Default: `"og:image — direito autoral do veículo, uso editorial sob crédito"`. |
| `extracted_from` | enum | `og:image`, `og:secure_url`, `twitter:image`, `inline-img`, `wikimedia`, `pdf-parent-og`. |
| `width_hint` / `height_hint` | int (opcional) | `width`/`og:image:width`/`naturalWidth`. |

**Não baixar bytes** — só URL + metadados. Download fica no
`instagram-briefer` (spec 004).

### 4.3 Critérios de descarte (silencioso, mas contado em `meta.skipped_reasons`)

- `out_of_window`: `published_at` mais antigo que `window_days`.
- `duplicate_url`: URL canônica já presente em outro finding desta run.
- `fetch_failed`: WebFetch retornou erro persistente após 1 retry.
- `paywall`: corpo da página tem menos de 200 chars de texto útil OU
  string óbvia de paywall ("Assine para continuar", "Subscribers only").
- `source_not_allowed`: domínio fora de `allowed_sources` (não devia
  acontecer se prompt foi seguido, mas log defensivo).
- `no_date`: página não expõe data de publicação extraível.
- `language_out_of_scope`: idioma ≠ pt-BR/pt-PT/en/es.

### 4.4 Extração de `geo_hints`

Lista canônica de keywords pra match case-insensitive contra
`title` + `summary` + `raw_excerpts`. Cada match vira uma entrada
em `geo_hints[]` (deduplicado, preserva forma canônica).

```yaml
geo_keywords:
  metropolitano:
    - "RMBH"
    - "Região Metropolitana de Belo Horizonte"
    - "Belo Horizonte"
    - "BH"
  cidades_avanz:                # áreas de atuação direta
    - "Mateus Leme"
    - "Esmeraldas"
    - "Juatuba"
    - "Jaboticatubas"
    - "Ribeirão das Neves"
    - "Caetanópolis"
  estado:
    - "Minas Gerais"
    - "MG"
  nacional:
    - "Brasil"
```

**Regras:**
- Match case-insensitive em PT-BR (com e sem acento).
- Forma canônica = forma da lista (preserva acentos/case).
- `geo_hints: []` é válido — finding sem RMBH/MG fica pro matcher
  decidir via `geografia_fit` (vai pontuar baixo, geralmente vira
  `skip-out-of-scope`).
- Não inventar — se finding cita "região metropolitana" genérica sem
  qualificador, **não** adicionar "RMBH".

## 5. Prompt do subagente

Conteúdo literal de `.claude/agents/market-researcher.md`:

```markdown
---
name: market-researcher
description: "Estágio 1 do pipeline content-radar. Pesquisa conteúdo público sobre mercado imobiliário RMBH usando WebSearch + WebFetch e devolve findings estruturados (URL, resumo, data, candidatos de imagem) em JSON estrito. Não pontua match, não escreve brief, não baixa arquivos."
tools: [WebSearch, WebFetch]
model: claude-sonnet-4-6
---

# market-researcher

Você é uma **analista de mercado imobiliário da Região Metropolitana de
Belo Horizonte (RMBH)**, trabalhando pra equipe editorial da **Avanz Imóveis**.
Sua única função é descobrir e estruturar conteúdo público que possa virar
pauta de Instagram pra empresa.

## Princípios duros

1. **Idioma: PT-BR.** Todos os campos de texto que você escreve (`summary`,
   `relevance_hint`, `alt` quando precisar fallback) são em português do
   Brasil. Você pode ler fontes em qualquer idioma, mas escreve em PT-BR.
2. **Nunca invente fontes.** Só use URLs que vieram do WebSearch ou
   WebFetch. Nunca componha uma URL "que provavelmente existe". Se uma
   busca não retornou nada relevante, devolva `findings: []` — vazio é
   resposta válida.
3. **Respeite `allowed_sources`.** O input traz a lista de domínios
   permitidos (resolvida a partir de `manifest.search_scopes[scope].sources`).
   Você só inclui no output findings cujo `source_domain` mapeia pra um
   `source_key` dessa lista. Se um resultado do WebSearch vem de domínio
   fora da lista, **descarta sem fetch**.
4. **Respeite `window_days`.** Findings com `published_at` mais antigos
   que `(hoje - window_days)` são descartados. Conte em
   `meta.skipped_reasons.out_of_window`.
5. **Pare cedo.** Busque até atingir `target_count * 1.5` findings válidos
   (pra dar margem ao matcher reprovar) e pare. Não esgote o WebSearch
   tentando lotar a lista — qualidade > quantidade.
6. **Saída é JSON estrito.** Última mensagem sua é UM objeto JSON
   conforme schema da §4 da spec 002. Sem markdown, sem ```json fence,
   sem prosa explicando. Se erro fatal, devolva
   `{"findings": [], "meta": {..., "error": "<motivo>"}}`.
7. **Não baixe arquivos.** Você só lê HTML/PDF metadata via WebFetch.
   Download de imagem pro disco é trabalho de outro estágio.
8. **Sem opinião editorial profunda.** Você não decide se um finding
   "serve" pra Avanz. `relevance_hint` é uma pista, não um veredicto.
   O `avanz-matcher` é quem pontua.

## Mapa source_key → domínio (use só esses)

Quando o input listar um `source_key`, traduza pra domínios assim na
hora de filtrar resultados do WebSearch:

| source_key | domínios aceitos |
|---|---|
| `fipezap` | fipe.org.br, downloads.fipe.org.br, datazap.com.br |
| `abrainc` | abrainc.org.br, downloads.fipe.org.br (PDFs ABRAINC/FIPE) |
| `valor` | valor.globo.com, valoreconomico.com.br |
| `globo-rural-imoveis` | globorural.globo.com, g1.globo.com (canal Globo Rural) |
| `exame-imoveis` | exame.com |
| `instagram-publico` | instagram.com (perfis públicos) |
| `caixa` | caixa.gov.br |
| `abecip` | abecip.org.br |
| `secovi` | secovimg.com.br, secovi.com.br |
| `prefeitura-mateus-leme` | mateusleme.mg.gov.br |
| `prefeitura-esmeraldas` | esmeraldas.mg.gov.br |
| `estado-mg` | mg.gov.br, agenciaminas.mg.gov.br |
| `hoje-em-dia` | hojeemdia.com.br |
| `blogs-imobiliarias-rmbh`, `calendario-marketing`, `calendario-real-estate` | input traz lista explícita quando aplicável |

Domínio plausível **fora** dessa tabela → descarte.

## Processo recomendado

1. **Componha 2–4 queries** a partir de `scope`, `pillar_filter` e
   `vault_paths.company_focus`. Exemplo pra `scope=trends` +
   `pillar=mercado-rmbh`:
   - `"FipeZap" "Belo Horizonte" 2026`
   - `lançamentos imobiliários "Região Metropolitana" Belo Horizonte 2026`
   - `valorização lotes RMBH OR "Mateus Leme" OR "Esmeraldas" 2026`
2. Pra cada resultado do WebSearch que bater em `allowed_sources`, faça
   **WebFetch** com prompt curto pedindo: título, data de publicação,
   resumo do conteúdo em 2 frases, og:image / twitter:image / primeira
   img grande inline, idioma, trecho literal de 200–800 chars sobre o
   tema central.
3. Normalize URL (remova `utm_*`, fragments; `http→https`).
4. Monte o finding seguindo o schema da §4 da spec 002.
5. Pare quando atingir `min(target_count * 1.5, 15)` findings válidos.
6. Devolva o JSON.

## Formato do input que você vai receber

O orquestrador injeta um bloco YAML/JSON com: `scope`, `pillar_filter`,
`window_days`, `target_count`, `max_per_source`, `allowed_sources` e
`vault_paths`. Trate como leitura única — não há ferramenta de Read.

## Formato da sua resposta final

Apenas o JSON. Nada antes, nada depois. Schema completo na §4 da
`docs/specs/002-researcher.md`.
```

> Observação: o frontmatter usa `model: claude-sonnet-4-6` — alias
> resolvido pelo runtime do Claude Code. Se o ambiente exigir o ID
> completo (ex. `claude-sonnet-4-6[1m]`), o orquestrador resolve no
> momento do spawn.

## 6. Gotchas e edge cases

| # | Caso | Mitigação |
|---|---|---|
| 1 | **Paywall** (Valor, Exame). HTML carrega só lead + "Assine pra continuar". | Detectar via heurística: corpo útil < 200 chars OR presença de strings `["Assine", "Subscribers", "Já é assinante"]`. Marcar `paywall` no skipped e usar **só** título + lead como `raw_excerpts`. Se mesmo assim houver `og:image` + data, o finding pode ser mantido (vale pra contextualizar), mas `summary` precisa deixar explícito "(matéria com paywall — só lead disponível)". |
| 2 | **JS-only sites** (SPAs que renderizam tudo no client). WebFetch retorna `<div id="app"></div>` vazio. | Tentar `og:image` e `<title>` do HTML inicial; se `summary` ficar impossível, descartar (`fetch_failed`). NÃO inventar. |
| 3 | **Rate limit do WebSearch.** Quotas internas do Claude Code. | Limitar a **6 queries** por execução; reaproveitar resultados (cachear na memória do agente). Se WebSearch falhar com erro de quota, terminar gracefully com o que tiver. |
| 4 | **`og:image` faltando.** | Cair pra `twitter:image` → primeira `<img width>=600>` fora de header/nav/footer. Se nenhuma, `image_candidates: []` (vazio é aceito; matcher/briefer escolhem se vão pedir foto de outro jeito). |
| 5 | **Datas relativas** ("há 3 dias", "ontem"). | Resolver no momento do parse usando a data corrente da run. Se ambíguo ("recentemente", "neste mês"), descartar com `no_date`. |
| 6 | **Conteúdo em inglês/espanhol.** | Marcar `language: en|es` e manter. O `summary` continua em PT-BR (você traduz/sintetiza). Matcher decide se aproveita. |
| 7 | **Fonte mudou de domínio** (ex. veículo migrou de `.com.br` pra `.com`). | Aceitar redirect HTTP. Usar o `source_domain` **final** (depois do redirect) pra checar `allowed_sources`. Se o destino sai da lista, descarta. |
| 8 | **Redirect infinito / loop.** | Limite de 3 hops. Se exceder, `fetch_failed`. |
| 9 | **404 / conteúdo deprecado.** | Não inclui no output. Conta `fetch_failed`. |
| 10 | **Anti-bot (Cloudflare challenge, captcha).** | WebFetch volta com HTML de challenge (`__cf_chl_jschl_tk__` etc). Tratar como `fetch_failed`. Não tentar truques. |
| 11 | **PDFs grandes** (relatórios FipeZap, ABRAINC). | WebFetch trunca; isso é OK pra `raw_excerpts`. `published_at` vem do nome do arquivo (`fipezap-202601-...`) OU da página parent que lista o PDF. Se ambos faltarem, descartar. |
| 12 | **Duplicatas via URL canônica diferente** (mesmo conteúdo em `?utm_=fb` e `?utm_=x`). | Normalizar antes de dedupar: lowercase do host, remover `utm_*`/`fbclid`/`gclid`, ordenar query restante. |

## 7. Exemplos

### 7.1 Exemplo A — `scope=trends`, `pillar=mercado-rmbh`

**Input passado ao agente:**

```yaml
scope: trends
pillar_filter: "mercado-rmbh"
window_days: 30
target_count: 10
max_per_source: 3
allowed_sources:
  - fipezap
  - abrainc
  - valor
  - globo-rural-imoveis
  - exame-imoveis
vault_paths:
  company_focus:
    foco_principal: "lotes, sítios, chácaras"
    excecao_casas: "MCMV com simulação Caixa prévia"
    geografia: "RMBH (Mateus Leme, Esmeraldas, Juatuba prioritários)"
  pillar_brief:
    id: "mercado-rmbh"
    tese: "quem está em Mateus Leme/Esmeraldas/Juatuba lê notícia local; Avanz vira referência da região"
    nao_fazer: "repostar notícia sem agregar análise"
```

**Output esperado** (2 findings ilustrativos — em produção viriam ~10):

```json
{
  "findings": [
    {
      "finding_id": "f_001",
      "url": "https://downloads.fipe.org.br/indices/fipezap/fipezap-202601-residencial-venda.pdf",
      "title": "Índice FipeZap — Residencial Venda — Janeiro 2026",
      "summary": "BH ficou em R$ 10.640/m² em jan/2026, variação acumulada -0,03% no ano. Média nacional +1,53% (jan-abr), abaixo do IPCA (2,83%).",
      "published_at": "2026-02-05T00:00:00-03:00",
      "fetched_at": "2026-05-27T14:32:00-03:00",
      "source_key": "fipezap", "source_domain": "fipe.org.br",
      "scope": "trends", "language": "pt-BR", "content_type": "report-pdf",
      "image_candidates": [
        { "url": "https://www.fipe.org.br/static/images/og-fipezap.png",
          "alt": "Capa Índice FipeZap",
          "license_hint": "logo institucional FIPE — uso editorial sob crédito",
          "extracted_from": "pdf-parent-og" }
      ],
      "geo_hints": ["Belo Horizonte", "BH", "Brasil"],
      "raw_excerpts": [
        "Em janeiro de 2026, o Índice FipeZAP de Venda Residencial registrou variação de -0,03%. Belo Horizonte apresentou preço médio de R$ 10.640/m²..."
      ],
      "relevance_hint": "Fonte primária de preço residencial em BH. `mercado-rmbh` gosta; foco Avanz é lote/sítio — matcher decide ângulo (ex.: contraponto a valorização de lote)."
    },
    {
      "finding_id": "f_002",
      "url": "https://portas.com.br/noticias/mercado-imobiliario-de-mg-projeta-crescimento-em-2026/",
      "title": "Mercado imobiliário de MG projeta crescimento em 2026",
      "summary": "Projeções ABRAINC indicam crescimento em MG em 2026 puxado por queda de juros e novo Plano Diretor de BH. Loteamentos despontam; RMBH segue aquecida.",
      "published_at": "2026-03-12T10:00:00-03:00",
      "fetched_at": "2026-05-27T14:33:11-03:00",
      "source_key": "abrainc", "source_domain": "portas.com.br",
      "scope": "trends", "language": "pt-BR", "content_type": "news",
      "image_candidates": [],
      "geo_hints": ["RMBH", "Região Metropolitana de Belo Horizonte", "Minas Gerais", "MG"],
      "raw_excerpts": [
        "Regiões como a Região Metropolitana de Belo Horizonte, Juiz de Fora e Uberlândia despontam entre os mercados mais aquecidos..."
      ],
      "relevance_hint": "Fala direto de loteamentos crescendo na RMBH — alinhado ao foco Avanz. Atenção: portas.com.br reaproveita release ABRAINC (mapeei pela origem; ver §8.4)."
    }
  ],
  "meta": {
    "scope": "trends", "pillar_filter": "mercado-rmbh",
    "window_days": 30, "target_count": 10,
    "total_searched": 14, "total_returned": 2, "total_skipped": 12,
    "skipped_reasons": { "out_of_window": 5, "duplicate_url": 2, "fetch_failed": 1, "paywall": 3, "source_not_allowed": 1 },
    "executed_at": "2026-05-27T14:32:00-03:00"
  }
}
```

### 7.2 Exemplo B — `scope=local`, sem `pillar_filter`

**Input** (resumido — mesma estrutura de A):

```yaml
scope: local
pillar_filter: null
window_days: 21
target_count: 10
allowed_sources: [prefeitura-mateus-leme, prefeitura-esmeraldas, estado-mg, hoje-em-dia]
vault_paths:
  company_focus: { foco_principal: "lotes, sítios, chácaras", geografia: "RMBH" }
```

**Output esperado** (1 finding ilustrativo — URL real é descoberta em
runtime via WebSearch; placeholder mantido pra não cravar link
não-validado neste documento normativo):

```json
{
  "findings": [
    {
      "finding_id": "f_001",
      "url": "https://www.hojeemdia.com.br/horizontes/<slug-runtime>",
      "title": "Novo trecho da MG-050 amplia acesso a Mateus Leme",
      "summary": "Estado de MG entrega duplicação parcial da MG-050 entre Juatuba e Mateus Leme, encurtando o trajeto até BH em ~15 min.",
      "published_at": "2026-05-10T08:30:00-03:00",
      "fetched_at": "2026-05-27T14:32:00-03:00",
      "source_key": "hoje-em-dia",
      "source_domain": "hojeemdia.com.br",
      "scope": "local",
      "language": "pt-BR",
      "content_type": "news",
      "image_candidates": [
        {
          "url": "https://www.hojeemdia.com.br/image/.../mg050.jpg",
          "alt": "Trecho duplicado da MG-050",
          "license_hint": "Crédito do veículo — uso editorial sob atribuição",
          "extracted_from": "og:image",
          "width_hint": 1200, "height_hint": 675
        }
      ],
      "geo_hints": ["Mateus Leme", "Juatuba", "BH"],
      "raw_excerpts": [
        "A duplicação parcial da MG-050, entregue nesta semana, encurta em cerca de 15 minutos o trajeto entre Juatuba e a capital..."
      ],
      "relevance_hint": "Notícia 100% local RMBH com efeito direto na valorização de lote em Mateus Leme — gancho forte pra `mercado-rmbh` com ângulo analítico Avanz."
    }
  ],
  "meta": {
    "scope": "local", "pillar_filter": null, "window_days": 21, "target_count": 10,
    "total_searched": 9, "total_returned": 1, "total_skipped": 8,
    "skipped_reasons": { "out_of_window": 4, "fetch_failed": 2, "source_not_allowed": 2 },
    "executed_at": "2026-05-27T14:32:00-03:00"
  }
}
```

## 8. Updates needed in spec 001

> NÃO editei a 001. Lista pro owner aprovar/aplicar na próxima revisão
> da foundation. Path em todos: `/srv/apps/content-radar/docs/specs/001-foundation.md`.

### 8.1 §6.1 (brief schema) — propagar `relevance_hint`

Em `### 6.1 Brief`, bloco `# Origem`, adicionar campo abaixo de
`source_excerpts:`:

```yaml
source_relevance_hints:    # do market-researcher (spec 002 §4.1) —
                           # preserva rastreabilidade do "por quê"
  - "Notícia 100% local RMBH com efeito direto na valorização de lote..."
```

**Motivo:** sem propagar pro brief, perdemos a justificativa textual do
researcher (útil pro matcher auditar e pro editor humano entender).

### 8.2 §3.2 (tabela de subagentes) — clarificar tools

Trocar a célula `tools` do `market-researcher` de
`"WebSearch, WebFetch"` pra `"WebSearch, WebFetch (sem Read/Write/Bash)"`.
**Motivo:** ressaltar que é stateless — vault entra inline pelo
orquestrador (spec 002 §3).

### 8.3 §10 (critério de pronto do 1º slice) — adicionar item 2a

Adicionar abaixo do item 2:

> 2a. `market-researcher` devolve JSON estrito conforme spec 002 §4 —
> orquestrador valida via JSON schema antes de passar pro matcher;
> falha aborta a run com erro claro.

**Motivo:** sem validação programática, campo faltante quebra o matcher
silenciosamente.

### 8.4 §11 (decisões abertas) — registrar pendência §11.P

Adicionar na tabela "Ainda pendentes":

> **P** | Tabela `source_key → domínio` (spec 002 §5) inclui agregadores
> (ex. `portas.com.br` mapeado pra `abrainc`). Aceitar agregadores ou
> exigir URL primária? | **Sugestão:** aceitar com nota explícita no
> `relevance_hint`; matcher (spec 003) decide se aproveita.

**Motivo:** descoberto no exemplo §7.1; não bloqueia o 1º slice mas
precisa ficar mapeado.

## 9. Critério de pronto

Checklist pra considerar o `market-researcher` "pronto" (cumprido junto
com a implementação no 1º slice):

- [ ] `.claude/agents/market-researcher.md` criado com frontmatter +
      prompt literal da §5.
- [ ] Spawn manual do agente (via `radar-scan` ou direto pra teste) com
      input do exemplo §7.1 devolve JSON parseável.
- [ ] Output passa por JSON Schema validator (orquestrador implementa;
      schema vem desta spec §4).
- [ ] Em 3 runs consecutivas com `scope=trends` + `pillar=mercado-rmbh`,
      retorna ≥ 5 findings válidos no total (não vazio).
- [ ] Anti-fonte funciona: forçar o agente a buscar `caixa.gov.br` num
      scope que **não** inclui `caixa` → não vem no output.
- [ ] `window_days=7` corta findings de mais de 7 dias — verificável
      olhando `published_at` × `executed_at`.
- [ ] Pelo menos 1 finding tem `image_candidates` populado; pelo menos
      1 tem `image_candidates: []` (cobrindo o caso vazio).
- [ ] `meta.skipped_reasons` soma com `total_skipped`.
- [ ] Output não contém prosa markdown — só JSON puro.
- [ ] Em caso de erro fatal (quota, rede), devolve `findings: []` +
      `meta.error` (não trava).
- [ ] Reproduz exemplo §7.1 com latência < 90s no Sonnet 4.6.
