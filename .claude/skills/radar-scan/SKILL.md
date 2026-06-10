---
name: radar-scan
description: |
  Orquestra o pipeline de descoberta do content-radar (researcher → matcher → briefer) para a Avanz Imóveis.
  Invoca os 3 subagentes via Task, valida JSON entre estágios, materializa briefs em
  store/briefs/pendente-aprovacao/ + mídia em store/media/pendente-aprovacao/ e atualiza store/ledger.jsonl.
  Use sempre que quiser **gerar pautas novas de Instagram** sob demanda. Não publica, não chama Open Design API.
argument-hint: |
  --scope=<trends|competitors|seasonal|cases|local> [--pillar=<1-imovel|2-decisao|3-inteligencia|5-quem-comprou|6-mercado-rmbh>] [--target-count=N] [--dry-run] [--scan-id=<id>]
---

# radar-scan

> Orquestrador do content-radar (1º slice). Lê manifest.yaml, valida args, prepara contexto, invoca
> os subagentes `market-researcher`, `avanz-matcher` e `instagram-briefer` na sequência, materializa
> briefs em arquivos `.md` e mídia local, escreve eventos no ledger. **Nunca publica no IG. Nunca chama
> Open Design API.** Publicação fica com `radar-handoff` (spec 007) e operação humana.

## Princípios duros

1. **Sem Pilar 4.** `--pillar=4-bastidor` → erro fatal. Bastidor vive nos stories (decisão humana ad-hoc),
   fora do escopo do radar (CLAUDE.md + spec 001 §3 + spec 003 §5.1).
2. **`--dry-run` é sagrado.** Em dry-run, **não invoque** Task() pra nenhum subagente. **Não escreva** em
   `store/`. **Não toque** no ledger. Só relate o plano (§7 da spec 005).
3. **Anti-repetição é responsabilidade dos subagentes.** Você não decide o que é redundante; matcher
   (spec 003 §8) e briefer (spec 004 §10) já checam. Você só persiste o que o briefer devolveu.
4. **Validação JSON é obrigatória entre estágios.** Researcher inválido → abort. Matcher inválido →
   abort. Briefer inválido pra 1 finding → skip aquele finding, continua. Spec 005 §6.
5. **Serial, não paralelo.** Briefers rodam um por vez no 1º slice. Race em `NNN` e anti-repetição
   intra-batch (spec 005 §9.3, §20 gotchas 1 e 4).
6. **Snapshot do vault no início.** Mudanças no vault Avanz mid-scan são ignoradas (§20 gotcha 5).

## Antes de começar

Carregue (via Read):
1. `/srv/apps/content-radar/manifest.yaml` (para `target_company`, `search_scopes`, `anti_repetition`,
   `storage`, `funnel`)
2. Arquivos em `target_company.always_load` (lista de paths absolutos do vault Avanz) — extraia
   trechos curtos pra injetar no researcher (stateless, spec 002 §3).
3. Liste `store/briefs/{pendente-aprovacao,pendente-publicacao,publicado,rejeitado}/` (frontmatters)
   só pra contar `NNN` e pra opcionalmente exibir contexto pro humano. **Não precisa ler conteúdo**;
   matcher/briefer fazem isso por conta própria.

## Args

- `--scope` (obrig.): chave de `manifest.search_scopes`.
- `--pillar` (opc.): rejeitar `4-bastidor` com erro; outros valores OK.
- `--target-count` (opc.): default = `manifest.funnel.candidates_per_week_target`.
- `--dry-run` (opc.): plano apenas.
- `--scan-id` (opc.): auto se omitido (formato `<YYYY-Www>-scan-<NNN>`).

## Fluxo

Segue spec 005 §5 (passo 0 + 10 passos). Após cada passo:

- **Passo 0 (housekeeping, piggyback)**: após validar args e antes de preparar contexto, invocar a skill
  `radar-housekeeping` (best-effort) pra purgar cache local expirado de `media/publicado/`. Falha **não
  aborta** o scan (loga warning e segue). Em `--dry-run`, invocar `radar-housekeeping --dry-run` (nada
  apagado). O sweep grava seu próprio `housekeeping-finished` no ledger (`trigger: "piggyback-radar-scan"`).
  Detalhes: spec 009 §8 + spec 005 §5.1.1.
- **Estágio 1**: `Task(subagent_type='market-researcher', prompt=<bloco com scope, pillar_filter, window_days,
  target_count, max_per_source, allowed_sources, vault_paths>)`. Validar JSON (§5.5).
- **Estágio 2**: `Task(subagent_type='avanz-matcher', prompt=<bloco com scan_id, findings[], paths absolutos
  do vault e dos 4 dirs de briefs>)`. Validar JSON (§5.7).
- **Estágio 4**: pra cada `promote-to-brief`, `Task(subagent_type='instagram-briefer', prompt=<bloco
  spec 004 §3>)`. Validar JSON (§5.8). Materializar `.md` + ledger.

## Saída

Relatório no formato do §10 da spec 005. **JSON estruturado pro stdout** não é necessário — esta skill
roda no session principal, output é pro humano.

## Ledger

Append `store/ledger.jsonl` (JSONL append-only). Eventos: `scan-started`, `scan-aborted`,
`scan-finished`, `brief-created`, `skip-redundant`, `skip-validation-failed`, `skip-low-score`,
`skip-out-of-scope`, `brief-schema-invalid`. Schema canônico em spec 005 §18.

## NÃO faça

- ❌ Publicar no IG.
- ❌ Chamar Open Design API (`/api/chat` etc).
- ❌ Subir foto pro Cloudinary (isso é `radar-handoff`, spec 007).
- ❌ Editar briefs existentes em `pendente-aprovacao/` (briefer nasce do zero; humano edita à mão).
- ❌ Rodar dois `radar-scan` em paralelo no mesmo `week_key` (race no `NNN` — §20 gotcha 1).
- ❌ Buscar fora de `manifest.search_scopes[scope].sources`.
- ❌ Inventar args novos sem atualizar a spec 005 primeiro.
