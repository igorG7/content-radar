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
   SDK externo. Snippet completo abaixo (spec 007 §8.3).

## Antes de começar

Carregue (via Read):

1. `/srv/apps/content-radar/manifest.yaml` (para `cloudinary.*`, `open_design.project_avanz`,
   `open_design.candidate_skills`, `storage.briefs_dirs`, `storage.packages_root`,
   `target_company.brand_facts`).
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
