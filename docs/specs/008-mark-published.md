<!--
  Spec 008 — radar-mark-published
  Fecha o ciclo do lifecycle (001 §4): pendente-publicacao/ → publicado/.
  Convenção: mesmo padrão de skill da 005 §3 + 007 §13; ledger canônico 005 §18.
  Status: proposta (documento-only). Implementação fica para sessão futura.
-->

# Spec 008 — `radar-mark-published`

> Define a skill que **fecha o ciclo** do `content-radar`. Consome briefs
> em `store/briefs/pendente-publicacao/` que **já foram entregues**
> (`handoff_at != null`, via [`radar-handoff`](./007-handoff.md)) e que o
> humano **já publicou manualmente no Instagram**. Registra a URL do post
> (`ig_post_url`) e o momento da publicação (`published_at`) no frontmatter,
> move o brief e a mídia da hero para o estado terminal `publicado/`, e
> grava o evento `published` no ledger.
>
> É a **última transição de estado** do lifecycle desenhado em
> [`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta) — o passo que a
> [`001 §10`](./001-foundation.md#10-primeiro-slice-vertical-escopo-do-primeiro-passo)
> deixou **explicitamente fora do 1º slice** ("primeiro slice usa `mv` cru").
> Esta spec o formaliza.
>
> Não duplica conceitos da foundation. Aterra em
> [`001 §3.3`](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado)
> (storage — diretórios `publicado/`),
> [`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta) (lifecycle),
> [`001 §5`](./001-foundation.md#5-anti-repetição) (anti-repetição — janela
> 90d em `publicado/`) e [`001 §6.1`](./001-foundation.md#61-brief-storebriefsdirslugmd)
> (schema do brief — campos `published_at`, `ig_post_url`).
>
> Reusa o padrão de skill estabelecido na
> [`005 §3`](./005-skill-scan.md#3-padrão-de-arquivo-claudeskillsslugskillmd)
> (diretório dedicado `.claude/skills/<slug>/SKILL.md`), o ledger canônico
> em [`005 §18`](./005-skill-scan.md#18-ledger--formato-canônico) (o evento
> `published` já estava **referenciado** em
> [`005 §18.4`](./005-skill-scan.md#184-eventos-futuros-referenciados-não-emitidos-pelo-1º-slice)),
> e a mecânica de transição física da skill-irmã
> [`radar-mv`](./005-skill-scan.md#parte-c--radar-mv) (`mv` do `.md` +
> remanejo de mídia + ledger).

---

## 1. Objetivo e posição no pipeline

`radar-mark-published` é a **peça que fecha o ciclo**. Roda no contexto do
**session principal** do Claude Code (mesmo padrão das skills da spec 005 —
ver [`005 §2`](./005-skill-scan.md#2-por-que-são-skills-não-subagentes) — e da
007), **não** é subagente.

Posição no diagrama da [`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta):

```
   briefs/pendente-publicacao/<slug>.md        ← entrada (handoff_at != null)
   media/pendente-publicacao/<slug>__N.<ext>
                  │
       humano abre o package no Smart Design (Open Design),
       gera o artifact e PUBLICA o post no Instagram (manual)
                  │
                  ▼
   ┌─────────────────────────────────────────┐
   │   skill: radar-mark-published           │   ← ESTA SPEC
   │   1. grava ig_post_url + published_at    │
   │   2. mv brief  → briefs/publicado/       │
   │   3. mv hero   → media/publicado/        │
   │   4. ledger: published                   │
   └─────────────────────────────────────────┘
                  │
                  ▼
   ┌───────────────────────────┐
   │ briefs/publicado/<slug>.md │──▶ anti-repetição (janela 90d, 001 §5)
   │ media/publicado/<slug>__N  │──▶ purge 30d após published_at (spec 009)
   └───────────────────────────┘
```

A [`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta) já tinha o
**esboço** desta transição (`radar-mark-published <slug> --ig-url=...`) —
esta spec **formaliza**: define args (§3), fluxo (§4), o evento `published`
do ledger (§5), idempotência (§6) e a relação com o purge da spec 009 (§8).

### 1.1 O que faz / o que NÃO faz

**Faz:**

- Lê um brief em `pendente-publicacao/` com `published_at: null` (re-roda /
  corrige com `--force`).
- Grava `ig_post_url` e `published_at` no frontmatter do brief.
- Move o `.md`: `briefs/pendente-publicacao/` → `briefs/publicado/`.
- Move a hero (única foto sobrevivente, `<slug>__N.<ext>`):
  `media/pendente-publicacao/` → `media/publicado/` e atualiza o
  `local_path` do candidato.
- Append no ledger: `published` (e `mark-published-skipped` nos skips).

**NÃO faz:**

- **Não publica no Instagram.** A publicação é **manual** e já aconteceu —
  esta skill só **registra** o fato (CLAUDE.md raiz: "Não publicar"). A
  `--ig-url` é fornecida pelo humano que publicou.
- **Não chama API do Open Design** (opção 3 — specs 011/012, conforme
  [`001 §8.3`](./001-foundation.md#83-três-opções-de-integração)).
- **Não toca no Cloudinary.** Sem upload, sem delete. A foto já está no
  Cloudinary desde o `radar-handoff` (spec 007 §8). A cópia local só muda
  de diretório.
- **Não modifica o package** em `store/packages/<slug>/` (gitignored;
  entrega já consumida pelo humano).
- **Não faz purge de mídia.** `media/publicado/` é purgado 30d após
  `published_at` pela **spec 009 (housekeeping)** — esta skill apenas
  **deixa o brief na janela** de purge (§8).
- **Não processa briefs em `pendente-aprovacao/`** (precisa ter passado por
  `radar-mv approve` + `radar-handoff`) **nem em `rejeitado/`** (terminal).

---

## 2. Pré-condições do brief

Para um brief ser **elegível** a `mark-published`, as condições abaixo são
checadas **antes de qualquer side effect**:

| # | Condição | Erro / ação se falhar |
|---|----------|----------------------|
| 1 | Brief existe em `store/briefs/pendente-publicacao/<slug>.md` (ou em `publicado/` quando `--force`) | `slug não encontrado em pendente-publicacao/` → erro fatal. Se o slug está em `pendente-aprovacao/`: erro pedindo `radar-mv approve` + `radar-handoff` antes. Se em `rejeitado/`: erro (`rejeitado/` é terminal). |
| 2 | Frontmatter parseia como YAML válido | `frontmatter inválido` → erro fatal. |
| 3 | `--ig-url` foi fornecida e é não-vazia | `--ig-url obrigatório` → erro fatal (é o dado que justifica a skill). |
| 4 | `published_at` é `null` (ou `--force` foi passado) | Ledger `mark-published-skipped` com `reason: "already_published"`; aborta sem tocar em nada. |
| 5 | `handoff_at != null` (brief já entregue via `radar-handoff`) | **Warning** (não erro): "brief nunca passou por radar-handoff — incomum, mas publicação é asserção humana". **Prossegue** (§2.1). |
| 6 | Se `hero_choice == N`: arquivo `media/pendente-publicacao/<slug>__N.<ext>` existe | **Warning** + prossegue sem mover mídia (§2.2). Não bloqueia: a foto pode já estar só no Cloudinary, ou ter sido removida. |

### 2.1 Por que `handoff_at == null` é só warning (e não erro)

A fonte da verdade desta skill é uma **asserção humana**: "eu publiquei este
post no Instagram, aqui está a URL". Bloquear a transição porque o brief não
tem `handoff_at` seria privilegiar a instrumentação interna sobre o fato do
mundo real. O caminho normal **tem** `handoff_at != null` (o humano usou o
package gerado pela 007 para produzir a arte), mas o humano pode ter
publicado por um caminho alternativo. Registramos o warning para auditoria e
seguimos. Contraste com o `radar-handoff`, onde `hero_choice` ausente **é**
erro (defesa em profundidade) porque ali nada externo aconteceu ainda.

### 2.2 `hero_choice == null` / mídia ausente

Quando o humano aprovou sem foto (`hero_choice: null`), **não há mídia em
`media/pendente-publicacao/<slug>__*`** — a transição move só o `.md`. Idem
quando a foto existia mas sumiu do cache local (a fonte da verdade é o
Cloudinary desde a 007; o cache local é descartável). Em ambos os casos:
não é erro, o brief vai para `publicado/` normalmente e o ledger registra
`hero_moved: false`.

---

## 3. Argumentos da skill

```
radar-mark-published <slug> --ig-url=<url> [--published-at=<iso8601>] [--force] [--dry-run]
```

| Arg | Obrig.? | Descrição |
|---|---|---|
| `<slug>` | sim | Slug completo ou **prefixo único**. Resolvido por glob em `pendente-publicacao/` (e também em `publicado/` quando `--force` — §6). Ambíguo → lista matches + aborta (§3.2). |
| `--ig-url=<url>` | sim | URL do post publicado no Instagram. Validada por formato (§3.2); domínio não-Instagram gera warning mas é aceito. Vai para `ig_post_url` no frontmatter e `extra.ig_post_url` no ledger. |
| `--published-at=<iso8601>` | não | Momento real da publicação (ISO 8601 com timezone). Default: **agora** (`date -Iseconds` no fuso do servidor, `America/Sao_Paulo` / `-03:00`). Override existe porque o post pode ter sido publicado **antes** de rodar a skill — e `published_at` é o que a spec 009 usa para a janela de purge (§8). |
| `--force` | não | Permite **corrigir** um brief já publicado (`published_at != null`, já em `publicado/`): reescreve `ig_post_url`/`published_at` sem mover de novo. Sem `--force`, brief já publicado → skip idempotente (§6). |
| `--dry-run` | não | Plano apenas. Sem `mv`, sem edição de frontmatter, sem ledger (§7). |

### 3.1 Combinações válidas

| Cenário | Comando | Efeito |
|---|---|---|
| Publicação normal | `radar-mark-published W22-005 --ig-url=https://instagram.com/p/Cxyz` | move brief+hero, grava URL e `published_at=now`, ledger `published`. |
| Publicação com data retroativa | `... --ig-url=... --published-at=2026-06-08T20:30:00-03:00` | idem, mas `published_at` = a data informada (janela de purge conta a partir dela). |
| Correção de URL errada | `radar-mark-published W22-005 --ig-url=<url-certa> --force` | brief **já** em `publicado/`; reescreve `ig_post_url` (e `published_at` se `--published-at` vier); **não** re-move; ledger `published` com `forced: true`. |
| Verificar antes | `radar-mark-published W22-005 --ig-url=... --dry-run` | imprime o plano; não toca em nada. |

### 3.2 Edge cases de args

- `--ig-url` ausente → erro fatal (pré-condição §2 item 3).
- `--ig-url` não casa com `^https?://(www\.)?instagram\.com/(p|reel|tv)/` →
  **warning** ("URL não parece um post de Instagram") + prossegue (o humano
  pode estar usando um encurtador ou um domínio próprio).
- `--published-at` com formato ISO inválido → erro fatal (não adivinhar
  data — `published_at` alimenta o purge).
- `<slug>` ambíguo → lista os matches e aborta sem tocar em nada (mesmo
  comportamento da [`005 §16.2`](./005-skill-scan.md#162-slug-ambíguo)).
- `<slug>` não encontrado → erro com a dica do estado provável (item 1 da
  tabela §2).

---

## 4. Fluxo passo-a-passo

Espelha o `radar-mv approve` ([`005 §15.1`](./005-skill-scan.md#151-approve)),
trocando o par de diretórios e os campos de frontmatter.

### 4.1 Resolução do slug

1. Glob `store/briefs/pendente-publicacao/<slug>*.md`. 0 → erro (ver §2 item
   1, com diagnóstico do estado provável). >1 → lista + aborta.
2. Com `--force`, se não achou em `pendente-publicacao/`, tentar
   `store/briefs/publicado/<slug>*.md` (caminho de correção, §6).

### 4.2 Parse + validação (sem side effects)

3. Ler e parsear o frontmatter YAML.
4. Rodar as pré-condições §2 (itens 2–6). Erros fatais abortam; warnings são
   acumulados para o relatório final.

### 4.3 Determinação de `published_at`

5. `published_at` = `--published-at` se fornecido (validado ISO 8601), senão
   `date -Iseconds` (server local, `-03:00`).

### 4.4 `mv` do brief

6. **Modo normal** (brief em `pendente-publicacao/`): `mv` do `.md` para
   `store/briefs/publicado/<slug>.md`.
   **Modo correção** (`--force`, brief já em `publicado/`): sem `mv` — o
   arquivo já está no destino.

### 4.5 `mv` da mídia (hero)

7. Se `hero_choice == N` e `media/pendente-publicacao/<slug>__N.<ext>`
   existe: `mv` para `media/publicado/<slug>__N.<ext>`. Senão: pula
   (`hero_moved = false`, §2.2). No modo correção, se a mídia já está em
   `media/publicado/`, é no-op.

### 4.6 Atualização do frontmatter

8. Editar o `.md` (agora em `publicado/`):
   - `published_at: <iso>`
   - `ig_post_url: <url>`
   - `updated_at: <now>`
   - Se a hero foi movida: `hero_image_candidates[N].local_path` →
     `./store/media/publicado/<slug>__N.<ext>` (mantém o `local_path`
     coerente com o diretório atual, como o `radar-mv` faz na aprovação).
   - `cloud_url` / `cloudinary_public_id` **permanecem intactos** (Cloudinary
     é fonte da verdade; não muda na publicação).

### 4.7 Append no ledger

9. Append de uma linha JSONL com `event: published` (§5.2).

### 4.8 Resumo final ao humano

10. Imprimir: slug, novo estado (`publicado/`), `ig_post_url`,
    `published_at`, se a hero foi movida, warnings acumulados, e o lembrete
    de que a mídia local entra na **janela de purge de 30d** (spec 009).

---

## 5. Ledger — evento novo

Esta spec adiciona o evento `published` (já **reservado** em
[`005 §18.4`](./005-skill-scan.md#184-eventos-futuros-referenciados-não-emitidos-pelo-1º-slice))
e o auxiliar `mark-published-skipped` ao canônico de
[`005 §18`](./005-skill-scan.md#18-ledger--formato-canônico).

### 5.1 Tabela de eventos

| `extra.event` | Origem | `from_dir` | `to_dir` | `brief_id` | Quando |
|---|---|---|---|---|---|
| `published` | `skill:radar-mark-published` | `briefs/pendente-publicacao` | `briefs/publicado` | setado | Brief publicado e movido com sucesso. No modo correção (`--force`), `from_dir`/`to_dir` ambos `briefs/publicado` (sem movimento físico). |
| `mark-published-skipped` | `skill:radar-mark-published` | null | null | setado | Pula antes de processar (já publicado sem `--force`). |

**Nota:** ao contrário do `radar-handoff` (que não move o brief e usa
`from_dir`/`to_dir = null`), aqui **há** transição física de diretório — por
isso `from_dir`/`to_dir` são preenchidos, no mesmo padrão do `radar-mv`
([`005 §18.3`](./005-skill-scan.md#183-eventos-canônicos-1º-slice)).

### 5.2 Schema de `extra` por evento

**`published`**:

```json
{
  "event": "published",
  "ig_post_url": "https://instagram.com/p/Cxyz123",
  "published_at": "2026-06-10T20:30:00-03:00",
  "hero_moved": true,
  "hero_choice": 0,
  "handoff_at_present": true,
  "forced": false
}
```

**`mark-published-skipped`**:

```json
{
  "event": "mark-published-skipped",
  "reason": "already_published",
  "existing_ig_post_url": "https://instagram.com/p/Cxyz123",
  "existing_published_at": "2026-06-08T19:10:00-03:00"
}
```

### 5.3 Exemplo (ciclo completo de um brief)

```jsonl
{"ts":"2026-05-29T13:40:00-03:00","brief_id":"2026-W22-005","from_dir":"briefs/pendente-aprovacao","to_dir":"briefs/pendente-publicacao","actor":"skill:radar-mv","extra":{"event":"mv-approved","hero_choice":0}}
{"ts":"2026-05-29T13:42:00-03:00","brief_id":"2026-W22-005","from_dir":null,"to_dir":null,"actor":"skill:radar-handoff","extra":{"event":"handoff-finished","hero_uploaded":true,"placeholder_mode":false}}
{"ts":"2026-06-10T20:31:00-03:00","brief_id":"2026-W22-005","from_dir":"briefs/pendente-publicacao","to_dir":"briefs/publicado","actor":"skill:radar-mark-published","extra":{"event":"published","ig_post_url":"https://instagram.com/p/Cxyz123","published_at":"2026-06-10T20:30:00-03:00","hero_moved":true,"hero_choice":0,"handoff_at_present":true,"forced":false}}
```

---

## 6. Idempotência e `--force`

### 6.1 Sem `--force`

- Brief com `published_at == null` em `pendente-publicacao/` → processa
  (caminho normal).
- Brief com `published_at != null` (já em `publicado/`) → **skip**: ledger
  `mark-published-skipped` (`reason: already_published`), nenhuma alteração.
- Rodar a skill **2× em sequência** sobre o mesmo brief = 1 `published` +
  1 `mark-published-skipped`. (Análogo ao §9.1 da 007.)

### 6.2 Com `--force`

- **Caso de uso**: o humano colou a URL errada (post de outra conta, link
  quebrado) e quer **corrigir**. O brief já está em `publicado/`.
- Resolução de slug passa a olhar **também** `publicado/` (§4.1 passo 2).
- Reescreve `ig_post_url` (e `published_at` **somente** se `--published-at`
  vier — senão preserva o original, para não falsear a janela de purge).
- **Não** re-move arquivos (já estão no destino). Ledger `published` com
  `forced: true`, `from_dir`/`to_dir` = `briefs/publicado`.

### 6.3 `--dry-run` é sempre idempotente

Por construção não toca em FS nem ledger (§7).

---

## 7. `--dry-run`

`--dry-run` é **sagrado** (mesma regra das specs 005/007): roda toda a
resolução + validação (§4.1–4.3), imprime o plano (origem → destino do
`.md` e da mídia, `published_at` que seria gravado, warnings), e **não**:

- não faz `mv` do `.md` nem da mídia;
- não edita frontmatter;
- não escreve no ledger.

---

## 8. Relação com mídia local e purge (spec 009)

- A hero migra para `media/publicado/<slug>__N.<ext>` — **cache local**,
  não fonte da verdade (Cloudinary é, desde a 007).
- **`published_at` é a chave do purge**: a spec 009 (housekeeping) apaga
  `media/publicado/<slug>__*` **30 dias após `published_at`**
  (`manifest.cloudinary.purge_local_after_days = 30`, referenciado em
  [`001 §3.3`](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado)
  e [`007 §15`](./007-handoff.md#15-purge-de-mídia-local--fora-desta-spec)).
  Por isso `--published-at` precisa refletir a publicação **real**, não o
  momento de rodar a skill, quando há defasagem relevante.
- O `.md` em `publicado/` **nunca** é purgado — é a memória de
  anti-repetição (§9) e o registro de auditoria.
- Esta spec **não** implementa o purge — só deixa o brief na janela.

---

## 9. Anti-repetição

`publicado/` é um dos 4 diretórios varridos pela anti-repetição
([`001 §5`](./001-foundation.md#5-anti-repetição); CLAUDE.md raiz: "checar
todos os 4 diretórios"). Mover o brief para `publicado/` é justamente o que
faz uma pauta **já publicada** entrar na **janela de 90 dias** de bloqueio
por `topic_hash` — sem esta skill, pautas publicadas via `mv` cru ficariam
"presas" em `pendente-publicacao/` e a anti-repetição enxergaria o estado
errado. Fechar o ciclo aqui **corrige a visão** do `radar-scan`.

---

## 10. Edge cases / gotchas

| # | Caso | Mitigação |
|---|---|---|
| 1 | **`mv` cru pelo humano** (arrastou o `.md` para `publicado/` sem a skill). Ledger sem evento `published`; `ig_post_url`/`published_at` ficam `null`. | Mesmo gotcha conhecido do `radar-mv` ([`005 §16.4`](./005-skill-scan.md#164-mv-cru-pelo-humano-sem-skill)). Rodar `radar-mark-published <slug> --ig-url=... --force` (a skill acha o brief em `publicado/` no modo correção) preenche os campos e grava o ledger. |
| 2 | **Brief em `pendente-aprovacao/`** (nunca aprovado). | Erro: "rode `radar-mv approve` + `radar-handoff` antes" (§2 item 1). |
| 3 | **Brief em `rejeitado/`**. | Erro: `rejeitado/` é terminal ([`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta)); nunca migra. |
| 4 | **`handoff_at == null`** (publicou sem package). | Warning, prossegue (§2.1). `extra.handoff_at_present: false` no ledger sinaliza para auditoria. |
| 5 | **Mídia ausente** (`hero_choice: null`, ou cache já purgado/sumido). | Warning + `hero_moved: false`; brief vai para `publicado/` normalmente (§2.2). |
| 6 | **URL não-Instagram** (encurtador / domínio próprio). | Warning, aceita (§3.2). A asserção do humano prevalece. |
| 7 | **Slug ambíguo.** | Lista matches + aborta (§3.2), mesmo padrão do `radar-mv`. |
| 8 | **Publicação retroativa** (post saiu dias antes de rodar a skill). | Usar `--published-at` — senão o purge da 009 conta a janela errada (§8). |
| 9 | **Colisão de nome em `publicado/`** (já existe `<slug>.md` no destino — improvável, slug é único por `<YYYY-Www-NNN>`). | Abortar com erro (não sobrescrever) e pedir inspeção manual. Sem `--force` "destrutivo". |
| 10 | **Cloudinary intacto.** Owner pode estranhar que a skill não "republica" a foto. | Por design: a foto já está no Cloudinary (007). Publicar só re-aponta o cache local de diretório; `cloud_url`/`cloudinary_public_id` não mudam (§4.6). |

---

## 11. Critério §10 da spec 001 — contribuição desta spec

A [`001 §10`](./001-foundation.md#10-primeiro-slice-vertical-escopo-do-primeiro-passo)
listou `radar-mark-published` **explicitamente fora** do 1º slice ("primeiro
slice usa `mv` cru"). Esta é a **primeira spec pós-slice**: fecha o lifecycle
que a [`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta) desenhou.

| Efeito | Como |
|---|---|
| Completa a última transição do lifecycle (`pendente-publicacao/` → `publicado/`) | §4. |
| Registra a publicação de forma auditável (`ig_post_url`, `published_at`, evento `published`) | §4.6 + §5. |
| Dá visão correta à anti-repetição (pauta publicada entra na janela 90d) | §9. |
| Destrava a spec 009 (purge keyed em `published_at`) | §8. |

### 11.1 O que NÃO entra na spec 008

- **Não publica no IG** (manual; opção 1 da
  [`001 §11.M`](./001-foundation.md#11-decisões-abertas)).
- **Não faz purge de mídia** (spec 009 — housekeeping).
- **Não chama Open Design API** (specs 011/012 — opção 3).
- **Não coleta métricas do post** (likes/alcance) — fora do escopo do radar
  no 1º ciclo; eventual `radar-metrics` seria spec futura.
- **Não gera relatório/calendário** de publicados (`editorial-planner` /
  `store/calendar/` — fora do slice).

---

## 12. `SKILL.md` literal — `.claude/skills/radar-mark-published/SKILL.md`

> Conteúdo proposto. Esta spec **NÃO cria o arquivo** — só descreve o que
> ele deve conter (mesma convenção da [`005 §17`](./005-skill-scan.md#17-skillmd-literal--claudeskillsradar-mvskillmd)
> e [`007 §13`](./007-handoff.md#13-skillmd-literal--claudeskillsradar-handoffskillmd)).

````markdown
---
name: radar-mark-published
description: |
  Fecha o ciclo do content-radar: registra que um brief já foi publicado no Instagram (manual) e move
  pendente-publicacao/ → publicado/. Grava ig_post_url + published_at no frontmatter, move a hero pra
  media/publicado/ e escreve evento `published` no ledger. Não publica no IG, não chama Open Design,
  não toca no Cloudinary, não faz purge.
argument-hint: |
  <slug> --ig-url=<url> [--published-at=<iso8601>] [--force] [--dry-run]
---

# radar-mark-published

> Última transição de estado do lifecycle (001 §4). Lê um brief em `store/briefs/pendente-publicacao/`
> que o humano já publicou no IG, grava `ig_post_url` + `published_at`, move o `.md` pra `publicado/`,
> move a hero pra `media/publicado/` e registra `published` no ledger.

## Princípios duros

1. **NÃO publica.** A publicação no Instagram já aconteceu (manual). Esta skill só **registra** o fato
   a partir da `--ig-url` fornecida pelo humano. Nunca chama API de IG nem de Open Design.
2. **`--ig-url` é obrigatório.** É o dado que justifica a transição. Sem ele → erro.
3. **`published_at` alimenta o purge da spec 009.** Default = agora (`date -Iseconds`, -03:00). Use
   `--published-at` quando o post saiu antes de rodar a skill — senão a janela de 30d conta errado.
4. **`handoff_at == null` é warning, não erro.** A asserção humana ("publiquei") prevalece sobre a
   instrumentação interna (spec 008 §2.1).
5. **`publicado/` e `rejeitado/` são terminais.** Brief em `pendente-aprovacao/` → erro (rode
   `radar-mv approve` + `radar-handoff` antes). Em `rejeitado/` → erro (terminal).
6. **Idempotente sem `--force`.** Brief já publicado (`published_at != null`) → skip silencioso
   (ledger `mark-published-skipped`, reason `already_published`). `--force` permite **corrigir** a URL
   de um brief já em `publicado/`.
7. **NÃO toca no Cloudinary.** A foto já está lá (radar-handoff). Só o cache local muda de diretório.
8. **`--dry-run` é sagrado.** Sem `mv`, sem ledger, sem edição de frontmatter.

## Args

- `<slug>` (obrig.): slug completo ou prefixo único (glob em `pendente-publicacao/`; também `publicado/`
  com `--force`).
- `--ig-url=<url>` (obrig.): URL do post. Não-Instagram → warning + aceita.
- `--published-at=<iso8601>` (opc.): momento real da publicação. Default: agora.
- `--force` (opc.): corrige `ig_post_url`/`published_at` de brief já publicado; não re-move.
- `--dry-run` (opc.): plano apenas.

## Fluxo

Spec 008 §4 (10 passos). Resumo:
1. Resolver slug → path único em `pendente-publicacao/` (ou `publicado/` com `--force`).
2. Parse + validação (pré-condições §2; warnings acumulados).
3. Determinar `published_at` (`--published-at` ou agora).
4. `mv` brief: `pendente-publicacao/` → `publicado/` (no-op no modo correção).
5. `mv` hero: `media/pendente-publicacao/<slug>__N.<ext>` → `media/publicado/` (se existe).
6. Atualizar frontmatter: `published_at`, `ig_post_url`, `updated_at`, `hero_image_candidates[N].local_path`.
7. Append no ledger (`event: published`).
8. Reportar (estado novo, URL, data, hero movida?, warnings, lembrete do purge 30d).

## Ledger

- `published` — `from_dir: briefs/pendente-publicacao`, `to_dir: briefs/publicado`, `brief_id` setado.
  `extra`: `ig_post_url`, `published_at`, `hero_moved`, `hero_choice`, `handoff_at_present`, `forced`.
- `mark-published-skipped` — skip idempotente; `extra.reason: already_published`.

## NÃO faça

- ❌ Publicar no Instagram ou chamar Open Design API.
- ❌ Subir/apagar foto no Cloudinary.
- ❌ Purgar mídia local (spec 009 faz, 30d após `published_at`).
- ❌ Mover brief de `pendente-aprovacao/` ou `rejeitado/` (erro — não é o caminho).
- ❌ Apagar o `.md` (anti-repetição precisa dele em `publicado/` por 90d).
- ❌ Sobrescrever um `<slug>.md` já existente em `publicado/` (abortar e pedir inspeção).
````

---

## 13. Critérios de pronto da spec

1. **Arquivo `.claude/skills/radar-mark-published/SKILL.md`** existe com o
   conteúdo proposto na §12 (literal, sem edição estrutural).
2. **`radar-mark-published <slug> --ig-url=<url>`** sobre um brief em
   `pendente-publicacao/` com `published_at: null`:
   - move o `.md` para `store/briefs/publicado/<slug>.md`;
   - move a hero para `media/publicado/<slug>__N.<ext>` (se `hero_choice != null`);
   - grava `published_at`, `ig_post_url`, `updated_at`,
     `hero_image_candidates[N].local_path` no frontmatter;
   - append no ledger `published` com `from_dir`/`to_dir` corretos.
3. **`hero_choice: null`** (ou mídia ausente): transição ocorre, sem mover
   mídia, `hero_moved: false`, sem erro.
4. **Idempotência** (sem `--force`): rodar 2× = 1 `published` +
   1 `mark-published-skipped` (`already_published`).
5. **`--force`** sobre brief já em `publicado/`: reescreve `ig_post_url`
   (e `published_at` se `--published-at` vier), sem re-mover; ledger
   `published` com `forced: true`.
6. **`--published-at=<iso>`** retroativo grava exatamente a data informada
   (validada ISO 8601).
7. **`--dry-run`** não modifica nada (sem `mv`, sem ledger, sem frontmatter).
8. **Pré-condições de estado**: brief em `pendente-aprovacao/` ou
   `rejeitado/` → erro com mensagem orientando o passo certo.

Itens 1–3 e 7–8 são pré-requisitos para o merge; 4–6 são testes de robustez.

---

## 14. Decisões registradas na 001 §11

Confirmadas pelo owner em 2026-06-10 e registradas em
[`001 §11`](./001-foundation.md#11-decisões-abertas) (letras Q–T):

| 001 §11 | Decisão | Resolução |
|---|---|---|
| **Q** | `handoff_at` ausente (§2.1) | **Warning + prossegue** — a publicação é fato consumado; a asserção humana prevalece sobre a instrumentação interna. |
| **R** | Default de `published_at` (§3) | **`now`** (`date -Iseconds`) com override via `--published-at` para publicação retroativa. |
| **S** | Granularidade do registro do post | Gravar **só `ig_post_url`** (+ `published_at`). `ig_post_id` derivado, métricas e tipo (`post`/`reel`) ficam para uma futura `radar-metrics` (§11.1). |
| **T** | Timezone canônico de `published_at` | **`-03:00` (America/Sao_Paulo)**, alinhado ao frontmatter dos briefs. |

Se o owner revisar outras decisões (nome do evento, campos do `extra`, modo
correção do `--force`): abrir pendência explícita na foundation 001.

---

## 15. Glossário (termos novos / reforçados nesta spec)

- **`mark-published`**: ato de **registrar** (não executar) a publicação de
  um brief no Instagram, movendo-o para o estado terminal `publicado/`.
  Distinto de "publicar" — a publicação é manual e externa (CLAUDE.md raiz).
- **`published_at`**: timestamp ISO 8601 da publicação **real** no IG. Chave
  da janela de purge da mídia local (spec 009, §8) e da janela de
  anti-repetição de 90d (§9). Gravado no frontmatter e no ledger.
- **`ig_post_url`**: URL pública do post no Instagram, fornecida pelo humano
  via `--ig-url`. Gravada no frontmatter e no ledger; é a única ligação
  persistente entre o brief do radar e a peça publicada.
- **modo correção (`--force`)**: operação sobre um brief **já** em
  `publicado/` para reescrever `ig_post_url`/`published_at` sem nova
  transição física (§6.2). Distinto do `--force` da 007 (que re-faz upload
  Cloudinary).
- **estado terminal**: `publicado/` e `rejeitado/` — diretórios dos quais um
  brief nunca migra ([`001 §4`](./001-foundation.md#4-lifecycle-de-uma-pauta)).
  `publicado/` permanece visível à anti-repetição por 90 dias.
