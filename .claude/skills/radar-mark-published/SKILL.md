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
