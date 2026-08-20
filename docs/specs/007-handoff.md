---
spec_id: 007-handoff
title: "content-radar — Skill radar-handoff (Cloudinary upload + package generator)"
status: draft
version: 0.1.2
data: 2026-05-29
autor: claude
empresa_alvo: avanz-imoveis
escopo: última peça do 1º slice — sobe a hero pra Cloudinary e gera o "package" que o humano leva pro Smart Design (Open Design @ design.consultorivandias.com.br)
resolves:
  - "item 7 do roadmap §9 da spec 001 (Skill radar-handoff + Cloudinary)"
  - "esboço da §8.5 da spec 001 (formaliza fluxo da radar-handoff)"
  - "itens 5 e 6 do critério §10 da spec 001 (package + abertura no Smart Design em <5 min)"
related:
  - /srv/apps/content-radar/docs/specs/001-foundation.md
  - /srv/apps/content-radar/docs/specs/002-researcher.md
  - /srv/apps/content-radar/docs/specs/003-matcher.md
  - /srv/apps/content-radar/docs/specs/004-briefer.md
  - /srv/apps/content-radar/docs/specs/005-skill-scan.md
  - /srv/apps/content-radar/manifest.yaml
  - /srv/apps/content-radar/INTEGRACAO-OPEN-DESIGN.md
  - /srv/apps/open-design/skills/ad-creative/SKILL.md
  - /srv/apps/open-design/skills/poster-hero/SKILL.md
  - /srv/apps/open-design/skills/social-x-post-card/SKILL.md
changelog:
  - "v0.1.2 (2026-05-29): pós-1ª execução real. §6 (template README do package) ganha nova seção `§5b. Prompt OD-ready` — versão consolidada do brief formatada como prompt único, pronta pra colar direto no chat do Smart Design (skill `ad-creative`). Equivalente ao §5+§6+§7 do README num bloco só. Motivada por feedback do owner: ter que navegar entre seções do README é fricção; o bloco consolidado elimina isso. Sem mudança em fluxo, args ou ledger."
  - "v0.1.1 (2026-05-28): pós-audit. §2 item 6 (enum `od_skill_ref`) reduzido a 3 valores — alinha com 004 v0.1.2. §6 (template README) deixa de hardcodar telefone — interpola `manifest.target_company.brand_facts.phone_display`. Sem mudança em fluxo, args ou ledger."
  - "v0.1.0 (2026-05-27): primeira versão; define args (--force, --dry-run, --placeholder-mode), contrato .local/cloudinary.env, fluxo de upload signed (SHA-1 em bash), template do README.md do package, schema do brief simplificado, eventos novos do ledger (cloudinary-uploaded, handoff-finished etc), modo placeholder transitório, SKILL.md literal e 10 gotchas."
---

# Spec 007 — `radar-handoff`

> **Superada em 2026-08-20.** A skill deixou de existir: a operação virou
> `exportar()` em `web/db/backend.ts`, que devolve **um `.md`** para download
> em vez de escrever cinco arquivos em `store/packages/`. O que continua
> valendo desta spec são as **regras** — o que o pacote precisa carregar e o
> que o evento `handoff-finished` registra. O que não vale mais é a forma:
> nada disto passa por arquivo em `store/` nem por um modelo lendo
> frontmatter.
> Ver [`docs/pendencias.md`](../pendencias.md).


> Define a **última skill** do 1º slice vertical do `content-radar`.
> Consome briefs em `store/briefs/pendente-publicacao/` (já validados pelo
> [`radar-mv approve`](./005-skill-scan.md#152-reject)) que ainda **não
> foram entregues** (`handoff_at: null`), sobe a foto escolhida pelo
> humano (`hero_choice == N`) pra **Cloudinary**, e gera um diretório
> `store/packages/<slug>/` com **tudo que o humano precisa pra abrir o
> Smart Design e produzir o post**.
>
> Não duplica conceitos da foundation. Aterra em
> [`001 §2`](./001-foundation.md#2-visão-do-sistema) (pipeline),
> [`001 §3.3`](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado)
> (storage), [`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta)
> (lifecycle), [`001 §6.1`](./001-foundation.md#61-brief-storebriefsdirslugmd)
> (schema do brief — campos `hero_image_candidates[N].cloud_url`,
> `cloudinary_public_id`, `handoff_at`, `package_path`),
> [`001 §8`](./001-foundation.md#8-integração-com-open-design-smart-design--designconsultorivandiascombr)
> (integração com Open Design, opção 1 do 1º slice) e
> [`001 §8.5`](./001-foundation.md#85-fluxo-da-radar-handoff-primeiro-slice--opção-1)
> (esboço — esta spec **formaliza**).
>
> Reusa o padrão de skill estabelecido na
> [`005 §3`](./005-skill-scan.md#3-padrão-de-arquivo-claudeskillsslugskillmd)
> (diretório dedicado `.claude/skills/<slug>/SKILL.md`) e o ledger
> canônico em [`005 §18`](./005-skill-scan.md#18-ledger--formato-canônico).

---

## 1. Objetivo e posição no pipeline

`radar-handoff` é a **última peça** do 1º slice (escopo de [`001 §10`](./001-foundation.md#10-primeiro-slice-vertical-escopo-do-primeiro-passo)).
Roda no contexto do **session principal** do Claude Code (mesmo padrão das skills da spec 005 — ver [`005 §2`](./005-skill-scan.md#2-por-que-são-skills-não-subagentes)),
não é subagente.

Posição no diagrama da [`001 §2`](./001-foundation.md#2-visão-do-sistema):

```
   briefs/pendente-publicacao/<slug>.md      ← entrada (output do radar-mv approve)
                  │
                  ▼
   ┌─────────────────────────────────────┐
   │   skill: radar-handoff              │   ← ESTA SPEC
   │   1. upload hero pra Cloudinary     │
   │   2. produz "package" pro humano    │
   │   3. grava package_path no brief    │
   └─────────────────────────────────────┘
                  │
                  ▼
   humano abre design.consultorivandias.com.br,
   cola brief + foto, agente OD gera artifact,
   humano publica no IG manualmente
                  │
                  ▼
   skill: radar-mark-published  (spec 008 — fora desta spec)
```

A spec 001 [§8.5](./001-foundation.md#85-fluxo-da-radar-handoff-primeiro-slice--opção-1)
já tinha o **esboço** do fluxo desta skill — esta spec **formaliza**,
adiciona modo placeholder transitório (§14), detalha o upload Cloudinary
(§8), define template literal do package (§6, §7) e os eventos novos do
ledger (§11).

### 1.1 O que faz / o que NÃO faz

**Faz:**

- Lê briefs em `pendente-publicacao/` com `handoff_at: null` (re-roda com
  `--force`).
- Sobe a mídia escolhida (`media/pendente-publicacao/<slug>__N.<ext>` —
  já filtrada pelo radar-mv para conter apenas a foto do `hero_choice`)
  pra Cloudinary (signed upload, §8).
- Gera `store/packages/<slug>/` com `README.md`, `brief.md` simplificado,
  `hero.<ext>`, `hero.cloud-url.txt`, `od-skill-ref.txt`.
- Atualiza o brief: `handoff_at`, `package_path`,
  `hero_image_candidates[N].cloud_url`, `cloudinary_public_id`.
- Append no ledger: `cloudinary-uploaded`, `handoff-finished`,
  `cloudinary-upload-failed`, `handoff-skipped`.

**NÃO faz:**

- Não publica no Instagram (publicação é manual, humano usa a web UI
  do Smart Design + sobe pro IG por fora — ver `CLAUDE.md` raiz do
  projeto, "Não publicar").
- Não chama API do Open Design (`POST /api/chat` — isso é spec 011/012,
  conforme [`001 §8.3`](./001-foundation.md#83-três-opções-de-integração)
  opção 3).
- Não move o brief — `pendente-publicacao/` é o lar do brief até
  `radar-mark-published` (spec 008) levar pra `publicado/`.
- Não faz purge de mídia local — isso é a spec 009 (housekeeping).
  Cópia local em `media/pendente-publicacao/` permanece até spec 008/009.
- Não consome briefs em `pendente-aprovacao/` (precisa ter passado pelo
  `radar-mv approve`).

---

## 2. Pré-condições do brief

Para um brief ser **elegível** pra handoff, todas as condições abaixo
devem valer (validadas antes de qualquer side effect):

| # | Condição | Erro / ação se falhar |
|---|----------|----------------------|
| 1 | Brief existe em `store/briefs/pendente-publicacao/<slug>.md` | `slug não encontrado em pendente-publicacao/` → erro fatal pra este brief; segue pro próximo. |
| 2 | Frontmatter parseia como YAML válido | `frontmatter inválido` → erro fatal pra este brief. |
| 3 | `handoff_at` é `null` (ou `--force` foi passado) | Ledger `handoff-skipped` com `reason: "already_handed_off"`; segue pro próximo. |
| 4 | `hero_choice` está setado (`null` OU int N válido) — já validado pelo `radar-mv approve` (spec 005 §14 item 4) | Se ausente: erro pedindo pra rodar `radar-mv approve` antes (defesa em profundidade — não devia acontecer). |
| 5 | Se `hero_choice == N`: `N ∈ [0, len(hero_image_candidates)-1]` (já validado pelo radar-mv) | Erro defensivo `hero_choice fora de range` → pula brief. |
| 6 | `od_skill_ref` setado e ∈ enum (`ad-creative` \| `poster-hero` \| `social-x-post-card`) — enum da [spec 004 §4.2](./004-briefer.md#42-schema-do-brief-formaliza-esboço-de-001-61). `social-spotify-card`/`social-reddit-card` ficam em `manifest.candidate_skills` mas não no enum (matriz §5 da 004 não atribui). | Ledger `handoff-skipped` com `reason: "invalid_od_skill_ref"`; segue. |
| 7 | `od_skill_ref` aponta para skill que **existe** em `/srv/apps/open-design/skills/<od_skill_ref>/SKILL.md` | Ledger `handoff-skipped` com `reason: "od_skill_not_found"`; segue. |
| 8 | Se `hero_choice == N`: arquivo `media/pendente-publicacao/<slug>__N.<ext>` (qualquer extensão `.jpg|.png|.webp|.gif`) existe no disco | Erro fatal pra este brief; segue pro próximo. (Mídia já foi filtrada pelo `radar-mv approve` — apenas a escolhida sobrevive; spec 005 §15.1 item 6.) |

### 2.1 Por que `hero_choice == null` é caso especial

Quando o humano aprovou sem foto (`hero_choice: null`), o fluxo:

- **Não chama Cloudinary** (`skip_upload: true`).
- `cloud_url` e `cloudinary_public_id` ficam intactos (`null`) em todos
  os candidatos.
- Package é gerado **sem `hero.<ext>` e sem `hero.cloud-url.txt`**.
- README.md do package alerta o humano que **não há hero** — Smart
  Design vai usar template ou gerar imagem; humano pode fazer upload
  manual de outra foto se quiser.
- `handoff_at` e `package_path` são preenchidos normalmente.
- Ledger registra `handoff-finished` com `extra.hero_uploaded: false`.

Não é erro — é caminho válido, alinhado com [`001 §11.C`](./001-foundation.md#11-decisões-abertas)
(uso explícito do hero — null é decisão consciente).

---

## 3. Argumentos da skill

Frontmatter `argument-hint`:

```
[<slug>] [--force] [--dry-run] [--placeholder-mode]
```

| Arg | Tipo | Obrigatório? | Default | Notas |
|---|---|---|---|---|
| `<slug>` | string posicional | não | — (processa **todos** os briefs elegíveis em `pendente-publicacao/`) | Slug completo ou **prefixo único** (resolução por glob, mesmo padrão do `radar-mv` — [`005 §13`](./005-skill-scan.md#13-argumentos) e [`005 §16.2`](./005-skill-scan.md#162-slug-ambíguo)). Sem arg = batch sobre todos os elegíveis. |
| `--force` | flag | não | `false` | Re-roda upload Cloudinary mesmo se `cloudinary_public_id` já gravado (regenera o package também). Útil quando humano editou `od_skill_ref` no `.md` ou template do README mudou. |
| `--dry-run` | flag | não | `false` | Não chama Cloudinary, não cria package, não atualiza brief, não escreve no ledger. Reporta o que faria (§5.8). Mesmo princípio do dry-run das skills da spec 005 (`SKILL.md` literal §13: "dry-run é sagrado"). |
| `--placeholder-mode` | flag | não | `false` | **Modo transitório** (§14): roda tudo MENOS o upload Cloudinary. Gera package com `cloud_url: "<PENDING_CLOUDINARY>"`. Útil enquanto a conta Cloudinary ([`001 §11.N`](./001-foundation.md#11-decisões-abertas) — política resolvida, **execução pendente**) não foi provisionada. |

### 3.1 Combinações válidas

- `radar-handoff` — sem args, batch sobre todos elegíveis. Requer
  `.local/cloudinary.env`.
- `radar-handoff <slug>` — só um brief específico. Requer credenciais.
- `radar-handoff --force` — re-roda batch. Requer credenciais.
- `radar-handoff <slug> --force` — re-roda só esse. Requer credenciais.
- `radar-handoff --dry-run` (com ou sem `<slug>`) — relata; sem
  credenciais OK (não chama Cloudinary).
- `radar-handoff --placeholder-mode` (com ou sem `<slug>`, com ou sem
  `--force`) — sem credenciais OK; sobe nada; package com placeholder.
- `--dry-run --placeholder-mode` — relata o que faria em modo
  placeholder. Idempotente. (Pouco útil mas válido.)

### 3.2 Edge cases

- `--force --placeholder-mode` juntos: re-gera package com placeholder
  (útil se template do README mudou e Cloudinary ainda não chegou).
- Sem `<slug>` em batch vazio (nenhum elegível): reporta `0 elegíveis,
  nada a fazer`. Não é erro.

---

## 4. Contrato `.local/cloudinary.env`

Conforme [`manifest.yaml#cloudinary.credentials_env`](../../manifest.yaml)
(= `./.local/cloudinary.env`) — formato canônico:

```
CLOUDINARY_CLOUD_NAME=<nome-da-conta>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
# opcional (sobrescreve manifest.cloudinary.folder):
CLOUDINARY_FOLDER=content-radar/avanz
```

**Regras operacionais:**

- Permissões: `chmod 600 .local/cloudinary.env`.
- Gitignored: `.local/` está em [`.gitignore`](../../.gitignore) (linha 13);
  arquivo nunca entra em git.
- Não fica em `git status` nem em `git stash`.
- Não imprimir no log nem em mensagem de erro o conteúdo de
  `CLOUDINARY_API_SECRET` (regra do `/etc/claude-code/CLAUDE.md`).

**Carregamento na skill** (bash):

```bash
if [[ -f .local/cloudinary.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .local/cloudinary.env
  set +a
fi

# Defaults do manifest se ENV não setou
: "${CLOUDINARY_FOLDER:=content-radar/avanz}"
```

**Validação de presença** (antes do upload real):

```bash
if [[ -z "$CLOUDINARY_CLOUD_NAME" || -z "$CLOUDINARY_API_KEY" || -z "$CLOUDINARY_API_SECRET" ]]; then
  if [[ "$PLACEHOLDER_MODE" != "true" ]]; then
    echo "❌ Credenciais Cloudinary ausentes em .local/cloudinary.env."
    echo "   Crie o arquivo com CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (chmod 600)."
    echo "   Ou rode com --placeholder-mode para gerar package sem upload."
    exit 1
  fi
fi
```

### 4.1 Provisionamento

Conforme [`001 §11.N`](./001-foundation.md#11-decisões-abertas) (resolvida
em 2026-05-27): owner provisiona conta nova dedicada Avanz no Cloudinary
e popula `.local/cloudinary.env` manualmente. Esta spec **não automatiza**
o provisionamento — é decisão de owner + 1 vez por projeto.

Até o provisionamento, modo `--placeholder-mode` (§14) é o fluxo
recomendado.

---

## 5. Fluxo passo-a-passo

Algoritmo executado pra **cada brief elegível**. Em modo batch, processa
serial (mesmo princípio da [`005 §9.3`](./005-skill-scan.md#93-serialização-do-briefer)
— evita race em ledger e em re-leitura de brief).

### 5.1 Resolução do batch

1. Se `<slug>` foi passado: resolver via glob em
   `store/briefs/pendente-publicacao/`. Slug ambíguo → lista matches e
   aborta (mesmo padrão da [`005 §16.2`](./005-skill-scan.md#162-slug-ambíguo)).
   Slug não encontrado → erro fatal.
2. Sem `<slug>`: listar **todos** os `pendente-publicacao/*.md`.
3. **Filtrar** por elegibilidade:
   - `handoff_at == null` **OU** `--force`.
   - `od_skill_ref` setado.
4. Resultante = `to_process[]` (lista de paths absolutos).
5. Se vazio → reporta `0 elegíveis` e termina (sem erro).
6. Em `--dry-run`: pula pro §5.8 (relatório) sem executar §5.2–§5.7.

### 5.2 Parse + validação do brief

Pra cada brief em `to_process[]` (serial, ordem alfabética):

1. Read frontmatter (Bash + `yq` ou Read + parser interno do agente).
2. Extrair: `brief_id`, `slug`, `od_skill_ref`, `hero_choice`,
   `hero_image_candidates[]`, `handoff_at`, `package_path`,
   `cloudinary_public_id` (do candidato escolhido, se houver).
3. Validar pré-condições §2 itens 1–8.
4. Falha → log no ledger (`handoff-skipped` com `reason`), segue pro
   próximo. **Não altera brief.**

### 5.3 Resolução da foto

```
if hero_choice == null:
  skip_upload = true
  hero_local_path = null
  hero_ext = null
else:
  N = hero_choice
  # Procurar arquivo real (extensão pode variar)
  hero_local_path = glob("media/pendente-publicacao/<slug>__<N>.{jpg,png,webp,gif}")[0]
  hero_ext = extension(hero_local_path)
  skip_upload = false (a menos que --placeholder-mode)
```

Se `hero_local_path` esperado não existe → erro defensivo (§2 item 8 já
deveria ter pego). Aborta este brief.

### 5.4 Upload Cloudinary

**Pular se** `skip_upload == true` (hero_choice null) **OU**
`--placeholder-mode`.

**Pular também se** (sem `--force`) o candidato N já tem
`cloud_url != null` e `cloudinary_public_id != null`. Nesse caso, reusar
os valores existentes (idempotência §9).

**Caso contrário, fazer upload signed** (algoritmo concreto em §8):

```
timestamp = $(date +%s)
public_id = "$CLOUDINARY_FOLDER/$slug"          # ex.: "content-radar/avanz/2026-W22-005_lote-em-rmbh-..."
to_sign   = "public_id=$public_id&timestamp=$timestamp"
signature = sha1("$to_sign$CLOUDINARY_API_SECRET")

response = curl POST .../upload
  -F file=@$hero_local_path
  -F api_key=$CLOUDINARY_API_KEY
  -F timestamp=$timestamp
  -F public_id=$public_id
  -F signature=$signature

cloud_url = jq -r .secure_url <<< $response
public_id = jq -r .public_id  <<< $response   # confirma; já sabemos
```

Tratamento de erros HTTP em §10. Sucesso → `cloud_url` e `public_id`
serão gravados no brief no §5.6.

**Em `--placeholder-mode`**: `cloud_url = "<PENDING_CLOUDINARY>"`,
`public_id = "<PENDING_CLOUDINARY>"`.

### 5.5 Resolução da skill do Open Design

Já validada em §5.2 (item 6 + 7 das pré-condições). Apenas:

- `od_skill_ref` → nome literal da skill (ex.: `ad-creative`).
- `od_skill_dir = /srv/apps/open-design/skills/<od_skill_ref>/`
  (existência confirmada).

### 5.6 Geração do package

`mkdir -p store/packages/<slug>/`. Criar 5 arquivos (4 se
`hero_choice == null`):

1. **`store/packages/<slug>/README.md`** — passo-a-passo pro humano.
   Template literal em §6.
2. **`store/packages/<slug>/brief.md`** — cópia simplificada do brief
   (sem campos internos). Template em §7.
3. **`store/packages/<slug>/hero.<ext>`** — cópia local da foto (`cp`
   de `media/pendente-publicacao/<slug>__N.<ext>`). **Não criar se
   `hero_choice == null`.**
4. **`store/packages/<slug>/hero.cloud-url.txt`** — uma linha com a URL
   Cloudinary (ou `<PENDING_CLOUDINARY>`). **Não criar se
   `hero_choice == null`.**
5. **`store/packages/<slug>/od-skill-ref.txt`** — uma linha com o
   nome da skill (ex.: `ad-creative`). Sempre criado.

Diretório `store/packages/` está **gitignored** (ver [`.gitignore`](../../.gitignore)
linha 10: contém cópias locais de mídia + brief duplicado; o brief
canônico em `store/briefs/` já é versionado e a mídia tá no Cloudinary —
manter packages fora do git evita duplicação).

### 5.7 Atualização do brief

Edit (ou Write reescrevendo) o frontmatter de
`store/briefs/pendente-publicacao/<slug>.md`:

- `updated_at`: agora ISO 8601 com tz `-03:00`.
- `handoff_at`: agora ISO 8601.
- `package_path`: `./store/packages/<slug>/README.md`.
- `hero_image_candidates[N].cloud_url`: `<secure_url>` (ou
  `<PENDING_CLOUDINARY>`) — apenas se `hero_choice == N`.
- `hero_image_candidates[N].cloudinary_public_id`: `<public_id>` (ou
  `<PENDING_CLOUDINARY>`).

**Outros candidatos** (não escolhidos) ficam com `cloud_url: null` e
`cloudinary_public_id: null` — não sobem (radar-mv já apagou suas mídias
locais; spec 005 §15.1 item 6).

### 5.8 Append no ledger + resumo

Pra **cada brief processado**, eventos conforme §11. No final do batch,
imprime o resumo do §5.9.

### 5.9 Resumo final ao humano

Template literal pro stdout:

```
📦 radar-handoff
Briefs elegíveis: 5
  ↳ Cloudinary upload: 4 success, 0 failed, 1 skipped (hero_choice=null)
  ↳ Packages criados:  5

  • store/packages/2026-W22-005_lote-em-rmbh-valorizou-8-4-no-q1-2026/README.md
  • store/packages/2026-W22-006_lote-em-mateus-leme-com-15-min-a-menos-pra-bh/README.md
  • store/packages/2026-W22-007_mcmv-2026-o-teto-subiu-mas-a-simulacao-caixa-diz/README.md
  • store/packages/2026-W22-008_novo-zoneamento-permite-loteamento-em-esmeraldas/README.md
  • store/packages/2026-W22-009_juros-em-baixa-impacto-no-financiamento-de-lote/README.md

Ledger: 9 eventos novos em store/ledger.jsonl

→ Próximo passo:
  1. Abrir cada README.md, copiar o brief, colar no Smart Design.
  2. Após publicar no Instagram, rodar /radar-mark-published <slug> --ig-url=... (spec 008).
```

Em `--dry-run`:

```
🧪 radar-handoff --dry-run
Plano:
  Elegíveis: 5
  ↳ Uploads que SERIAM feitos: 4
  ↳ Skips (hero_choice=null): 1
  ↳ Packages que SERIAM criados:
     • store/packages/2026-W22-005_.../README.md
     • ...
  ↳ Briefs que SERIAM atualizados (handoff_at, package_path, cloud_url):
     • 2026-W22-005, 2026-W22-006, 2026-W22-007, 2026-W22-008, 2026-W22-009
  ↳ Ledger: 9 eventos seriam appendados (sem escrita)

Nenhum arquivo será modificado. Nenhuma chamada ao Cloudinary.
```

Em `--placeholder-mode`:

```
📦 radar-handoff --placeholder-mode
Modo transitório (Cloudinary não provisionado — §11.N).
Briefs elegíveis: 5
  ↳ Cloudinary upload: 0 (modo placeholder)
  ↳ Packages criados:  5 (com cloud_url = "<PENDING_CLOUDINARY>")

  • ...

⚠️  Quando .local/cloudinary.env for provisionado, rode:
    /radar-handoff --force
  para re-fazer upload e atualizar cloud_url no brief + package.
```

---

## 6. Template do `README.md` do package

Conteúdo literal — a skill renderiza substituindo `<placeholders>`.
Para `hero_choice == null`, blocos marcados são omitidos (ver
condicionais inline).

````markdown
# Package — <brief_id> — <slug>

> <headline>

## 1. O que produzir

Post de feed Instagram (1:1 ou 4:5) seguindo o brief abaixo.

## 2. Skill recomendada no Smart Design

- **Skill**: `<od_skill_ref>` (em [/srv/apps/open-design/skills/<od_skill_ref>/](file:///srv/apps/open-design/skills/<od_skill_ref>/))
- **Por que essa**: <derivado da matriz pilar→skill da [spec 004 §5](/srv/apps/content-radar/docs/specs/004-briefer.md#5-matriz-pilar--skill-do-open-design) — frase 1 explicando o porquê aderente ao Pilar `<pillar>` do brief>
- **Alternativas** (se quiser explorar): <od_skill_alternatives joined>

## 3. Passo-a-passo

1. Abra <https://design.consultorivandias.com.br> (Basic Auth — suas credenciais).
2. Selecione o projeto **Avanz Imoveis-final** (id `00da0d59-836a-432f-8d78-23aa75b44115`).
3. Escolha a skill `<od_skill_ref>`.
4. Cole o brief abaixo (§5) no chat do projeto.
5. <SE hero_choice != null>
   Faça upload da hero:
   - Baixe a foto em <cloud_url> (ou use o arquivo `hero.<ext>` desta pasta).
   - No chat do Smart Design, anexe a imagem (botão de upload).
   </SE hero_choice != null>
   <SE hero_choice == null>
   Não há hero nesta pauta. Opções:
   - Peça pra skill `<od_skill_ref>` gerar/usar um template visual (poster-hero / ad-creative aceitam canvas sem foto).
   - Se quiser uma foto real, faça upload manual de uma do seu acervo.
   </SE hero_choice == null>
6. Acompanhe o run no SSE do daemon (terminal ou aba "Runs" da web UI; pode reanexar).
7. Exporte o artifact final (PNG/JPG/MP4 conforme a skill).
8. Publique no Instagram manualmente (a partir do celular ou da web do IG).
9. Quando publicado: rode `radar-mark-published <slug> --ig-url=https://instagram.com/p/<post-id>` (spec 008).

## 4. Hero

- **hero_choice**: <N | null>
- **Cloudinary URL**: <cloud_url | "<PENDING_CLOUDINARY>" | "— (sem foto)">
- **Local** (cópia neste package): <./hero.<ext> | "— (sem foto)">
- **Alt**: <alt do candidato escolhido | "— (sem foto)">
- **Licença**: <license_hint do candidato escolhido | "— (sem foto)">
- **Licensável**: <true | false | "— (sem foto)">

<SE cloud_url == "<PENDING_CLOUDINARY>">
> ⚠️  **Cloudinary pendente.** A conta dedicada Avanz ainda não foi
> provisionada ([001 §11.N](/srv/apps/content-radar/docs/specs/001-foundation.md#11-decisões-abertas)).
> Quando `.local/cloudinary.env` existir, rode
> `radar-handoff --force <slug>` pra subir a foto e atualizar este
> package. Por enquanto, faça upload manual da foto em
> `./hero.<ext>` direto no chat do Smart Design.
</SE>

## 5. Brief (cole isto no Smart Design)

```yaml
<copy do brief simplificado — schema em §7 desta spec; renderizado como YAML inline>
```

<corpo markdown do brief simplificado abaixo, mantendo headline / caption / CTA legíveis>

## 5b. Prompt OD-ready (cópia única pra colar no chat)

> Versão consolidada do brief, formatada como prompt pronto pra colar
> direto no chat do Smart Design. Equivalente ao §5 + §6 + §7 num bloco
> só. Use esta versão se preferir não navegar entre seções.

````
Crie um post de FEED Instagram (1:1) para a Avanz Imóveis.

PILAR: <pillar.numero> (<pillar.nome>) · ICP: <icp> (<icp_descricao_curta>)

—— HEADLINE (overlay da arte, ≤90 chars) ——
<headline>

—— CAPTION (cole no Instagram) ——
<caption_draft>

—— HASHTAGS ——
<hashtags joined com "#" prefix>

—— ARTE (1:1, <visual_mood>) ——
<visual_brief.composition_notes>

MUST-HAVE:
- <visual_brief.must_have[0]>
- <visual_brief.must_have[1]>
- ...

EVITAR:
- <visual_brief.avoid_visual[0]>
- <visual_brief.avoid_visual[1]>
- ...

GUARDRAILS Avanz:
- Sem promessa de valorização garantida
- Sem clickbait ("imperdível", "última chance", "compre antes que acabe")
- Tom: especialista acessível — direto, transparente, orientador, humano
- Logo Avanz canto inferior direito + telefone <manifest.target_company.brand_facts.phone_display>
- Cores: azul-marinho #0F172A + laranja #F97316
- Tipografia: Inter (números/headline) + Montserrat (apoio)
````

> **Sobre a hero:** o `ad-creative` é **copy-first** — tenta sem foto
> primeiro. Se ficar fraco, suba a `hero.<ext>` deste package como
> referência visual. Skills `poster-hero` / `social-x-post-card`
> geralmente usam a hero como elemento central.

## 6. Visual brief

```yaml
base_template: <visual_brief.base_template>
composition_notes: |
  <visual_brief.composition_notes>
must_have:
  - <visual_brief.must_have[0]>
  - <visual_brief.must_have[1]>
  - ...
<SE visual_brief.avoid_visual existe>
avoid_visual:
  - <...>
</SE>
```

## 7. Guardrails (lembre o agente OD)

- Sem promessa de valorização garantida.
- Sem "última oportunidade", "imperdível", "compre antes que acabe".
- Logo Avanz canto inferior direito.
- Telefone <manifest.target_company.brand_facts.phone_display>
  (interpolado no momento da geração do package; hoje `(31) 9 9077-4580`).
- Cores oficiais: azul marinho `#0F172A` + laranja `#F97316`.
- Tipografia: Inter (primária) / Montserrat (secundária).
- Brand book completo: [/srv/my-mind/Empresas/avanz-imoveis/identity/brand.md](file:///srv/my-mind/Empresas/avanz-imoveis/identity/brand.md).

---

_Gerado por `radar-handoff` em `<handoff_at>`._
_Anti-repetição já checada (matcher + briefer, [spec 003 §8](/srv/apps/content-radar/docs/specs/003-matcher.md) + [spec 004 §10](/srv/apps/content-radar/docs/specs/004-briefer.md#10-anti-repetição-definitiva-headline-based))._
````

### 6.1 Notas sobre o template

- **Não inclui ledger refs nem campos internos** do pipeline (decisão
  §7 — humano não precisa ver `match_score_breakdown` no chat do
  Smart Design).
- **Links de filesystem** (`file:///srv/...`) funcionam apenas quando o
  README é aberto em um cliente que entende `file://` (VS Code, Cursor,
  alguns viewers). Não são essenciais — só conveniência.
- **Headline aparece como blockquote** no topo (linha 3) pra puxar a
  vista do humano. É o primeiro contexto.
- **Bloco YAML do §5** existe pra o humano poder colar tudo no chat do
  Smart Design de uma vez. O agente OD vai parsear naturalmente
  (Claude/Codex entendem YAML inline).

---

## 7. Template do `brief.md` simplificado

O `brief.md` do package é **uma cópia simplificada** do brief canônico
em `store/briefs/pendente-publicacao/<slug>.md`. Mantém o que o humano
+ agente OD precisam pra fazer o post; **remove campos internos** do
pipeline.

### 7.1 Campos mantidos

| Campo | Por quê |
|---|---|
| `brief_id`, `slug` | Identificação. |
| `created_at` | Contexto temporal (não inclui `updated_at` — irrelevante pro OD). |
| `pillar`, `icp` | Determinam tom e visual (agente OD usa pra calibrar). |
| `headline` | É a frase-síntese do post. |
| `hook` | Primeira frase da caption. |
| `caption_draft` | Caption completa. |
| `hashtags` | Para a publicação no IG. |
| `cta` | Fechamento. |
| `format` (`post_feed_instagram`) | Confirma escopo. |
| `od_skill_ref` | Skill recomendada (também em `od-skill-ref.txt`, redundância proposital). |
| `template_ref_avanz` | Apontador pro JSON prompt da Avanz (contexto histórico, não-obrigatório pro agente OD). |
| `visual_brief` (`base_template`, `composition_notes`, `must_have`, `avoid_visual`) | Instrução visual pra agente OD. |
| `source_urls` | Auditável (humano pode conferir a fonte). |
| `why_match` | Resumo do "por que esse post existe" — útil pro agente OD entender o ângulo editorial. |

### 7.2 Campos removidos

| Campo | Por quê removido |
|---|---|
| `topic_hash` | Hash interno do anti-repetição. Agente OD não usa. |
| `match_score` e `match_score_breakdown` | Detalhe técnico do matcher (spec 003 §5). Humano não precisa ver no chat do OD. |
| `source_relevance_hints[]` | Idem — instrumentação interna. |
| `source_excerpts[]` | Trechos literais auditáveis no brief canônico (anti-fake), mas seriam ruído no chat. |
| `hero_image_candidates[]` | Só **1** foto importa no handoff (`hero_choice`); essa já está em §4 do README + arquivo local. Mostrar os 2 outros candidatos (não-escolhidos) confunde. |
| `hero_choice` | Já é decidido — package só carrega a foto escolhida. |
| `ledger_ref` | Caminho interno do radar; agente OD não usa. |
| `review_notes` | Comunicação humano-radar; OD não. |
| `handoff_at`, `package_path` | Recursão (campos preenchidos pela própria handoff). |
| `published_at`, `ig_post_url` | Ainda null. |
| `suggested_slot` | Decisão de calendário (planner — spec 011); não-essencial pro OD. |

### 7.3 Estrutura final do `brief.md` no package

```markdown
---
brief_id: <id>
slug: <slug>
created_at: <iso>
pillar: <id-do-pilar>
icp: <icp | null>
format: post_feed_instagram
od_skill_ref: <od_skill_ref>
template_ref_avanz: <post-imovel | post-mes>

headline: <headline>
hook: <hook>
hashtags: [<...>]
cta: <cta>

source_urls:
  - <url-primária>
  - <url-secundária>
  ...

visual_brief:
  base_template: <post-imovel | post-mes>
  composition_notes: |
    <texto>
  must_have:
    - <...>
  avoid_visual:    # opcional
    - <...>

why_match: |
  <texto curto — 1 parágrafo>
---

# <headline>

<hook>

<caption_draft completa — render em parágrafos legíveis>

<hashtags renderizados como linha final com `#`>

<cta como bloco final em itálico>
```

Esse `.md` é **autônomo** — o humano pode colar tudo (frontmatter +
corpo) no chat do Smart Design e o agente OD entende.

---

## 8. Cloudinary — implementação concreta

### 8.1 Decisão: **signed upload**

Cloudinary oferece duas formas de upload via HTTP:

- **Signed upload**: cliente assina cada requisição com SHA-1 dos
  parâmetros + `api_secret`. Robusto; não exige configuração prévia no
  dashboard.
- **Unsigned upload**: cliente passa `upload_preset` (criado no
  dashboard) sem assinatura. Mais simples mas menos seguro (qualquer um
  com o preset name pode subir).

**Esta spec recomenda signed upload.** Justificativa:

1. **Não exige config dashboard**: owner pode provisionar a conta e
   liberar uso imediato sem criar `upload_preset` separado. Reduz
   fricção de setup.
2. **API_SECRET nunca trafega pela rede**: a assinatura SHA-1 é
   calculada local e enviada apenas como hash. Mais difícil de abusar
   em caso de log leak.
3. **Bash + `sha1sum` + `curl` cobre 100%**: sem dependência de SDK
   Node/Python. Skill roda em pure bash dentro da session do Claude
   Code, sem extras.
4. **Determinístico**: `public_id` controlado pelo cliente (não pelo
   preset) → naming previsível (`content-radar/avanz/<slug>`).

**Pendência potencial** (§18): confirmar com owner se prefere unsigned
+ preset por motivos operacionais (revogar acesso fácil via dashboard).
Por default, signed.

### 8.2 Naming do `public_id`

```
public_id = "$CLOUDINARY_FOLDER/$slug"
```

Onde `CLOUDINARY_FOLDER` (default `content-radar/avanz` — do
`manifest.cloudinary.folder` ou override via env).

Exemplos reais:

```
content-radar/avanz/2026-W22-005_lote-em-rmbh-valorizou-8-4-no-q1-2026
content-radar/avanz/2026-W22-006_lote-em-mateus-leme-com-15-min-a-menos-pra-bh
```

**Slashes em `public_id` são literais** — viram diretórios virtuais no
Cloudinary (folder structure). Cloudinary aceita; **não precisa
URL-encode** no signed upload (gotcha §16 item 2).

### 8.3 Algoritmo signed upload (bash)

Snippet completo (a skill copia/cola isto):

```bash
# Inputs:
#   $hero_local_path       # ex.: store/media/pendente-publicacao/<slug>__0.jpg
#   $slug                  # ex.: 2026-W22-005_lote-em-rmbh-...
#   $CLOUDINARY_CLOUD_NAME, $CLOUDINARY_API_KEY, $CLOUDINARY_API_SECRET, $CLOUDINARY_FOLDER
#
# Outputs:
#   $cloud_url, $public_id, $upload_http_code

set -euo pipefail

timestamp=$(date +%s)
public_id="${CLOUDINARY_FOLDER}/${slug}"

# Parâmetros assinados — ordem alfabética obrigatória
# (Cloudinary docs: "alphabetical order of all parameters affecting the upload")
to_sign="public_id=${public_id}&timestamp=${timestamp}"

# SHA-1 de (to_sign + api_secret)
signature=$(printf '%s%s' "$to_sign" "$CLOUDINARY_API_SECRET" | sha1sum | awk '{print $1}')

# Upload com captura do HTTP code
response_file=$(mktemp)
upload_http_code=$(curl -sS -w '%{http_code}' -o "$response_file" \
  -X POST "https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload" \
  -F "file=@${hero_local_path}" \
  -F "api_key=${CLOUDINARY_API_KEY}" \
  -F "timestamp=${timestamp}" \
  -F "public_id=${public_id}" \
  -F "signature=${signature}")

if [[ "$upload_http_code" == "200" ]]; then
  cloud_url=$(jq -r .secure_url "$response_file")
  public_id_resp=$(jq -r .public_id "$response_file")
  rm "$response_file"
  echo "✅ uploaded: $cloud_url"
else
  err_msg=$(jq -r '.error.message // "unknown"' "$response_file" 2>/dev/null || echo "non-json")
  rm "$response_file"
  echo "❌ Cloudinary upload failed: HTTP $upload_http_code — $err_msg"
  return 1
fi
```

**Notas:**

- `to_sign` segue ordem alfabética dos params **assináveis**
  (`public_id` antes de `timestamp`). Se adicionarmos `tags`, `folder`,
  etc, manter alfabético.
- `file`, `api_key`, `signature` não entram no `to_sign` (são
  separados pelo Cloudinary).
- `--write-out '%{http_code}'` captura status; resposta JSON vai pro
  `$response_file` temporário (evita misturar status com body).
- `jq` parseia `secure_url` (URL HTTPS) e `public_id`. `secure_url` é
  o que vai pro brief (não `url` HTTP).

### 8.4 Tratamento de erros HTTP

| HTTP | Significado típico | Ação |
|---|---|---|
| 200 | Sucesso | Segue. |
| 400 | Bad request (params errados, ex.: signature inválida) | Log + skip brief; segue pro próximo. Logar `error.message` do response (sem expor `api_secret`). |
| 401 / 403 | Credenciais inválidas | **Abort batch** (todas as outras chamadas vão falhar igual). Mensagem clara: "verifique `.local/cloudinary.env`". Nenhum brief teve `cloud_url` atualizado nesta run. |
| 4xx (outros) | Limites de conta (ex.: tamanho de arquivo, formato) | Log + skip brief. |
| 5xx | Erro do Cloudinary | **Retry 1x** (esperar 2 s, re-tentar). Se 2ª falhar, log + skip brief. |
| timeout (sem resposta em 30 s) | Rede ou Cloudinary lento | Retry 1x; depois skip. |

Retry só pra 5xx/timeout — outros erros são determinísticos e retry não
ajuda. Sem backoff exponencial no 1º slice (volume é baixo).

### 8.5 Sem deletes / overwrites em massa

A skill **nunca deleta** arquivos no Cloudinary. Re-upload do mesmo
`public_id` **sobrescreve** (default da API Cloudinary — `overwrite=true`
implícito). Comportamento desejado pra `--force`: re-upload da mesma
hero atualiza a URL canônica (mesma `public_id`, nova `version` no
URL).

Limpeza programática de arquivos antigos (ex.: briefs rejeitados que
nunca foram publicados) **não é** escopo desta spec — pode entrar na
spec 009 (housekeeping) ou ser feita via dashboard.

---

## 9. Idempotência

Princípio: **rodar `radar-handoff` 2 vezes seguidas (sem `--force`) deve
ser um no-op total** (exceto pelas leituras).

### 9.1 Sem `--force`

| Estado do brief | Ação |
|---|---|
| `handoff_at != null` | Pula brief. Ledger `handoff-skipped` com `reason: "already_handed_off"`. |
| `handoff_at == null` mas candidato escolhido já tem `cloudinary_public_id != null` (cenário raro — só se outra ferramenta subiu antes) | **Pula upload** (reusa URL existente). **Re-renderiza package** (README/brief.md podem ter mudado de template). Atualiza `handoff_at` e `package_path`. Ledger `handoff-finished` com `extra.upload_skipped: true`. |
| `handoff_at == null` e sem `cloudinary_public_id` | Caminho feliz: upload + package + atualiza brief. |

### 9.2 Com `--force`

- **Re-faz upload Cloudinary** mesmo se já tem `public_id` (sobrescreve
  via mesmo `public_id` — §8.5).
- **Re-gera package** (sobrescreve README, brief.md, hero.<ext>,
  hero.cloud-url.txt, od-skill-ref.txt).
- **Atualiza** `handoff_at` (novo timestamp), `package_path` (mesmo
  path), `cloud_url`, `cloudinary_public_id`.
- Ledger registra `cloudinary-uploaded` (mesmo `public_id`, possivelmente
  `secure_url` com nova `version`) e `handoff-finished`.

### 9.3 Cenário de uso de `--force`

- Humano editou `od_skill_ref` no `.md` (trocou de `ad-creative` pra
  `poster-hero` depois de aprovar). Quer re-gerar o package com a nova
  skill: `radar-handoff --force <slug>`.
- Template do `README.md` (§6) mudou (atualização da spec 007 / nova
  versão da skill). Quer atualizar todos os packages:
  `radar-handoff --force` (batch).
- Cloudinary chegou depois de runs em `--placeholder-mode`. Quer
  substituir `<PENDING_CLOUDINARY>` por URL real:
  `radar-handoff --force` (sem placeholder-mode, agora com credenciais).

### 9.4 `--dry-run` é sempre idempotente

Sem side effects. Pode rodar N vezes em sequência sem efeito.

---

## 10. Erros e fallbacks

Resumo tabelado:

| Caso | Ação |
|---|---|
| `.local/cloudinary.env` ausente e **sem** `--placeholder-mode` | Erro fatal **antes de iniciar o batch**. Mensagem instrui a criar o arquivo OU usar `--placeholder-mode`. Nada é alterado. Sem ledger event (pré-condição global). |
| Cloudinary 401/403 | Abort batch. Ledger `cloudinary-upload-failed` com `extra: {http_code: 401, brief_id: <id>, error: "invalid_credentials"}` pro brief que falhou primeiro. Mensagem instrui a verificar `.local/cloudinary.env`. |
| Cloudinary 5xx ou timeout | Retry 1x; depois log + skip brief. Outros briefs no batch seguem. |
| Cloudinary 4xx (não-auth) | Log + skip brief (`cloudinary-upload-failed`); outros seguem. |
| `od_skill_ref` aponta pra skill que não existe em `/srv/apps/open-design/skills/` | Skip brief com `handoff-skipped` + `reason: "od_skill_not_found"`. |
| Mídia escolhida sumiu de `media/pendente-publicacao/<slug>__N.<ext>` | Skip brief com erro defensivo (pré-condição §2 item 8). Outros seguem. |
| Brief com `handoff_at != null` em batch sem `--force` | Skip silencioso (`handoff-skipped` + `reason: "already_handed_off"`); outros seguem. Não é erro. |
| `Edit` no frontmatter falha (arquivo bloqueado, permissão) | Skip brief com erro; **Cloudinary upload já aconteceu** (cloud_url gravado no log mas não no brief — gotcha §16 item 5). Re-rodar com `--force` corrige. |
| `mkdir` de `store/packages/<slug>/` falha | Skip brief com erro. Cloudinary upload preservado se já ocorreu. |
| `<slug>` passado não encontrado em `pendente-publicacao/` | Erro fatal pra esse brief (apenas). Em batch sem slug, nunca acontece. |

### 10.1 Comportamento "best effort" do batch

Em batch (sem `<slug>`), **uma falha em um brief não aborta os outros**
— exceto 401/403 do Cloudinary (que indica problema sistêmico de
credenciais, aborta logo).

Resumo final (§5.9) reporta `failed`/`skipped` agregados.

---

## 11. Ledger — eventos novos

Esta spec adiciona 4 eventos ao **canônico** definido em
[`005 §18`](./005-skill-scan.md#18-ledger--formato-canônico).

### 11.1 Tabela de eventos

| `extra.event` | Origem | `from_dir` | `to_dir` | `brief_id` | Quando |
|---|---|---|---|---|---|
| `cloudinary-uploaded` | `skill:radar-handoff` | null | null | setado | Cada upload bem-sucedido (1 por brief com hero). |
| `cloudinary-upload-failed` | `skill:radar-handoff` | null | null | setado | Falha de upload (HTTP 4xx/5xx após retries). |
| `handoff-finished` | `skill:radar-handoff` | null | null | setado | Brief totalmente processado (upload OK ou skip; package criado; frontmatter atualizado). |
| `handoff-skipped` | `skill:radar-handoff` | null | null | setado | Pula brief antes de processar (já entregue, od_skill_ref inválido, etc). |

**Notas:**

- `from_dir`/`to_dir` são `null` porque `radar-handoff` **não move o
  brief** entre diretórios — `pendente-publicacao/` é a casa do brief
  até `radar-mark-published` (spec 008).
- `brief_id` é sempre setado (a skill sempre opera sobre um brief
  específico, mesmo nos skips).

### 11.2 Schema de `extra` por evento

**`cloudinary-uploaded`**:

```json
{
  "event": "cloudinary-uploaded",
  "public_id": "content-radar/avanz/2026-W22-005_lote-em-rmbh-...",
  "secure_url": "https://res.cloudinary.com/<cloud_name>/image/upload/v1700000000/content-radar/avanz/2026-W22-005_....png",
  "hero_choice": 0,
  "bytes": 48721,
  "format": "png",
  "version": 1700000000
}
```

**`cloudinary-upload-failed`**:

```json
{
  "event": "cloudinary-upload-failed",
  "http_code": 5xx_or_4xx,
  "error": "Cloudinary error message text (sanitized — sem api_secret)",
  "hero_choice": 0,
  "attempts": 1_or_2
}
```

**`handoff-finished`**:

```json
{
  "event": "handoff-finished",
  "package_path": "./store/packages/2026-W22-005_.../README.md",
  "od_skill_ref": "ad-creative",
  "hero_uploaded": true,
  "placeholder_mode": false,
  "forced": false
}
```

**`handoff-skipped`**:

```json
{
  "event": "handoff-skipped",
  "reason": "already_handed_off" | "no_credentials_no_placeholder" | "invalid_od_skill_ref" | "od_skill_not_found" | "hero_media_missing"
}
```

### 11.3 Exemplos (uma run completa)

```jsonl
{"ts":"2026-05-27T16:05:10-03:00","brief_id":"2026-W22-005","from_dir":null,"to_dir":null,"actor":"skill:radar-handoff","extra":{"event":"cloudinary-uploaded","public_id":"content-radar/avanz/2026-W22-005_lote-em-rmbh-valorizou-8-4-no-q1-2026","secure_url":"https://res.cloudinary.com/avanz-radar/image/upload/v1700000000/content-radar/avanz/2026-W22-005_....png","hero_choice":0,"bytes":48721,"format":"png","version":1700000000}}
{"ts":"2026-05-27T16:05:12-03:00","brief_id":"2026-W22-005","from_dir":null,"to_dir":null,"actor":"skill:radar-handoff","extra":{"event":"handoff-finished","package_path":"./store/packages/2026-W22-005_lote-em-rmbh-.../README.md","od_skill_ref":"ad-creative","hero_uploaded":true,"placeholder_mode":false,"forced":false}}
{"ts":"2026-05-27T16:05:13-03:00","brief_id":"2026-W22-007","from_dir":null,"to_dir":null,"actor":"skill:radar-handoff","extra":{"event":"handoff-skipped","reason":"already_handed_off"}}
```

---

## 12. Critério §10 da spec 001 — contribuição desta spec

Conforme [`001 §10`](./001-foundation.md#10-primeiro-slice-vertical-escopo-do-primeiro-passo)
itens 5 e 6, esta spec fecha:

| Item do critério da 001 §10 | Esta spec cobre? | Como |
|---|---|---|
| 5. `radar-handoff` produz package em `store/packages/<slug>/` com URL Cloudinary | ✅ | §5.6 (geração do package) + §8 (upload Cloudinary). |
| 6. Owner consegue, em <5 min, abrir o package no Smart Design e gerar o post | ✅ | §6 (README com passo-a-passo) + §7 (brief simplificado pronto pra colar). |

### 12.1 O que NÃO entra na spec 007

- **Não publica no IG**: humano publica manualmente após gerar artifact
  no Smart Design (decisão arquitetural da [`001 §11.M`](./001-foundation.md#11-decisões-abertas)
  — opção 1).
- **Não fecha o ciclo**: `radar-mark-published` (spec 008) move o brief
  pra `publicado/` e grava `ig_post_url`.
- **Não faz purge de mídia local**: `cloudinary.purge_local_after_days`
  do manifest é responsabilidade da spec 009 (housekeeping).
- **Não chama API do Open Design**: spec 011/012 (opção 3 — futuras).

---

## 13. `SKILL.md` literal — `.claude/skills/radar-handoff/SKILL.md`

> Conteúdo proposto. Esta spec **NÃO cria o arquivo** — só descreve o
> que ele deve conter (mesma convenção da [`005 §12`](./005-skill-scan.md#12-skillmd-literal--claudeskillsradar-scanskillmd)).

````markdown
---
name: radar-handoff
description: |
  Sobe a hero do brief escolhida pelo humano pra Cloudinary (signed upload) e gera um package em
  store/packages/<slug>/ com README + brief.md simplificado + foto + URL Cloudinary + skill OD recomendada.
  Pacote é a entrega final do 1º slice — humano leva pro Smart Design (Open Design @ design.consultorivandias.com.br)
  e gera o post manualmente. Não publica no IG, não chama API do Open Design.
argument-hint: |
  [<slug>] [--force] [--dry-run] [--placeholder-mode]
---

# radar-handoff

> Última peça do 1º slice. Lê briefs em `store/briefs/pendente-publicacao/` com `handoff_at: null`
> (ou todos, com `--force`), sobe a foto escolhida (`hero_choice == N`) pra Cloudinary, e gera
> `store/packages/<slug>/` com tudo que o humano precisa pra abrir o Smart Design e produzir o post.
> Atualiza `handoff_at`, `package_path`, `hero_image_candidates[N].cloud_url` e
> `cloudinary_public_id` no frontmatter do brief.

## Princípios duros

1. **NÃO publica.** Esta skill **nunca** chama API do Instagram nem da Open Design. Só Cloudinary +
   FS local + ledger. Publicação no IG é humana (CLAUDE.md raiz: "Não publicar").
2. **NÃO move o brief.** `pendente-publicacao/` continua sendo o lar do brief até a `radar-mark-published`
   (spec 008). Esta skill atualiza o **frontmatter** mas mantém o arquivo no mesmo lugar.
3. **`--dry-run` é sagrado.** Em dry-run, **não chame** Cloudinary. **Não escreva** package. **Não toque**
   no brief. **Não escreva** no ledger. Só relate.
4. **`hero_choice == null` é caminho válido.** Pula upload Cloudinary, gera package sem `hero.<ext>` e
   sem `hero.cloud-url.txt`. README do package instrui o humano. Não erro. (Spec 001 §11.C — uso explícito.)
5. **Idempotente sem `--force`.** Brief com `handoff_at != null` é pulado silenciosamente (ledger
   `handoff-skipped` com `reason: "already_handed_off"`).
6. **Modo placeholder transitório.** Enquanto `.local/cloudinary.env` não existir, use
   `--placeholder-mode` pra gerar packages com `cloud_url: "<PENDING_CLOUDINARY>"`. Quando a conta
   chegar, rode `--force` pra atualizar tudo (spec 007 §14).
7. **Signed upload Cloudinary.** SHA-1 de `public_id=...&timestamp=...$api_secret`. Sem dependência de
   SDK externo. Snippet completo em spec 007 §8.3.

## Antes de começar

Carregue (via Read):

1. `/srv/apps/content-radar/manifest.yaml` (para `cloudinary.*`, `open_design.project_avanz`,
   `open_design.candidate_skills`, `storage.briefs_dirs`, `storage.packages_root`).
2. Liste `store/briefs/pendente-publicacao/` (frontmatters) pra filtrar elegíveis (`handoff_at == null`
   ou `--force`).
3. Em Bash:
   ```bash
   set -a; source .local/cloudinary.env 2>/dev/null || true; set +a
   : "${CLOUDINARY_FOLDER:=content-radar/avanz}"
   ```
   Se sem credenciais e sem `--placeholder-mode` → erro fatal com instrução clara.

## Args

- `<slug>` (opc.): processar apenas esse brief; sem arg = batch sobre todos elegíveis.
- `--force` (opc.): re-roda upload + package mesmo se já entregue.
- `--dry-run` (opc.): plano apenas; sem side effects.
- `--placeholder-mode` (opc.): sem credenciais Cloudinary; gera package com `cloud_url: "<PENDING_CLOUDINARY>"`.

## Fluxo

Segue spec 007 §5 (sub-seções §5.1 a §5.9). Pra cada brief elegível (serial):

1. Parse + validação (§5.2 + pré-condições §2).
2. Resolver foto (§5.3).
3. Upload Cloudinary com signed SHA-1 (§5.4 + §8.3); pular se `--placeholder-mode` ou hero null.
4. Validar `od_skill_ref` existe em `/srv/apps/open-design/skills/<od_skill_ref>/SKILL.md`.
5. Gerar `store/packages/<slug>/`:
   - `README.md` (template §6).
   - `brief.md` simplificado (template §7).
   - `hero.<ext>` (cp da mídia local — se hero_choice != null).
   - `hero.cloud-url.txt` (1 linha; se hero_choice != null).
   - `od-skill-ref.txt` (1 linha; sempre).
6. Edit no frontmatter do brief: `handoff_at`, `package_path`, `cloud_url`, `cloudinary_public_id`.
7. Append ledger eventos (§11).
8. Resumo final pro humano (§5.9).

## Snippet Cloudinary (signed upload)

```bash
set -euo pipefail

timestamp=$(date +%s)
public_id="${CLOUDINARY_FOLDER}/${slug}"
to_sign="public_id=${public_id}&timestamp=${timestamp}"
signature=$(printf '%s%s' "$to_sign" "$CLOUDINARY_API_SECRET" | sha1sum | awk '{print $1}')

response_file=$(mktemp)
upload_http_code=$(curl -sS -w '%{http_code}' -o "$response_file" \
  -X POST "https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload" \
  -F "file=@${hero_local_path}" \
  -F "api_key=${CLOUDINARY_API_KEY}" \
  -F "timestamp=${timestamp}" \
  -F "public_id=${public_id}" \
  -F "signature=${signature}")

if [[ "$upload_http_code" == "200" ]]; then
  cloud_url=$(jq -r .secure_url "$response_file")
  rm "$response_file"
else
  err=$(jq -r '.error.message // "unknown"' "$response_file" 2>/dev/null || echo "non-json")
  rm "$response_file"
  echo "❌ HTTP $upload_http_code — $err"
  return 1
fi
```

Tratamento de erros: 401/403 → abort batch. 5xx/timeout → retry 1x. Outros 4xx → skip brief.

## Ledger

Append `store/ledger.jsonl` (canônico spec 005 §18). Eventos: `cloudinary-uploaded`,
`cloudinary-upload-failed`, `handoff-finished`, `handoff-skipped`. Schemas em spec 007 §11.2.

## Saída

Template literal em spec 007 §5.9. Caminho feliz, dry-run e placeholder-mode têm formatos distintos.

## NÃO faça

- ❌ Publicar no Instagram.
- ❌ Chamar API do Open Design (`POST /api/chat`, etc) — opção 3 é spec 012.
- ❌ Mover brief entre diretórios (`radar-mark-published` faz isso — spec 008).
- ❌ Apagar mídia local — purge é spec 009.
- ❌ Re-criar arquivos do package sem `--force` se `handoff_at != null` (apenas reusa).
- ❌ Imprimir `CLOUDINARY_API_SECRET` em log, erro ou ledger.
- ❌ Inventar args novos sem atualizar a spec 007 primeiro.
````

---

## 14. Modo placeholder transitório

> Esta seção descreve um **modo de operação válido durante a fase de
> transição** entre escrita da spec 007 e provisionamento da conta
> Cloudinary ([`001 §11.N`](./001-foundation.md#11-decisões-abertas)).
> Pode sair quando o owner provisionar Cloudinary; até lá, é prático.

### 14.1 Quando usar

- `.local/cloudinary.env` não existe (owner ainda não provisionou).
- Testar o resto do slice (geração de package, README, integração com
  Smart Design) sem depender de Cloudinary.
- Validar que `od_skill_ref` está correto, que o template do README faz
  sentido, que o humano consegue operar o Smart Design — tudo sem
  upload real.

### 14.2 Fluxo simplificado

```
radar-handoff --placeholder-mode [<slug>]
```

1. Pula §5.4 (upload Cloudinary).
2. Preenche `cloud_url: "<PENDING_CLOUDINARY>"` e
   `cloudinary_public_id: "<PENDING_CLOUDINARY>"` em
   `hero_image_candidates[hero_choice]` do brief.
3. Gera package normal (§5.6) com README incluindo o **bloco de alerta**
   da §6 (`> ⚠️  Cloudinary pendente. ...`).
4. `hero.cloud-url.txt` contém literalmente `<PENDING_CLOUDINARY>`.
5. Atualiza `handoff_at` e `package_path` normalmente.
6. Ledger registra `handoff-finished` com `extra.placeholder_mode: true`.

### 14.3 Recovery — quando Cloudinary chegar

Owner cria `.local/cloudinary.env` com credenciais reais. Para
atualizar packages já gerados em placeholder mode:

```
radar-handoff --force
```

(sem `--placeholder-mode`, agora com credenciais).

Pra cada brief com `cloud_url == "<PENDING_CLOUDINARY>"`:

- `--force` faz upload real.
- Frontmatter recebe `cloud_url` verdadeiro.
- Package é regenerado (README sem o bloco de alerta; `hero.cloud-url.txt`
  com URL real).
- Ledger registra **novo** `cloudinary-uploaded` + **novo**
  `handoff-finished` (com `placeholder_mode: false`).

### 14.4 No README do package (modo placeholder)

O bloco condicional `<SE cloud_url == "<PENDING_CLOUDINARY>">` (§6) é
renderizado:

```markdown
> ⚠️  **Cloudinary pendente.** A conta dedicada Avanz ainda não foi
> provisionada (001 §11.N). Quando `.local/cloudinary.env` existir,
> rode `radar-handoff --force <slug>` pra subir a foto e atualizar
> este package. Por enquanto, faça upload manual da foto em
> `./hero.<ext>` direto no chat do Smart Design.
```

Humano consegue operar mesmo assim — só sobe a foto manualmente no
chat do Smart Design em vez de baixar de URL.

### 14.5 Vale documentar como transitório

Sim. O modo **pode ser removido** quando Cloudinary chegar (não há
custo de mantê-lo, mas a complexidade extra do código `if
placeholder_mode` desaparece). Até lá: documentado e testado.

---

## 15. Purge de mídia local — fora desta spec

[`manifest.yaml#cloudinary.purge_local_after_days`](../../manifest.yaml)
= `30`. **Esta spec NÃO faz purge.** Justificativa:

- 007 só faz upload + package. Mantém escopo enxuto.
- Purge é responsabilidade da **spec 009 (housekeeping)** — cron simples
  que limpa `store/media/publicado/` 30 dias após `published_at`
  (referenciado em [`001 §3.3`](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado)
  e [`001 §9`](./001-foundation.md#9-componentes-a-construir--ordem) item 9).
- Cópia local da hero permanece em `media/pendente-publicacao/<slug>__N.<ext>`
  enquanto o brief estiver em `pendente-publicacao/`. Quando
  `radar-mark-published` (spec 008) move o brief pra `publicado/`, a
  mídia também migra pra `media/publicado/`; aí entra na janela de
  purge da spec 009.
- Cópia da hero em `store/packages/<slug>/hero.<ext>` (cópia secundária
  feita por esta skill) também não é purgada por esta spec — segue o
  destino do package. Como `store/packages/` é gitignored, owner pode
  apagar manualmente a qualquer momento sem afetar nada.

---

## 16. Gotchas

| # | Caso | Mitigação |
|---|---|---|
| 1 | **`--placeholder-mode` produz package usável mas sem URL Cloudinary.** Humano que tenta "baixar de cloud_url" vai bater em `<PENDING_CLOUDINARY>`. | README do package (§6) tem bloco de alerta condicional explicando — humano deve fazer upload manual da foto (`./hero.<ext>`) direto no chat do Smart Design. Quando Cloudinary chegar: `radar-handoff --force` corrige tudo de uma vez. |
| 2 | **Cloudinary `public_id` contém `/` (vira pasta virtual).** Tentação de URL-encode (`%2F`). | **Não URL-encode.** Cloudinary aceita slashes literais no signed upload (form-data). A signature SHA-1 também usa o `public_id` com slashes (não-encoded). Encoding **quebra** a assinatura. |
| 3 | **Mídia já filtrada pelo `radar-mv approve`.** Só **uma** foto em `media/pendente-publicacao/<slug>__*.*` (a do `hero_choice`); os outros candidatos foram apagados (spec 005 §15.1 item 6). | Skill não procura múltiplas mídias. Só checa que `media/pendente-publicacao/<slug>__<hero_choice>.{jpg,png,webp,gif}` existe. Falha defensiva se sumiu (§2 item 8). |
| 4 | **Brief simplificado (§7) elimina campos internos do pipeline.** Humano editor pode estranhar não ver `match_score_breakdown` no chat do OD. | Decisão de design — o brief canônico em `store/briefs/pendente-publicacao/<slug>.md` mantém **todos** os campos (auditoria preservada). O `brief.md` do package é só pra colar no chat — agente OD não precisa ver instrumentação do radar. |
| 5 | **Falha após upload Cloudinary mas antes de Edit no frontmatter.** Cenário: upload OK (`cloud_url` válido no Cloudinary), Edit falha (arquivo bloqueado / disco cheio). Ledger registra `cloudinary-uploaded` mas brief não tem `cloud_url`. | Re-rodar `radar-handoff --force <slug>` resolve: novo upload sobrescreve mesmo `public_id` (no-op no Cloudinary side, custo desprezível), Edit acontece de novo. Sem `--force`, idempotência §9.1 reusaria — mas `cloud_url` no brief continua `null`. Mitigação simples: `--force`. |
| 6 | **Spec 010 vai introduzir skill custom `avanz-instagram-post` no OD.** Quando estiver pronta, package vai sugerir essa skill em vez de `ad-creative`/`poster-hero`. Hoje, matriz da [`004 §5`](./004-briefer.md#5-matriz-pilar--skill-do-open-design) vale. | Esta spec usa enum hard-coded de `od_skill_ref` ([`004 §4.2`](./004-briefer.md#42-schema-do-brief-formaliza-esboço-de-001-61)). Quando spec 010 entregar, atualizar enum (briefer + handoff) — o `od_skill_ref` no brief vai mudar e radar-handoff vai apenas validar que a skill existe em `/srv/apps/open-design/skills/` (já faz). Sem mudança estrutural. |
| 7 | **Open Design Basic Auth (nginx).** Owner usa credencial dele na web UI; radar-handoff **NÃO** autentica programaticamente no OD (1º slice = opção 1 da [`001 §8.3`](./001-foundation.md#83-três-opções-de-integração)). | `.local/open-design-basic-auth.txt` (manifest `open_design.auth.credentials_env`) **não** é usado por esta skill — fica reservado pra opção 3 (spec 012). README do package instrui humano a usar suas credenciais via browser. |
| 8 | **Re-rodar 007 depois de humano editar `od_skill_ref` no `.md` regenera package** com a nova skill. | Documentado em §9.3. Sem `--force`, idempotência §9.1 pula upload (já tem `public_id`) mas re-renderiza package (README muda). Comportamento desejado: editor pode trocar skill sem precisar `--force`. **Exceção**: se editor mudou `hero_choice` (raro depois do approve), `--force` é necessário pra novo upload. |
| 9 | **`--force` regenera tudo (upload + package).** Sem `--force`, idempotente: sem upload se já tem `public_id`, mas package é re-renderizado se README.md trocou de template. | Spec 007 §9.1 e §9.2 detalham. `--force` é "atomic re-do"; sem ele é "best effort reuse". |
| 10 | **`store/packages/` está gitignored.** Owner que olha `git status` pós-handoff não vê os packages — só vê os briefs atualizados. | Documentado em `.gitignore` linha 10. README do package em si é local-only (não vai pra repo). Justificativa: package duplica conteúdo já versionado (brief canônico) + mídia (Cloudinary é fonte da verdade). Versionar dois lugares é redundante. |
| 11 | **Cloudinary 5xx + retry → 2 uploads no mesmo `public_id`.** O 1º upload pode ter ido (servidor deu 5xx mas processou); o 2º (retry) sobrescreve. Não há duplicação no Cloudinary (mesmo `public_id`) — só custo de 2 chamadas. | Aceitar. Cloudinary cobra por requisição/storage, não por sobrescrita. Custo desprezível pro volume do 1º slice (~10 uploads/semana). |
| 12 | **Slug ambíguo em `radar-handoff <slug>`.** Mesmo padrão do `radar-mv` ([`005 §16.2`](./005-skill-scan.md#162-slug-ambíguo)). | Lista matches + aborta sem tocar em nada. |

---

## 17. Critérios de pronto da spec

1. **Arquivo `.claude/skills/radar-handoff/SKILL.md`** existe com o
   conteúdo proposto na §13 (literal, sem edição estrutural).
2. **`radar-handoff --placeholder-mode <slug>`** roda **sem credenciais
   Cloudinary** e produz:
   - `store/packages/<slug>/README.md` com bloco de alerta
     `<PENDING_CLOUDINARY>` (§14.4).
   - `store/packages/<slug>/brief.md` simplificado (§7).
   - `store/packages/<slug>/hero.<ext>` (se `hero_choice != null`).
   - `store/packages/<slug>/hero.cloud-url.txt` = `<PENDING_CLOUDINARY>`.
   - `store/packages/<slug>/od-skill-ref.txt`.
   - Frontmatter do brief atualizado: `handoff_at`, `package_path`,
     `hero_image_candidates[N].cloud_url = "<PENDING_CLOUDINARY>"`,
     `cloudinary_public_id = "<PENDING_CLOUDINARY>"`.
   - Ledger com `handoff-finished` + `extra.placeholder_mode: true`.
3. **Modo real** (com `.local/cloudinary.env` válido) faz upload
   Cloudinary (HTTP 200), grava `secure_url` real no frontmatter +
   `hero.cloud-url.txt`, gera package sem bloco de alerta. Ledger
   `cloudinary-uploaded` + `handoff-finished`.
4. **`radar-handoff --force <slug>`** re-roda upload mesmo se
   `handoff_at != null` e regenera package. Cloud_url é atualizado.
5. **Package contém**: README, brief.md, hero.<ext> (se hero), hero.cloud-url.txt,
   od-skill-ref.txt — todos com conteúdo conforme §6/§7/§5.6.
6. **Owner consegue, em <5 min**, abrir o package (`README.md`), copiar
   o brief (§5 do README), colar no Smart Design e gerar o post — sem
   precisar consultar specs internas do content-radar.
7. **`radar-handoff --dry-run`** não modifica nada (sem upload, sem
   package, sem ledger, sem alteração no brief).
8. **Idempotência** (sem `--force`): rodar `radar-handoff` 2 vezes em
   sequência sobre o mesmo brief = 1 sucesso + 1 `handoff-skipped`
   (`already_handed_off`).

Itens 1–7 são pré-requisitos pro merge da spec; item 8 é teste de
robustez.

---

## 18. Decisões a registrar na 001 §11

_Provavelmente nenhuma — todas resolvidas dentro da spec 007._

Possível pendência a confirmar com owner:

- **Signed vs unsigned upload Cloudinary** (§8.1). Esta spec recomenda
  **signed** (sem dependência de preset no dashboard, controle local do
  `public_id`, sem dependência de SDK externo). Owner pode preferir
  unsigned se quiser revogar acesso via dashboard sem rotacionar
  `api_secret`. Caso prefira unsigned: abrir como `§11.Q` na foundation
  001 (próxima letra livre — Q vem depois de P em [`001 §11`](./001-foundation.md#11-decisões-abertas)).

Se owner discordar de outras decisões (template do README, campos
removidos do brief simplificado, eventos novos do ledger): abrir como
pendência explícita na foundation 001 com letra adequada.

---

## 19. Glossário (termos novos introduzidos nesta spec)

- **`package`**: diretório `store/packages/<slug>/` produzido pela
  `radar-handoff`, contendo README + brief simplificado + hero (cópia
  local) + URL Cloudinary + nome da skill OD. É o **artefato de
  entrega** pro humano operar o Smart Design (opção 1 da [`001 §8.3`](./001-foundation.md#83-três-opções-de-integração)).
  Distinto do brief canônico em `store/briefs/pendente-publicacao/<slug>.md`
  (versionado, completo, com instrumentação interna).
- **`placeholder-mode`**: modo transitório de operação (§14) em que a
  skill gera package sem chamar Cloudinary, preenchendo `cloud_url`
  com `<PENDING_CLOUDINARY>`. Útil enquanto a conta Cloudinary
  (resposta [`001 §11.N`](./001-foundation.md#11-decisões-abertas))
  não foi provisionada. Recuperável depois com `--force`.
- **`signed upload`**: modalidade de upload Cloudinary que usa
  assinatura SHA-1 dos parâmetros + `api_secret`. Recomendada por esta
  spec (§8.1). Distinto do **unsigned upload** (usa `upload_preset` do
  dashboard, sem assinatura).
- **`public_id`** (Cloudinary): identificador único do asset no
  Cloudinary, controlado pelo cliente em signed upload. Esta spec
  fixa formato `<folder>/<slug>` (ex.: `content-radar/avanz/2026-W22-005_...`).
- **`secure_url`** (Cloudinary): URL HTTPS canônica do asset após
  upload, retornada pela API. Forma: `https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<public_id>.<ext>`.
  É o valor que vai pro `cloud_url` do brief.
- **`handoff_at`**: timestamp ISO 8601 no frontmatter do brief, gravado
  pela `radar-handoff`, marcando que o package foi gerado (independente
  do brief ter virado post no IG). Junto com `package_path`, sinaliza
  ao próximo run da skill que este brief não precisa de re-handoff (a
  menos que `--force`).
- **`<PENDING_CLOUDINARY>`**: literal string usada como valor sentinel
  para `cloud_url` e `cloudinary_public_id` em modo placeholder (§14).
  Não é URL válida — substituído pela URL real quando `--force` rodar
  depois com credenciais.
