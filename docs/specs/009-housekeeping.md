<!--
  Spec 009 — radar-housekeeping
  Purga lazy/on-demand do cache local media/publicado/ (30d após published_at).
  Substitui o esboço "cron simples" da 001 §9/§3.3 (decisão 001 §11.U).
  Convenção: mesmo padrão de skill da 005 §3 + 007 §13 + 008 §12; ledger 005 §18.
  Status: proposta (documento-only). Implementação fica para sessão futura.
-->

# Spec 009 — `radar-housekeeping`

> Define a skill de **higiene de cache** do `content-radar`. Purga a mídia
> local em `store/media/publicado/` **N dias após `published_at`**
> (`manifest.cloudinary.purge_local_after_days = 30`), liberando disco sem
> tocar no Cloudinary (fonte da verdade) nem nos `.md` (memória de
> anti-repetição).
>
> **Substitui o esboço "cron simples"** das
> [`001 §3.3`](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado)
> e [`001 §9` item 9](./001-foundation.md#9-componentes-a-construir--ordem)
> por um modelo **lazy / on-demand**, coerente com a decisão
> [`001 §11.D`](./001-foundation.md#11-decisões-abertas) (radar roda **local,
> sob demanda** — não há daemon nem deploy do content-radar). Decisão
> registrada em [`001 §11.U`](./001-foundation.md#11-decisões-abertas).
>
> Aterra em
> [`001 §3.3`](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado)
> (storage — `media/publicado/` é cache; Cloudinary é a verdade após upload),
> [`001 §11.L`](./001-foundation.md#11-decisões-abertas) (mídia gitignored,
> Cloudinary fonte da verdade) e na chave `published_at` que a
> [`008`](./008-mark-published.md) fixou (fuso `-03:00`, [`001 §11.T`](./001-foundation.md#11-decisões-abertas)).
>
> Reusa o padrão de skill da
> [`005 §3`](./005-skill-scan.md#3-padrão-de-arquivo-claudeskillsslugskillmd),
> o ledger canônico de [`005 §18`](./005-skill-scan.md#18-ledger--formato-canônico),
> e a regra do `--dry-run` sagrado das specs 005/007/008.

---

## 1. Objetivo e posição no pipeline

`radar-housekeeping` é uma skill de **manutenção**, fora do fluxo de
produção de pautas. Não gera, não move, não publica nada — só **apaga cache
local expirado**. Roda no **session principal** (mesmo padrão das demais
skills), **não** é subagente.

```
   briefs/publicado/<slug>.md            (terminal; NUNCA apagado — anti-rep 90d)
   media/publicado/<slug>__N.<ext>       ← cache local; Cloudinary é a verdade
                  │
       published_at + 30d  &&  hero já no Cloudinary
                  │
                  ▼
   ┌─────────────────────────────────────────┐
   │   skill: radar-housekeeping             │   ← ESTA SPEC
   │   apaga media/publicado/<slug>__*        │
   │   ledger: media-purged                   │
   └─────────────────────────────────────────┘
                  │
                  ▼
   disco liberado; brief.md e Cloudinary intactos
```

### 1.1 O que faz / o que NÃO faz

**Faz:**

- Varre `store/briefs/publicado/**`, lê `published_at` e a situação Cloudinary
  da hero.
- Apaga `store/media/publicado/<slug>__*` dos briefs **elegíveis** (§3).
- Atualiza o brief: `media_purged_at`, `hero_image_candidates[N].local_path: null`.
- Append no ledger: `media-purged`, `media-purge-skipped`, `housekeeping-finished`.

**NÃO faz:**

- **Não apaga `.md`.** `briefs/publicado/<slug>.md` é terminal e alimenta a
  anti-repetição por 90d ([`001 §5`](./001-foundation.md#5-anti-repetição)).
- **Não toca no Cloudinary.** Sem delete remoto — o asset lá é a fonte da
  verdade ([`001 §11.L`](./001-foundation.md#11-decisões-abertas)).
- **Não purga `pendente-aprovacao/` / `pendente-publicacao/`.** Esses dirs são
  cache **vivo** (a hero ainda vai ser entregue/operada). `rejeitado/` já é
  sem mídia ([`001 §3.3`](./001-foundation.md#33-storage-store--diretórios-físicos-por-estado)).
- **Não apaga mídia de brief em modo placeholder** (cópia local é a **única**
  cópia) — guarda crítica da §3.1.
- **Não instala cron/systemd.** O disparo é on-demand (§2).

---

## 2. Por que não é um cron de sistema

A [`001 §9`](./001-foundation.md#9-componentes-a-construir--ordem) esboçou
"cron de purga". Esta spec **rejeita** o cron de sistema e adota purga
**lazy / on-demand**. Justificativa:

### 2.1 O purge é cache, não integridade

`media/publicado/` é **puro cache** — o Cloudinary é a fonte da verdade após
o `radar-handoff` ([`001 §11.L`](./001-foundation.md#11-decisões-abertas)).
Consequências:

- Perder a "janela das 3h" não causa **nenhum** dano — só atrasa liberar
  disco. Não há correção a garantir.
- Logo, **não** se precisa de um daemon sempre-ligado nem de horário fixo.

### 2.2 Coerência com "local, sob demanda" (001 §11.D)

O content-radar **não tem deploy** (CLAUDE.md raiz: "Deploy do próprio
content-radar → ainda não definido") e roda **local, sob demanda**
([`001 §11.D`](./001-foundation.md#11-decisões-abertas)). Um cron de sistema
seria **infra órfã** de uma ferramenta não-deployada, exigiria máquina
sempre ligada, e tocaria `/etc`/`systemctl` (anúncio + confirmação pela
política da org). Nada disso combina com a ferramenta.

**Modelo escolhido** — dois gatilhos, ambos on-demand:

1. **Piggyback no `radar-scan`** (§8): todo scan dispara um sweep de
   housekeeping no início (best-effort). Como o cache só **cresce** quando
   você roda o radar, **limpar quando você roda o radar** é o acoplamento
   certo. Sem daemon, sem `/etc`.
2. **Invocação manual**: `radar-housekeeping` (com `--dry-run` para
   inspecionar antes).

### 2.3 Fallback: `systemd --user` timer (não é o default)

Só se um dia o disco virar gargalo **e** o radar passar a rodar raramente.
Nesse caso, o certo seria um **timer `systemd --user`** com
`Persistent=true` (roda como o usuário, sobrevive a reboot, faz **catch-up**
de execução perdida quando a máquina estava desligada) chamando
`radar-housekeeping` em modo não-interativo — **nunca** crontab de sistema em
`/etc`. Mesmo assim exige anúncio/confirmação (política da org) e contraria o
espírito sob-demanda. Fica como **apêndice**, não como mecanismo principal.

> `/schedule` e `/loop` do Claude Code são camada errada: orquestram o
> Claude, não fazem higiene de FS local. Não usar para isto.

---

## 3. Critérios de elegibilidade para purge

Um arquivo `media/publicado/<slug>__N.<ext>` só é apagado se **todas** as
condições valem (avaliadas por brief, sem side effects até a decisão):

| # | Condição | Se falhar |
|---|----------|-----------|
| 1 | Brief está em `store/briefs/publicado/<slug>.md` e frontmatter parseia | Ignora o brief (não é candidato a purge). |
| 2 | `published_at` setado e ISO 8601 válido | `media-purge-skipped`, `reason: "no_published_at"` (anomalia — brief em `publicado/` sem data; provável `mv` cru, ver 008 §10 gotcha 1). |
| 3 | `now − published_at ≥ purge_local_after_days` (default 30; override `--older-than-days`) | `media-purge-skipped`, `reason: "not_yet_due"` (silencioso na contagem). |
| 4 | **Hero está no Cloudinary**: `hero_image_candidates[hero_choice].cloud_url` é URL real (≠ `null`, ≠ `<PENDING_CLOUDINARY>`) **e** `cloudinary_public_id` idem | `media-purge-skipped`, `reason: "placeholder_not_on_cloudinary"` — **NUNCA apaga** (§3.1). |
| 5 | Existe arquivo `media/publicado/<slug>__N.<ext>` no disco | `media-purge-skipped`, `reason: "no_local_media"` (já purgado, ou `hero_choice: null`). |

### 3.1 Guarda anti-placeholder (crítica)

> **Esta é a regra que impede perda de dados.** No estado atual do projeto
> (`manifest.cloudinary.status: aguardando-provisionamento`), **todos** os
> briefs estão em `handoff_mode: placeholder` com
> `cloud_url: "<PENDING_CLOUDINARY>"`. Nesse estado, **a cópia local é a única
> cópia que existe.**

Apagar mídia de um brief placeholder **destruiria** a imagem. Por isso o
critério §3 item 4 é **inviolável**: a skill só purga o que está
**comprovadamente** no Cloudinary (`cloud_url` é URL `https://res.cloudinary.com/...`).
Briefs placeholder são **sempre** pulados (`placeholder_not_on_cloudinary`),
por mais antigos que sejam.

**Não há flag para forçar** purge de placeholder. Se o owner quiser liberar
esse disco antes do Cloudinary chegar, é decisão manual e consciente dele
(apagar à mão, aceitando a perda) — a skill não oferece esse caminho. O
fluxo correto é: provisionar Cloudinary → `radar-handoff --force` (sai do
placeholder, sobe a foto) → aí o `radar-housekeeping` passa a poder purgar.

---

## 4. Argumentos da skill

```
radar-housekeeping [--dry-run] [--older-than-days=N] [--slug=<slug>]
```

| Arg | Obrig.? | Descrição |
|---|---|---|
| `--dry-run` | não | Plano apenas: lista o que **seria** apagado (com idade e bytes), **não** apaga, **não** edita brief, **não** escreve ledger. Recomendado rodar antes do real. |
| `--older-than-days=N` | não | Override do limiar. Default: `manifest.cloudinary.purge_local_after_days` (30). Útil para purga agressiva pontual (`--older-than-days=7`) ou conservadora. |
| `--slug=<slug>` | não | Limita a um único brief (slug completo ou prefixo único em `publicado/`). Sem ele, varre **todos** os briefs de `publicado/`. |

Sem args, o comportamento é: varrer `publicado/`, apagar tudo que for
elegível (§3) com `published_at` mais velho que 30 dias, gravar ledger.

---

## 5. Fluxo passo-a-passo

1. **Carregar config**: ler `manifest.cloudinary.purge_local_after_days`
   (limiar), salvo override por `--older-than-days`.
2. **Selecionar briefs**: glob `store/briefs/publicado/*.md` (ou só o
   `--slug`). `now` = `date -Iseconds` (fuso `-03:00`, [`001 §11.T`](./001-foundation.md#11-decisões-abertas)).
3. **Para cada brief** (serial), avaliar critérios §3 sem apagar nada ainda;
   classificar em `purge` ou `skip(reason)`.
4. **Se `--dry-run`**: imprimir o plano (lista de arquivos, idade em dias,
   bytes totais a liberar, e os skips por motivo) e **encerrar** — nada mais.
5. **Executar purge** (não-dry-run): para cada brief elegível:
   - `rm` dos arquivos `store/media/publicado/<slug>__*` (na prática só a
     hero sobrevivente; glob defensivo cobre múltiplos se existirem).
   - Editar o brief: `media_purged_at: <now>`,
     `hero_image_candidates[N].local_path: null`, `updated_at: <now>`.
     **`cloud_url` / `cloudinary_public_id` permanecem** (Cloudinary é a
     verdade).
   - Append ledger `media-purged` (§6).
6. **Skips**: para cada brief pulado, append `media-purge-skipped` apenas
   quando o motivo for **acionável/anômalo** (`no_published_at`,
   `placeholder_not_on_cloudinary`); motivos de rotina (`not_yet_due`,
   `no_local_media`, `already_purged`) entram só na **contagem** do summary,
   sem poluir o ledger linha a linha.
7. **Summary**: append `housekeeping-finished` com contadores; imprimir
   resumo ao humano (apagados, bytes liberados, skips por motivo).

---

## 6. Ledger — eventos novos

Adiciona ao canônico de [`005 §18`](./005-skill-scan.md#18-ledger--formato-canônico).
(O evento de purga **não** estava reservado na
[`005 §18.4`](./005-skill-scan.md#184-eventos-futuros-referenciados-não-emitidos-pelo-1º-slice)
— é novo desta spec.)

### 6.1 Tabela

| `extra.event` | Origem | `from_dir` | `to_dir` | `brief_id` | Quando |
|---|---|---|---|---|---|
| `media-purged` | `skill:radar-housekeeping` | null | null | setado | Mídia local de 1 brief apagada. |
| `media-purge-skipped` | `skill:radar-housekeeping` | null | null | setado | Pulo **acionável/anômalo** (placeholder, sem `published_at`). |
| `housekeeping-finished` | `skill:radar-housekeeping` | null | null | null | Fim do sweep, com contadores. |

`from_dir`/`to_dir` são `null` — a skill **não move** nada, só apaga cache.

### 6.2 Schema de `extra`

**`media-purged`**:

```json
{
  "event": "media-purged",
  "files_deleted": ["2026-W22-005_..._0.png"],
  "bytes_freed": 48721,
  "published_at": "2026-05-10T20:30:00-03:00",
  "age_days": 31,
  "cloud_url_present": true
}
```

**`media-purge-skipped`**:

```json
{
  "event": "media-purge-skipped",
  "reason": "placeholder_not_on_cloudinary" | "no_published_at",
  "published_at": "2026-05-10T20:30:00-03:00" | null
}
```

**`housekeeping-finished`**:

```json
{
  "event": "housekeeping-finished",
  "trigger": "manual" | "piggyback-radar-scan",
  "briefs_scanned": 12,
  "purged": 3,
  "bytes_freed": 146163,
  "skipped": { "not_yet_due": 6, "placeholder_not_on_cloudinary": 2, "no_local_media": 1, "no_published_at": 0 },
  "threshold_days": 30,
  "dry_run": false
}
```

### 6.3 Exemplo

```jsonl
{"ts":"2026-06-10T09:00:00-03:00","brief_id":"2026-W22-005","from_dir":null,"to_dir":null,"actor":"skill:radar-housekeeping","extra":{"event":"media-purged","files_deleted":["2026-W22-005_..._0.png"],"bytes_freed":48721,"published_at":"2026-05-10T20:30:00-03:00","age_days":31,"cloud_url_present":true}}
{"ts":"2026-06-10T09:00:00-03:00","brief_id":"2026-W22-003","from_dir":null,"to_dir":null,"actor":"skill:radar-housekeeping","extra":{"event":"media-purge-skipped","reason":"placeholder_not_on_cloudinary","published_at":"2026-05-09T11:00:00-03:00"}}
{"ts":"2026-06-10T09:00:01-03:00","brief_id":null,"from_dir":null,"to_dir":null,"actor":"skill:radar-housekeeping","extra":{"event":"housekeeping-finished","trigger":"manual","briefs_scanned":7,"purged":1,"bytes_freed":48721,"skipped":{"not_yet_due":3,"placeholder_not_on_cloudinary":2,"no_local_media":1},"threshold_days":30,"dry_run":false}}
```

---

## 7. Idempotência e `--dry-run`

- **Idempotente por construção**: após o purge, `local_path: null` e o arquivo
  some — re-rodar cai em `no_local_media` (skip silencioso). Rodar 2× = 1
  purge + 0 (nada a fazer).
- **`--dry-run` é sagrado** (regra das 005/007/008): roda toda a avaliação,
  imprime o plano, e **não** apaga, **não** edita brief, **não** escreve
  ledger.

---

## 8. Piggyback no `radar-scan` (integração)

O gatilho primário (§2.2) é um sweep no **início** do `radar-scan`:

- **Passo 0** do fluxo do `radar-scan` (antes do researcher): invocar
  `radar-housekeeping` em modo **não-interativo**, **best-effort** — falha do
  housekeeping **não aborta** o scan (loga warning e segue).
- **Herda o `--dry-run`**: se o scan é `--dry-run`, o housekeeping também é
  (nada é apagado). Coerente com "dry-run sagrado".
- Ledger do sweep usa `housekeeping-finished` com
  `trigger: "piggyback-radar-scan"` para distinguir do disparo manual.

> **Mudança de doc necessária na implementação**: adicionar este "passo 0" ao
> fluxo do `radar-scan` (SKILL.md + [`005 §5`](./005-skill-scan.md#5-fluxo-passo-a-passo)).
> Esta spec **não** edita aquele arquivo — só especifica o contrato, na mesma
> convenção doc-only das 007/008.

---

## 9. Edge cases / gotchas

| # | Caso | Mitigação |
|---|---|---|
| 1 | **Projeto inteiro em placeholder** (estado atual). | Guarda §3.1: todos pulados (`placeholder_not_on_cloudinary`); **nada** é apagado até o Cloudinary ser provisionado. Comportamento correto, não bug. |
| 2 | **`mv` cru levou brief a `publicado/` sem `published_at`.** | `media-purge-skipped`/`no_published_at`. Não dá pra contar a janela sem a data; pular é seguro. Owner resolve com `radar-mark-published --force` (008 §10 gotcha 1). |
| 3 | **Brief com `hero_choice: null`** (nunca teve mídia). | `no_local_media` — skip silencioso (rotina). |
| 4 | **Arquivo de mídia órfão** (`<slug>__N` sem brief correspondente em `publicado/`). | Conservador: **não** apaga órfão sem brief (evita apagar algo de estado desconhecido). Loga no summary como anomalia; limpeza de órfãos é decisão manual. |
| 5 | **`published_at` futuro / relógio torto.** | `age_days` negativo → cai em `not_yet_due`; nunca apaga. |
| 6 | **Cloudinary provisionado mas `radar-handoff --force` ainda não rodado** nos antigos. | Continuam placeholder → continuam protegidos (§3.1) até o `--force` subir a foto. |
| 7 | **Race com `radar-scan` (piggyback) e housekeeping manual simultâneos.** | Operações são `rm` idempotentes + append no ledger; pior caso = um vê `no_local_media` do outro. Sem corrupção. (Mesma postura best-effort do scan.) |

---

## 10. Critério da 001 — contribuição desta spec

Fecha o item 9 da [`001 §9`](./001-foundation.md#9-componentes-a-construir--ordem)
("Cron de purga `media/publicado/` (30d)"), **redefinindo** o mecanismo de
cron para lazy/on-demand ([`001 §11.U`](./001-foundation.md#11-decisões-abertas)).

| Efeito | Como |
|---|---|
| Libera disco do cache local expirado, sem daemon | §2 + §5. |
| Nunca perde imagem (guarda anti-placeholder) | §3.1. |
| Mantém Cloudinary e anti-repetição (`.md`) intactos | §1.1. |
| Disparo coerente com "local, sob demanda" | §2.2 (piggyback) + §8. |

### 10.1 O que NÃO entra na spec 009

- **Não deleta assets no Cloudinary** (lifecycle remoto — eventual spec de
  retenção Cloudinary, fora de escopo).
- **Não purga `pendente-*`** (cache vivo).
- **Não coleta métricas** do post nem gera relatório de publicados.
- **Não instala timer/cron** — o `systemd --user` da §2.3 é apêndice
  opcional, materializado só se/quando o owner pedir (com anúncio/confirmação).

---

## 11. `SKILL.md` literal — `.claude/skills/radar-housekeeping/SKILL.md`

> Conteúdo proposto. Esta spec **NÃO cria o arquivo** — só descreve o que
> ele deve conter (convenção das [`007 §13`](./007-handoff.md#13-skillmd-literal--claudeskillsradar-handoffskillmd)
> e [`008 §12`](./008-mark-published.md#12-skillmd-literal--claudeskillsradar-mark-publishedskillmd)).

````markdown
---
name: radar-housekeeping
description: |
  Higiene de cache do content-radar: purga store/media/publicado/ N dias (default 30) após published_at,
  liberando disco. NUNCA apaga mídia de brief em modo placeholder (cópia local é a única cópia), nunca
  toca no Cloudinary, nunca apaga o .md. Disparada manual ou como passo 0 do radar-scan. Não publica,
  não move brief, não chama Open Design.
argument-hint: |
  [--dry-run] [--older-than-days=N] [--slug=<slug>]
---

# radar-housekeeping

> Manutenção, fora do fluxo de produção. Varre store/briefs/publicado/, e para cada brief com
> published_at mais velho que o limiar E cuja hero já está no Cloudinary, apaga store/media/publicado/<slug>__*.
> Escreve `media-purged` / `housekeeping-finished` no ledger.

## Princípios duros

1. **Guarda anti-placeholder (inviolável).** Só purga brief cujo `hero_image_candidates[N].cloud_url`
   é URL real (≠ `null`, ≠ `<PENDING_CLOUDINARY>`). Placeholder = cópia local é a ÚNICA cópia → pular
   SEMPRE. Sem flag para forçar (spec 009 §3.1).
2. **NUNCA apaga o `.md`.** `publicado/` é terminal e alimenta anti-repetição 90d (001 §5).
3. **NUNCA toca no Cloudinary.** Asset remoto é a fonte da verdade (001 §11.L).
4. **Só `publicado/`.** `pendente-aprovacao/`/`pendente-publicacao/` são cache vivo; `rejeitado/` é sem mídia.
5. **`--dry-run` é sagrado.** Sem `rm`, sem edição de brief, sem ledger.
6. **Idempotente.** Após purge, `local_path: null`; re-rodar cai em `no_local_media`.
7. **Lazy/on-demand, não cron.** Disparo manual ou piggyback no radar-scan (passo 0, best-effort). Sem
   daemon, sem /etc, sem systemctl (spec 009 §2).

## Args

- `--dry-run` (opc.): plano apenas (lista arquivos, idade, bytes; sem apagar).
- `--older-than-days=N` (opc.): override do limiar. Default: `manifest.cloudinary.purge_local_after_days` (30).
- `--slug=<slug>` (opc.): restringe a um brief.

## Fluxo

Spec 009 §5 (7 passos). Resumo:
1. Limiar = manifest (ou `--older-than-days`). `now` = `date -Iseconds` (-03:00).
2. Glob `publicado/*.md` (ou `--slug`).
3. Classificar cada brief: purge vs skip(reason) pelos critérios §3 (placeholder NUNCA purga).
4. `--dry-run` → imprime plano e encerra.
5. Purge: `rm media/publicado/<slug>__*`; brief `media_purged_at`, `local_path: null`; ledger `media-purged`.
6. Skips anômalos (placeholder, no_published_at) → `media-purge-skipped`; rotina só conta no summary.
7. `housekeeping-finished` + resumo ao humano.

## Ledger

- `media-purged` — `extra`: `files_deleted`, `bytes_freed`, `published_at`, `age_days`, `cloud_url_present`.
- `media-purge-skipped` — `extra.reason`: `placeholder_not_on_cloudinary` | `no_published_at`.
- `housekeeping-finished` — `extra`: `trigger`, `briefs_scanned`, `purged`, `bytes_freed`, `skipped{}`, `threshold_days`, `dry_run`.

## NÃO faça

- ❌ Apagar mídia de brief placeholder (cópia local é a única cópia).
- ❌ Apagar `.md` de `publicado/`.
- ❌ Deletar asset no Cloudinary.
- ❌ Purgar `pendente-aprovacao/` ou `pendente-publicacao/`.
- ❌ Apagar mídia órfã (sem brief correspondente) — logar como anomalia, decisão manual.
- ❌ Instalar cron/systemd por conta própria (apêndice §2.3 exige anúncio/confirmação do owner).
````

---

## 12. Critérios de pronto da spec

1. **Arquivo `.claude/skills/radar-housekeeping/SKILL.md`** existe com o
   conteúdo da §11 (literal).
2. **`radar-housekeeping --dry-run`** lista candidatos (idade, bytes) e **não**
   apaga/edita/escreve nada.
3. **Purge real** apaga só `media/publicado/<slug>__*` de briefs elegíveis,
   seta `media_purged_at` + `local_path: null`, e grava `media-purged` +
   `housekeeping-finished`.
4. **Guarda anti-placeholder**: brief com `cloud_url: "<PENDING_CLOUDINARY>"`
   ou `null` **nunca** é purgado, por mais antigo que seja (`media-purge-skipped`).
5. **`--older-than-days=N`** altera o limiar corretamente.
6. **Idempotência**: rodar 2× = 1 purge + 1 sweep que acha `no_local_media`.
7. **Nunca** apaga `.md`, nunca chama Cloudinary, nunca toca `pendente-*`.
8. **Piggyback** (§8): `radar-scan` dispara o sweep no passo 0, best-effort,
   herdando `--dry-run` — documentado na 005 §5 quando implementado.

Itens 1–4 e 7 são pré-requisitos para o merge; 5–6 e 8 são robustez/integração.

---

## 13. Decisões registradas na 001 §11

Confirmada com o owner em 2026-06-10 e registrada em
[`001 §11`](./001-foundation.md#11-decisões-abertas):

| 001 §11 | Decisão | Resolução |
|---|---|---|
| **U** | Mecanismo de purga de `media/publicado/` (esboço "cron simples" da 001 §9/§3.3) | **Lazy / on-demand**: skill `radar-housekeeping` disparada manual + piggyback no `radar-scan` (passo 0, best-effort), com **guarda anti-placeholder** inviolável. **Sem** cron de sistema. `systemd --user` timer fica como fallback futuro (anúncio/confirmação). Substitui o "cron simples" do esboço. |

Se o owner quiser o timer `systemd --user` desde já, ou um limiar diferente de
30d, ou purga de órfãos automática: abrir como ajuste na foundation 001.

---

## 14. Glossário (termos novos nesta spec)

- **purga lazy / on-demand**: remoção de cache disparada **quando a
  ferramenta é usada** (manual ou piggyback no `radar-scan`), não por
  daemon/cron de horário fixo. Adequada porque o purge é higiene de cache,
  não integridade (§2.1).
- **guarda anti-placeholder**: invariante de segurança (§3.1) que impede
  apagar mídia local de brief ainda **não** no Cloudinary (`<PENDING_CLOUDINARY>`/`null`),
  cujo arquivo local é a **única** cópia.
- **`media_purged_at`**: timestamp ISO 8601 (`-03:00`) gravado no frontmatter
  do brief quando seu cache local de mídia foi purgado. Marca a operação e
  torna re-execuções idempotentes.
- **piggyback**: invocação automática do `radar-housekeeping` como passo 0 do
  `radar-scan` (§8), best-effort (não aborta o scan), herdando `--dry-run`.
