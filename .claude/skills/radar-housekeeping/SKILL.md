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
