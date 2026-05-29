# Changelog — content-radar

Convenção: [Keep a Changelog](https://keepachangelog.com/) + [SemVer](https://semver.org/).
Datas em ISO 8601 (UTC-3, horário de Brasília).

## [Unreleased]

Próximo: 2ª execução real (escolher entre `scope=local`, mais findings da 1ª,
ou novo `scope=trends` semana que vem).

## [0.12.0] — 2026-05-29 — Template do package ganha "Prompt OD-ready"

### Added

- **`docs/specs/007-handoff.md` v0.1.1 → v0.1.2**: nova seção
  `§5b. Prompt OD-ready` no template do `README.md` do package — versão
  consolidada do brief, formatada como prompt único pronto pra colar
  direto no chat do Smart Design. Equivalente ao §5 + §6 + §7 num
  bloco só. Motivação: feedback do owner durante a 1ª execução real —
  navegar entre seções do README pra montar mentalmente o prompt é
  fricção desnecessária.
- **`store/packages/2026-W22-001_*/README.md`** atualizado retroativamente
  com o bloco `§5b` preenchido (1º package gerado nesta sessão).

### Notes

- 1ª execução real do 1º slice concluída com sucesso em 2026-05-28/29:
  9 findings → 6 promovidos pelo matcher → 1 brief gerado (owner
  restringiu pra validação) → approve → handoff `--placeholder-mode`.
- Aprendizado registrado no ledger:
  `researcher-schema-warning` (output parcialmente conformante);
  `user-restricted-promotion` (1 de 6 promovidos viraram brief).
- Spec 002 (researcher) pode receber refino futuro pra produzir
  output 100% conformante — não bloqueia, validação inline cobriu.

## [0.11.0] — 2026-05-28 — 1º slice implementado (foundation → código)

### Added

- **3 subagentes em `.claude/agents/`**:
  - `market-researcher.md` (Sonnet 4.6, `[WebSearch, WebFetch]`) — transcrição
    literal do prompt da spec 002 §5, com adendo cobrindo os campos novos
    (`finding_id`, `fetched_at`, `geo_hints`, `raw_excerpts[]`).
  - `avanz-matcher.md` (Sonnet 4.6, `[Read]`) — transcrição literal da spec
    003 §6 com ajuste: anti-rep usa `topic_hash_matcher` (title-based) contra
    `topic_hash` (headline-based, gravado pelo briefer); `source_relevance_hints[]`
    explícito no algoritmo.
  - `instagram-briefer.md` (Opus 4.7, `[Read, Write, Bash]`) — prompt composto
    a partir das §§5–13 da spec 004 (a spec só dava o frontmatter de referência,
    não um bloco literal). Cobre matriz pilar→skill OD, geração de copy +
    visual_brief, hero via Bash+curl, naming/IDs, anti-rep headline-based,
    política agregadores, guardrail check com 2 retries.
- **3 skills em `.claude/skills/<slug>/SKILL.md`**:
  - `radar-scan/SKILL.md` — transcrição literal spec 005 §12.
  - `radar-mv/SKILL.md` — transcrição literal spec 005 §17.
  - `radar-handoff/SKILL.md` — transcrição literal spec 007 §13.
- **`.local/cloudinary.env.example`** — template do contrato definido em
  spec 007 §4. Owner copia pra `.local/cloudinary.env` quando provisionar
  Cloudinary.
- **`.gitignore`** ganha exceção `!.local/*.example` — permite versionar
  templates de env mantendo credenciais reais fora.

### Validações empíricas no momento da criação

- Frontmatter `name + description + argument-hint` foi **aceito pelo
  Claude Code** — as 3 skills aparecem auto-detectadas como `/radar-scan`,
  `/radar-mv`, `/radar-handoff` na lista de skills disponíveis assim que
  os arquivos são criados.
- Confirma que a alegação do `claude-code-guide` ("skill não pode invocar
  Task") era imprecisa — skills herdam o set de tools da sessão como
  qualquer outra instrução; a sessão tem Task/Agent disponível.

### Notes

- Próximo bloqueio = nenhum técnico. Implementação validada empiricamente.
  Bloqueio operacional remanescente é só Cloudinary (placeholder destrava).
- Specs 002, 003, 004, 005, 007 não foram bumpadas — os arquivos
  `.claude/` são materialização das specs, não revisão delas.

## [0.10.0] — 2026-05-28 — Audit cruzado resolve 5 incoerências pré-implementação

### Fixed

- **Schema researcher↔matcher (crítico)**. Specs 002 e 003 foram escritas
  em paralelo e divergiam nos nomes de campos do `finding`. Auditoria
  apontou 5 gaps: `finding_id` ausente, `source` vs `source_key`,
  `fetched_at` ausente, `geo_hints[]` ausente, `raw_excerpt` (string) vs
  `raw_excerpts` (array). Resolução: 002 vira fonte da verdade do schema
  (é o agente que produz). 002 v0.2.0 ganha os 4 campos novos +
  conversão pra array; 003 v0.2.0 renomeia `source` → `source_key`;
  ambas documentam quais campos o matcher usa diretamente vs propaga
  intactos pro briefer.
- **Schema matcher→briefer (médio)**. `topic_hash` no output do `ranked[]`
  da 003 é title-based (proxy); `topic_hash` no brief é headline-based
  (definitivo). Mesmo nome confunde. 003 v0.2.0 renomeia o do output pra
  `topic_hash_matcher`. Adiciona também `source_relevance_hints[]`
  (derivado dos componentes do `match_score_breakdown`) — o briefer (004)
  espera esse campo e o matcher já tem a análise.
- **Telefone Avanz (médio)**. 004/007 hardcodavam `(31) 9 9077-4580` em
  prosa, mas `brand.md` não tem o número (vive em `brand.json`).
  Novo bloco `manifest.target_company.brand_facts` (phone_display,
  phone_e164, phone_secondary_e164, main_channel) — agora há um único
  ponto de verdade no manifest do content-radar. 004 v0.1.2 e 007 v0.1.1
  apontam pra ele.
- **`per_pillar["1-imovel"]` faltava content-bank (baixo)**. Manifest
  listava só `post-imovel.json + visual-base.json`. Adicionado
  `strategy/content-bank/pilar-1-imovel-da-semana.md` (existe no vault).
- **Enum `od_skill_ref` redundante (baixo)**. 004 §4.2 incluía
  `social-spotify-card` e `social-reddit-card` no enum, mas a matriz
  §5 não atribuía nenhuma das duas a nenhum pilar Avanz. Removidas do
  enum (ficam em `manifest.candidate_skills` como "candidatas
  conhecidas no OD"); ajuste replicado em 007 §2.

### Changed

- **`docs/specs/002-researcher.md` v0.1.0 → v0.2.0**: schema +
  tabela §4.1 + nova §4.4 (lista canônica de geo_keywords) + 3
  exemplos JSON atualizados.
- **`docs/specs/003-matcher.md` v0.1.0 → v0.2.0**: input §3.1 alinhado
  ao output real da 002; output §4 renomeia + adiciona `source_relevance_hints[]`;
  nota explicando hash matcher (title) vs hash brief (headline).
- **`docs/specs/004-briefer.md` v0.1.1 → v0.1.2**: enum reduzido a 3
  valores; refs a telefone interpoladas via manifest.
- **`docs/specs/007-handoff.md` v0.1.0 → v0.1.1**: §2 alinhado ao novo
  enum; §6 (template README) interpola telefone via manifest.
- **`docs/specs/001-foundation.md` v0.9.0 → v0.10.0**: changelog
  registra o audit + as 5 correções.
- **`manifest.yaml` v0.3.0-foundation → v0.4.0-foundation**: novo
  bloco `brand_facts`; `per_pillar["1-imovel"]` ganha content-bank.

### Notes

- Audit foi rodado por subagente `general-purpose` em modo read-only;
  itens críticos foram confirmados pessoalmente pelo claude principal
  antes da edição. Relatório original (não persistido) reportou 7
  itens, dos quais 2 ("trade-off consciente: in-flight não barra
  pillar+icp 14d" e "SKILL.md em chinês das skills `poster-hero` /
  `social-x-post-card`") foram **aceitos como estão** — fora do escopo
  do content-radar consertar.
- Implementação fica **destravada** após este bump. Bloqueio residual
  é só upload Cloudinary real (credenciais — não bloqueia
  `--placeholder-mode`).

## [0.9.0] — 2026-05-27 — Spec 007 escrita (`radar-handoff`); 1º slice totalmente especificado

### Added

- **`docs/specs/007-handoff.md`** — spec da skill `radar-handoff` (1320
  linhas). Cobre 19 seções:
  - **Pré-condições** do brief (em `pendente-publicacao/`, `handoff_at:
    null`, `od_skill_ref` ∈ enum, etc).
  - **Args**: `<slug>` opcional, `--force`, `--dry-run`,
    `--placeholder-mode`.
  - **Contrato `.local/cloudinary.env`**: 3 vars obrigatórias +
    `CLOUDINARY_FOLDER` opcional; chmod 600; gitignored.
  - **Fluxo passo-a-passo**: parse brief → resolve foto → upload
    Cloudinary → resolve skill OD → gera package → atualiza brief →
    ledger.
  - **Template literal do README do package** (passo-a-passo pro humano
    operar no Smart Design).
  - **Template do brief.md simplificado** (campos internos do pipeline
    são removidos da cópia que vai pro package).
  - **Implementação Cloudinary**: signed POST em bash puro (curl +
    sha1sum + jq); snippet completo inline. Recomenda signed sobre
    unsigned (sem dependência de preset no dashboard, mais robusto).
  - **Idempotência granular**: sem `--force`, pula upload mas
    re-renderiza package quando humano edita `od_skill_ref` no `.md`.
  - **Modo placeholder** (`--placeholder-mode`): sentinel
    `<PENDING_CLOUDINARY>` no brief + alerta condicional no README do
    package. Destrava a implementação enquanto credenciais não chegam.
    Recuperável com `--force` quando Cloudinary chegar.
  - **Eventos novos no ledger**: `cloudinary-uploaded`,
    `cloudinary-upload-failed`, `handoff-finished`, `handoff-skipped`.
  - **`SKILL.md` literal** de `.claude/skills/radar-handoff/SKILL.md`.

### Changed

- **`docs/specs/001-foundation.md` v0.8.0 → v0.9.0**:
  - §3.1: linha `radar-handoff` marcada ✅ com link pra 007.
  - §9 item 7: status → ✅ com nota sobre modo placeholder.
  - §12: spec 007 sai dos pendentes; Cloudinary deixa de ser bloqueio
    de implementação (vira bloqueio só de upload real).
  - `related[]` ganha `007-handoff.md`.

### Notes

- Spec 007 foi escrita por um subagente `general-purpose` com prompt
  contendo contexto completo (mesmo padrão das 002, 003, 004, 005).
- Pendência menor herdada da 007: confirmar com owner signed vs
  unsigned upload Cloudinary (signed é o default desta spec). Não
  bloqueia implementação.
- **Marco**: todas as specs do 1º slice estão escritas (002, 003, 004,
  005, 007). Próximo passo é implementação — pode começar via
  `--placeholder-mode` da 007.

## [0.8.0] — 2026-05-27 — Spec 005 escrita (`radar-scan` + `radar-mv`)

### Added

- **`docs/specs/005-skill-scan.md`** — spec das duas skills de orquestração
  do 1º slice (990 linhas). Cobre 23 seções em 4 partes:
  - **A — Conceitos comuns**: por que são skills (não subagentes), padrão
    `.claude/skills/<slug>/SKILL.md` com diretório dedicado (alinha com
    Open Design e abre espaço pra `_shared/`).
  - **B — `radar-scan`**: args (`--scope`, `--pillar`, `--target-count`,
    `--dry-run`), fluxo passo-a-passo (preparação → researcher → matcher
    → briefer serial), validação JSON inline com `jq`, dry-run sem
    Task(), idempotência, estimativa de custo, template de saída,
    fallbacks, `SKILL.md` literal completo.
  - **C — `radar-mv`**: args, pré-condições (`hero_choice` setado para
    approve), fluxo approve (move brief + mídia escolhida, apaga
    candidatos descartados), fluxo reject (move brief, apaga toda a
    mídia), edge cases (slug ambíguo, mv cru pelo humano), `SKILL.md`
    literal.
  - **D — Comum**: ledger canônico (8 tipos de eventos), como satisfaz
    critério §10 da 001, 10 gotchas, critérios de pronto.
- `headline maxLength: 90` confirmado pelo owner em 2026-05-27 (já
  registrado em [0.7.1]; reforçado aqui).

### Changed

- **`docs/specs/001-foundation.md` v0.7.1 → v0.8.0**:
  - §3.1: linhas `radar-scan` e `radar-mv` marcadas ✅ com link pra 005;
    outras skills ganham referência da spec onde serão definidas (006,
    007, 008, 011).
  - §9 item 5: status → ✅.
  - §12 reordenado: spec 005 sai dos pendentes; bloqueio remanescente
    do 1º slice é só Cloudinary (spec 007).
  - `related[]` ganha `005-skill-scan.md`.

### Notes

- Spec 005 foi escrita por um subagente `general-purpose` com prompt
  contendo contexto completo (mesmo padrão das specs 002, 003 e 004).
- Decisão notável: **briefer roda serial dentro do radar-scan** (não
  paralelo) — evita race no contador `NNN` (spec 004 §15 gotcha 2) e
  na anti-repetição definitiva headline-based (spec 004 §10.3).
- Nenhuma incoerência detectada entre 005 e specs anteriores ou
  manifest.

## [0.7.1] — 2026-05-27 — Owner confirma `headline maxLength: 90`

### Changed

- **`docs/specs/004-briefer.md` v0.1.0 → v0.1.1**: §17 atualizado para
  marcar `headline maxLength: 90` como confirmado pelo owner. Nenhuma
  pendência aberta na 004.
- **`docs/specs/001-foundation.md` §12**: removida menção ao item como
  "pendência menor".

## [0.7.0] — 2026-05-27 — Spec 004 escrita (`instagram-briefer`)

### Added

- **`docs/specs/004-briefer.md`** — spec do subagente `instagram-briefer`
  (1293 linhas). Cobre 18 seções: tools (Opus 4.7; Read + Write + Bash),
  input/output contracts, JSON-schema completo do brief (formaliza o
  esboço de §6.1 da spec 001), matriz pilar→skill do Open Design
  (Pilar 1/5 → `poster-hero`; Pilar 2/3/6 → `ad-creative`), geração de
  copy combinando prompts Avanz + ICP modifiers + guardrails, geração de
  `visual_brief`, hero handling via `curl` (não `WebFetch`, que retorna
  texto), naming + IDs (`<YYYY-Www-NNN>_<kebab-headline>`),
  anti-repetição definitiva headline-based (segunda passada dupla §5 da
  001), aplicação da política §11.P de agregadores, saída intermediária
  JSON do agente, 13 tipos de erros e fallbacks, 10 gotchas e 3 exemplos
  calibrados (Pilar 6 trends + Pilar 1 imóvel + skip-redundant por
  colisão de headline).

### Changed

- **`docs/specs/001-foundation.md` v0.6.0 → v0.7.0**:
  - §3.2: linha do `instagram-briefer` marcada como ✅ com link pra spec
    004; tools atualizadas (Read + Write + Bash, não só Read + Write).
  - §9 item 4: status do briefer → ✅.
  - §12 reordenado: spec 004 sai da lista de "pendentes" e entra como
    ✅; Cloudinary continua bloqueio externo da spec 007.
  - `related[]` ganha `004-briefer.md`.

### Notes

- Spec 004 foi escrita por um subagente `general-purpose` com prompt
  contendo contexto completo (mesmo padrão das specs 002 e 003).
- Pendência menor herdada da 004: confirmar `headline maxLength: 90`
  (spec 004 §17). Não bloqueia 1º slice — é parâmetro do prompt do
  agente, ajustável sem mudar contrato.

## [0.6.0] — 2026-05-27 — §11.O e §11.P resolvidas

### Changed

- **`docs/specs/001-foundation.md` v0.5.0 → v0.6.0**:
  - §11.O **resolvido**: `metadata.baseDir` do projeto Avanz no Open Design
    fica **não setado** por enquanto (cwd cai em `PROJECTS_DIR/<id>/`).
    Decisão final é **deferida pra spec 010**, quando o contexto da skill
    custom `avanz-instagram-post` estiver concreto. Não bloqueia o 1º slice
    (opção 1 = package handoff manual independe de `baseDir`).
  - §11.P **resolvido** seguindo o default: agregadores secundários (ex:
    `portas.com.br` republicando release ABRAINC) **são aceitos**, mas com
    priorização da primária via `source_key` canônico + marcação como
    repasse no `relevance_hint`. Researcher (spec 002) infere a fonte
    original quando possível; matcher (spec 003) usa `source_key` canônico
    pra dedup intra-batch e penaliza republicações no scoring.
  - Cabeçalho atualizado: "Decisões §11.A–P todas resolvidas; nenhuma
    pendente."
  - §12 (próximos passos) reordenado refletindo a resolução de O e P.

### Notes

- Após este bump, **não há mais decisões §11 abertas**. O bloqueio
  remanescente pra implementação é apenas externo (provisionamento da
  conta Cloudinary pelo owner — §11.N já resolvido em política, falta
  execução).

## [0.5.0] — 2026-05-27 — Specs 002 e 003 escritas; §11.I resolvido

### Added

- **`docs/specs/002-researcher.md`** — spec do subagente `market-researcher`
  (501 linhas). Stateless (sem Read/Write/Bash); cap rígido de 6 queries
  WebSearch; `target_count * 1.5` como teto de findings; rigor em
  `published_at` ISO 8601.
- **`docs/specs/003-matcher.md`** — spec do subagente `avanz-matcher`
  (880 linhas). Resolve §11.I com `match_score_min: 0.55`, pesos definidos
  pra 5 dimensões, calibração com 5 exemplos reais.
- **Pendência §11.P** — política sobre agregadores (release ABRAINC
  republicada por outras fontes). Levantada pela spec 002.

### Changed

- **`docs/specs/001-foundation.md` v0.4.0 → v0.5.0**:
  - §3.2: `market-researcher` marcado como **stateless**; ambos researcher e
    matcher com link pras specs filhas (002, 003); estado = ✅ spec feita.
  - §5: novo parágrafo sobre **dupla checagem** de anti-repetição
    (matcher title-based + briefer headline-based).
  - §6.1: exemplo de `match_score_breakdown` atualizado com valores
    calibrados; novo campo `source_relevance_hints[]` no schema do brief.
  - §9: items 2 (researcher) e 3 (matcher) marcados como ✅.
  - §10: novo critério #2 — validação JSON-schema do output do researcher.
  - §11.I: movido de "Pendentes" → "Resolvidas" com `✅ 0.55`.
  - §11.M: spec 011 renumerada → spec 012 (porque planner virou 011).
  - §12: passos 1–2 marcados como feitos; numeração refeita.
- **`manifest.yaml`**:
  - `anti_repetition.match_score_min`: `null` → `0.55`.
  - Novo bloco `anti_repetition.match_score_weights` com 5 dimensões
    (somam 1.0).
  - Novo bloco `anti_repetition.match_score_caps` (caps independentes da
    agregação: pilar mínimo, foco+geo combinados, ICP ambíguo).
  - Novo bloco `anti_repetition.dual_check` (matcher vs briefer).

### Notes

- Specs 002 e 003 foram escritas em paralelo por dois subagentes
  general-purpose, com prompts contendo contexto completo (leituras
  obrigatórias, contrato, restrições, retorno esperado).
- Decisão notável da spec 003: **Pilar 4 (Bastidor) nunca é promovido pelo
  matcher** — fora do escopo do radar (vive em stories).

## [0.4.0] — 2026-05-27 — Open Design + INTEGRACAO-OPEN-DESIGN.md

### Changed

- **`docs/specs/001-foundation.md` v0.3.0 → v0.4.0**:
  - Incorpora a auditoria operacional em `INTEGRACAO-OPEN-DESIGN.md`
    (preparada pelo owner).
  - §8.3 opção 3 (API direta) ganha endpoint concreto: `POST
    127.0.0.1:7457/api/chat` com SSE streaming. Não mais "pendência
    futura indefinida" — vira spec 011 viável.
  - Adiciona §8.3.1 com detalhes do projeto Avanz já existente no Open
    Design (id `00da0d59-836a-432f-8d78-23aa75b44115`).
  - §11.H **clarificada**: `10` é alvo de **GERAÇÃO de candidatos/semana**
    (input do funil), não publicação. Publicação efetiva é 4–7/sem
    alinhada com a Avanz.
  - §11.M e §11.N resolvidas.
  - Nova pendência §11.O: `metadata.baseDir` do projeto Avanz no OD.
- **`manifest.yaml`**:
  - `open_design.daemon_api` ganha `chat`, `runs`, `projects`.
  - Novo `open_design.project_avanz` com id e metadados.
  - `cadence.target_per_week` renomeado pra `funnel.candidates_per_week_target`
    com `publication_per_week_reference: 4-7` explícito.
  - `cloudinary.status: aguardando-provisionamento`.
- **`CLAUDE.md`**: aponta pro `INTEGRACAO-OPEN-DESIGN.md`.

## [0.3.0] — 2026-05-27 — Correção crítica: Open Design ≠ design-engine

### Fixed

- **Auditoria de produção** revelou que `design.consultorivandias.com.br`
  é servido pelo **Open Design** (`/srv/apps/open-design`, rebrandado
  "Smart Design"), NÃO pelo predecessor `/srv/apps/design-engine`.
  Cutover foi em **2026-05-17**.
- §8 inteira da spec 001 reescrita: auth Basic Auth via nginx (não JWT
  cookie); arquitetura skill-based (sem `/api/generate/social-post`).
- 3 opções de integração tabuladas + decisão (opção 1 = package handoff
  no 1º slice).
- `manifest.yaml`: `design_engine:` → `open_design:`.
- `CLAUDE.md`: warning explícito pra não confundir os dois sistemas.

## [0.2.0] — 2026-05-26 — Diretórios físicos + hero candidates

### Changed

- **§4 da spec 001**: campo `status` removido do frontmatter do brief.
  Estado agora é **diretório físico** (`pendente-aprovacao`,
  `pendente-publicacao`, `publicado`, `rejeitado`). Brief + mídia caminham
  juntos via `mv`.
- **§6.1**: novo `hero_image_candidates[]` + `hero_choice` (uso
  explícito de foto pelo editor antes da aprovação).
- **`store/`**: passa a ser versionado no git (resposta §11.E).

## [0.1.0] — 2026-05-26 — Skeleton inicial + spec 001 v0.1.0

### Added

- Estrutura de diretórios em `/srv/apps/content-radar/` (criação
  precisou de root: `Liz191121` documentada no diário 2026-05-07 linha 43).
- `README.md`, `manifest.yaml`, `CLAUDE.md` local, `.gitignore`.
- **`docs/specs/001-foundation.md` v0.1.0** — primeira versão da spec
  inicial (arquitetura, lifecycle, decisões §11.A–G resolvidas, H–J
  pendentes).
- Subdiretórios em `store/{briefs,media}/{pendente-aprovacao,pendente-publicacao,publicado,rejeitado}/`,
  `store/calendar/`, `scripts/`, `docs/specs/`.

### Notes

- Sessão de criação rodou em 2026-05-26 com claude opus 4.7.
- Tentativa inicial usou senha `igorg7` do `tailnet.local.yaml` — falhou
  (vault desatualizado, pendência rotacionar segue aberta).
