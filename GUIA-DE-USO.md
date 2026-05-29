# Guia de uso — content-radar

Como rodar o pipeline de descoberta de pautas da Avanz Imóveis do começo ao
fim, comando por comando. Inclui o modo **sem Cloudinary** (placeholder).

> Para o *porquê* de cada decisão, leia a spec
> [`docs/specs/001-foundation.md`](./docs/specs/001-foundation.md). Este guia é
> só o *como*.

---

## 1. O que o content-radar faz (e o que NÃO faz)

O radar transforma **conteúdo público do mercado imobiliário** em **briefs de
post de feed do Instagram** prontos para um humano levar ao **Smart Design**
(Open Design @ `design.consultorivandias.com.br`) e publicar manualmente.

A entrega final **não é o post** — é um **package** (`store/packages/<slug>/`)
com o brief, a foto hero e o passo-a-passo de operação.

**O radar FAZ:**
- Pesquisa fontes públicas (escopos definidos em [`manifest.yaml`](./manifest.yaml)).
- Cruza o achado com a estratégia da Avanz e dá um score de match.
- Escreve briefs em `.md` + baixa candidatos de imagem localmente.
- Sobe a foto escolhida pro Cloudinary e monta o package de entrega.

**O radar NÃO faz:**
- ❌ Não publica no Instagram (publicação é **manual**).
- ❌ Não chama a API do Open Design no 1º slice (humano opera a web UI).
- ❌ Não inventa fontes fora de `manifest.search_scopes.*.sources`.
- ❌ Não gera Pilar 4 (Bastidor) — isso é stories, decisão humana.

---

## 2. Os 4 estágios do pipeline

```
  internet                vault Avanz              vault + prompts
     │                        │                          │
     ▼                        ▼                          ▼
┌──────────────┐      ┌──────────────┐           ┌──────────────┐
│ 1. RESEARCHER│ ───► │ 2. MATCHER   │ ──(skip── │ 4. BRIEFER   │
│ WebSearch +  │      │ score + pilar│  redund.) │ copy + visual│
│ WebFetch     │      │ + ICP + why  │           │ + hero local │
└──────────────┘      └──────────────┘           └──────────────┘
  findings JSON         ranked JSON                 brief .md
                                                        │
                                                        ▼
                                    store/briefs/pendente-aprovacao/<slug>.md
                                    store/media/pendente-aprovacao/<slug>__N.jpg
```

> O estágio 3 (planner) **não existe no 1º slice** — distribuição multi-pauta
> fica para a spec 011. Hoje o briefer roda direto após o matcher.

Cada estágio é um **subagente** em [`.claude/agents/`](./.claude/agents/):
`market-researcher`, `avanz-matcher`, `instagram-briefer`. Você não os chama à
mão — a skill `radar-scan` orquestra os três via `Task`.

---

## 3. Ciclo de vida de um brief (diretórios físicos)

O estado de cada pauta **é a pasta onde o arquivo está**:

```
                  radar-scan
                      │
                      ▼
        store/briefs/pendente-aprovacao/   ◄── saída fresca; aguarda você revisar
                      │
        você revisa o .md, edita copy, define hero_choice
                      │
            ┌─────────┴──────────┐
       radar-mv approve     radar-mv reject
            │                    │
            ▼                    ▼
   pendente-publicacao/      rejeitado/   ◄── terminal, sem mídia (anti-repetição 30d)
            │
       radar-handoff   (sobe Cloudinary + gera package; NÃO move o brief)
            │
   você abre o Smart Design, gera o post, publica no IG manualmente
            │
       (mv manual p/ publicado/ — radar-mark-published é spec 008, ainda não existe)
```

Toda transição feita por skill grava um evento em
[`store/ledger.jsonl`](./store/ledger.jsonl). Se você fizer `mv` cru na mão, o
ledger fica inconsistente — **prefira as skills**.

---

## 4. Pré-requisitos

1. **cwd dentro de `/srv/apps/content-radar/`** — é o que faz o Claude Code
   descobrir as skills e subagentes em `.claude/`.
2. Ferramentas de shell: `curl`, `jq`, `sha1sum`, `awk` (já no servidor).
3. Para upload real: arquivo `.local/cloudinary.env` (ver §7). **Sem ele,
   use o modo placeholder** — o pipeline roda inteiro mesmo assim.

As skills são invocadas digitando `/<nome>` no Claude Code (ou pedindo "roda o
radar-scan ..."). Os argumentos abaixo são o `argument-hint` de cada skill.

---

## 5. Passo a passo completo

### Passo 1 — Gerar pautas: `radar-scan`

```
/radar-scan --scope=trends --pillar=6-mercado-rmbh
```

**Argumentos** (de [`.claude/skills/radar-scan/SKILL.md`](./.claude/skills/radar-scan/SKILL.md)):

| Arg | Obrigatório | Valores | Default |
|---|---|---|---|
| `--scope` | sim | `trends`, `competitors`, `seasonal`, `cases`, `local` | — |
| `--pillar` | não | `1-imovel`, `2-decisao`, `3-inteligencia`, `5-quem-comprou`, `6-mercado-rmbh` | todos |
| `--target-count` | não | inteiro | `manifest.funnel.candidates_per_week_target` (=10) |
| `--dry-run` | não | flag | off |
| `--scan-id` | não | string | auto (`<YYYY-Www>-scan-<NNN>`) |

> `--pillar=4-bastidor` é **erro fatal** de propósito (Bastidor está fora do
> escopo do radar).

**Sempre comece com `--dry-run`** para ver o plano sem efeitos colaterais:

```
/radar-scan --scope=trends --pillar=6-mercado-rmbh --dry-run
```

Em dry-run a skill **não** invoca subagentes, **não** escreve em `store/` e
**não** toca no ledger — só relata o que faria.

**O que acontece sem dry-run:** researcher busca → matcher pontua e descarta
redundantes/baixo-score → briefer escreve os briefs aprovados. Resultado:

- `store/briefs/pendente-aprovacao/<slug>.md` (um por pauta promovida)
- `store/media/pendente-aprovacao/<slug>__N.{jpg|png|webp}` (candidatos de imagem)
- eventos no `store/ledger.jsonl` (`scan-started`, `brief-created`, `skip-*`, `scan-finished`)

### Passo 2 — Revisar (você, na mão)

Abra cada `.md` em `store/briefs/pendente-aprovacao/`, leia a copy
(headline / hook / caption / CTA) e o `visual_brief`. Edite o que quiser
direto no arquivo. **Antes de aprovar, defina `hero_choice` no frontmatter:**

- `hero_choice: 0` (ou `1`, `2`...) → usa o candidato de imagem N.
- `hero_choice: null` → sem foto; o Smart Design gera/usa template.

> `hero_choice` **precisa estar presente** para aprovar. Default implícito é
> erro (decisão de uso explícito da foto).

### Passo 3 — Aprovar ou rejeitar: `radar-mv`

```
/radar-mv 2026-W22-001 approve
/radar-mv 2026-W22-003 reject --reason="fonte fraca, dado não confere"
```

**Argumentos** (de [`.claude/skills/radar-mv/SKILL.md`](./.claude/skills/radar-mv/SKILL.md)):

| Arg | Obrigatório | Observação |
|---|---|---|
| `<slug>` | sim | slug completo **ou prefixo único** (resolvido por glob) |
| `approve` \| `reject` | sim | direção da transição |
| `--reason="..."` | não | vai pro `review_notes` (reject) / `extra.reason` (ledger) |
| `--dry-run` | não | plano apenas |

- **approve:** move o `.md` para `pendente-publicacao/`, move **só** a foto
  escolhida para `media/pendente-publicacao/` e **apaga os demais candidatos**.
- **reject:** move o `.md` para `rejeitado/` e **apaga todas** as mídias do
  candidato. `rejeitado/` é terminal (preserva o `.md` por 30d p/ anti-repetição).

### Passo 4 — Empacotar para o Smart Design: `radar-handoff`

```
/radar-handoff                 # batch: todos os elegíveis (handoff_at == null)
/radar-handoff 2026-W22-001    # só um brief
```

**Argumentos** (de [`.claude/skills/radar-handoff/SKILL.md`](./.claude/skills/radar-handoff/SKILL.md)):

| Arg | Obrigatório | Observação |
|---|---|---|
| `<slug>` | não | sem arg = batch sobre todos elegíveis em `pendente-publicacao/` |
| `--force` | não | re-roda upload + package mesmo se já entregue |
| `--dry-run` | não | plano apenas, sem efeitos |
| `--placeholder-mode` | não | **roda sem Cloudinary** (ver §7) |

O que faz para cada brief elegível:
1. Resolve a foto (`hero_choice`). Se `null`, pula o upload.
2. Sobe a foto pro Cloudinary (signed upload, sem SDK).
3. Valida que `od_skill_ref` existe em `/srv/apps/open-design/skills/<skill>/SKILL.md`.
4. Gera `store/packages/<slug>/` com `README.md` (passo-a-passo), `brief.md`
   simplificado, `hero.<ext>`, `hero.cloud-url.txt`, `od-skill-ref.txt`.
5. Atualiza o frontmatter do brief: `handoff_at`, `package_path`, `cloud_url`,
   `cloudinary_public_id`.

> **Importante:** o handoff **não move** o brief. Ele continua em
> `pendente-publicacao/`. É **idempotente**: re-rodar sem `--force` pula quem
> já tem `handoff_at`.

### Passo 5 — Operar o Smart Design e publicar (você, na mão)

Abra `store/packages/<slug>/README.md` e siga o passo-a-passo: abrir
`design.consultorivandias.com.br`, escolher a skill recomendada, colar o brief,
subir a foto (baixar do `cloud_url` se preciso), gerar a arte, exportar e
**publicar no Instagram manualmente**.

> O fechamento do ciclo (`mv` para `publicado/` via `radar-mark-published`)
> ainda não está implementado (spec 008). Por enquanto é `mv` manual.

---

## 6. Receita rápida (caminho feliz)

```
# 1. ver o plano
/radar-scan --scope=trends --pillar=6-mercado-rmbh --dry-run

# 2. gerar de verdade
/radar-scan --scope=trends --pillar=6-mercado-rmbh

# 3. revisar os .md em store/briefs/pendente-aprovacao/ e setar hero_choice

# 4. aprovar os bons
/radar-mv 2026-W22-001 approve

# 5. empacotar (com Cloudinary)
/radar-handoff

# 6. abrir store/packages/<slug>/README.md e operar o Smart Design
```

---

## 7. Rodando SEM Cloudinary (modo placeholder)

A conta Cloudinary dedicada da Avanz ainda está **aguardando provisionamento**
(`manifest.yaml` → `cloudinary.status: aguardando-provisionamento`). Você não
precisa esperar por ela: **todo o pipeline roda sem Cloudinary**.

**Quem precisa do Cloudinary?** Só o `radar-handoff`, e só para subir a foto
hero. `radar-scan` e `radar-mv` **não tocam no Cloudinary** — rodam normalmente.

### Como rodar o handoff sem credenciais

```
/radar-handoff --placeholder-mode
```

O que muda:
- **Não** chama o Cloudinary.
- Gera o package normalmente, mas com `cloud_url: "<PENDING_CLOUDINARY>"`.
- A foto local (`hero.<ext>`) é copiada pro package mesmo assim — dá pra operar
  o Smart Design fazendo upload da foto local direto, sem URL pública.
- O `README.md` do package instrui o humano sobre o estado pendente.

> Se você rodar `/radar-handoff` **sem** `--placeholder-mode` e **sem** o
> arquivo `.local/cloudinary.env`, a skill **aborta** com erro claro. O
> placeholder é justamente o caminho oficial enquanto não há conta.

### Quando a conta Cloudinary chegar

1. Crie `.local/cloudinary.env` (gitignored) com:
   ```bash
   CLOUDINARY_CLOUD_NAME=<cloud_name>
   CLOUDINARY_API_KEY=<api_key>
   CLOUDINARY_API_SECRET=<api_secret>
   # opcional — default content-radar/avanz
   CLOUDINARY_FOLDER=content-radar/avanz
   ```
2. Preencha `cloud_name` em `manifest.yaml` (`cloudinary.cloud_name`).
3. Re-rode o handoff com `--force` para subir as fotos e trocar os
   `<PENDING_CLOUDINARY>` pelas URLs reais:
   ```
   /radar-handoff --force
   ```

> **Segurança:** `.local/` é gitignored. **Nunca** commite o
> `cloudinary.env` nem imprima o `CLOUDINARY_API_SECRET` em log/erro/ledger.

---

## 8. `--dry-run` em qualquer skill

`radar-scan`, `radar-mv` e `radar-handoff` aceitam `--dry-run`. Em dry-run a
skill **só relata o plano**: nada de subagentes, escrita em `store/`, upload ou
ledger. Use sempre que estiver inseguro sobre o que vai acontecer.

---

## 9. Onde olhar quando algo der errado

| Sintoma | Onde checar |
|---|---|
| Skill não aparece com `/` | cwd está dentro de `/srv/apps/content-radar/`? |
| `--pillar=4-bastidor` falha | é esperado — Pilar 4 é fora de escopo |
| Scan não gera nenhum brief | provável skip por redundância / baixo score — veja `store/ledger.jsonl` (`skip-*`) |
| Handoff aborta sem subir foto | falta `.local/cloudinary.env` → use `--placeholder-mode` |
| Histórico de transições | `store/ledger.jsonl` (append-only, 1 evento por linha) |
| Anti-repetição "comeu" a pauta | checa os 4 dirs de `store/briefs/` — colisão de `topic_hash` |

---

## 10. Referências

- Spec normativa: [`docs/specs/001-foundation.md`](./docs/specs/001-foundation.md)
- Integração downstream: [`INTEGRACAO-OPEN-DESIGN.md`](./INTEGRACAO-OPEN-DESIGN.md)
- Config do projeto: [`manifest.yaml`](./manifest.yaml)
- Skills: [`.claude/skills/`](./.claude/skills/) · Subagentes: [`.claude/agents/`](./.claude/agents/)
</content>
</invoke>
