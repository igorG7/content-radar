---
name: radar-mv
description: |
  Transição de estado físico de um brief do content-radar: pendente-aprovacao/ → pendente-publicacao/ (approve)
  ou pendente-aprovacao/ → rejeitado/ (reject). Move o .md, remaneja mídia conforme hero_choice (mantém só a
  foto escolhida no approve; apaga todas no reject) e escreve evento no ledger. Não chama Open Design,
  não sobe foto, não publica.
argument-hint: |
  <slug> approve|reject [--reason="<motivo>"] [--dry-run]
---

# radar-mv

> Transição de estado pós-revisão humana. Lê o frontmatter do brief em pendente-aprovacao/, valida
> hero_choice (approve) ou aceita o reject, faz `mv` do .md, remaneja mídia, escreve no ledger.

## Princípios duros

1. **hero_choice EXPLÍCITO.** No `approve`, o campo `hero_choice` precisa existir no frontmatter
   (`null`, `0`, `1`, ...). null permitido com warning ao humano. Default implícito → erro. Spec
   001 §11.C + spec 004 §8.3.
2. **rejeitado/ é terminal e sem mídia.** No `reject`, apagar TODOS os arquivos
   `media/pendente-aprovacao/<slug>__*`. Spec 001 §3.3 + §11.K.
3. **Approve mantém só a foto escolhida.** No `approve`, mover `<slug>__N.<ext>` (N = hero_choice)
   pra `media/pendente-publicacao/` e apagar os outros candidatos. Economiza cache e deixa claro
   pro próximo estágio o que importa.
4. **Pendente-publicacao/, publicado/, rejeitado/ são read-only via esta skill.** Quem está nesses
   dirs não passa por radar-mv. Approve só funciona em pendente-aprovacao/.
5. **`--dry-run` é sagrado.** Sem `mv`, sem ledger.

## Args

- `<slug>` (obrig.): slug completo ou prefixo único (resolução por glob em `pendente-aprovacao/`).
- `approve|reject` (obrig.): direção.
- `--reason="<string>"` (opc.): vai pro `review_notes` (reject) ou pro `extra.reason` do ledger.
- `--dry-run` (opc.): plano apenas.

## Fluxo approve

Spec 005 §15.1 (8 passos). Resumo:
1. Resolver slug → path único em pendente-aprovacao/.
2. Validar `hero_choice` (null ou int ∈ range).
3. Validar arquivo de mídia escolhida existe (warning se não — §16.6).
4. `mv` brief: pendente-aprovacao/ → pendente-publicacao/.
5. Atualizar `updated_at` no frontmatter.
6. `mv` mídia escolhida; apagar candidatos restantes em pendente-aprovacao/.
7. Append no ledger (`event: mv-approved`).
8. Reportar pro humano.

## Fluxo reject

Spec 005 §15.2 (8 passos). Resumo:
1. Resolver slug.
2. Validar pré-condições (brief em pendente-aprovacao/).
3. Ler frontmatter.
4. `mv` brief: pendente-aprovacao/ → rejeitado/.
5. Atualizar `updated_at` + append em `review_notes` com `--reason`.
6. Apagar TODOS os `media/pendente-aprovacao/<slug>__*`.
7. Append no ledger (`event: mv-rejected`).
8. Reportar.

## Edge cases

Ver spec 005 §16:
- brief já em outro estado → erro com sugestão da skill correta.
- slug ambíguo → lista matches + abort.
- slug não encontrado → erro.
- hero_choice fora de range → erro.
- mídia ausente → warning + pergunta ao humano.
- `mv` cru sem skill → aceitar silenciosamente; ledger inconsistente (gotcha conhecido).

## NÃO faça

- ❌ Chamar Open Design API.
- ❌ Subir foto pro Cloudinary (radar-handoff faz).
- ❌ Re-mover brief de pendente-publicacao/ → publicado/ (radar-mark-published faz; spec 008).
- ❌ Apagar `.md` (rejeitado/ preserva o arquivo — anti-repetição precisa dele 30d).
- ❌ Confiar que humano fez `mv` cru — pode ter feito; ledger não tem evento.
