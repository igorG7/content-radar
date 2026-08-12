# Prompt de handoff — interface completa do content-radar (app web)

> Cole o conteúdo abaixo (da linha `---` em diante) como prompt para o agente
> Claude com skills de frontend. Ele assume acesso ao repositório
> `/srv/apps/content-radar` e trabalho dentro de `web/`.

---

## Contexto: o que é este produto

`content-radar` é um pipeline editorial que descobre pautas de mercado
imobiliário da RMBH (Região Metropolitana de Belo Horizonte) e as transforma em
**briefs de post de feed do Instagram** para a **Avanz Imóveis** (lotes, sítios
e chácaras na RMBH; casas prontas apenas MCMV com simulação Caixa prévia).

O pipeline roda como agentes/skills do Claude Code em 4 estágios —
`market-researcher` → `avanz-matcher` → `instagram-briefer` → materialização —
e grava tudo **em arquivos no disco**: um `.md` com frontmatter YAML por brief.

A entrega final NÃO é o post pronto. É um *package* que um humano leva para o
sistema downstream **Open Design ("Smart Design")**, onde a arte é gerada. A
publicação no Instagram é manual.

**A app web é o painel humano desse fluxo.** Ela existe para que o editor não
precise abrir terminal para revisar, editar, aprovar e rejeitar pautas.

### Decisão arquitetural fundamental (não mudar)

**Não há banco de dados.** A fonte da verdade é o filesystem:

- `store/briefs/<estado>/<slug>.md` — um markdown com frontmatter YAML rico por brief
- `store/media/<estado>/` — cache de imagens candidatas (gitignored; pode faltar)
- `store/ledger.jsonl` — append-only, um evento JSON por linha (auditoria)
- `manifest.yaml` (raiz do projeto) — toda a configuração operacional

A app **lê e escreve esses arquivos diretamente**, preservando comentários do
YAML nas edições de config. Toda página é `export const dynamic = "force-dynamic"`.
Não introduza Prisma, SQLite, Supabase, nem cache persistente.

## Máquina de estados dos briefs

Quatro diretórios = quatro estados. As transições são físicas (move de arquivo)
e sempre geram evento no ledger:

```
pendente-aprovacao  ──approve──▶  pendente-publicacao  ──(skill radar-mark-published)──▶  publicado
        │
        └──reject──▶  rejeitado
```

- **pendente-aprovacao** — fila ativa de revisão humana. É aqui que o editor gasta o tempo dele.
- **pendente-publicacao** — aprovado, aguardando handoff/publicação manual.
- **publicado** — fechado; guarda `ig_post_url` e `published_at`.
- **rejeitado** — preservado para histórico e checagem de anti-repetição.

Regras que a UI precisa respeitar:

- `hero_choice` (escolha da foto) precisa ser uma **decisão da sessão humana** antes de aprovar.
  O gerador escreve `hero_choice: null` por padrão, então um `null` no arquivo é
  indistinguível de "ninguém decidiu". A UI já modela isso como
  `Pick = number | "none" | undefined`. **Preserve essa semântica.**
- `hero_choice: null` é uma escolha válida e comum: significa "card só-tipografia,
  o Open Design compõe a arte sem foto".
- Aprovar mantém só a foto escolhida e apaga as demais; rejeitar apaga todas as mídias.
- Briefs `borderline: true` (score entre 0.48 e 0.55) chegam à fila justamente
  para o humano decidir — precisam de destaque visual claro, não de escondimento.
- Mídia declarada no frontmatter pode não existir em disco (cache purgado). A UI
  já emite `warnings` por brief; eles devem aparecer, não sumir.

## Estado atual da implementação (`web/`)

Next.js **16.3** (App Router, React 19.2, Server Components por padrão),
TypeScript, **Tailwind v4** (`@import "tailwindcss"` — sem `tailwind.config.js`;
tokens em `app/globals.css`), `zod` v4 para validação, `yaml` para o manifest,
`vitest` para testes de lógica pura, fontes Geist Sans/Mono.

⚠️ Leia `web/AGENTS.md`: esta versão do Next tem breaking changes em relação ao
seu conhecimento prévio. Consulte `node_modules/next/dist/docs/` antes de escrever
código de framework. Note que `LayoutProps<"/">` e `params: Promise<{...}>` já são
usados no código existente.

### Rotas hoje

| Rota | Tipo | O que faz |
|---|---|---|
| `/` | server | Dashboard: contadores por estado, prévia da fila (6 itens), saúde do fluxo, últimos 10 eventos do ledger, lista de briefs ilegíveis |
| `/fila` | server | Fila de aprovação — lista de `BriefCard` interativos |
| `/fila/[slug]` | server | Página de detalhe de um brief da fila |
| `/fila/[slug]/editar` | server+form | Edição do brief pendente de aprovação |
| `/briefs` | server | Acervo — abas por estado (`?estado=`) para aprovados/publicados/rejeitados |
| `/briefs/[state]/[slug]` | server | Detalhe read-only do acervo |
| `/briefs/pendente-publicacao/[slug]/editar` | server+form | Edição de brief já aprovado |
| `/chat` | client | **Casca sem backend** — chat com o agente editorial, hoje só ecoa mensagem fixa |
| `/config` | server+form | Edita `manifest.yaml` direto, preservando comentários |

### APIs hoje

| Endpoint | Método | Efeito |
|---|---|---|
| `/api/briefs/[slug]/hero` | PATCH | Grava `hero_choice` no frontmatter |
| `/api/briefs/[slug]/transition` | POST `{direction: approve\|reject, reason?, dryRun?}` | Move o arquivo, remaneja mídia, escreve no ledger |
| `/api/brief-editor/[state]/[slug]` | PATCH | Edita campos de copy + `visual_brief` (só nos dois estados editáveis) |
| `/api/config` | PATCH `{edits:[{path,value}]}` | Patch cirúrgico no `manifest.yaml`, validado antes de gravar |
| `/api/media/[state]/[file]` | GET | Serve imagem do cache fora de `public/`, com guarda anti-traversal |

### Camadas

- `lib/manifest.ts` — schema zod do manifest, `BRIEF_STATES`, `resolvePaths()`, `RADAR_ROOT`
- `lib/store/briefs.ts` — parsing do frontmatter em `Brief` tipado, `listState`/`listAllStates`, coleta de `warnings` e `failures`
- `lib/store/frontmatter.ts` — leitura e reescrita cirúrgica de campos
- `lib/store/ledger.ts` — leitura do JSONL
- `lib/transitions/mv.ts` — regras duras de approve/reject (porta da skill `radar-mv`), com testes
- `lib/config/{manifest-edit,validate}.ts` — patch YAML preservando comentários + validação, com testes
- `components/queue-types.ts` + `brief-mapper.ts` — fronteira server→client: **caminhos absolutos de disco nunca cruzam para o cliente**

### Design system atual

`app/globals.css` (≈590 linhas) define uma paleta própria em CSS custom
properties, com tema claro e escuro (`:root[data-theme="dark"]`, aplicado por
script inline no `<head>` para evitar flash) e um `ThemeToggle` client-side que
persiste em `localStorage`.

Paleta: `--ink #0d1321`, `--space #1d2d44`, `--slate #3e5c76`, `--denim #748cab`,
`--eggshell #f0ebd8`, `--canvas #f8f6ee`. Estética editorial/impressa: cantos de
8px, linhas finas de 1px, quase nenhuma sombra, tipografia com peso alto,
números tabulares. Classes utilitárias próprias: `.app-shell`, `.app-nav`,
`.app-container`, `.panel`, `.surface`, `.row`, `.pill`, `.button-primary`,
`.button-secondary`, `.button-danger`, `.field`, `.alert-warning`,
`.alert-danger`, `.eyebrow`, `.muted`.

## O que você precisa entregar

Uma **interface completa e coerente** sobre essa base. Não é um redesign do
zero: mantenha a identidade visual e as decisões de arquitetura acima. O trabalho
é elevar a app de "funcional" para "produto acabado", cobrindo os buracos.

### 1. Consolidar o design system

Hoje o CSS cresceu por acréscimo — há blocos `:root` repetidos, três
redefinições encadeadas de `.theme-toggle`, e nomes de token inconsistentes
(`--text-muted` é referenciado em `.route-history` mas nunca definido; o correto
é `--muted`). O navbar está **copiado e colado em 5 páginas**, cada cópia
decidindo manualmente qual link recebe `button-primary`.

- Extraia um `<AppShell>` / `<AppNav>` único com estado ativo derivado da rota
  (`usePathname` ou prop), incluindo o badge de contagem da fila.
- Reorganize os tokens em um bloco só por tema, com nomes semânticos coerentes
  e sem duplicação; corrija os tokens órfãos.
- Documente os componentes primitivos (botão, pill, painel, campo, alerta) —
  seja como componentes React tipados, seja como camadas Tailwind v4. Escolha um
  caminho e aplique em toda a app; hoje há mistura de classe utilitária própria
  com utilitário Tailwind arbitrário (`text-[var(--text-strong)]`) repetido dezenas de vezes.
- Garanta paridade real claro/escuro em todos os estados, inclusive `:disabled`,
  `:focus-visible` e hover.

### 2. Fila de aprovação — a tela que mais importa

É onde o editor decide 10 pautas por semana. Precisa ser rápida e legível.

- Filtros e ordenação: por pilar, por ICP, por score, por borderline, por
  presença de mídia em cache, por data. Estado na URL (`searchParams`), não em
  React state, para ser compartilhável e sobreviver ao `router.refresh()`.
- Busca textual sobre headline/hook/caption.
- Visualização do score: hoje aparece só o número. O frontmatter traz
  `match_score_breakdown` (5 componentes ponderados) e `source_relevance_hints`
  (evidência textual por componente). Isso merece uma visualização compacta —
  barra de composição ou mini-tabela — que explique *por que* o score é aquele.
  Se for construir gráfico, **carregue antes a skill `dataviz`**.
- Seleção da arte candidata: melhorar a grade atual (thumbnails 3-colunas) com
  preview ampliado, `alt`, `license_hint` e o aviso de `licensable: false` visível
  — usar imagem de veículo de imprensa tem implicação legal, o editor precisa ver isso.
- Ações em lote seriam úteis, mas cada transição escreve no ledger — se
  implementar, faça sequencial e com relatório por item.
- Feedback de estado: hoje o approve/reject faz `router.refresh()` sem
  confirmação visual. Precisa de estado otimista, toast/undo quando possível, e
  mensagem de erro legível quando a regra dura da transição recusa (a API devolve
  422 com `code`).

### 3. Detalhe do brief

O objeto `QueueBrief` tem ~25 campos e hoje são despejados em uma coluna longa.
Reorganize em uma leitura hierárquica: **decisão** (score, breakdown, borderline,
why_match, redundância) → **copy** (headline, hook, caption, hashtags, CTA) →
**arte** (candidatas, visual_brief com must_have/avoid_visual/aspect_ratio,
`od_skill_ref` e alternativas) → **procedência** (source_urls, source_excerpts,
scan_id, created_at, origin).

Preview do post: vale muito mostrar como a caption fica em formato Instagram
(largura de coluna, quebra em "ver mais" a ~125 caracteres, hashtags separadas)
e a proporção da arte segundo `visual_brief.aspect_ratio` (1:1 padrão, mas há
briefs com 3:4). Contadores de caracteres na headline e caption.

Há hoje duas apresentações concorrentes do mesmo conteúdo — `BriefDetail`
(modal) e a página `/fila/[slug]`. Unifique o conteúdo em um componente só.

### 4. Editor de brief

`brief-edit-form.tsx` cobre os campos, mas de forma crua. Precisa de: dirty
state e aviso ao sair, validação alinhada aos limites do zod da API
(headline 240, hook 1200, caption 8000, até 40 hashtags), editor de hashtags como
chips, editor de listas (`must_have` / `avoid_visual`) com adicionar/remover/reordenar,
e salvamento com feedback claro. Diferencie visualmente editar um brief **em
fila** de editar um **já aprovado** — o segundo é mais sensível.

### 5. Acervo

Hoje é uma lista simples com abas. Precisa de busca, filtros por pilar/ICP/período,
e — dado que o anti-repetição olha janelas de 14/30/90 dias — uma visão temporal:
agrupamento por semana ISO (o `brief_id` já é `AAAA-Wnn-nnn`) ou timeline. Ajuda
o editor a ver o que já foi publicado antes de aprovar algo parecido.

### 6. Ledger / auditoria

Existe só como "últimos 10 eventos" no dashboard, com tipos de evento crus
(`mv-approved`, `handoff-finished`, `brief-corrected`, `published`, `mv-rejected`).
Merece uma tela própria: filtro por brief, por ator (`human:*`, `skill:*`,
`app:radar-web`), por tipo; e o campo `extra` (JSON arbitrário e às vezes rico —
razões de rejeição, notas de correção, avisos) exibido de forma legível.
No detalhe de cada brief, mostre a linha do tempo daquele brief específico.

### 7. Configuração

`ConfigForm` já edita alvo semanal, `match_score_min`, `borderline_min`, pesos
e escopos de busca. Falta: feedback de que os 5 pesos precisam somar 1.0
(hoje o backend valida, a UI não antecipa), edição das fontes por escopo com o
mapeamento chave→domínio que hoje só existe como comentário no YAML, exibição
dos `warnings` de validação de forma acionável, e um diff/preview antes de gravar
— é o arquivo que governa o comportamento de todo o pipeline.

### 8. Chat com o agente

Hoje é casca (`agent-chat.tsx` responde com texto fixo). **Não invente o
backend** — não existe endpoint. Entregue a interface pronta para plugar em
streaming: estado de "pensando", render de markdown, mensagens de ferramenta/ação,
histórico, e um contrato de props/tipos explícito que o backend futuro vai
preencher. Deixe evidente na UI que está desconectado.

### 9. Transversal

- **Loading e vazio**: toda página é `force-dynamic` e lê disco a cada request.
  Adicione `loading.tsx` / Suspense e estados vazios com texto útil, não só
  "Nada pendente".
- **Erro**: `error.tsx` por segmento. Hoje um brief ilegível é reportado, mas um
  `manifest.yaml` inválido derruba a página inteira com stack trace do zod.
- **Responsivo**: a app é usada no desktop, mas revisar a fila no celular é caso
  real. Nada pode estourar horizontalmente; tabelas e grades de mídia precisam
  se adaptar.
- **Acessibilidade**: foco visível já existe; falta rigor em labels, `aria-live`
  nas ações assíncronas, ordem de foco em modal (hoje `BriefDetail` não tem focus
  trap nem fecha no `Esc`), e contraste verificado nos dois temas.
- **Atalhos de teclado** na fila (`j`/`k`, `a` aprovar, `r` rejeitar, `1..n`
  escolher foto) — o fluxo é repetitivo o suficiente para justificar.

## Restrições

- **Idioma**: toda a interface em **português do Brasil**. Código (identificadores
  e comentários) em **inglês**.
- **Sem dependências pesadas novas** sem justificar: nada de MUI, Chakra ou
  bibliotecas de componentes inteiras. Radix/Headless UI para primitivos
  acessíveis (dialog, popover) é aceitável e provavelmente desejável.
- **Server Components por padrão**; `"use client"` só onde há interação real.
  Mantenha a fronteira de `brief-mapper.ts`: caminhos absolutos de disco e
  qualquer coisa de servidor não vazam para o cliente.
- **Não mexa na lógica de negócio** de `lib/transitions/mv.ts`,
  `lib/config/manifest-edit.ts` e `lib/store/frontmatter.ts` — são as regras
  duras portadas das skills, têm testes, e uma mudança lá corrompe arquivos do
  store. Se precisar de dado novo, estenda o mapper/loader.
- **Escrita em disco é destrutiva e real**: aprovar apaga mídia, rejeitar apaga
  mídia, editar config reescreve o `manifest.yaml`. Não experimente contra o
  store real; use cópias em `/tmp`. Existe `RADAR_ROOT` para apontar a app para
  outra raiz.
- Commits em Conventional Commits, em inglês.

## Ordem sugerida

1. Design system consolidado + `AppShell`/`AppNav` (destrava todo o resto)
2. Fila de aprovação (maior retorno por esforço)
3. Detalhe unificado do brief + preview do post
4. Editor de brief
5. Acervo + ledger
6. Configuração
7. Chat (casca polida)
8. Passe transversal: loading/erro/vazio, responsivo, a11y, atalhos

## Como validar

```bash
cd /srv/apps/content-radar/web
npm run dev     # http://localhost:3000 — store real, cuidado com ações destrutivas
npm run build   # precisa passar
npm run lint
npx vitest run  # testes de lib/transitions e lib/config
npx tsx scripts/smoke.mts
```

Há dados reais no store para testar: 14 briefs em `pendente-aprovacao`
(incluindo borderline e casos com mídia ausente), 2 em `pendente-publicacao`,
16 em `publicado`, 1 em `rejeitado`.

## Leitura obrigatória antes de começar

1. `web/AGENTS.md` — avisos sobre esta versão do Next
2. `CLAUDE.md` (raiz) — escopo, princípios, o que o radar não faz
3. `docs/specs/001-foundation.md` — spec da fundação
4. `manifest.yaml` — a configuração que a tela `/config` edita
5. Um brief real completo, ex.:
   `store/briefs/pendente-aprovacao/2026-W26-010_almg-debate-8-novos-colegios-tiradentes-na-rmbh-o-que-muda.md`
   — é a melhor forma de entender a riqueza do modelo de dados
6. `store/ledger.jsonl` (últimas linhas) — formato dos eventos
