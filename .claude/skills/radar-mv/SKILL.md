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

> Transição de estado pós-revisão humana. **Esta skill não executa os passos à mão** — ela delega
> para `web/lib/transitions/mv.ts`, a mesma implementação que a interface web usa. Uma regra, dois
> pontos de entrada.

## Como executar

A partir da raiz do repositório:

```bash
web/node_modules/.bin/tsx web/scripts/radar-mv.mts <slug> approve|reject [--reason="<motivo>"] [--dry-run]
```

Repasse a saída do comando ao humano. **Não reimplemente o fluxo com `mv`, `rm` e `Edit`** — o
módulo já faz a validação, a movimentação, o remanejo de mídia e o append no ledger, com
`actor: "skill:radar-mv"`.

Se o comando falhar por dependência ausente, rode `npm install` dentro de `web/` e tente de novo.

## Args

- `<slug>` (obrig.): slug completo ou **prefixo único** (resolvido em `pendente-aprovacao/`;
  prefixo ambíguo lista os candidatos e aborta).
- `approve|reject` (obrig.): direção.
- `--reason="<string>"` (opc.): vai pro `review_notes` (reject) e pro `extra.reason` do ledger.
- `--dry-run` (opc.): imprime o plano; não escreve nada.

## Princípios duros

O módulo garante cada um destes, e há teste automatizado para todos
(`web/lib/transitions/mv.test.ts`). Eles seguem valendo como contrato — se algum deixar de valer,
é bug do módulo, não licença pra contornar por fora.

1. **hero_choice EXPLÍCITO.** No `approve`, o campo precisa existir no frontmatter (`null`, `0`,
   `1`, ...). `null` é caminho válido (Smart Design gera a arte) e emite warning. Campo ausente →
   erro. Spec 001 §11.C + spec 004 §8.3.
2. **rejeitado/ é terminal e sem mídia.** No `reject`, apaga TODOS os
   `media/pendente-aprovacao/<slug>__*`. Spec 001 §3.3 + §11.K.
3. **Approve mantém só a foto escolhida.** Move `<slug>__N.<ext>` pra `media/pendente-publicacao/`
   e apaga os demais candidatos.
4. **Só sai de pendente-aprovacao/.** Brief em outro diretório → erro apontando a skill correta.
5. **`--dry-run` é sagrado.** Sem `mv`, sem ledger, sem alteração de frontmatter.

## Cuidado conhecido: `hero_choice: null` por default

O briefer grava `hero_choice: null` por padrão (spec 004 §8.3). No arquivo, isso é
**indistinguível** de "o humano decidiu não usar foto". Um `approve` cego num brief que nunca
passou por revisão apaga as candidatas em cache — e nada foi pro Cloudinary ainda, então é
irreversível.

Antes de aprovar, confirme com o humano se o `null` é decisão dele. A interface web resolve isso
exigindo escolha explícita na sessão; no terminal, a confirmação é sua.

## Edge cases

Tratados pelo módulo (spec 005 §16):

- brief em outro estado → erro com sugestão da skill correta.
- slug ambíguo → lista matches + aborta.
- slug não encontrado → erro.
- `hero_choice` sem candidata correspondente → erro.
- mídia escolhida ausente do cache → warning; o brief avança sem mídia.
- `mv` cru feito por fora → não há evento no ledger (gotcha conhecido; o módulo não detecta).

## NÃO faça

- ❌ Reimplementar o fluxo com `mv`/`rm`/`Edit` em vez de chamar o comando.
- ❌ Chamar Open Design API.
- ❌ Subir foto pro Cloudinary (radar-handoff faz).
- ❌ Mover brief de pendente-publicacao/ → publicado/ (radar-mark-published faz; spec 008).
- ❌ Apagar `.md` (rejeitado/ preserva o arquivo — anti-repetição precisa dele 30d).
