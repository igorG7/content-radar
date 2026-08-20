# Pendências

> Estado em 2026-08-17, com o histórico até `dc4e116` mais a correção do
> frontmatter e os blocos, ainda não commitados. Ordenado por quem
> destrava quem, não por tamanho.

## Prontas para começar

**Migrações das tabelas operacionais.** `ambiente`, `usuario`, `brief`,
`brief_candidata`, `scan` e `evento` não dependem das decisões acima — só as
tabelas do vault dependem. DDL pronto em
[`design-esquema-banco.md`](./design-esquema-banco.md). Aplicar no `radar_dev`
e verificar o RLS com dados de duas empresas fictícias.

Duas escolhas técnicas menores no caminho: cliente de Postgres (`pg` puro ou
algo como Drizzle) e ferramenta de migração.

## Depois

**Fase 1 — importador.** 33 briefs, 208 eventos e o vault. Roda contra cópia
até as contagens baterem. Dois obstáculos já medidos: 32 eventos com `event`
dentro de `extra` (formato antigo) e frontmatter dobrado em 80 colunas. E um
terceiro descoberto no teste de RLS: **o importador roda como `radar_owner` e
esbarra no `FORCE ROW LEVEL SECURITY`** — precisa declarar `app.ambiente` a
cada lote.

**Fase 2 — backend de Postgres** atrás da interface `RadarStore`, e as fases
seguintes de [`design-migracao.md`](./design-migracao.md).

## Fase 4 — o que falta

**Uma execução real.** A credencial deixou de faltar: o SDK usa a autenticação
local do Claude Code, e uma sonda de um turno respondeu em 8s. O que ainda não
foi exercitado com saída de verdade: a detecção de estágio pela invocação do
subagente, a ingestão, e o carregamento das skills sob
`settingSources: ["project"]`. Falta só rodar — são 12 a 63 minutos e custo
real, então é decisão de quando, não de se dá.

**O processo trabalhador** existe (`web/scripts/trabalhador.mts`) e foi provado
ponta a ponta: reivindicou um pedido real, carimbou início, falhou pelo motivo
certo e liberou a vaga. Falta **subir sob pm2** e decidir o `kill_timeout` —
que depende da medição por estágio (design-execucao-scan §9.2).

**Conversa não é persistida.** O chat vive na aba: recarregar perde o
histórico. A memória do agente fica no servidor (a sessão do SDK), mas o
ponteiro para ela mora no navegador. Precisa de tabela e de decisão sobre
retenção.

**Purga do que subiu para o Cloudinary.** A escolha da arte agora sobe a foto
com `public_id` estável por brief, e guarda o `cloudinary_public_id`. Rejeitar
um brief apaga a mídia local, mas **não** apaga o objeto remoto — é o que a
purga precisa fazer, e é o primeiro trabalho concreto da housekeeping.

**`radar-housekeeping`** é a última skill determinística sem código — a purga
de mídia. É a de menor pressa: não move estado de brief nenhum.

As outras três saíram do repositório em 2026-08-20. `radar-mv` virou
`aplicarTransicao`, `radar-mark-published` virou `marcarPublicado`, e
`radar-handoff` virou `exportar` — que devolve **um `.md`** para download em vez
de escrever cinco arquivos em `store/packages/`. Eram código escrito em prosa:
mudança de estado com regra fixa quer transação, não um modelo decidindo.

**Injeção por ferramenta em vez de arquivo** — chegou pela metade, antes do
gatilho previsto. O **chat** já funciona assim: seis ferramentas sobre a camada
(`web/lib/chat/ferramentas.ts`), nenhuma delas tocando em arquivo, e o ambiente
nunca como argumento. O **executor do scan** continua materializando workspace,
porque as skills leem caminho relativo. O gatilho declarado para converter o
resto segue o segundo cliente ([`design-migracao.md`](./design-migracao.md)
§5.4).

## Soltas

- **`positioning.md` do vault da Avanz** cita `brand.json#/target_audience`
  como fonte de quatro perfis de ICP; o arquivo tem três. Fora deste
  repositório, e **não vamos alterar** — é espaço de trabalho do cliente. A
  migração resolve por construção: um bloco `publicos` só, sem onde a
  contradição morar. O que fica é o importador reportar divergência
  ([`design-migracao.md`](./design-migracao.md) §5).

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
