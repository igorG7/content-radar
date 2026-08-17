# web — painel editorial do content-radar

Next 16 (App Router, Turbopack) + React 19. Sem banco: toda página é
`force-dynamic` e relê `store/briefs/**`, `store/media/**` e `store/ledger.jsonl`
do disco a cada request.

O layout é a implementação do protótipo em [`../content-radar/`](../content-radar/)
— o `README.md` de lá é o contrato do template e o `brand-spec.md` fixa a paleta.

```bash
npm run dev     # http://localhost:3000
npm run build
npx vitest run          # unidades de lib/
npx tsx scripts/smoke.mts   # invariantes contra o store real
```

## Rotas

| Rota | Tela |
|---|---|
| `/` | Painel: contadores por estado, prévia da fila, saúde do fluxo, ledger recente, briefs ilegíveis |
| `/fila` | Fila de aprovação — atalhos de teclado, escolha de arte, aprovar/rejeitar, lote |
| `/acervo` | Abas por estado, agrupamento por semana, janelas de anti-repetição |
| `/briefs/[state]/[slug]` | Detalhe: score decomposto, copy, arte, procedência, prévia e linha do tempo |
| `/briefs/[state]/[slug]/editar` | Editor de copy e visual brief, com diff e savebar |
| `/ledger` | Auditoria: eventos append-only, filtros, JSONL cru |
| `/chat` | Chat com o agente — casca: conversas, anexos, modelo/esforço e interrupção, sem endpoint |
| `/perfil` | Perfil: identidade, preferências, atividade humana do ledger, sessão |
| `/config` | Configuração › Operação (patch cirúrgico no `manifest.yaml`) |
| `/config/vault`, `/config/vault/[bloco]`, `/config/vault/documento` | Configuração › Vault — casca, blocos no `localStorage` |
| `/login` | Login fora do shell — casca, sem credencial verificada |

## Camadas

- `app/globals.css` — design system inteiro: tokens dos dois temas e todos os
  componentes. **Nenhum hex fora do bloco `:root`.**
- `lib/store/index.ts` — a camada de armazenamento. Página nenhuma monta
  caminho: tudo pede em termos de domínio (`listarFila`, `buscarBrief`,
  `aplicarTransicao`).
- `lib/view/brief-view.ts` — ponte entre o frontmatter real e o formato que as
  telas consomem. É o único lugar que traduz nome de campo.
- `lib/vault/*` — catálogo dos blocos do vault (casca; a persistência real está
  desenhada em `docs/design-vault-onboarding.md`).
- `components/ui/*` — primitivas compartilhadas: toast, modal com focus trap,
  score bar, tile de mídia, prévia do Instagram, prosa.

## O que ainda não passa pela web

Marcar como publicado e gerar o pacote de handoff continuam sendo das skills
(`radar-mark-published`, `radar-handoff`): a UI valida a entrada e diz qual
comando fecha o ciclo. Reverter uma transição também é operação de terminal.
