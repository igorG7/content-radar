# Pendências

> Estado em 2026-08-17, com o histórico até `8779093`. Ordenado por quem
> destrava quem, não por tamanho.

## Esperando decisão do owner

**Conjunto de blocos do vault.** Circulam três versões: 13 em
[`vault-avanz-referencia.md`](./vault-avanz-referencia.md), 12 em
`web/lib/vault/blocos.ts`, e o vault real da Avanz com outra divisão. O
importador precisa de uma só. Trava a fase 1.

**Conflito dos dois conjuntos de ICP.** `comprador`/`investidor`/`proprietario`
(o que o score pontua, em `prompts/icp-modifiers.json`) contra
`primeiro-comprador`/`sem-banco`/`sair-do-aluguel`/`investidor` (o que
`strategy/positioning.md` declara). Os dois entram no mesmo contexto do
briefer. São recortes diferentes, não sinônimos — escolher é decisão
editorial. Trava a fase 1.

## Em curso

**Atualização do layout.** Em outra sessão. Inclui uma página de perfil nova,
ainda não revisada aqui — as restrições do modelo (um usuário, um ambiente,
cadastro fechado, sem papéis) estão em
[`design-persistencia-multiusuario.md`](./design-persistencia-multiusuario.md) §2.

## Prontas para começar

**Corrigir `replaceFrontmatterFields`.** Reserializa o frontmatter inteiro e
dobra as linhas em 80 colunas — foi o que truncou a headline do `W26-010` e
obrigou o gerador do protótipo a trocar regex por PyYAML. A correção é usar
`patchScalars`, que já existe e é testado. Depois da migração das rotas, está
confinada a um lugar: `editarBrief`, em `web/lib/store/index.ts`.

**Migrações das tabelas operacionais.** `ambiente`, `usuario`, `brief`,
`brief_candidata`, `scan` e `evento` não dependem das decisões acima — só as
tabelas do vault dependem. DDL pronto em
[`design-esquema-banco.md`](./design-esquema-banco.md). Aplicar no `radar_dev`
e verificar o RLS com dados de duas empresas fictícias.

Duas escolhas técnicas menores no caminho: cliente de Postgres (`pg` puro ou
algo como Drizzle) e ferramenta de migração.

## Bloqueadas pelo layout

**Migrar as 9 páginas para a camada de armazenamento.** `app/(shell)/`:
`page.tsx`, `layout.tsx`, `fila`, `acervo`, `ledger`, `chat`, `config`, e as
duas de `briefs/[state]/[slug]`. Troca mecânica de `resolvePaths(manifest)` por
`radarStore()`. A outra sessão pode fazer na mesma passada.

**Ligar o teste de arquitetura.** Falha se algo fora de `lib/store/` importar
`resolvePaths`, `briefsDir` ou `mediaDir`. Só pode entrar quando a última
página migrar — antes disso falharia de propósito. É o que impede a costura de
se desfazer na primeira tela nova.

## Depois

**Fase 1 — importador.** 33 briefs, 208 eventos e o vault. Roda contra cópia
até as contagens baterem. Dois obstáculos já medidos: 32 eventos com `event`
dentro de `extra` (formato antigo) e frontmatter dobrado em 80 colunas. E um
terceiro descoberto no teste de RLS: **o importador roda como `radar_owner` e
esbarra no `FORCE ROW LEVEL SECURITY`** — precisa declarar `app.ambiente` a
cada lote.

**Fase 2 — backend de Postgres** atrás da interface `RadarStore`, e as fases
seguintes de [`design-migracao.md`](./design-migracao.md).

## Soltas

- **Conteúdo fictício no catálogo de blocos.** Em `web/lib/vault/blocos.ts`,
  públicos, pilares, temas e paleta não são os da Avanz — só `geografia` e
  `contato` têm dado real. Bom para maquete, perigoso se virar semente de
  importação.
- **`painel.png`** na raiz do repositório, sem destino definido.
- **`handoff_at` com download sob demanda** — hoje o carimbo torna a skill
  idempotente; com download repetível, falta decidir se registra o primeiro
  download ou deixa de existir.
- **Telemetria de consumo** — frente aberta mais antiga; trava cobrança e
  dimensionamento de fila.
- **Produção** — não decidida. Pode ser este mesmo servidor, já que a app vive
  aqui. Vale decidir quando houver um segundo cliente.
