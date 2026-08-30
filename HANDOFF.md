---
type: handoff
status: ready-for-next-session
created_at: 2026-05-27
session_end: 2026-05-27
next_session_owner: igorg7
---

> [!WARNING]
> **Documento histórico — 2026-05-27.** Descreve o content-radar como pipeline
> de linha de comando, operado por skills. A app web o substituiu: as skills
> determinísticas viraram código, `radar-handoff` virou `exportar`, e as
> credenciais do Cloudinary saíram de `.local/cloudinary.env` para o `.env` de
> cada instalação. **Não siga as instruções daqui.**
>
> O estado atual está em [`docs/pendencias.md`](./docs/pendencias.md); o
> contrato de ambiente, em [`web/.env.example`](./web/.env.example).

# HANDOFF — content-radar

> Documento canônico pra a próxima sessão de trabalho continuar de onde paramos.
> Leia este antes de qualquer coisa.

## TL;DR — em 1 minuto

`content-radar` é um pipeline sob demanda (Claude Code skills + subagentes)
que **pesquisa mercado imobiliário → cruza com perfil Avanz → gera briefs
estruturados + fotos no Cloudinary → entrega "package" pro humano operar
no Smart Design (`design.consultorivandias.com.br`)** e publicar no IG.

**Status agora**: foundation + **implementação do 1º slice prontas** (2026-05-28).
- 6 specs escritas: 001, 002, 003, 004, 005, 007.
- 3 subagentes materializados em `.claude/agents/`: `market-researcher`, `avanz-matcher`, `instagram-briefer`.
- 3 skills materializadas em `.claude/skills/`: `radar-scan`, `radar-mv`, `radar-handoff` — todas auto-detectadas pelo Claude Code (`/radar-scan` etc estão disponíveis).
- Bloqueio externo remanescente: **Cloudinary** (placeholder mode destrava enquanto credenciais não chegam).

## O que existe hoje (paths absolutos)

```
/srv/apps/content-radar/
├── README.md                              índice + visão geral
├── CLAUDE.md                              regras de sessão (carregado pelo Claude Code)
├── INTEGRACAO-OPEN-DESIGN.md              auditoria do sistema downstream (Open Design)
├── HANDOFF.md                             ← você está aqui
├── CHANGELOG.md                           histórico de versões do foundation
├── manifest.yaml                          config canônica (empresa-alvo, scopes, scoring, cloudinary, OD)
├── .gitignore                             store/media/, store/packages/, .local/
├── .claude/
│   ├── skills/
│   │   ├── radar-scan/SKILL.md           ✅ orquestrador (spec 005 §12)
│   │   ├── radar-mv/SKILL.md             ✅ transição de estado (spec 005 §17)
│   │   └── radar-handoff/SKILL.md        ✅ Cloudinary + package (spec 007 §13)
│   └── agents/
│       ├── market-researcher.md          ✅ Sonnet 4.6 (spec 002)
│       ├── avanz-matcher.md              ✅ Sonnet 4.6 (spec 003)
│       └── instagram-briefer.md          ✅ Opus 4.7 (spec 004)
├── .local/
│   └── cloudinary.env.example            ✅ template (gitignored exceto .example)
├── docs/specs/
│   ├── 001-foundation.md                  v0.10.0 — arquitetura, lifecycle, decisões §11.A–P todas resolvidas
│   ├── 002-researcher.md                  v0.2.0 — subagente market-researcher (+ finding_id/fetched_at/geo_hints/raw_excerpts[])
│   ├── 003-matcher.md                     v0.2.0 — subagente avanz-matcher (alinhado a 002; topic_hash_matcher + source_relevance_hints[] no output)
│   ├── 004-briefer.md                     v0.1.2 — subagente instagram-briefer (enum od_skill_ref reduzido; telefone via manifest.brand_facts)
│   ├── 005-skill-scan.md                  v0.1.0 — skills radar-scan + radar-mv (990 linhas, orquestração + transição de estado)
│   └── 007-handoff.md                     v0.1.1 — skill radar-handoff (enum alinhado; telefone via manifest.brand_facts)
├── store/                                 (vazio — populado pela primeira execução do radar-scan)
│   ├── briefs/{pendente-aprovacao,pendente-publicacao,publicado,rejeitado}/
│   ├── media/{...}/                       gitignored
│   ├── packages/                          gitignored
│   ├── calendar/
│   └── (ledger.jsonl será criado)
└── scripts/                               (vazio)
```

## Sistema downstream — Open Design (NÃO confundir com design-engine!)

- **Open Design** ("Smart Design") = `/srv/apps/open-design` +
  `https://design.consultorivandias.com.br`. Sistema vivo desde 2026-05-17.
- `/srv/apps/design-engine` = **predecessor desativado** — qualquer referência
  a `/api/polish-brief` ou `/api/generate/social-post` é do velho. Ignorar.
- Auditoria completa em [`INTEGRACAO-OPEN-DESIGN.md`](./INTEGRACAO-OPEN-DESIGN.md).
- Projeto Avanz no Open Design já existe: id `00da0d59-836a-432f-8d78-23aa75b44115`.

## Estado das decisões (§11 da spec 001)

```
A ✅ Modelos: Sonnet 4.6 (researcher/matcher/planner), Opus 4.7 (briefer)
B ✅ Auth OD: Basic Auth nginx; 1º slice não autentica (humano opera UI)
C ✅ Foto: hero_image_candidates[] + hero_choice obrigatório
D ✅ Onde rodar: local, sob demanda
E ✅ Versionar store/: texto sim, mídia gitignored
F ✅ Multi-empresa: monogâmico agora; expansão no roadmap §9 item 13
G ✅ Diretórios físicos por estado (4 dirs)
H ✅ funnel.candidates_per_week_target: 10 (geração, não publicação)
I ✅ match_score_min: 0.55 (definido na spec 003 §5)
J ✅ Redundantes: skip silencioso
K ✅ briefs/rejeitado/ mantido
L ✅ Gitignore + Cloudinary
M ✅ Integração OD: package handoff (1º slice); skill custom = spec 010;
                   API direta = spec 012
N ✅ Cloudinary: conta nova dedicada — owner provisiona
O ✅ baseDir do projeto Avanz no OD: deferido pra spec 010 (mantém não setado)
P ✅ Agregadores: aceitar secundárias; priorizar primária via source_key
                   canônico + marcar repasses no relevance_hint
```

**Nenhuma decisão §11 aberta após 2026-05-27.**

## Pesos e thresholds (canônicos)

Fonte da verdade: [`manifest.yaml`](./manifest.yaml) `anti_repetition.*`.

```yaml
match_score_min: 0.55
match_score_weights:    # somam 1.0
  pillar_fit:           0.30
  foco_editorial_fit:   0.25
  geografia_fit:        0.20
  icp_fit:              0.15
  freshness:            0.10
match_score_caps:
  pillar_fit_min:           0.30   # se pillar_fit < isso → skip antes da soma
  foco_and_geo_combined_min: 0.50  # se foco<0.20 E geo<0.50 → skip
  icp_ambiguous_cap:        0.45   # ambiguidade ICP → default comprador, cap em 0.45
```

## O que está bloqueado e o que NÃO está

| Tarefa | Bloqueio | Quem desbloqueia |
|---|---|---|
| **Spec 004 (briefer)** | ✅ feita 2026-05-27 ([link](./docs/specs/004-briefer.md)) | — |
| **Spec 005 (radar-scan + radar-mv)** | ✅ feita 2026-05-27 ([link](./docs/specs/005-skill-scan.md)) | — |
| **Spec 007 (radar-handoff)** | ✅ feita 2026-05-27 ([link](./docs/specs/007-handoff.md)) | — |
| **Implementação 1º slice** | nada — pode começar via `--placeholder-mode` | claude (próxima sessão) |
| **Upload Cloudinary real** | **credenciais** | owner popula `.local/cloudinary.env` |
| **Spec 010 (skill custom OD)** | nada — §11.O fica pra ela decidir baseDir | claude |
| **Spec 012 (API direta OD)** | spec 010 implementada (define baseDir) | claude |

## Pré-requisitos pra próxima sessão começar codando o 1º slice

1. **Owner provisiona conta Cloudinary nova dedicada** (free tier OK — estimativa
   ~200 MB/mês cabe nos 25 créditos do free).
2. **Owner cria `/srv/apps/content-radar/.local/cloudinary.env`** com:
   ```
   CLOUDINARY_CLOUD_NAME=<nome>
   CLOUDINARY_API_KEY=<key>
   CLOUDINARY_API_SECRET=<secret>
   ```
   chmod 600. (Path `.local/` já está no `.gitignore`.)

Sem isso, dá pra avançar com specs 004, 005 e (parcial) 007 mesmo sem
credenciais — só não dá pra rodar handoff de verdade.

## Próximas ações sugeridas (em ordem)

1. **Rodar o pipeline pela primeira vez** —
   `/radar-scan --scope=trends --pillar=mercado-rmbh --dry-run` pra ver
   plano; depois sem `--dry-run` pra execução real. Esperado: 3+ briefs
   em `store/briefs/pendente-aprovacao/`.
2. **Revisão humana** — abrir os `.md` gerados, escolher `hero_choice`,
   editar copy se quiser. Depois: `/radar-mv <slug> approve` (move
   pra `pendente-publicacao/` + mantém só a foto escolhida).
3. **Handoff em modo placeholder** —
   `/radar-handoff --placeholder-mode` enquanto Cloudinary não chega.
   Gera package em `store/packages/<slug>/` com `<PENDING_CLOUDINARY>`
   na URL. Humano abre Smart Design, cola brief, faz upload manual
   da foto, gera post, publica no IG.
4. **(Quando chegar Cloudinary)** Owner provisiona conta + popula
   `.local/cloudinary.env`. Rodar `/radar-handoff --force` sobre briefs
   já entregues atualiza URL real no brief + package.
5. **(Opcional) Owner confirma signed vs unsigned Cloudinary** (spec 007
   §18) — signed é o default; mudar pra unsigned se preferir revogação
   fácil via dashboard.
6. **Critério §10 da spec 001** atendido → specs 006 (review),
   008 (mark-published), 009 (housekeeping).
7. **Decisão sobre git/GitHub**: o owner já tem `gh auth login` autenticado como
   `igorG7` (resposta N8). Decidir: nome do repo, público vs privado, push
   inicial. Não bloqueia desenvolvimento local.

## Decisões técnicas notáveis das specs 002, 003, 004, 005 e 007 (pra próxima sessão internalizar)

### Da spec 007 (radar-handoff)

- **Cloudinary signed upload em bash puro** (curl + sha1sum + jq) — sem
  SDK, sem dependência node/python no 1º slice. Snippet completo no
  SKILL.md.
- **Modo `--placeholder-mode`** com sentinel `<PENDING_CLOUDINARY>` no
  brief + alerta condicional no README do package. Destrava a
  implementação do 1º slice mesmo sem credenciais. `--force` re-roda
  quando Cloudinary chegar.
- **Brief simplificado do package remove campos internos do pipeline**
  (`match_score_breakdown`, `topic_hash`, `ledger_ref`, candidatos
  não-escolhidos) — humano não precisa ver instrumentação no chat do OD.
- **Skill NÃO move o brief** — `pendente-publicacao/` continua sendo a
  casa até `radar-mark-published` (spec 008). Ledger usa `from_dir =
  to_dir = null` pros 4 eventos novos.
- **Idempotência granular**: sem `--force`, pula upload mas re-renderiza
  package quando humano edita `od_skill_ref` no `.md`.
- **Pendência menor**: confirmar signed vs unsigned com owner (signed é
  o default).

### Da spec 005 (radar-scan + radar-mv)

- **Skills em diretório dedicado** (`.claude/skills/<slug>/SKILL.md`) em
  vez de arquivo flat — abre espaço pra `_shared/` (stopwords-pt-br já
  referenciado por specs 003/004).
- **Briefers rodam serial dentro do radar-scan** (não paralelo) — evita
  race no contador `NNN` e na anti-rep definitiva.
- **`--dry-run` não invoca Task() nem simula chamadas** — só valida +
  planeja; custo zero. Trade-off: não pega erro de runtime.
- **`hero_choice: null` no approve é permitido com warning** — alinhado
  a §11.C ("Open Design improvisa quando null").
- **`mv` cru pelo humano fica aceito silenciosamente** — ledger é
  best-effort; anti-rep lê arquivos (não ledger), então não quebra.
- **Validação JSON ad-hoc inline com `jq`** no 1º slice; JSON-Schema
  formal fica pra spec futura.

### Da spec 004 (briefer)

- **Matriz pilar → skill OD**: `imovel-da-semana`/`quem-comprou` → `poster-hero`; os demais →
  `ad-creative` (com `social-x-post-card` como alternativa recorrente).
  `avanz-instagram-post` fica como placeholder pra spec 010 — ainda
  não usável (enum do schema não a inclui).
- **Hero download via `Bash` + `curl -sSL`**, NÃO `WebFetch` —
  `WebFetch` retorna texto processado, não bytes brutos. Cap de 3
  candidatos por brief; falhas individuais não invalidam o brief
  (no pior caso, `hero_image_candidates: []`).
- **Briefer stateful** (`Read` no frontmatter, em contraste com
  researcher stateless): leitura repetida do vault e dos 4 dirs de
  briefs cabe no prompt-cache do Claude Code.
- **Anti-repetição definitiva = 2ª passada com headline final**: o
  briefer pode descartar pauta que o matcher liberou (matcher usa
  `title` do finding; briefer usa `headline` redigida). Trade-off de
  design: in-flight só barra em `topic_hash` OR `source_urls` overlap;
  "mesma notícia, fontes diferentes" pode passar — editor humano pega
  na revisão.
- **Guardrail check com 2 retries**: keyword list derivada de
  `guardrails.md` + `content-pillars.md > O que NÃO entra`; persistência
  → `decision: skip-validation-failed`, `skip_reason: "guardrail_violation"`.
- **Headline `maxLength: 90`** — calibrado pra ser overlay legível em
  `poster-hero`/`ad-creative`. ✅ confirmado pelo owner em 2026-05-27.

### Da spec 002 (researcher)

- **Stateless** — sem Read/Write/Bash. Orquestrador injeta trechos do vault
  inline no prompt. Saída é JSON puro.
- **Cap rígido**: 6 queries WebSearch por execução (proteção rate limit).
- **`target_count * 1.5`** como teto de findings (margem pro matcher).
- **Datas relativas → descarte**: "recentemente" sem timestamp absoluto é
  insuficiente. `published_at` ISO 8601 é obrigatório.

### Da spec 003 (matcher)

- **`bastidor` nunca é promovido** — fora do escopo do radar (`pillar_fit=0`,
  decisão = `skip-out-of-scope`). Bastidor vive nos stories, decisão humana
  ad-hoc.
- **Default ICP=comprador** quando ambíguo, mas com cap `icp_fit=0.45` (sinaliza
  ambiguidade pro briefer sem derrubar o finding).
- **Caps independentes do agregado** — `pillar_fit<0.30` OU
  (`foco<0.20` AND `geo<0.50`) ⇒ skip antes de agregar (evita "soma compensa").
- **Anti-repetição roda 2x**: matcher (title-based, barato) + briefer
  (headline-based, definitivo). Ver §5 da spec 001.
- **Dedup intra-batch**: matcher detecta findings duplicados na mesma resposta
  do researcher (ex.: G1+Valor sobre mesmo fato) e promove só o de maior score.

## Como retomar (passo-a-passo pra próxima sessão)

1. `cd /srv/apps/content-radar`
2. Ler este `HANDOFF.md` (você acabou de fazer).
3. Ler `CLAUDE.md` local (carregado automaticamente pelo Claude Code).
4. Ler `docs/specs/001-foundation.md` v0.5.0.
5. Verificar pré-requisitos da próxima sessão (Cloudinary credentials).
6. Decidir: começar pela spec 004 ou pela 005 (recomendo 004 — afeta o schema
   do brief; 005 só orquestra).

## Referências rápidas (paths absolutos)

- Vault Avanz: `/srv/my-mind/Empresas/avanz-imoveis/`
- Open Design app: `/srv/apps/open-design/`
- Open Design daemon URL: `http://127.0.0.1:7457` (loopback only)
- Open Design UI: `https://design.consultorivandias.com.br` (Basic Auth nginx)
- Senha root deste host: documentada em `/srv/my-mind/_system/diario/2026-05-07.md`
  linha 43 (use via `su -` com pty — `sudo` com a senha do user `igorg7` no
  `tailnet.local.yaml` está desatualizado)

## Contato e contexto pessoal

- Owner: igorG7 (`junioh2001@gmail.com`)
- GitHub do owner: `igorG7` (já autenticado via `gh auth login`)
- Host: `storage-web-server` (alias `storage-jl`)
- Foco operacional declarado pela Avanz: lotes, sítios, chácaras (NÃO casas
  prontas, exceto MCMV com simulação Caixa prévia)
- Áreas-alvo: RMBH (Mateus Leme, Esmeraldas, Juatuba, BH)
