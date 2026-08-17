---
spec_id: 004-briefer
title: "content-radar — Subagente instagram-briefer (estágio 4 — síntese final antes do humano)"
status: draft
version: 0.1.2
data: 2026-05-27
autor: claude
empresa_alvo: avanz-imoveis
escopo: definição do subagente que fecha o pipeline (síntese de copy + visual + hero candidates → brief)
resolves:
  - "esboço do brief schema em §6.1 da spec 001 (formaliza JSON-schema)"
  - "matriz pilar → skill do Open Design (referenciada em §8.3 da spec 001)"
related:
  - /srv/apps/content-radar/docs/specs/001-foundation.md
  - /srv/apps/content-radar/docs/specs/002-researcher.md
  - /srv/apps/content-radar/docs/specs/003-matcher.md
  - /srv/apps/content-radar/manifest.yaml
  - /srv/apps/content-radar/INTEGRACAO-OPEN-DESIGN.md
  - /srv/my-mind/Empresas/avanz-imoveis/manifest.yaml
  - /srv/my-mind/Empresas/avanz-imoveis/identity/brand.md
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/positioning.md
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md
  - /srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md
  - /srv/my-mind/Empresas/avanz-imoveis/prompts/icp-modifiers.json
  - /srv/my-mind/Empresas/avanz-imoveis/prompts/post-imovel.json
  - /srv/my-mind/Empresas/avanz-imoveis/prompts/post-mes.json
  - /srv/my-mind/Empresas/avanz-imoveis/prompts/visual-base.json
  - /srv/my-mind/Empresas/avanz-imoveis/ops/guardrails.md
  - /srv/apps/open-design/skills/ad-creative/SKILL.md
  - /srv/apps/open-design/skills/poster-hero/SKILL.md
  - /srv/apps/open-design/skills/social-x-post-card/SKILL.md
changelog:
  - "v0.1.2 (2026-05-28): pós-audit. Enum `od_skill_ref` (§4.2) reduzido a 3 valores (`ad-creative`, `poster-hero`, `social-x-post-card`) — `social-spotify-card`/`social-reddit-card` ficam no manifest.candidate_skills, mas não no enum (matriz §5 não as atribui). `visual_brief.must_have` (§4.2 + §7.3) e regra de placeholders (§6.6) deixam de hardcodar telefone — apontam pra `manifest.target_company.brand_facts.phone_display`. Sem mudança no contrato; só limpeza."
  - "v0.1.1 (2026-05-27): owner confirma headline `maxLength: 90` (§17); §17 atualizado, pendência fechada. Nenhuma outra mudança."
  - "v0.1.0 (2026-05-27): primeira versão; formaliza JSON-schema do brief (§4), define matriz pilar→skill OD (§5), descreve geração de copy/visual com guardrails Avanz (§6–§7), download de hero via Bash+curl (§8), naming/IDs (§9), anti-repetição definitiva headline-based (§10), política §11.P agregadores (§11), saída intermediária JSON do agente (§12), fallbacks (§13) e 3 exemplos calibrados (§14)."
---

# Spec 004 — `instagram-briefer`

> Define o **subagente do estágio 4** do pipeline. Recebe `ranked[]` com
> `decision: promote-to-brief` do `avanz-matcher` (spec 003) e produz, para
> cada finding aprovado, **um brief de feed Instagram** pronto pra revisão
> humana — markdown + frontmatter YAML em `store/briefs/pendente-aprovacao/`
> mais candidatos de imagem baixados em `store/media/pendente-aprovacao/`.
> É o **último estágio automático** antes do editor humano abrir o `.md`.
>
> Sem `editorial-planner` no primeiro slice (decisão §10 da foundation):
> o briefer é o terminal do pipeline automatizado. Tudo que sai dele e
> sobrevive ao editor vira fila pra `radar-mv approve` → `radar-handoff`.

## 1. Objetivo e posição no pipeline

Estágio 4 do pipeline definido em [`001-foundation.md §2`](./001-foundation.md#2-visão-do-sistema).
Consome a saída do matcher (spec 003 §4) — `ranked[]` filtrado por
`decision == "promote-to-brief"` — e devolve **um artefato editorial
completo** por finding aprovado:

1. **Brief markdown + frontmatter YAML** seguindo o schema da §4 desta
   spec, gravado em
   `store/briefs/pendente-aprovacao/<slug>.md`.
2. **Candidatos de imagem hero** baixados pra
   `store/media/pendente-aprovacao/<slug>__<N>.<ext>` (até 3 por brief,
   ver §8).

O briefer **não publica**, **não chama Open Design API**, **não faz upload
Cloudinary** (isso é responsabilidade do `radar-handoff`, spec 007) e
**não planeja calendário** (planner = spec 011, fora do 1º slice).

Diferença das outras specs: o briefer é o **único estágio que escreve
linguagem natural em PT-BR com tom de marca específico** — headline, hook,
caption, CTA. Os outros (researcher, matcher) extraem e classificam; este
sintetiza. Justifica o uso de Opus 4.7 (§2).

Não duplica contratos já definidos na foundation: este documento aterra
em [`001 §2`](./001-foundation.md#2-visão-do-sistema) (lugar no pipeline),
[`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta) (lifecycle),
[`001 §5`](./001-foundation.md#5-anti-repetição) (dual-check definitivo) e
[`001 §6.1`](./001-foundation.md#61-brief-storebriefsdirslugmd) (formaliza
o schema esboçado lá).

## 2. Ferramentas e modelo

| Recurso | Escolha | Justificativa |
|---|---|---|
| **Modelo** | `claude-opus-4-7` | Decisão §11.A da [foundation](./001-foundation.md#11-decisões-abertas). Briefer é **o único estágio que sintetiza copy criativa em PT-BR com tom Avanz**: headline + hook + caption + CTA num ato. Researcher (Sonnet) extrai; matcher (Sonnet) classifica; briefer **escreve**. Opus paga pela qualidade do output editorial — uma headline ruim aqui contamina o package, o handoff, o Cloudinary e o post final. |
| **Tools — `Read`** | obrigatório | Carrega o vault Avanz (lista §3.2) sempre e, definitivamente, os 4 diretórios de `store/briefs/**` para a anti-repetição final headline-based (§10). O agente é **stateful** — diferente do researcher (stateless) — porque o vault é grande (8+ arquivos, ~30 KB de instrução de marca) e cabe melhor em Read sob demanda do que injetado inline em todo prompt. |
| **Tools — `Write`** | **não usado** | O agente não grava arquivo: devolve JSON (§12) e o orquestrador `radar-scan` materializa o `.md`. Removido das `tools` em 2026-08-12; a linha anterior desta spec dizia o contrário e estava desatualizada. Mídia local é gravada via `Bash` (curl); ver linha abaixo. |
| **Tools — `Bash`** | obrigatório | **Download de bytes** de imagem. `WebFetch` retorna texto/HTML processado pelo runtime (resumido, sem bytes brutos) — não serve pra baixar JPG/PNG/WebP. `curl -sSL -o <path> <url>` é o caminho concreto. Bash também é usado pra `mkdir -p` defensivo do diretório de mídia, listar arquivos da semana pra calcular `NNN` (§9) e computar `SHA1` do `topic_hash` via `sha1sum`/`shasum`. **Não** é usado pra `git`, `mv`, `rm`, instalar pacote, alterar `/etc/`, `/opt/` — guardrails do CLAUDE.md global aplicam. |
| **Sem `WebSearch`** | — | Researcher já fez todo trabalho de descoberta. Qualquer ida à web no briefer é sinal de bug. |
| **Sem `WebFetch` (com ressalva)** | — | Foi considerado pra baixar imagem; descartado em §8 — `WebFetch` retorna texto processado, não bytes. Mantemos `Bash` + `curl`. |
| **Sem `Edit`** | — | Briefs nascem do zero a cada execução. Não editamos brief existente — se anti-repetição barra (§10), descartamos silencioso. Se o editor humano quer revisar, ele edita direto no FS (sem agente). |

```yaml
# .claude/agents/instagram-briefer.md — frontmatter (referência)
name: instagram-briefer
description: "Estágio 4 do content-radar. Recebe finding promovido pelo matcher e produz brief de feed Instagram em PT-BR pra Avanz Imóveis: copy (headline/hook/caption/CTA), visual_brief, escolha de skill do Open Design e download local de candidatos de imagem hero. Devolve JSON estruturado; orquestrador renderiza .md+frontmatter."
tools: [Read, Bash]
model: claude-opus-4-7
```

## 3. Input contract

O orquestrador (`radar-scan`, spec 005) invoca o briefer **uma vez por
finding promovido** e passa, via prompt, o seguinte bloco:

```yaml
# Finding promovido pelo matcher — schema completo em spec 003 §4
ranked_entry:
  finding:
    finding_id: f_001
    url: "https://downloads.fipe.org.br/.../fipezap-202601-residencial-venda.pdf"
    title: "Índice FipeZap — Residencial Venda — Janeiro 2026"
    summary: "BH ficou em R$ 10.640/m² em jan/2026..."
    published_at: "2026-02-05T00:00:00-03:00"
    source_key: fipezap
    source_domain: fipe.org.br
    scope: trends
    language: pt-BR
    content_type: report-pdf
    image_candidates:
      - url: "https://www.fipe.org.br/static/images/og-fipezap.png"
        alt: "Capa Índice FipeZap"
        license_hint: "logo institucional FIPE — uso editorial sob crédito"
        extracted_from: pdf-parent-og
    geo_hints: ["Belo Horizonte", "BH", "Brasil"]
    raw_excerpts:
      - "Em janeiro de 2026, o Índice FipeZAP de Venda Residencial..."
    relevance_hint: "Fonte primária de preço residencial em BH. Pilar 6..."
  pillar: "6-mercado-rmbh"
  icp: investidor
  match_score: 0.916
  match_score_breakdown:
    pillar_fit: 0.95
    icp_fit: 0.85
    foco_editorial_fit: 0.95
    geografia_fit: 0.98
    freshness: 0.85
  source_relevance_hints:
    - component: pillar_fit
      evidence: "headline menciona explicitamente RMBH e valorização — bate Pilar 6"
    - component: foco_editorial_fit
      evidence: "fonte trata de lote (não casa pronta) — alinha foco declarado"
  why_match: "..."
  topic_hash_matcher: "7e3b4c2a1..."   # hash title-based do matcher (proxy)
  decision: promote-to-brief
  decision_reason: "score >= threshold (0.55) e não-redundante."

# Contexto da semana corrente (orquestrador injeta — briefer NÃO calcula sozinho)
week_context:
  week_key: "2026-W22"
  today_iso: "2026-05-27"
  slugs_created_this_week:   # já presentes em qualquer dos 4 dirs com prefixo week_key
    - "2026-W22-001_fipezap-bh-lote-valorizacao-q1"
    - "2026-W22-002_..."
  # Próximo NNN = max(N existentes) + 1; orquestrador também pode pré-calcular
  # e passar via campo opcional `next_nnn`. Default: agente calcula com Bash (§9).

# Paths absolutos do vault Avanz (carregar via Read)
vault_paths:
  always:
    - /srv/my-mind/Empresas/avanz-imoveis/manifest.yaml
    - /srv/my-mind/Empresas/avanz-imoveis/identity/brand.md
    - /srv/my-mind/Empresas/avanz-imoveis/strategy/positioning.md
    - /srv/my-mind/Empresas/avanz-imoveis/strategy/content-pillars.md
    - /srv/my-mind/Empresas/avanz-imoveis/strategy/cadencia-editorial.md
    - /srv/my-mind/Empresas/avanz-imoveis/prompts/icp-modifiers.json
    - /srv/my-mind/Empresas/avanz-imoveis/ops/guardrails.md
  per_pillar:                # resolvido pelo orquestrador a partir de manifest.target_company.per_pillar
    - /srv/my-mind/Empresas/avanz-imoveis/prompts/post-mes.json
    - /srv/my-mind/Empresas/avanz-imoveis/strategy/content-bank/pilar-6-mercado-rmbh.md
  visual_base: /srv/my-mind/Empresas/avanz-imoveis/prompts/visual-base.json

# Paths absolutos dos diretórios de briefs (anti-repetição definitiva — §10)
briefs_dirs:
  pendente_aprovacao: /srv/apps/content-radar/store/briefs/pendente-aprovacao
  pendente_publicacao: /srv/apps/content-radar/store/briefs/pendente-publicacao
  publicado: /srv/apps/content-radar/store/briefs/publicado
  rejeitado: /srv/apps/content-radar/store/briefs/rejeitado

# Diretório de mídia (onde salvar candidatos hero baixados)
media_dir: /srv/apps/content-radar/store/media/pendente-aprovacao

# Janelas anti-repetição (do manifest.yaml#anti_repetition.windows — repassadas)
windows:
  in_flight_check: all
  publicado_days: 90
  rejeitado_days: 30
  pillar_icp_redundant_days: 14
```

**Diferença vs researcher/matcher**: o briefer é stateful (`Read` no
frontmatter). Não recebe trechos pré-extraídos inline — recebe **paths
absolutos** e lê sob demanda. Isso porque (a) volume de leitura é alto
(vault Avanz + 4 dirs de briefs), (b) prompt-cache do Claude Code é
eficiente com Read repetida no mesmo turno, (c) facilita manutenção (mudou
manifest? agente pega na próxima execução sem precisar reescrever o
orquestrador).

## 4. Output contract

### 4.1 Saída do agente (JSON estruturado — última mensagem)

O briefer devolve **um único objeto JSON** como última mensagem. O
orquestrador (`radar-scan`) parseia, valida contra o schema deste §4 e,
se válido, renderiza `.md` + frontmatter + grava mídia. Mesmo padrão da
spec 002 §4 e spec 003 §4.

```json
{
  "decision": "create-brief" | "skip-redundant" | "skip-validation-failed",
  "skip_reason": "string | null",
  "brief": { /* schema §4.2 abaixo, ou null se decision != create-brief */ },
  "media_downloads": [
    {
      "index": 0,
      "url": "https://...",
      "local_path": "/srv/apps/content-radar/store/media/pendente-aprovacao/<slug>__0.jpg",
      "content_type": "image/jpeg",
      "bytes": 142387,
      "ok": true,
      "error": null
    }
  ],
  "ledger_events": [
    { "event": "media-download-failed", "url": "...", "error": "HTTP 403" }
  ]
}
```

### 4.2 Schema do `brief` (formaliza esboço de [001 §6.1](./001-foundation.md#61-brief-storebriefsdirslugmd))

```yaml
# JSON-schema esquemático — orquestrador valida com `ajv` ou equivalente
# antes de materializar como .md+frontmatter.

brief_id:        string  required  pattern: "^\\d{4}-W\\d{2}-\\d{3}$"   # "2026-W22-001"
slug:            string  required  pattern: "^\\d{4}-W\\d{2}-\\d{3}_[a-z0-9-]{1,80}$"
created_at:      string  required  format: "ISO 8601 with timezone (-03:00)"
updated_at:      string  required  format: same as created_at

# Origem (vem do finding, intacto)
scope:           enum    required  ["trends","competitors","seasonal","cases","local"]
source_urls:     array<url>  required  minItems: 1
                                       # §11: primária (source_key canônico) primeiro,
                                       # secundárias (agregadores) depois.
source_excerpts: array<string>  required  # trechos LITERAIS do finding usado (subset de raw_excerpts[])
                                          # — auditável.
source_relevance_hints: array<object>  required  # propaga §4 do researcher + §4 do matcher
  - component: string   # "pillar_fit" | "foco_editorial_fit" | ...
    evidence: string

# Match com empresa-alvo — propagado intacto do matcher
pillar:          enum    required  ["1-imovel","2-decisao","3-inteligencia",
                                    "5-quem-comprou","6-mercado-rmbh"]
                                   # NÃO inclui "4-bastidor" (matcher filtra; ver §13)
icp:             enum|null required  ["comprador","investidor","proprietario", null]
match_score:     number  required  range: [0, 1]
match_score_breakdown:  object  required
  pillar_fit:           number range: [0, 1]
  icp_fit:              number range: [0, 1]
  foco_editorial_fit:   number range: [0, 1]
  geografia_fit:        number range: [0, 1]
  freshness:            number range: [0, 1]
why_match:       string  required  # propagado do matcher
topic_hash:      string  required  pattern: "^[a-f0-9]{40}$"  # SHA1 hex, headline-based (§9)

# Conteúdo proposto (gerado pelo briefer — §6)
format:          const   "post_feed_instagram"   # único formato no 1º slice
od_skill_ref:    enum    required  ["ad-creative","poster-hero",
                                    "social-x-post-card"]
                                   # enum = apenas skills atribuídas pela matriz §5.
                                   # `social-spotify-card` e `social-reddit-card`
                                   # permanecem em manifest.open_design.candidate_skills
                                   # como "candidatas conhecidas", mas a matriz
                                   # §5 não as atribui a nenhum pilar Avanz —
                                   # incluir no enum só geraria confusão.
                                   # avanz-instagram-post entra na spec 010.
od_skill_alternatives:  array<string>  optional  # 1–2 alternativas pro editor
template_ref_avanz: enum required  ["post-imovel","post-mes"]   # qual prompt JSON Avanz alimenta o package
headline:        string  required  maxLength: 90    # ver §6.2
hook:            string  required  maxLength: 120
caption_draft:   string  required  # 3–5 parágrafos curtos, abre com hook, fecha com CTA
hashtags:        array<string>  required  minItems: 5  maxItems: 8
                                # sempre inclui "avanzimoveis" + ≥1 regional
cta:             string  required  # usa template do ICP em icp-modifiers.json (§6.5)

# Imagem hero — candidatos baixados localmente (Cloudinary fica pra spec 007)
hero_image_candidates: array<object>  required  maxItems: 3
  - index:          integer  required  # 0-based
    source_url:     url      required  # página de onde veio (extracted_from)
    image_url:      url      required  # URL direta da imagem
    local_path:     string   required  # path absoluto em store/media/pendente-aprovacao/
    cloud_url:      string|null  required  # null até radar-handoff (spec 007)
    cloudinary_public_id: string|null  required  # null até radar-handoff
    alt:            string   required
    license_hint:   string   required   # do researcher, nunca null
    extracted_from: enum     required   ["og:image","og:secure_url","twitter:image",
                                         "inline-img","wikimedia","pdf-parent-og"]
    licensable:     boolean  required   # inferido pelo briefer a partir do license_hint
hero_choice:     integer|null  required  default: null   # editor preenche antes do mv approve

# Visual brief — pro Open Design materializar (§7)
visual_brief:    object  required
  base_template:        enum  ["post-imovel","post-mes"]    # === template_ref_avanz
  composition_notes:    string  required   # 2–4 frases PT-BR, descritivas, sem juridiquês
  must_have:            array<string>  required  minItems: 2
                        # sempre inclui logo Avanz + telefone
                        # (interpolado de manifest.target_company.brand_facts.phone_display)
  avoid_visual:         array<string>  optional  # propaga do icp_modifiers visual_mood.avoid_visual

# Distribuição (preenchido pelo planner futuro — fica null no 1º slice)
suggested_slot: object|null  optional
  week: string  pattern: "^\\d{4}-W\\d{2}$"
  day: enum  ["segunda","terca","quarta","quinta","sexta","sabado","domingo"]
  publish_window: string

# Histórico
ledger_ref:      string  required  default: "./store/ledger.jsonl"
review_notes:    string  required  default: ""   # editor preenche

# Handoff (preenchido pela radar-handoff, spec 007)
handoff_at:      string|null  required  default: null
package_path:    string|null  required  default: null

# Publicação (preenchido pela radar-mark-published, spec 008)
published_at:   string|null  required  default: null
ig_post_url:    string|null  required  default: null
```

### 4.3 Validação no orquestrador

Mesmo critério da spec 001 §10 item 2 (validação JSON-schema do output do
researcher) e spec 003 §11 item 5 (validação no matcher). O orquestrador:

1. Parseia JSON da última mensagem do briefer.
2. Valida `brief` contra schema §4.2 (campos obrigatórios, tipos, enums,
   patterns, `maxLength`, `minItems`/`maxItems`).
3. Se inválido → aborta o brief deste finding (não materializa `.md`),
   loga `{"event":"brief-schema-invalid","finding_id":"...","errors":[...]}`
   no ledger e segue pro próximo finding.
4. Se válido → renderiza `<slug>.md`:
   - frontmatter YAML idêntico ao schema acima
   - corpo markdown legível: H1 = `headline`, parágrafos com `hook` +
     `caption_draft`, lista de `hashtags`, sub-headers "Por que entra"
     (= `why_match`) e "Visual brief" (= prosa do `visual_brief`)
5. Move (ou confirma) os arquivos de mídia em `media_downloads[].local_path`
   pra `store/media/pendente-aprovacao/`.
6. Append `{"event":"brief-created","brief_id":"...","to_dir":"...","actor":"agent:instagram-briefer"}`
   no `store/ledger.jsonl`.

## 5. Matriz pilar → skill do Open Design

> Central da spec. Cada pilar Avanz tem uma skill default no Open Design e
> 1–2 alternativas. `od_skill_ref` no brief vem desta tabela. Justificativa
> baseada no SKILL.md de cada candidata
> (`/srv/apps/open-design/skills/<skill>/SKILL.md`).

| Pilar Avanz | Skill default | Alternativas | Por quê |
|---|---|---|---|
| **1-imovel** | `poster-hero` | `ad-creative`, `social-x-post-card` | Posts de imóvel da Avanz têm **foto do imóvel como protagonista** + telefone + logo (`prompts/post-imovel.json` §composicao). O `poster-hero` é o template do OD com canvas grande dedicado a hero visual + texto curto em destaque — exatamente o que `post-imovel.json` pede. `ad-creative` entra como alternativa quando o ângulo é "por que esse passou no nosso filtro" (Pilar 1 Cat. E do content-bank) — copy-first, foto-secundária. |
| **2-decisao** | `ad-creative` | `social-x-post-card`, `poster-hero` | Pilar 2 é **texto-pesado** — checklist, comparativo, "5 perguntas antes de assinar contrato". O `ad-creative` é a skill marketing/copy-first do OD (Corey Haines marketing skills). `social-x-post-card` é alternativa quando o ângulo é "uma frase forte" (ex.: "A regra dos 30%: a parcela cabe se você fica abaixo de…"). |
| **3-inteligencia** | `ad-creative` | `social-x-post-card`, `poster-hero` | Pilar 3 (autoridade tech do Ivan) é **insight + dado + posicionamento** — também texto-pesado. `ad-creative` entrega copy estrutural. `social-x-post-card` se a pauta vira "thread Twitter/X" (estrutura clássica do Pilar 3 segundo `content-pillars.md`: "thread de tweet/LinkedIn replicado em IG carrossel"). |
| **5-quem-comprou** | `poster-hero` | `ad-creative` | Prova social tem **foto da entrega da chave / antes-depois** como protagonista (Pilar 5 content-bank Cat. B: "Formatos visuais"). `poster-hero` cobre o canvas. `ad-creative` quando o ângulo é "marco de cliente N" e o post é mais texto que foto (Pilar 5 content-bank Cat. D, tema #13). |
| **6-mercado-rmbh** | `ad-creative` | `social-x-post-card`, `poster-hero` | Pilar 6 é **fato → análise → implicação → CTA** (estrutura citada em `content-pillars.md`). Dado numérico + leitura curta cabe em `ad-creative`. `social-x-post-card` ajuda quando o brief vira "tweet de mercado RMBH" autoral do Ivan (formato Pilar 3-adjacente). |

**Pilar 4 (Bastidor)** não aparece nesta tabela: matcher filtra
(`pillar_fit = 0`, `decision: skip-out-of-scope` — spec 003 §5.1 e §9
gotcha #6) e nunca chega ao briefer. Se chegar, briefer aborta com
`decision: skip-validation-failed`, `skip_reason: "pillar-4-out-of-scope"`
(ver §13).

### 5.1 Skill custom `avanz-instagram-post` (spec 010 — futura)

A spec 010 vai introduzir uma skill custom em
`/srv/apps/open-design/skills/avanz-instagram-post/` que materializa
direto pro brand Avanz (paleta, fontes, telefone, logo já injetados).
Quando essa skill existir:

- `od_skill_ref` default vira `avanz-instagram-post` em **todos os pilares**;
- skills atuais (`ad-creative`, `poster-hero`, …) viram alternativas no
  `od_skill_alternatives`;
- a matriz acima muda na spec 010.

**Por enquanto (1º slice)**: skills atuais do OD. Não setar
`avanz-instagram-post` em `od_skill_ref` até a spec 010 ser implementada
(o orquestrador valida via enum em §4.2 e o valor não estará na lista —
falharia validação).

### 5.2 Override pelo editor humano

`od_skill_ref` no brief é **sugestão**, não vinculação dura. O editor
humano pode editar o `.md` antes de `mv approve` e trocar pra outra skill
(p.ex. `social-x-post-card`). `radar-handoff` (spec 007) consome o valor
final do brief.

## 6. Geração de copy

Algoritmo central do briefer: como produzir
headline / hook / caption / hashtags / CTA a partir do finding promovido
+ vault Avanz.

### 6.1 Inputs combinados

Cada peça de copy é função de **3 fontes** que o briefer combina:

1. **Prompt da Avanz por pilar** (do `manifest.target_company.per_pillar`):
   - Pilar 1 → `prompts/post-imovel.json` (composição visual; nesse pilar
     o "copy" da arte é só o telefone, mas a **caption** do IG precisa ser
     escrita pelo briefer — `post-imovel.json` rege a arte, não a caption).
   - Pilar 2, 3, 6 → `prompts/post-mes.json` (template institucional);
     content-bank do pilar dá os ângulos.
   - Pilar 5 → só content-bank (`pilar-5-quem-comprou.md`); briefer usa
     `post-mes.json` como fallback de visual (§13).
2. **ICP overlay** (`prompts/icp-modifiers.json`):
   - `tone_overlay.register`, `tone_overlay.emphasis`, `tone_overlay.avoid`
   - `copy_keywords` (puxar 2–4 desses para a caption sem soar forçado)
   - `cta_pattern` (template literal — substitui placeholder `AVZ-XXXX`)
3. **Guardrails** (`ops/guardrails.md`):
   - proibições: "Não prometer aprovação garantida"; "Não inventar
     informações sobre imóveis"; "Não fornecer valores sem contexto";
     "Não fugir do escopo imobiliário"
   - tom: "humano e natural", "clareza e ação", "próximo passo claro"
   - `content-pillars.md > O que NÃO entra`: clickbait, urgência fabricada,
     emoji de fogo, "última oportunidade!!!", feng shui, "compre antes que
     acabe"

### 6.2 Headline

| Atributo | Valor |
|---|---|
| Max chars | **90** |
| Estilo | Direto, factual, com gancho concreto. Sem clickbait. |
| Estrutura preferida | `<fato> + <implicação curta>` ou `<pergunta concreta>` |
| Exemplos OK | "Lote em RMBH valorizou 8.4% no Q1 2026 — onde mais subiu" / "MCMV 2026: o teto subiu, mas a simulação Caixa diz outra coisa" |
| Exemplos proibidos (guardrails) | "Última oportunidade!", "Compre antes que acabe", "10 dicas que NENHUMA imobiliária te conta", "🔥 imperdível 🔥" |

**Por que 90 chars**: IG não trunca headline (não existe campo nativo de
headline no feed — é a primeira linha da caption). 90 é o cap razoável
para virar **um overlay legível na arte** do post (poster-hero / ad-creative
usam headline como elemento visual, fontes grandes — passou de 90 quebra
em 3+ linhas e perde impacto). Calibrado olhando os exemplos do
`content-bank/`.

Pendência em §17 — confirmar com owner.

### 6.3 Hook

| Atributo | Valor |
|---|---|
| Max chars | **120** |
| Função | **Primeira frase da caption**. Segura o scroll. |
| Estilo | 1 frase, declarativa ou interrogativa. Pode parafrasear headline com ângulo emocional/analítico do ICP. |
| Tom por ICP | `comprador`: humano-próximo, didático. `investidor`: analítico, direto. `proprietario`: consultivo, sereno. (Vem de `icp-modifiers.json#tone_overlay.register`.) |
| Exemplos OK | "Não é boom. É movimento técnico. Vamos olhar o dado." (Pilar 6, investidor) / "Antes de visitar imóvel, simule no Caixa. Por quê?" (Pilar 2, comprador) |

### 6.4 Caption draft

| Atributo | Valor |
|---|---|
| Estrutura | 3–5 parágrafos curtos (1–3 frases cada). Abre com **hook** (já é o §1), fecha com **CTA** (§5). |
| Tom | Lido de `identity/brand.md` ("especialista acessível: direto, transparente, orientador, humano, didático sem ser técnico demais") + `tone_overlay` do ICP. |
| Conteúdo do meio (§2–§4) | Reformulação do `summary` + `raw_excerpts` do finding em PT-BR Avanz. **Sem inventar dados** (guardrails). Pode citar 1 número-chave do finding (ex.: "+8.4%") com referência implícita à fonte (não URL crua no IG; fonte fica no frontmatter `source_urls`). |
| Limites IG | IG aceita até 2.200 chars na caption — briefer mira em 600–1.200 chars (5–8 linhas mobile). |
| Conteúdo proibido | Tudo do `content-pillars.md > O que NÃO entra` + `guardrails.md > Restrições`. Briefer auto-checa antes de devolver (§13 — guardrail violation → reescreve). |

### 6.5 Hashtags

| Atributo | Valor |
|---|---|
| Quantidade | **5–8** (≠ limite IG de 30 — Avanz prefere enxuto, decisão implícita em `brand.md` "clareza antes de volume") |
| Sempre incluir | `avanzimoveis` (brand) + **≥1 regional** (`rmbh`, `mateusleme`, `esmeraldas`, `juatuba`, `bh`, `bhmg`, conforme `geo_hints` do finding ou `geografia_fit` do matcher). |
| Por pilar (sugestão) | Pilar 1: `imovelbh`, `loteamentormbh`, `terreno`. Pilar 2: `decisaoimobiliaria`, `mcmv`, `financiamento`. Pilar 3: `inteligenciaimobiliaria`, `proptech`. Pilar 5: `quemcomprounaavanz` ou `clienteavanz`. Pilar 6: `mercadormbh`, `valorizacao`. |
| Estilo | lowercase, sem acento, sem emoji, sem `#` no JSON (orquestrador adiciona no markdown renderizado). |

### 6.6 CTA

Vem **literal** do `icp_modifiers.json` (campo `cta_pattern` por ICP):

- `comprador`: "Quer entender se esse caminha pra você? Manda no WhatsApp que a gente conversa sem compromisso."
- `investidor`: "Quer ver os números fechados desse e os comparativos da região? Manda 'AVZ-XXXX' no WhatsApp."
- `proprietario`: "Quer um plano de venda claro pro seu imóvel? Manda foto + endereço no WhatsApp que a gente monta a estratégia."

Briefer **substitui placeholders** quando aplicável:
- `AVZ-XXXX` → código do imóvel se vier do finding (raro no 1º slice, só
  Pilar 1); senão mantém literal `AVZ-RMBH` (referência regional).
- Telefone implícito → não substituir; o número (vindo de
  `manifest.target_company.brand_facts.phone_display`) já está
  no `visual_brief.must_have` da arte (vai aparecer na imagem, não no
  texto).

### 6.7 Pilar 5 (Quem comprou) — caveat

Pilar 5 só tem `content-bank/pilar-5-quem-comprou.md`, sem prompt JSON
dedicado. Se algum dia matcher promover finding pra Pilar 5 a partir de
fonte web (improvável — depoimento real precisa consentimento; spec 003
§5.1 já filtra), briefer:

- Usa `post-mes.json` como `template_ref_avanz` (fallback visual).
- Marca em `caption_draft` o disclaimer "(pauta sugerida pelo radar a
  partir de fonte pública; consentimento de cliente real **precisa** ser
  obtido antes de publicar — ver Pilar 5 `content-pillars.md`)".
- `hero_choice = null` recomendado (foto de cliente real **nunca** vem da
  web).

## 7. Geração do `visual_brief`

Os 3 campos do `visual_brief` (§4.2) são derivados assim:

### 7.1 `base_template`

Mesma regra do `template_ref_avanz`:

- Pilar 1 → `post-imovel`
- Pilares 2, 3, 6 → `post-mes`
- Pilar 5 → `post-mes` (fallback — §6.7)

### 7.2 `composition_notes`

2–4 frases PT-BR descrevendo a composição esperada da arte. Combina:

- `prompts/visual-base.json#style` (clean, premium, modernidade) +
  `composition` (centralizado, respiro, hierarquia clara).
- `icp_modifiers.json#visual_mood`:
  - `comprador`: "aspiracional acolhedor — vida real começando", luz
    natural quente, opcionalmente silhueta humana.
  - `investidor`: "inteligência de mercado — dado vira decisão", drone/aérea,
    linha/seta discreta, tabela/comparativo sem virar planilha poluída.
  - `proprietario`: "confiabilidade institucional", ângulos de
    entrada/fachada, estética portfólio premium.
- Pilar-specific (do content-pillars.md ou content-bank): "Pilar 6 com
  ângulo de mapa", "Pilar 1 com foto do imóvel como protagonista", etc.

Exemplo (Pilar 6, investidor):
> "Aérea de loteamento em Mateus Leme com overlay numérico grande '+8.4%'
> em laranja `#F97316`. Sem rosto, sem família — estética analítica
> (visual_mood.investidor). Bloco institucional inferior com logo Avanz +
> telefone. Sem texto longo na arte."

### 7.3 `must_have`

Sempre inclui (não-negociável — vem de `prompts/post-imovel.json` e
`post-mes.json` + `manifest.target_company.brand_facts`):

- `"logo Avanz canto inferior direito"`
- `"telefone <manifest.target_company.brand_facts.phone_display>"`
  (interpolado em runtime; hoje `(31) 9 9077-4580`)

Pode adicionar, conforme pilar/ICP:

- `"paleta oficial: azul marinho #0F172A + laranja #F97316"` (sempre que
  briefer julgar relevante reforçar — recomendado em todo brief até skill
  custom existir)
- `"tipografia Inter (primária) / Montserrat (secundária)"` (idem)
- `"foto real do imóvel — sem stock genérico"` (Pilar 1, 5)
- `"comparativo numérico — não planilha poluída"` (Pilar 2, 6, ICP
  investidor)

### 7.4 `avoid_visual` (opcional mas recomendado)

Propaga `icp_modifiers.json#visual_mood.avoid_visual` quando ICP definido.
Ex.: `investidor → ["famílias sorrindo", "estética de revista de
decoração", "ambientes internos sem contexto territorial"]`.

## 8. Hero image handling — download dos candidatos

> Fluxo concreto. **Decisão técnica chave**: `WebFetch` no Claude Code
> retorna **texto processado** (resumo/markdown da página), não bytes
> brutos. Pra baixar `image/jpeg`/`png`/`webp` precisamos de `Bash` com
> `curl`. Confirmado lendo o behavior do WebFetch — não é tool de
> download.

### 8.1 Algoritmo

```
1. Pegar `finding.image_candidates[]` (do researcher, spec 002 §4.2).
   Ordem já vem priorizada (og:image > twitter:image > inline-img > wikimedia > pdf-parent-og).
2. Aplicar CAP: pegar apenas os primeiros 3 candidatos (mais que isso
   não vira hero — editor humano só vai escolher entre 1–3).
3. Pra cada candidato i ∈ [0..min(N, 3)):
   a. inferir extensão da URL (.jpg, .png, .webp, .gif) — se ambíguo,
      usar `.jpg` como default e ajustar pós-download via `file --mime-type`.
   b. local_path = "<media_dir>/<slug>__<i>.<ext>"
      onde <media_dir> = /srv/apps/content-radar/store/media/pendente-aprovacao/
   c. mkdir -p "<media_dir>"  (Bash, defensivo)
   d. curl -sSL --max-time 20 \
              -A "content-radar/0.1.0 (+https://...; abuse@...)" \
              -o "<local_path>" \
              "<image_url>"
      → captura HTTP status code via `--write-out '%{http_code}'`
   e. Verificar:
      - status != 200 → fail
      - file size < 5 KB → provavelmente HTML de erro → fail
      - file --mime-type "<local_path>" não começa com "image/" → fail
   f. Sucesso → adicionar ao output:
        hero_image_candidates[].local_path = local_path
        hero_image_candidates[].licensable = inferido de license_hint
          (true se license_hint contém "CC BY" ou "domínio público"
            ou "wikimedia"; false se contém "direito autoral do veículo"
            ou "uso editorial sob crédito")
      Falha → não adicionar, registrar em media_downloads[].ok=false
              + erro no ledger_events.
4. Resultado:
   - hero_image_candidates pode ter 0..3 elementos
   - SE 0 (todos falharam) → brief ainda válido; Open Design vai usar
     template/gerar imagem. hero_choice forçado null (§13).
```

### 8.2 Naming dos arquivos de mídia

`<slug>__<N>.<ext>` — sufixo `__N` (dois underscores) idêntico ao usado
em [001 §3.3](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado):

- N = índice 0-based em `hero_image_candidates[]`
- ext = inferida do `Content-Type` ou da URL (`jpg`, `png`, `webp`, `gif`)

Ex.: `2026-W22-001_fipezap-bh-lote-valorizacao-q1__0.jpg`.

### 8.3 `hero_choice: null` por padrão

Briefer **nunca** preenche `hero_choice`. Sempre null. O editor humano
escolhe abrindo o `.md`, olhando as fotos em
`store/media/pendente-aprovacao/`, e editando o frontmatter antes de
`radar-mv approve` (spec 005).

Se 0 candidatos baixados, `hero_choice` continua null (forçado).

### 8.4 User-Agent e rate-limit

- User-Agent identifica o radar pra não ser confundido com crawler
  malicioso.
- Sem retry agressivo — 1 tentativa, timeout 20s. Se falhar, falhou.
- Sem download paralelo (concorrência 1) — evita estourar rate-limit de
  fontes pequenas (prefeitura, blogs).

## 9. Naming + IDs

### 9.1 `week_key`

ISO 8601 week number da `today_iso` (input):

```
week_key = strftime("%G-W%V", today_iso)
# Ex.: 2026-05-27 → "2026-W22"
```

`%G`/`%V` (ISO) **não** `%Y`/`%U` (POSIX) — fim/início de ano pode
divergir, ISO ganha.

### 9.2 `NNN` (contador sequencial intra-semana)

Conta arquivos `<week_key>-*.md` em **todos os 4 diretórios** de briefs
+ 1, zero-padded 3 dígitos:

```bash
COUNT=$(find \
  /srv/apps/content-radar/store/briefs/{pendente-aprovacao,pendente-publicacao,publicado,rejeitado} \
  -maxdepth 1 -name "${week_key}-*.md" 2>/dev/null | wc -l)
NNN=$(printf "%03d" $((COUNT + 1)))
```

Se o orquestrador passou `next_nnn` via input, briefer usa esse valor
(eficiente — orquestrador já contou ao invocar o batch). Senão, calcula.

### 9.3 `slug`

`<week_key>-<NNN>_<kebab-headline>`:

```
kebab-headline =
  1. lowercase(headline)
  2. NFD-normalize + strip diacritics  (ex.: "valorização" → "valorizacao")
  3. replace [^a-z0-9]+ por "-"
  4. trim "-" das pontas
  5. truncate a 60 chars (sem cortar palavra no meio — backtrack até `-`)
```

Exemplo:
- headline: `"Lote em RMBH valorizou 8.4% no Q1 2026 — onde mais subiu"`
- kebab: `"lote-em-rmbh-valorizou-8-4-no-q1-2026-onde-mais-subiu"`
- slug: `"2026-W22-001_lote-em-rmbh-valorizou-8-4-no-q1-2026-onde-mais"`

### 9.4 `brief_id`

`<week_key>-<NNN>` — sem o segmento de slug. Pattern: `^\d{4}-W\d{2}-\d{3}$`.

Ex.: `2026-W22-001`.

### 9.5 `topic_hash`

SHA1 hex (40 chars) da headline normalizada, **headline-based** (definitivo,
diferente do matcher que usa `title` do finding):

```
normalize(headline):
  1. lowercase
  2. NFD-normalize + strip diacritics
  3. remove pontuação (mantém alfanum + espaços)
  4. remove stopwords PT-BR
     (lista canônica em .claude/skills/_shared/stopwords-pt-br.txt,
      ou pacote nltk pt-br se disponível — referência spec 003 §8.2)
  5. join spaces
  6. truncate primeiros 200 chars

topic_hash = sha1(normalize(headline).encode("utf-8")).hexdigest()
```

Implementação prática: agente usa `Bash` para `sha1sum` (idêntico ao
algoritmo do matcher, spec 003 §8.2).

## 10. Anti-repetição definitiva (headline-based)

> Dupla checagem do pipeline ([001 §5](./001-foundation.md#5-anti-repetição)):
> matcher (spec 003 §8) usa `title` do finding como proxy; **briefer aqui
> usa a `headline` já redigida** — é o gate final antes de gravar o brief.

### 10.1 Quando rodar

**Depois** de gerar headline / caption / cta (§6) e **antes** de devolver
o JSON final. Custo: 1 leitura dos frontmatters dos 4 dirs (mesma operação
que o matcher já fez na spec 003 — agora com headline finalizada).

### 10.2 Janelas (espelho de [001 §5](./001-foundation.md#5-anti-repetição) + [manifest#anti_repetition.windows](../../manifest.yaml))

| Diretório | Janela | Critério de hit | Ação |
|---|---|---|---|
| `pendente-aprovacao/` | any (in-flight) | `topic_hash` igual OU `source_urls` overlap (≥1 URL em comum) | `decision: skip-redundant` |
| `pendente-publicacao/` | any (in-flight) | mesmo | `decision: skip-redundant` |
| `publicado/` | 90 dias | `topic_hash` igual | `decision: skip-redundant` |
| `publicado/` | 14 dias | `pillar` + `icp` iguais (sem hash) | `decision: skip-redundant` — §11.J: skip silencioso de pauta redundante |
| `rejeitado/` | 30 dias | `topic_hash` igual | `decision: skip-redundant` |

### 10.3 Por que checar de novo aqui?

O matcher liberou usando o `title` do finding (que reflete a fonte, p.ex.
"Índice FipeZap Q1/2026 — relatório oficial"). O briefer escreveu uma
headline que pode normalizar diferente — p.ex. "Lote em RMBH valorizou
8.4% no Q1 2026". `topic_hash(title) ≠ topic_hash(headline)`.

Se outro finding desta mesma scan (com `title` diferente) virou brief
**com headline equivalente**, o matcher não pegaria (hashes diferentes).
O briefer pega aqui, porque:

1. Esta segunda execução **lê o brief recém-criado** em
   `pendente-aprovacao/` (caso o orquestrador processe findings em
   sequência, não em paralelo);
2. Mesmo com paralelismo, a colisão fica visível na primeira execução
   subsequente — o segundo brief ainda em vôo é descartado.

### 10.4 Output ao bater

```json
{
  "decision": "skip-redundant",
  "skip_reason": "topic_hash collision with brief 2026-W22-001 in pendente-aprovacao/",
  "brief": null,
  "media_downloads": [],
  "ledger_events": [
    {"event":"skip-redundant","reason":"...","collided_with":"2026-W22-001"}
  ]
}
```

Orquestrador grava no ledger e **não materializa nada** (sem `.md`, sem
mídia). Diferença vs `skip-validation-failed`: redundant é silencioso
(§11.J da foundation); validation-failed pode merecer alerta pro
desenvolvedor.

## 11. §11.P — política de agregadores

Foundation [001 §11.P](./001-foundation.md#11-decisões-abertas) resolveu:
"aceitar secundárias, mas priorizar primárias via `source_key` canônico +
marcar repasses no `relevance_hint`". O briefer aplica assim:

### 11.1 Ordem em `source_urls[]`

Quando `relevance_hint` do finding (ou metadados do matcher) indicam
repasse de release:

1. **Primeiro** elemento do array: URL da fonte **primária** canônica
   (`source_key` do `manifest.yaml#search_scopes` — p.ex. abrainc,
   fipezap, valor).
2. **Subsequentes**: URLs das secundárias (agregadores — p.ex.
   portas.com.br, blogs imobiliárias RMBH) que foram **efetivamente
   lidas** pelo researcher.

Se researcher não conseguiu inferir a primária (`relevance_hint` não
flagou repasse), `source_urls[]` tem só a URL que veio do finding —
sem invenção de URL primária (guardrails: "Não inventar fontes").

### 11.2 `source_excerpts[]`

Mantém o **trecho literal que o briefer usou** ao redigir copy. Pode vir
da fonte secundária (geralmente o agregador é quem o researcher fez fetch
e extraiu trechos). Não há obrigação de "buscar trecho equivalente na
primária" — primária só está no array de URLs como ponteiro.

### 11.3 `topic_hash`

**Sempre** headline-based (§9.5). Não muda em função de fonte primária vs
secundária. Anti-repetição (§10) continua igual.

### 11.4 Exemplo

Finding do researcher (spec 002 §7.1 ex.B):
```yaml
url: "https://portas.com.br/noticias/mercado-imobiliario-de-mg-projeta-crescimento-em-2026/"
source_key: abrainc   # researcher inferiu — portas.com.br republica release ABRAINC
relevance_hint: "...portas.com.br reaproveita release ABRAINC..."
```

Brief resultante:
```yaml
source_urls:
  - "https://abrainc.org.br/.../release-mg-2026"        # primária canônica (inferida)
  - "https://portas.com.br/noticias/mercado-imobiliario-de-mg-projeta-crescimento-em-2026/"  # secundária lida
source_excerpts:
  - "Regiões como a Região Metropolitana de Belo Horizonte..."  # do portas.com.br (secundária)
```

Se a URL primária canônica não está no finding (researcher não a navegou),
o briefer pode (a) deixar só a secundária, (b) compor a URL primária
**apenas** se o `source_key` mapeia para um domínio canônico óbvio
(`abrainc → abrainc.org.br`) e essa URL existe nos `raw_excerpts`/`title`
do finding. Sem isso, deixa só secundária. **Nunca inventa URL.**

## 12. Saída intermediária JSON do agente

Recapitulando o §4.1, o agente devolve **um único objeto JSON** como
última mensagem. Schemas válidos por `decision`:

### 12.1 `decision: "create-brief"` (caminho feliz)

```json
{
  "decision": "create-brief",
  "skip_reason": null,
  "brief": { /* §4.2 schema completo */ },
  "media_downloads": [
    {"index":0,"url":"...","local_path":"...","content_type":"image/jpeg",
     "bytes":142387,"ok":true,"error":null},
    {"index":1,"url":"...","local_path":"...","content_type":"image/png",
     "bytes":89231,"ok":true,"error":null}
  ],
  "ledger_events": []
}
```

### 12.2 `decision: "skip-redundant"` (anti-repetição §10)

```json
{
  "decision": "skip-redundant",
  "skip_reason": "topic_hash collision with brief 2026-W22-001 in pendente-aprovacao/",
  "brief": null,
  "media_downloads": [],
  "ledger_events": [
    {"event":"skip-redundant","reason":"topic_hash collision",
     "collided_with":"2026-W22-001","window":"in_flight"}
  ]
}
```

### 12.3 `decision: "skip-validation-failed"` (§13)

```json
{
  "decision": "skip-validation-failed",
  "skip_reason": "guardrail_violation: headline contém 'última oportunidade' após 2 retries",
  "brief": null,
  "media_downloads": [],
  "ledger_events": [
    {"event":"guardrail-violation","attempt":1,"headline":"..."},
    {"event":"guardrail-violation","attempt":2,"headline":"..."}
  ]
}
```

### 12.4 Trabalho do orquestrador

Mesmo padrão da spec 002 / 003:

1. Parseia JSON.
2. Roteia por `decision`:
   - `create-brief` → valida `brief` contra §4.2 → grava `.md` + mídia
     (mídia já está no disco, agente garantiu via Bash) → ledger
     `brief-created`.
   - `skip-redundant` → ledger silencioso (§11.J).
   - `skip-validation-failed` → ledger com `error_kind` e `attempts`.

## 13. Erros e fallbacks

### 13.1 WebFetch / curl falha em **todos** os candidatos

- `hero_image_candidates: []`
- `hero_choice: null` (forçado)
- `media_downloads[]` reflete cada tentativa com `ok: false` + `error`
- `ledger_events[]` registra cada falha
- **Brief permanece válido** → vira `.md` normal em `pendente-aprovacao/`.
  Open Design (no `radar-handoff`/Smart Design) vai gerar imagem ou usar
  template (poster-hero / ad-creative aceitam canvas sem foto real —
  ver SKILL.md de cada).

### 13.2 Pilar do finding não tem prompt no `per_pillar`

Pilar 5 só tem content-bank `.md` (sem `prompts/post-X.json`):
- `template_ref_avanz: post-mes` (fallback)
- `base_template: post-mes` no `visual_brief`
- content-bank do Pilar 5 entra como contexto extra do briefer (Read)
- Caption recebe disclaimer §6.7

### 13.3 Pilar do finding inesperado (∉ {1,2,3,5,6})

Matcher já filtra Pilar 4 (spec 003 §5.1 + §9 gotcha #6). Se chegar:
- `decision: skip-validation-failed`
- `skip_reason: "unexpected_pillar: <pillar>"`
- Não gera brief; não baixa mídia; loga `ledger_events: [{event:"unexpected-pillar","value":"4-bastidor"}]`.

### 13.4 Guardrail violation na headline/caption

Auto-check pós-geração (regex/keyword search):

```
forbidden_substrings = [
  "última oportunidade", "ultima oportunidade", "imperdível", "imperdivel",
  "compre antes que acabe", "antes que acabe",
  "🔥", "💸", "💯",
  "10 dicas que nenhuma imobiliária",
  "10 dicas que nenhuma imobiliaria",
  "garantido", "garantia 100",
  "feng shui", "atrair prosperidade",
  "bom dia, segunda", "bom dia, terça", "bom dia, quarta",   # bom-dia genérico
  "sonho da casa própria",   # quando isolado, sem produto concreto
]
```

(Lista derivada de `content-pillars.md > O que NÃO entra` +
`guardrails.md > Restrições` + `prompts/post-mes.json > restricoes_de_texto`.)

Algoritmo:
1. Briefer gera headline + caption.
2. Briefer auto-checa: se hit em `forbidden_substrings`, **reescreve até
   2 vezes** (`attempt=1`, `attempt=2`).
3. Se 3ª tentativa ainda viola → `decision: skip-validation-failed`,
   `skip_reason: "guardrail_violation"`, ledger registra todas as
   tentativas.

Justificativa do cap em 2 retries: evita loop; Opus 4.7 normalmente
acerta em 1 tentativa quando a violação foi acidental. Persistência de
violação após 2 retries sinaliza que o conteúdo do finding "puxa" pra
linguagem proibida — melhor descartar que forçar.

### 13.5 Headline excede 90 chars após geração

Não considerado "guardrail violation". Briefer encurta sozinho (preserva
o gancho central, corta adjetivos). Sem retry; se mesmo após encurtamento
ficar > 90, trunca em palavra inteira.

### 13.6 Hashtags fora do range 5–8

Auto-ajusta: se < 5, adiciona regionais/pilar-specific (§6.5); se > 8,
remove as menos relevantes (mantém `avanzimoveis` + ≥1 regional).

## 14. Calibração com exemplos reais

Três findings (do estilo da spec 003 §7), mostrando entrada do matcher,
saída do briefer (brief simplificado + JSON intermediário) e justificativa
de skill OD.

### 14.1 Exemplo A — Pilar 6 trends (caminho feliz)

**Input (do matcher):**

```yaml
finding:
  url: https://downloads.fipe.org.br/.../fipezap-202601.pdf
  title: "Índice FipeZap — Residencial Venda — Janeiro 2026"
  summary: "Lotes RMBH valorizam 8.4% no Q1 2026; Mateus Leme +11.2%..."
  published_at: "2026-02-05T00:00:00-03:00"
  source_key: fipezap
  image_candidates:
    - url: https://www.fipe.org.br/static/images/og-fipezap.png
      alt: "Capa Índice FipeZap"
      extracted_from: pdf-parent-og
pillar: "6-mercado-rmbh"
icp: investidor
match_score: 0.916
decision: promote-to-brief
```

**Saída do briefer (JSON intermediário, recortado):**

```json
{
  "decision": "create-brief",
  "skip_reason": null,
  "brief": {
    "brief_id": "2026-W22-001",
    "slug": "2026-W22-001_lote-em-rmbh-valorizou-8-4-no-q1-2026-onde-mais",
    "created_at": "2026-05-27T14:32:00-03:00",
    "scope": "trends",
    "source_urls": ["https://downloads.fipe.org.br/.../fipezap-202601.pdf"],
    "source_excerpts": ["Em janeiro de 2026, o Índice FipeZAP..."],
    "pillar": "6-mercado-rmbh",
    "icp": "investidor",
    "match_score": 0.916,
    "topic_hash": "7e3b4c2a1f9d8e0c5b3a2f1e0d9c8b7a6f5e4d3c",
    "format": "post_feed_instagram",
    "od_skill_ref": "ad-creative",
    "od_skill_alternatives": ["social-x-post-card","poster-hero"],
    "template_ref_avanz": "post-mes",
    "headline": "Lote em RMBH valorizou 8.4% no Q1 2026 — onde mais subiu",
    "hook": "Não é boom. É movimento técnico. Vamos olhar o dado.",
    "caption_draft": "Não é boom. É movimento técnico. Vamos olhar o dado.\n\nO Índice FipeZap fechou janeiro de 2026 mostrando alta de 8.4% no preço de lotes na RMBH. Mateus Leme puxou com +11.2%; Esmeraldas, +9.1%; a capital, +6.3%.\n\nPra investidor, isso pede 2 leituras: (a) qual perímetro da região puxou mais — e por quê; (b) qual ticket de entrada ainda faz sentido hoje, depois da alta.\n\nA gente fechou os números bairro a bairro nas cidades-foco: Mateus Leme, Esmeraldas, Ribeirão das Neves, Juatuba. Tem comparativo de m² e vetor de crescimento.\n\nQuer ver os números fechados desse e os comparativos da região? Manda 'AVZ-RMBH' no WhatsApp.",
    "hashtags": ["avanzimoveis","mercadormbh","rmbh","valorizacao","lotes","mateusleme","investimentoimobiliario"],
    "cta": "Quer ver os números fechados desse e os comparativos da região? Manda 'AVZ-RMBH' no WhatsApp.",
    "hero_image_candidates": [
      {
        "index": 0,
        "source_url": "https://downloads.fipe.org.br/.../fipezap-202601.pdf",
        "image_url": "https://www.fipe.org.br/static/images/og-fipezap.png",
        "local_path": "/srv/apps/content-radar/store/media/pendente-aprovacao/2026-W22-001_lote-em-rmbh-valorizou-8-4-no-q1-2026-onde-mais__0.png",
        "cloud_url": null,
        "cloudinary_public_id": null,
        "alt": "Capa Índice FipeZap",
        "license_hint": "logo institucional FIPE — uso editorial sob crédito",
        "extracted_from": "pdf-parent-og",
        "licensable": false
      }
    ],
    "hero_choice": null,
    "visual_brief": {
      "base_template": "post-mes",
      "composition_notes": "Aérea de loteamento em Mateus Leme (ou render abstrato de RMBH se foto real indisponível) + overlay grande '+8.4%' em laranja #F97316. Sem rosto, sem família — estética analítica investidor. Bloco institucional inferior. Sem texto longo na arte.",
      "must_have": [
        "logo Avanz canto inferior direito",
        "telefone (31) 9 9077-4580",
        "paleta oficial: azul marinho #0F172A + laranja #F97316",
        "comparativo numérico — não planilha poluída"
      ],
      "avoid_visual": [
        "famílias sorrindo",
        "estética de revista de decoração",
        "ambientes internos sem contexto territorial"
      ]
    },
    "match_score_breakdown": {
      "pillar_fit": 0.95, "icp_fit": 0.85, "foco_editorial_fit": 0.95,
      "geografia_fit": 0.98, "freshness": 0.85
    },
    "source_relevance_hints": [
      {"component":"pillar_fit","evidence":"headline menciona explicitamente RMBH e valorização"},
      {"component":"foco_editorial_fit","evidence":"fonte trata de lote (não casa pronta)"}
    ],
    "why_match": "Foco em valorização de lotes em RMBH bate direto com o foco editorial declarado pela Avanz (lotes/sítios/chácaras) + ICP investidor pede análise técnica + comparativo.",
    "ledger_ref": "./store/ledger.jsonl",
    "review_notes": "",
    "handoff_at": null, "package_path": null,
    "published_at": null, "ig_post_url": null
  },
  "media_downloads": [
    {"index":0,"url":"https://www.fipe.org.br/static/images/og-fipezap.png",
     "local_path":"/srv/apps/content-radar/store/media/pendente-aprovacao/2026-W22-001_..._0.png",
     "content_type":"image/png","bytes":48721,"ok":true,"error":null}
  ],
  "ledger_events": []
}
```

**Skill OD escolhida**: `ad-creative` (default Pilar 6 — §5). Justificativa
implícita: dado numérico + leitura curta + CTA — copy-first. Alternativas:
`social-x-post-card` (se editor decidir transformar em "tweet de mercado")
ou `poster-hero` (se editor optar por canvas vertical com foto aérea).

---

### 14.2 Exemplo B — Pilar 1 imóvel (caminho feliz)

**Input (do matcher — finding atípico no scope `trends` mas plausível em
`competitors` ou `local`):**

```yaml
finding:
  url: https://www.hojeemdia.com.br/horizontes/mg-050-mateus-leme
  title: "Novo trecho duplicado da MG-050 chega a Mateus Leme"
  summary: "Estado entrega duplicação da MG-050; trajeto Juatuba-BH cai 15 min..."
  published_at: "2026-05-10T08:30:00-03:00"
  source_key: hoje-em-dia
  image_candidates:
    - url: https://www.hojeemdia.com.br/image/.../mg050.jpg
      alt: "Trecho duplicado da MG-050"
      extracted_from: og:image
pillar: "1-imovel"     # Pilar 1 — ângulo "imóvel da semana em região com infra nova"
icp: comprador
match_score: 0.72
decision: promote-to-brief
```

Briefer sintetiza o ângulo "lote em Mateus Leme se valoriza com infra
nova — esse aqui economiza 15 min de BH" — Pilar 1 Cat. C tema #13
("Infra recente — Asfalto, iluminação, comércio novo: o que isso muda
no preço") do content-bank.

**Saída do briefer (resumo):**

```json
{
  "decision": "create-brief",
  "brief": {
    "brief_id": "2026-W22-002",
    "slug": "2026-W22-002_lote-em-mateus-leme-com-15-min-a-menos-pra-bh-mg-050",
    "scope": "local",
    "source_urls": ["https://www.hojeemdia.com.br/horizontes/mg-050-mateus-leme"],
    "pillar": "1-imovel",
    "icp": "comprador",
    "od_skill_ref": "poster-hero",
    "od_skill_alternatives": ["ad-creative"],
    "template_ref_avanz": "post-imovel",
    "headline": "Lote em Mateus Leme com 15 min a menos pra BH — MG-050",
    "hook": "Duplicaram o trecho. Você ainda olha o lote pelo preço de antes?",
    "caption_draft": "Duplicaram o trecho. Você ainda olha o lote pelo preço de antes?\n\nA MG-050 ganhou duplicação entre Juatuba e Mateus Leme — o trajeto pra BH cai cerca de 15 minutos pra quem mora ou trabalha na região.\n\nIsso muda 2 coisas pra quem está procurando lote agora: (a) o tempo real de deslocamento, que entra na conta da rotina; (b) o vetor de valorização da região, que tende a acompanhar a melhoria de infra.\n\nA gente curou 3 lotes em Mateus Leme com topografia ok, documentação 100% e entrada flexível. Tem ângulo pra quem está saindo do aluguel e pra quem quer construir nos próximos 12 meses.\n\nQuer entender se esse caminha pra você? Manda no WhatsApp que a gente conversa sem compromisso.",
    "hashtags": ["avanzimoveis","mateusleme","loteamento","rmbh","mg050","primeiroimovel"],
    "cta": "Quer entender se esse caminha pra você? Manda no WhatsApp que a gente conversa sem compromisso.",
    "hero_image_candidates": [
      {"index":0,"image_url":"https://www.hojeemdia.com.br/.../mg050.jpg",
       "local_path":"/srv/apps/content-radar/store/media/pendente-aprovacao/2026-W22-002_..._0.jpg",
       "alt":"Trecho duplicado da MG-050","licensable":false,...}
    ],
    "hero_choice": null,
    "visual_brief": {
      "base_template": "post-imovel",
      "composition_notes": "Foto do imóvel real (a curar pelo editor — placeholder com hero da rodovia ok no momento) como protagonista, 100% canvas. Degradê branco translúcido inferior. Pílula de telefone canto esquerdo, logo direita.",
      "must_have": [
        "logo Avanz canto inferior direito",
        "telefone (31) 9 9077-4580",
        "foto real do imóvel — sem stock genérico",
        "paleta oficial: azul marinho #0F172A + laranja #F97316"
      ]
    }
  }
}
```

**Skill OD**: `poster-hero` (default Pilar 1 — §5). Foto do imóvel
protagonista. Alternativa: `ad-creative` se editor decidir focar no
ângulo analítico "MG-050 → valorização" (vira mais Pilar 6).

---

### 14.3 Exemplo C — `skip-redundant` por colisão de headline

**Input (do matcher — finding C2 promovido, repercussão do FipeZap Q1
no Valor):**

```yaml
finding:
  url: https://valor.globo.com/.../fipezap-rmbh-lotes-q1-2026.ghtml
  title: "Valor: lotes RMBH valorizam 8.4% no Q1/2026"
  summary: "Reportagem do Valor reproduz dados FipeZap Q1/2026..."
  source_key: valor
pillar: "6-mercado-rmbh"
icp: investidor
match_score: 0.78
decision: promote-to-brief    # matcher LIBEROU (title difere do brief A já criado)
```

Briefer, ao gerar headline:

```
headline candidate: "Lote em RMBH subiu 8.4% no Q1 — análise por bairro"
topic_hash(headline_C) = sha1(normalize("lote rmbh subiu 8 4 q1 análise bairro")) = e2a5...

# Anti-repetição §10: ler frontmatters
brief A em pendente-aprovacao/ tem:
  topic_hash: 7e3b4c2a...       # de "lote rmbh valorizou 8 4 q1 2026 mais subiu"
  source_urls: [https://downloads.fipe.org.br/.../fipezap-202601.pdf]
  pillar: 6-mercado-rmbh
  icp: investidor

# Hash difere (e2a5 != 7e3b), URLs não overlap... mas:
# §10.2 linha 4 (publicado/, 14 dias, pillar+icp iguais) — não aplica
# (brief A está em pendente-aprovacao/, não publicado/)
# §10.2 linha 1 (pendente-aprovacao/, any, topic_hash igual OR source_urls overlap):
# - topic_hash difere
# - source_urls não overlap (fipe.org.br vs valor.globo.com)
# → NÃO bate ainda.

# Briefer reflete: a regra "pillar+icp em 14d" aplica-se SÓ a publicado/.
# In-flight (pendente-aprovacao/+pendente-publicacao/) só barra em
# topic_hash OR source_urls. Então este finding NÃO é redundante
# — vira brief 2026-W22-003.

# HMMMM — mas se editor manualmente julgar redundante depois, é o
# caso de rejeitado/. Algoritmo automatico do briefer não captura
# "mesma notícia, fonte diferente" sem source_urls overlap. Documentar
# como gotcha (§15).
```

Mostrando aqui o **outro** caso onde realmente colide: imagine briefer
**reprocessa** o finding A (re-execução do scan, alguém mexeu no input).
A primeira execução já criou
`2026-W22-001_lote-em-rmbh-valorizou-8-4-no-q1-2026-onde-mais.md`.

**Segunda execução** sobre o mesmo finding A:

```json
{
  "decision": "skip-redundant",
  "skip_reason": "topic_hash collision with brief 2026-W22-001 in pendente-aprovacao/ (in-flight)",
  "brief": null,
  "media_downloads": [],
  "ledger_events": [
    {"event":"skip-redundant",
     "reason":"topic_hash collision",
     "collided_with":"2026-W22-001",
     "window":"in_flight_check:all",
     "current_topic_hash":"7e3b4c2a1f9d8e0c5b3a2f1e0d9c8b7a6f5e4d3c"}
  ]
}
```

Orquestrador grava no ledger silenciosamente (§11.J), não cria `.md`,
não baixa mídia, segue pro próximo finding.

**Por que esse exemplo importa**: mostra (a) que o anti-repetição
definitivo headline-based pega colisões intra-batch que o matcher pode
ter deixado passar quando re-roda; (b) que findings da mesma "notícia"
em fontes diferentes precisam de heurística adicional pra serem
flagrados — fica no §15 (gotcha).

## 15. Gotchas

| # | Caso | Mitigação |
|---|---|---|
| 1 | **`WebFetch` retorna texto, não bytes.** Tentar baixar JPG via WebFetch dá string vazia/HTML resumido. | Usar `Bash` + `curl -sSL -o <path>`. Conferir resultado via `file --mime-type` (deve começar com `image/`). |
| 2 | **Race condition no contador `NNN`.** Se 2 instâncias do briefer rodam em paralelo no mesmo `week_key`, ambas podem calcular `NNN = 003` e criar slugs colidentes. | 1º slice: aceitar gap — orquestrador (`radar-scan`) executa serialmente, 1 finding por vez (latência aceitável p/ 10/semana). Spec 005 vai documentar isso explicitamente. Solução futura: lock file `store/.nnn.lock` ou contador no ledger. |
| 3 | **Headline "ideal" vs guardrails Avanz.** Opus tende a soltar "última oportunidade!" e "imperdível" em contexto de notícia quente — esses são proibidos (`guardrails.md` + `content-pillars.md > O que NÃO entra`). | Auto-check pós-geração com keyword list (§13.4); 2 retries; depois abort. Lista mantida no prompt do agente — atualizar se Avanz adicionar termo. |
| 4 | **Hashtags: IG aceita 30, Avanz prefere 5–8.** Tentação de "encher" pra ranking. | Hardcoded em §6.5 (5–8). `avanzimoveis` + ≥1 regional sempre. Briefer auto-ajusta se sai do range. |
| 5 | **Cloudinary acontece DEPOIS.** Briefer só baixa local. `cloud_url` e `cloudinary_public_id` ficam **sempre `null`** no brief criado pelo briefer — `radar-handoff` (spec 007) preenche depois de o editor aprovar `hero_choice` e mover pra `pendente-publicacao/`. | Schema (§4.2) exige campos `null` por default. Briefer não tem credencial Cloudinary, não tenta upload. |
| 6 | **Pilar 4 NÃO chega aqui.** Matcher filtra (spec 003 §5.1 + §9 gotcha #6). | Briefer rejeita defensivamente em §13.3 (`unexpected_pillar`). Não confiar exclusivamente no matcher — defesa em profundidade. |
| 7 | **Content-bank tem múltiplos ângulos.** Pilar 1 tem 20 temas / 5 categorias; Pilar 6 tem 25/6. Tentação de fundir 2–3 ângulos numa só headline → vira pauta confusa. | **Um ângulo por brief.** Briefer escolhe **um** tema do content-bank (o mais aderente ao finding) e segue ele. Outros ângulos viram briefs separados em outras execuções (anti-repetição §10 garante que não vira spam). |
| 8 | **Findings "mesma notícia, fonte diferente" passam o anti-repetição.** Ex.: FipeZap publica relatório (fonte A); Valor noticia o mesmo dado (fonte B). Title difere, headline pode divergir levemente, `source_urls` não overlap, hash não bate. | Limite conhecido. Mitigação parcial: matcher já filtra com `pillar+icp em 14d` (spec 003 §8.3) **mas só em `publicado/`** — in-flight só barra em hash OR URLs overlap. Editor humano pega na revisão. Não é falha — é trade-off de design. Cobrir com regra extra "in-flight 7d + pillar+icp+geografia" fica como pendência futura (não bloqueia 1º slice). |
| 9 | **Skill OD escolhida sem ler `SKILL.md` em runtime.** Briefer não usa Read pra olhar `/srv/apps/open-design/skills/<slug>/SKILL.md` em runtime — usa a matriz §5 hardcoded no prompt do agente. | Vantagem: determinístico, sem custo de Read extra. Desvantagem: matriz desatualiza se nova skill entra no OD. Mitigação: spec 010 (skill custom `avanz-instagram-post`) re-cobre a matriz. Até lá, owner pode editar `od_skill_ref` no `.md` antes do `mv approve`. |
| 10 | **`source_excerpts` precisa ser literal.** Briefer pode parafrasear no `caption_draft` (PT-BR Avanz), mas `source_excerpts[]` precisa ser **trecho exato** do `raw_excerpt` do finding — pra auditoria. | Validação simples: orquestrador checa que cada entrada de `source_excerpts[]` é substring de algum `raw_excerpt` (ou `raw_excerpts[]`) do finding original. Se não bater, valida-fail. |

## 16. Critérios de pronto da spec

1. **Arquivo `.claude/agents/instagram-briefer.md`** existe com frontmatter
   + prompt cobrindo as regras desta spec (matriz §5, geração de copy §6,
   visual_brief §7, hero handling §8, naming §9, anti-rep §10, política
   agregadores §11, output §12, fallbacks §13).
2. **Dry-run com 3 findings de teste** (cobrindo Pilar 1, 2/3/6, 5):
   briefer devolve JSON parseável conforme §4.1; orquestrador valida
   `brief` contra §4.2 e materializa `.md` corretamente.
3. **Anti-repetição definitiva funciona** (§10): plantar brief
   colidente em `pendente-aprovacao/`, rodar briefer sobre finding
   equivalente → `decision: skip-redundant`, sem `.md` criado.
4. **Download de mídia funciona** (§8): 1 finding com `image_candidates[]`
   válido → arquivo gravado em `store/media/pendente-aprovacao/<slug>__0.<ext>`,
   `file --mime-type` retorna `image/*`, brief tem `local_path` apontando.
   Plus: 1 finding com `image_candidates: []` ou todas URLs 404 → brief
   ainda válido com `hero_image_candidates: []` (§13.1).
5. **Guardrail check pega keyword proibida** (§13.4): forçar briefer a
   gerar headline com "última oportunidade" → 2 retries → 3ª = abort com
   `decision: skip-validation-failed`, `skip_reason: "guardrail_violation"`.
6. **Brief renderizado é legível** pelo editor humano sem parser de YAML:
   H1 = headline, parágrafos = caption_draft, sub-headers "Por que entra"
   e "Visual brief" como prosa.

## 17. Decisões a registrar na 001 §11

_Nenhuma — todas as decisões de design ficaram dentro da spec 004._

- **Headline `maxLength: 90`** (§6.2) — ✅ **confirmado pelo owner em
  2026-05-27**. Calibrado a partir de exemplos do content-bank Avanz e
  legibilidade em overlay de `poster-hero` / `ad-creative`. Valor fica
  hardcoded no prompt do agente; ajustável sem mudar contrato se a
  prática mostrar necessidade.

Caso owner queira reabrir alguma decisão futura (matriz pilar→skill §5,
política de retries em §13.4, hashtags 5–8), abrir como pendência
explícita em [001 §11](./001-foundation.md#11-decisões-abertas) com
prefixo `Q` (próxima letra livre após `P`).

## 18. Glossário (termos novos introduzidos nesta spec)

- **`base_template`**: campo do `visual_brief` que aponta qual JSON da
  Avanz (`post-imovel.json` ou `post-mes.json`) governa a composição da
  arte. Distinto do `od_skill_ref` (skill do OD) e do `template_ref_avanz`
  (rótulo curto — `post-imovel` | `post-mes`).
- **`hook`**: primeira frase da caption no IG (≤ 120 chars). Segura o
  scroll. Pode parafrasear a headline com ângulo emocional/analítico do
  ICP. Diferente de "headline", que é a frase de impacto principal e
  vira overlay na arte.
- **`kebab-headline`**: porção do `slug` derivada da headline normalizada
  (lowercase + sem diacrítico + non-alphanum → "-" + truncate 60 chars).
- **`media_downloads[]`**: array do JSON intermediário do briefer (§12),
  reportando o que foi tentado e o resultado de cada `curl`. Diferente de
  `hero_image_candidates[]` no brief: o primeiro audita o briefer, o
  segundo é o contrato com o editor humano + `radar-handoff`.
- **Guardrail violation**: trigger pra `decision: skip-validation-failed`
  quando headline/caption gerada bate keyword proibida da Avanz mesmo
  após 2 retries (§13.4).
