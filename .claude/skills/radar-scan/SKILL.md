---
name: radar-scan
description: |
  Orquestra o pipeline de descoberta do content-radar (researcher → matcher → briefer) para a Avanz Imóveis.
  Invoca os 3 subagentes via Task, valida JSON entre estágios, materializa briefs em
  store/briefs/pendente-aprovacao/ + mídia em store/media/pendente-aprovacao/ e atualiza store/ledger.jsonl.
  Use sempre que quiser **gerar pautas novas de Instagram** sob demanda. Não publica, não chama Open Design API.
argument-hint: |
  --scope=<trends|competitors|seasonal|cases|local> [--pillar=<imovel-da-semana|decisao-inteligente|inteligencia-imobiliaria|quem-comprou|mercado-rmbh>] [--target-count=N] [--dry-run] [--scan-id=<id>]
---

# radar-scan

> Orquestrador do content-radar (1º slice). Lê manifest.yaml, valida args, prepara contexto, invoca
> os subagentes `market-researcher`, `avanz-matcher` e `instagram-briefer` na sequência, materializa
> briefs em arquivos `.md` e mídia local, escreve eventos no ledger. **Nunca publica no IG. Nunca chama
> Open Design API.** Publicação fica com `radar-handoff` (spec 007) e operação humana.

## Princípios duros

1. **Sem `bastidor`.** `--pillar=bastidor` → erro fatal. Bastidor vive nos stories (decisão humana ad-hoc),
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

> **Tudo é relativo ao diretório de trabalho.** A execução acontece num
> workspace do ambiente, montado a partir do banco — não no repositório. Caminho
> absoluto aqui faria a skill ler a configuração e o vault de outro cliente.

Carregue (via Read):
1. `./manifest.yaml` (para `target_company`, `search_scopes`, `anti_repetition`,
   `storage`, `funnel`)
2. Arquivos em `target_company.always_load` (caminhos relativos ao workspace) — extraia
   trechos curtos pra injetar no researcher (stateless, spec 002 §3).
3. Liste `store/briefs/{pendente-aprovacao,pendente-publicacao,publicado,rejeitado}/` (frontmatters)
   só pra contar `NNN` e pra opcionalmente exibir contexto pro humano. **Não precisa ler conteúdo**;
   matcher/briefer fazem isso por conta própria.

## Args

- `--scope` (obrig.): chave de `manifest.search_scopes`.
- `--pillar` (opc.): rejeitar `bastidor` com erro; outros valores OK.
- `--target-count` (opc.): default = `manifest.funnel.candidates_per_week_target`.
- `--dry-run` (opc.): plano apenas.
- `--scan-id` (opc.): auto se omitido (formato `<YYYY-Www>-scan-<NNN>`).

## Fluxo

Segue spec 005 §5 (passo 0 + 10 passos). Após cada passo:

- **Passo 0 (housekeeping)**: não é mais sua responsabilidade. A purga do cache
  local virou código no executor, que a roda antes de montar o workspace e grava
  `media-purged` no ledger.

  > A skill fazia isso dentro do workspace — que é uma cópia descartável sem
  > arquivo de mídia nenhum. Ela rodava, gravava `housekeeping-finished` e não
  > purgava nada, porque não havia o que purgar ali.
  Detalhes: spec 009 §8 + spec 005 §5.1.1.
- **Estágio 1**: `Task(subagent_type='market-researcher', prompt=<bloco com scope, pillar_filter, window_days,
  target_count, max_per_source, allowed_sources, vault_paths>)`. Validar JSON (§5.5).
- **Estágio 2**: `Task(subagent_type='avanz-matcher', prompt=<bloco com scan_id, findings[], caminhos relativos
  do vault e dos 4 dirs de briefs>)`. Validar JSON (§5.7).
- **Estágio 4**: pra cada `promote-to-brief` **e cada `promote-borderline`**,
  `Task(subagent_type='instagram-briefer', prompt=<bloco spec 004 §3>)`. Validar JSON (§5.8).

  **Materializar como `.json`, não como `.md`.** Grave o objeto `brief` que o briefer
  devolveu, **exatamente como veio**, em
  `store/briefs/pendente-aprovacao/<slug>.json`. Sem reformatar, sem redistribuir campos,
  sem transformar em prosa. Um `.md` para leitura humana é opcional e ignorado pela
  ingestão.

  > Por quê: duas execuções reais gravaram formatos diferentes de `.md`. Numa, `hook`,
  > `cta`, `hashtags` e `visual_brief` foram para o frontmatter; na outra, para o corpo
  > do markdown. A ingestão lê os campos declarados, então metade do brief se perdeu sem
  > erro nenhum — o texto existia no arquivo e não chegou ao banco. Renderizar prosa é
  > decisão de formatação, e formatação instável não serve como contrato.

  - **Tier borderline (calibração §11.V / manifest `anti_repetition.borderline_min`)**: quando o
    matcher devolveu `decision: promote-borderline`, após o briefer retornar `create-brief`,
    acrescente ao objeto gravado: `borderline: true` e
    `borderline_reason: <decision_reason do matcher>`. Para `promote-to-brief` pleno, escreva
    `borderline: false`. O flag sinaliza ao editor humano que foi um match marginal (0.48–0.55) —
    ele é o portão de qualidade (§11.H). Nenhum outro campo muda; borderline **vira brief normal**
    em `pendente-aprovacao/`.
  - Se o briefer devolver `skip-redundant` (checagem definitiva headline-based), respeite — vale
    para borderline também.

## Saída

Relatório no formato do §10 da spec 005. **JSON estruturado pro stdout** não é necessário — esta skill
roda no session principal, output é pro humano.

## Ledger

**O `ts` vem do relógio, nunca da sua cabeça.** Toda linha do ledger usa:

```bash
TS=$(TZ=America/Sao_Paulo date -Iseconds)
```

Não é detalhe de estilo. Numa execução real você escreveu `"2026-08-24T12:50:00-03:00"`
à mão — minutos redondos, segundos zerados — para um evento que aconteceu às
11:50 UTC. O carimbo caiu **quatro horas no futuro**, depois de eventos que de
fato vieram depois. Ordenação, janela de anti-repetição e duração por estágio
saem todas erradas a partir daí, e nada avisa.

A máquina roda em **UTC**; o `TZ=America/Sao_Paulo` é o que faz o `-03:00` que a
spec pede ser verdadeiro em vez de decorativo. Carimbar `-03:00` num horário UTC
adianta tudo em três horas.

Append `store/ledger.jsonl` (JSONL append-only). Eventos: `scan-started`, `scan-aborted`,
`scan-finished`, `brief-created`, `skip-redundant`, `skip-validation-failed`, `skip-low-score`,
`skip-out-of-scope`, `brief-schema-invalid`. Schema canônico em spec 005 §18.

- **Borderline (calibração §11.V)**: `promote-borderline` gera um `brief-created` normal, com
  `extra.borderline: true` (e `extra.match_score` + `extra.borderline_reason`) — assim a métrica
  de aprovação humana pode separar borderline de promote pleno nos 2 ciclos de medição
  (docs/calibracao-matcher.md §5). `promote-to-brief` grava `extra.borderline: false`.

## NÃO faça

- ❌ Publicar no IG.
- ❌ Chamar Open Design API (`/api/chat` etc).
- ❌ Subir foto pro Cloudinary (isso é `radar-handoff`, spec 007).
- ❌ Editar briefs existentes em `pendente-aprovacao/` (briefer nasce do zero; humano edita à mão).
- ❌ Rodar dois `radar-scan` em paralelo no mesmo `week_key` (race no `NNN` — §20 gotcha 1).
- ❌ Buscar fora de `manifest.search_scopes[scope].sources`.
- ❌ Inventar args novos sem atualizar a spec 005 primeiro.
