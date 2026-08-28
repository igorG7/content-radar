# Pendências

> Estado em 2026-08-25. Ordenado por quem destrava quem, não por tamanho.

## O que falta

- **Fechar o cadastro antes do deploy** — a tela existe (`/cadastro`) e
  **não vai ser usada por enquanto**: a Avanz entra direto no banco de produção
  quando ele existir, e o cadastro é desligado junto. Detalhe abaixo.

- **Tela de consumo** — a medição já grava (ver abaixo); falta mostrar. Adiada
  de propósito até acumular execuções: tela de custo com tabela vazia não diz
  nada e ainda sugere que o custo é zero.

- **Retenção de conversas** — nada apaga conversa antiga, e ninguém decidiu por
  quanto tempo ficam.

- **Deploy.** O banco de produção está na VPS e verificado. Sobram a app de lá
  — credencial da Anthropic inclusa — e desativar produção nesta máquina, nessa
  ordem: a de cá é a única que roda scan hoje. O roteiro do banco virou dois
  scripts — `papeis-de-producao.mts` (papéis, segredos e conferência) e
  `migrar.mts` (migrações, mostrando o erro que o `drizzle-kit` engole):

  1. ~~**Criar o banco**~~ — feito. `radar_prod` existe com 15 migrações, 19
     tabelas com RLS + FORCE, e papéis próprios: `radar_app_prod` e
     `radar_owner_prod`, os únicos que conectam nele. Os dados da Avanz estão
     lá — 34 briefs, 10 blocos de vault, 6 pilares, 22 fontes, 135 temas.
  2. ~~**Backup**~~ — feito. `web/scripts/backup-producao.sh` roda como
     `postgres`, grava em `/srv/backups/content-radar` (disco separado do
     banco), confere linha a linha o dump contra a base e guarda como
     `.SUSPEITO` o que divergir. Primeira cópia validada: 34 briefs, 225
     eventos, 10 blocos.

     Falta só agendar, no cron do root:

     `0 3 * * * su postgres -c /srv/apps/content-radar/web/scripts/backup-producao.sh`

     Duas coisas que a conferência existe para pegar, e que já morderam: um
     `pg_dump` como `radar_owner` sai **vazio** por causa do FORCE RLS, com
     tamanho plausível; e o arquivo nasce legível por qualquer conta do
     servidor se ninguém apertar o modo — ele carrega conteúdo de cliente e
     hash de senha.
  3. ~~**Segredos**~~ — gerados. `scripts/papeis-de-producao.mts` escreve
     `web/.env.producao` (600, fora do git) com `SESSION_SECRET` novo, papéis
     próprios do Postgres — `radar_app_prod` e `radar_owner_prod`, e só eles
     conectam em `radar_prod` — e o prefixo do Cloudinary. As chaves do
     Cloudinary passaram para o `.env` de cada instalação — o arquivo à parte
     era um terceiro lugar guardando o mesmo segredo, e um mecanismo a mais para
     quem fosse fazer deploy descobrir. `.local/` ficou vazio.

     Duas coisas vieram junto porque a separação não funcionaria sem elas.
     Os privilégios de aplicação passaram a morar no grupo `radar_apps`: as
     migrações revogavam `UPDATE`/`DELETE` de `evento` e `consumo` citando
     `radar_app` pelo nome, e um papel novo nasceria com esses privilégios
     intactos — append-only é a garantia cuja quebra não aparece, o ledger
     continua gravando e só deixa de valer como registro. E o prefixo do
     Cloudinary passou a existir de fato: o `public_id` era
     `<ambiente>/<brief>`, igual nos dois bancos, que saíram da mesma cópia; com
     `overwrite`, uma varredura em dev trocaria a imagem publicada do mesmo
     brief, e uma purga a apagaria.

  4. ~~**Apontar a app e o trabalhador**~~ — feito, e verificado. Os dois
     rodam sob pm2 contra `radar_prod`, e dizem isso na primeira linha do log:
     não havia como descobrir de fora, porque `--env-file` popula o ambiente
     por dentro e o pool é preguiçoso.

     O que carrega a garantia é a flag: o Next carrega `.env.local` sozinho,
     inclusive em produção, e sem `--env-file` a app de produção sobe contra o
     banco de desenvolvimento **sem erro nenhum**. Verificado nos dois sentidos.

  5. ~~**Onde a app roda**~~ — decidido, e o inverso do que se supunha aqui.
     Esta máquina é **desenvolvimento**; produção vai para a `vps-ivandias`,
     por clone do repositório. É o que impede dev de tocar produção sem passar
     por um push.

     Enquanto a VPS não existe, a app de produção roda aqui em
     `127.0.0.1:5200`, sob pm2, **sem acesso externo** — nenhum site nginx
     aponta para ela e nenhum ingress do túnel a menciona. Ela é mantida porque
     este `radar_prod` é a fonte da migração e o único lugar onde dá para
     exercitar o fluxo autenticado antes da VPS.

     **O critério de desligamento é a VPS rodar um scan, não a VPS existir.**
     Ela já existe — Postgres 16.15, `radar_prod` restaurado, 22 tabelas, RLS
     efetivo, build do Next feito — e mesmo assim o segundo motivo acima
     continua de pé: a VPS ainda não tem `ANTHROPIC_API_KEY` nem o binário
     nativo do Claude Code (item 6), então nenhuma varredura roda lá. Desligar
     esta instância antes disso não deixa produção sem casa; deixa o produto
     inteiro sem lugar nenhum onde um scan chega ao fim.

     Dos dois motivos, o primeiro já caiu: a migração aconteceu, e os 34 briefs
     estão verificados na VPS.

     Quando a VPS fechar o item 6 e completar um scan de ponta a ponta, o
     desligamento daqui é `pm2 delete radar-trabalhador radar-web` seguido de
     `pm2 save` — sem o `save`, o `pm2-igorg7.service` os traz de volta no
     próximo boot. O banco `radar_prod` desta máquina não é tocado por isso.

     Até lá, atenção a um efeito do `CLAUDE_CONFIG_DIR` que o
     `ecosystem.config.cjs` agora declara: esta instância autentica hoje pela
     sessão do Claude Code do operador, e é exatamente essa porta que a
     variável fecha. Um `pm2 reload` **nesta máquina**, antes de a decisão ser
     tomada, faz os scans dela avisarem na partida e terminarem vazios. Quem
     quiser mantê-la viva até lá precisa descomentar `ANTHROPIC_API_KEY` no
     `web/.env.producao` daqui. Desenvolvimento não é afetado: roda fora do
     pm2, e continua caindo na sessão do CLI.
  6. ~~**A credencial da Anthropic**~~ — resolvida na VPS em 2026-08-28. A
     `ANTHROPIC_API_KEY` foi escrita no `.env.producao` de lá, e os processos só
     passaram a enxergá-la depois de `pm2 restart` seguido de `pm2 save` — os
     que estavam de pé eram de 26/08.

     **Como se confere, e como não se confere.** Não dá para olhar
     `/proc/<pid>/environ`: o `--env-file` popula o ambiente por dentro do Node,
     e o `environ` do processo continua sem a variável. A evidência de fora é a
     linha de partida do trabalhador, que mudou de `ATENÇÃO — sem credencial`
     para `Anthropic: chave de API`. Foi para isso que ela existe.

     Continua valendo o resto do que estava escrito aqui: são três lugares que
     autenticam — executor, chat e ensaio —, e a chave deve ser de conta da
     empresa, não pessoal.

  6b. **O texto abaixo é histórico**, de quando isto era bloqueio:

     As varreduras autenticam pela sessão do Claude Code de quem roda o
     processo (`~/.claude/.credentials.json`). Funciona nesta máquina, onde
     alguém fez login, e **não existe** num servidor. Com produção indo para a
     VPS, isso deixou de ser pendência adiada.

     O que já está pronto para receber a chave: `ANTHROPIC_API_KEY` documentada
     no `.env.example` e no `.env.producao` — **comentada, não vazia**, porque
     uma chave vazia pode ofuscar a sessão do CLI em vez de cair nela. O SDK
     repassa `process.env` ao processo filho, então preencher basta.

     E o executor **recusa começar** sem credencial, antes de montar workspace e
     antes de registrar `scan-started`: sem isso a varredura não estoura, ela
     termina vazia depois de vinte minutos com o registro dizendo que deu certo.
     O trabalhador também anuncia a origem na partida, porque o intervalo entre
     um servidor subir e alguém pedir o primeiro scan é onde isso se esconderia.

     **Correção de 2026-08-28:** eu afirmei aqui, e várias vezes na conversa,
     que o `npm install` não traz o binário e que era preciso instalá-lo à parte
     no home de quem roda o pm2. **É falso.** Desde a 0.3.236 o SDK o traz como
     dependência opcional por plataforma — 320 MB, em
     `node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude`. O clone
     mais `npm ci` bastam, e não há passo de instalação separado nem
     complicação ao trocar o usuário do processo. O erro veio de eu ter olhado
     o `manifest.json` do pacote, que lista os binários por plataforma, e
     concluído que ele não os continha — sem procurar as dependências opcionais.
     Achado pelo agente da VPS, operando a máquina.

     O que a chave de fato não resolve: `curl`, que o briefer usa para baixar
     imagem.

     Três lugares usam o SDK, não um: o executor, o **chat** (que roda no
     processo web) e o ensaio. Sem binário, a VPS serve tudo menos essas três
     coisas — e o chat estoura 500 em vez de degradar como o Cloudinary ausente.

     Continua valendo o que já estava escrito: chave da conta da empresa, não
     pessoal. O custo dos scans dos clientes precisa cair onde a telemetria de
     consumo consegue prestar contas.

  7. **A VPS** — o banco está feito; a app, não.

     Feito e verificado em 2026-08-26: Postgres 16.15 instalado, papéis e banco
     criados pelo `01-antes-do-restore.sql`, dump restaurado, posse e
     privilégios pelo `02`, mídia em `store/media/` e `var/`. As treze
     verificações do `--conferir` passam: 34 briefs com `app.ambiente`, zero sem
     ele, posse toda de `radar_owner_prod`, e os papéis de desenvolvimento nem
     existem lá. Segredos só em `web/.env.producao`, 600; os SQL apagados
     depois de as credenciais autenticarem contra o cluster.

     Três defeitos apareceram no caminho, e todos eram meus:

     - O laço de posse lia `pg_class`, que não inclui tipos. Um enum continuou
       pertencendo ao papel de dev, e o dump o carregou pelo nome — abortando o
       restore numa máquina onde esse papel não existe.
     - **A conferência tinha o mesmo ponto cego**, e afirmava "toda a posse é do
       dono de produção" quando era falso. Verificação que compartilha o ponto
       cego do que verifica é pior que nenhuma: troca um desconhecido por uma
       certeza errada.
     - `has_database_privilege` e o cast `::regrole` **lançam** para papel
       inexistente. Escrito nesta máquina, onde os papéis de dev sempre
       existiram, o `--conferir` morria na primeira instalação limpa — onde
       ninguém tem um segundo jeito de saber se o restore prestou.

     O que falta lá, e é a app: as três chaves do Cloudinary e a
     `ANTHROPIC_API_KEY` no `.env.producao`, o binário do Claude Code, `next
     build`, pm2, e a camada de entrada — que na VPS pode ser nginx com certbot,
     já que ela tem IP público.

     E duas que a restauração criou:

     - **O `radar_prod` da VPS não tem backup.** A rotina que existe faz backup
       do banco desta máquina, que a partir de agora é a cópia secundária. O
       script roda em qualquer lugar; falta instalá-lo lá.
     - **A app roda como root na VPS**, e a mídia chegou com dono `1003`. Os
       dois se resolvem juntos, criando um usuário próprio antes de ir ao ar.

  8. **Desativar produção nesta máquina**, quando a VPS estiver servindo: o pm2
     daqui volta para desenvolvimento, e o `radar_prod` local vira
     `radar_ensaio` — dois bancos com o mesmo nome em máquinas diferentes é como
     se erra o alvo.

  Já resolvidos e fora da lista: cadastro fechado por padrão
  (`CADASTRO_ABERTO`), limite de tentativas no login e no cadastro, e
  `SESSION_SECRET` sem valor de fallback — a app recusa subir sem um.

  Continuam adiados de propósito, com o cadastro fechado: confirmação de e-mail,
  limite de cadastro além do rate-limit, e o middleware de rota.

- **A URL de terceiro entra sem aspas na linha de `curl` do briefer.** Achado
  pelo agente da VPS em 2026-08-28, e é o mais sério da lista dele.

  A cadeia: o `market-researcher` lê páginas de terceiros com `WebSearch` e
  `WebFetch`, e `image_candidates[].url` sai de `og:image`, `twitter:image` ou
  `<img src>` — texto que um estranho escolheu. Isso chega ao
  `instagram-briefer`, que tem `Bash`, e o executor roda com
  `permissionMode: "acceptEdits"` sem ninguém para aprovar.

  Mitigado no mesmo dia, editando o `.claude/agents/instagram-briefer.md`:
  aspas simples na URL, `--` antes dela, `--proto '=https'`, `--max-filesize`,
  extensão derivada do mime em vez da URL, e instrução para recusar URL que
  contenha aspa. **É mitigação, não garantia** — mora num prompt, e prompt é
  instrução a um modelo, não guarda de código.

  A correção de verdade é tirar o shell do laço: uma ferramenta MCP estreita
  que baixe a imagem em código, com validação de URL, substituindo o `Bash` do
  briefer. Nenhuma validação programática de URL existe hoje — nem em
  `web/lib/`, nem em `web/db/`.

  Vale notar o contraste com o chat, fechado em 2026-08-28 (`4ec7b3c`): lá a
  superfície foi removida com `tools: []`, em código. O briefer é o mesmo
  problema e é ele, não o chat, quem recebe texto não confiável.

- **Um cliente novo nasce sem escopo, sem fonte e sem pilar — e não há caminho
  para lhe dar nenhum.** Medido: `cliente-novo` e `igor-teste` têm zero dos três.
  A Avanz só os tem porque vieram da importação inicial, e o `imobiliaria-teste`
  porque foi clonado.

  Os únicos três lugares no código que criam essas linhas são de semeadura:

  ```
  db/seed/importar.ts      → escopo_busca, fonte
  db/seed/semear-vault.ts  → pilar
  ```

  Nada na aplicação. O `provisionar` faz usuário, ambiente, config com defaults,
  vault vazio e prefixo de mídia — e o comentário dele diz que "`fontes` vivem
  na configuração", apontando para a tela que não sabe gravar. O laço se fecha
  sem saída.

  O efeito é que **um cliente novo não roda varredura nenhuma**: sem escopo a
  API recusa qualquer pedido, e ainda que houvesse, sem pilar o matcher não tem
  como classificar. Não é desconforto de interface — é pré-requisito do segundo
  cliente.

  A muleta que existe hoje é `scripts/clonar-ambiente.mts`, que copia a
  configuração de um ambiente configurado. Serve para teste e não é produto: o
  cliente novo herdaria os pilares e as fontes de uma imobiliária de BH.

  A entrevista do vault já é o lugar natural para isso — ela pergunta pilares,
  públicos e área de atuação em prosa. Falta o passo que transforma as respostas
  em linhas de `pilar`, `escopo_busca` e `fonte`.

- **A tela de fontes exibe e não grava.** A seção "Grupos de fontes" da
  configuração renderiza campos, aceita digitação e mostra o diff — e a gravação
  é recusada com 422: `gravarConfiguracao` só aceita caminhos de `funnel` e
  `anti_repetition`, e a UI envia `search_scopes`. Provado chamando o store
  direto: `caminho fora da configuração: search_scopes.trends.label`.

  Quem edita fontes é **o cliente**, não o operador — então é tela de verdade,
  não consulta. É a metade "editar" do item acima; aquele é a metade "criar do
  zero", e os dois se resolvem no mesmo caminho de gravação. O que falta:

  - **Ler o que já existe.** O store devolve `{slug, url, nota, ativo}` por
    fonte; o `page.tsx` descarta tudo com `.map((f) => f.slug)`. Por isso não há
    campo de URL: o dado nunca chega ao cliente. Falta passar também os pilares
    do ambiente, para o seletor ter de onde escolher.
  - **Escrever.** Método novo no store, transacional, sobre `escopo_busca`,
    `fonte` e `escopo_pilar`. Não cabe em `gravarConfiguracao`, que é para os
    números e tem outra forma. É onde mora o risco, e o que merece teste.
  - **A interface.** URL por fonte, criar e remover fonte, criar e remover
    grupo, seletor de pilares alvo, e os interruptores de ativo — por fonte e
    por grupo.

  Duas coisas facilitam mais do que parece. O manifest que a varredura lê é
  **gerado do banco** (`workspace.ts`), então gravar no banco basta: não há
  arquivo a sincronizar. E o `ativo` já é respeitado de ponta a ponta — o
  workspace filtra escopo e fonte inativos, a API de varredura recusa escopo
  inativo e lista os disponíveis, o chat filtra igual. O interruptor comanda
  máquina que já funciona; falta só o botão.

  Duas decisões de comportamento, para quem for fazer: apagar um grupo com
  fontes deve **recusar**, não cascatear — dez fontes perdidas num clique se
  descobre tarde. E o `ativo` é o caminho preferível ao apagar, porque preserva
  a URL de uma fonte que só começou a dar ruído.

- **Duas tabelas sem RLS: `usuario` e `fila_pedido`.** Das 21 com `ambiente_id`,
  19 têm `ENABLE` + `FORCE`; estas duas não têm nem política. E `usuario` guarda
  `senha_hash`.

  **Não há vazamento pelo código de hoje.** As únicas leituras de `usuario` são
  o login e a checagem de duplicata do cadastro, ambas por e-mail, mais o
  insert do provisionamento — nada lista usuários. O que falta é a garantia: uma
  consulta futura escrita sem filtro entregaria e-mails e hashes de todos os
  clientes, e o banco não a impediria. Todo o resto do sistema tem essa rede.

  A ausência tem razão estrutural, e é por isso que não é conserto de uma linha:

  - **`usuario`** — o login precisa achar a pessoa **antes** de saber o
    ambiente. Uma política `ambiente_id = current_setting('app.ambiente')`
    quebraria a autenticação, e uma que aceite `app.ambiente` nulo é o buraco
    que já existe, só que escrito.
  - **`fila_pedido`** — o trabalhador precisa enxergar a fila inteira para
    escolher o próximo pedido, que é justamente atravessar ambientes.

  A correção certa para `usuario` é RLS com a política de sempre **mais** uma
  função `SECURITY DEFINER` para a busca por e-mail, devolvendo só o que a
  autenticação precisa. Aí o acesso direto à tabela passa a ser filtrado e o
  login entra por uma porta estreita e nomeada.

  O defeito real, hoje, é nenhuma das duas exceções estar escrita — nem na
  migração, nem no desenho. Quem ler o esquema conclui que a proteção é
  uniforme, e ela não é.

- **Fixture própria da suíte** — detalhe abaixo. Só vira bloqueio no dia em que
  alguém quiser apagar o `store/briefs/`.

- **Revisor de brief sob demanda** — adiado com gatilho declarado: alguns briefs
  reais. Detalhe abaixo.

## O que ficou provado

**A execução real aconteceu** — seis varreduras entre 20 e 22 de agosto, no
ambiente `avanz-teste`. Estão provados com saída de verdade: detecção de estágio,
ingestão, carregamento das skills sob `settingSources: ["project"]`, cache de
mídia por ambiente e o contrato `.json` do brief. A `scan-006` produziu o
primeiro brief íntegro — legenda, CTA, hashtags, `od_skill_ref`, direção de arte,
imagem baixada, sem um aviso.

Duração por estágio, primeira medição que esta ferramenta já teve:

|                     | pesquisa    | filtragem | redação   | total       |
| ------------------- | ----------- | --------- | --------- | ----------- |
| seasonal · filtrado | 12,4 · 15,2 | 6,3 · 4,7 | 3,9 · 3,9 | 24,1 · 25,5 |
| cases · todos       | 8,9         | 11,2      | 3,9       | 26,4        |
| cases · filtrado    | 12,4 · 7,2  | 7,5 · 5,8 | — · 5,8   | — · 21,1    |

Duas execuções idênticas deram 12,4 e 7,2 minutos de pesquisa — 42% de
diferença. É a mesma variação inexplicada que o §8.2 do desenho de execução
apontou no `trends`, agora atribuível a um estágio em vez de diluída no total.
O que falta para explicá-la é a contagem parcial (`fontes_lidas`,
`fontes_sem_resposta`) que a skill ainda não preenche.

**O trabalhador está sob pm2**, no padrão deste servidor — `pm2-igorg7.service`
ao lado dos de `ivandias` e `root`. Verificado como um reboot faria: daemon
derrubado, serviço iniciado pelo systemd, processo restaurado do dump.

O `kill_timeout` ficou em 30 minutos, e é a primeira decisão de drenagem apoiada
em medição em vez de palpite — as seis varreduras levaram de 21 a 26 (§9.2 do
desenho de execução pedia exatamente isso).

**A conversa do chat persiste.** Tabelas `conversa` e `mensagem`, isoladas como
o resto, com a sessão do SDK gravada junto da mensagem que a produziu. Provado
no navegador: perguntar, recarregar, e perguntar "e qual deles tem o maior
score?" — frase que só se resolve se a memória sobreviveu.

O que ficou em aberto aqui é **retenção**: nada apaga conversa antiga, e ninguém
decidiu por quanto tempo elas ficam.

**A mídia do Cloudinary tem dono.** A escolha da arte sobe a foto com
`public_id` estável por brief — reescolher sobrescreve o mesmo objeto em vez de
deixar órfão pago na conta. Descartar uma candidata apaga o arquivo local **e**
o objeto remoto.

**A purga do cache local é código**, e com ela caiu a última skill
determinística. O que se exige dela é sobretudo o que ela não faz: não toca em
mídia de brief que ainda não saiu, nem em recém-publicada, nem — acima de tudo
— naquela cuja única cópia é a local, onde apagar não libera disco, perde a
foto.

As outras três saíram do repositório em 2026-08-20. `radar-mv` virou
`aplicarTransicao`, `radar-mark-published` virou `marcarPublicado`, e
`radar-handoff` virou `exportar` — que devolve **um `.md`** para download em vez
de escrever cinco arquivos em `store/packages/`. Eram código escrito em prosa:
mudança de estado com regra fixa quer transação, não um modelo decidindo.

**A suíte tem banco próprio.** Roda em `radar_teste`, criado e semeado por
`web/scripts/preparar-banco-de-teste.mts` a partir do repositório — sem depender
de nenhum outro banco.

Fechou três buracos de uma vez. O trabalhador do pm2 deixou de reivindicar
pedido de teste como se fosse varredura de verdade: chegava a tentar executar, e
só parava por vault vazio — proteção acidental, não separação. A falha
intermitente de posição na fila sumiu junto (0 em 20 rodadas; era 1 em 20). E o
pulo silencioso morreu: banco declarado e fora do ar agora **falha** a suíte, em
vez de deixá-la verde com 96 testes escondidos, que foi o que aconteceu uma vez.

**Varredura e chat medem o que gastam.** Uma linha por modelo por execução, em
`consumo` — tokens, cache, buscas web e custo estimado. Antes disso o SDK
entregava os números em todo resultado e nós os descartávamos: seis varreduras
reais, nenhuma com custo registrado.

Duas armadilhas da API, documentadas nela mesma e fáceis de errar: `usage` cobre
só o laço principal e **exclui subagente** — que é quase toda a varredura —, e
`modelUsage` é **cumulativo**, então o último resultado substitui em vez de
somar. Errar qualquer uma das duas dá número plausível e errado, que é pior que
número nenhum.

Gravado em `finally` e com o erro engolido: execução que falhou também gastou, e
é justamente esse custo que hoje sumiria. Perder a medição de uma varredura é
ruim; perder a varredura por causa da medição é pior.

**Injeção por ferramenta em vez de arquivo** — chegou pela metade, antes do
gatilho previsto. O **chat** já funciona assim: seis ferramentas sobre a camada
(`web/lib/chat/ferramentas.ts`), nenhuma delas tocando em arquivo, e o ambiente
nunca como argumento. O **executor do scan** continua materializando workspace,
porque as skills leem caminho relativo. O gatilho declarado para converter o
resto segue o segundo cliente ([`design-migracao.md`](./design-migracao.md)
§5.4).

## Adiados com gatilho

**O cadastro fica desligado até o deploy.** `/cadastro` cria empresa, conta e
ambiente, e está testado — mas a decisão é não usá-lo agora. Quando o banco de
produção existir, o usuário da Avanz é criado direto nele e a tela sai do ar.

O que precisa entrar **junto** com o deploy, não depois:

- **Desligar o cadastro** — por variável de ambiente, não removendo o código: a
  tela volta quando houver segundo cliente de verdade, e código apagado é código
  reescrito pior.
- **Confirmação de e-mail** — hoje não há envio de e-mail em lugar nenhum do
  produto, então é trabalho de verdade, não uma linha.
- **Limite de cadastro** — sem ele o endpoint é uma torneira aberta de
  ambientes. Enquanto a app não está publicada isso não custa nada; publicada,
  custa.
- **Proteção de rota** — está melhor do que eu supus ao escrever isto. A guarda
  já é única: vive no layout do shell, e as onze rotas de API dependem de
  `radarStore()`, que recusa sem sessão (`SemSessao` → 401). Página nova dentro
  do shell nasce protegida sem fazer nada.

  O que fica é a defesa em profundidade que hoje não existe: um `middleware.ts`
  recusando antes de qualquer render. Sem ele, uma rota criada **fora** do
  `(shell)` — como o próprio `/cadastro` — nasce aberta, e é preciso lembrar
  disso. Não é buraco atual; é o que separa "não esquecemos" de "não dá para
  esquecer".

Enquanto nada disso existe, a app não pode ficar exposta. O que segura hoje é
ela não estar publicada — que é circunstância, não proteção.


**Revisor de brief sob demanda.** Um agente que, acionado por botão na página
do brief, abre as `source_urls` e confere o que a copy afirma — "a legenda diz
38,6% e a fonte diz 38,4%" — além de apontar envelhecimento e contradição com
os guardrails. Cai nos "Pontos de atenção" que já existem no pacote.

Não é o briefer que faz isso: seria o autor revisando o próprio texto na mesma
passada em que o escreve, e o contexto dele é o _finding_ — ele nunca abre a
fonte, então não teria como confirmar o número que escreveu.

Três restrições decididas junto com o desenho: **não edita** (observa e
registra; corrigir é do humano, como toda ferramenta do chat), **distingue "não
confirmei" de "está errado"** (fonte fora do ar não é dado inventado, e
misturar os dois transforma aviso em ruído que se pula), e **cita trecho e
fonte** em cada apontamento.

Sob demanda, não automático ao fim da varredura: pagar por brief que talvez
seja rejeitado de cara não se justifica, e o scan já leva 21 a 26 minutos.

Adiado de propósito, com gatilho: **alguns briefs reais**. Hoje existe um só, e
a lista de verificações sairia do que eu imagino que dá errado. Nenhum dos
defeitos desta semana — nomes de campo divergindo, guardrail truncado na
importação, posição de fila empatando — teria sido previsto assim; todos vieram
de execução.

## Soltas

- **"Pontos de atenção" nunca chega preenchido, e o campo tem dois donos.**
  Nenhum dos cinco briefs traz o que conferir antes de publicar — o briefer não
  gera, e ainda não se sabe se é por falta de instrução ou porque a ingestão não
  lê.

  Debaixo disso há uma confusão maior: `review_notes` guarda **também** o motivo
  da rejeição (`aplicarTransicao` escreve ali). Escrever pontos de atenção e
  depois rejeitar apaga as notas, e o pacote imprimiria o motivo da rejeição
  como "nota da revisão". Não morde hoje porque brief rejeitado não é exportado.

  Separar as duas coisas é pré-requisito para preencher a primeira.

- **Template próprio para os pilares editoriais.** Só `imovel-da-semana` e
  `decisao-inteligente` têm template; `inteligencia-imobiliaria`,
  `quem-comprou` e `mercado-rmbh` não. O pacote agora cai num padrão declarado
  (3:4) em vez do palpite do briefer, então isto deixou de sangrar — mas
  continua sendo a marca que deveria dizer o enquadramento de cada pilar, e
  `decisao-inteligente` aponta hoje para `post-mes`, template de efeméride, o
  que provavelmente já é encaixe errado.

  Trabalho de design da Avanz, não nosso. Um template talvez resolva os três:
  são todos post editorial, sem foto de imóvel.
- **O trabalhador não recarrega código.** Roda sob pm2 com `tsx`, então
  correção em `db/**` só passa a valer depois de `pm2 restart
  radar-trabalhador`. Já custou duas vezes: uma varredura rodou sem a
  telemetria recém-escrita, outra sem as correções de ingestão.

  A definição dos subagentes **não** tem esse problema — o workspace é
  materializado a cada execução, então `.claude/agents/` vale na hora. Saber
  qual das duas metades mudou é o que decide se precisa reiniciar.

  Vale um aviso automático: comparar o commit do processo com o HEAD antes de
  enfileirar. Enquanto não existir, é lembrar.

- **`positioning.md` do vault da Avanz** cita `brand.json#/target_audience`
  como fonte de quatro perfis de ICP; o arquivo tem três. Fora deste
  repositório, e **não vamos alterar** — é espaço de trabalho do cliente. A
  migração resolve por construção: um bloco `publicos` só, sem onde a
  contradição morar. O que fica é o importador reportar divergência
  ([`design-migracao.md`](./design-migracao.md) §5).

- **`painel.png`** na raiz do repositório, sem destino definido.
- **A fixture do teste ainda sai dos arquivos do cliente** — o preparo do
  `radar_teste` semeia a Avanz lendo `docs/vault-avanz.md`, `manifest.yaml` e
  `store/briefs/`. Funciona e é reproduzível, mas cria um motivo novo para esses
  arquivos continuarem existindo, bem quando a intenção é aposentá-los.

  Não urge: eles seguem no repositório de qualquer jeito enquanto o legado não
  for removido. Vira bloqueio no dia em que alguém perguntar "posso apagar o
  `store/briefs/`?" — e a resposta for "não, a suíte depende".

  A saída é uma fixture própria: vault sintético, versionado, escrito para o
  teste. Melhora os três testes de quebra, que hoje podem falhar porque a Avanz
  mudou o foco editorial — coisa que nada tem a ver com workspace.

- **Onde o dado da Avanz vive** — hoje no `radar_dev`, junto com tudo, tocado
  por script e por suíte. Incomoda com razão, mas criar um `radar_prod` antes de
  existir produção só troca o nome: o app continuaria apontando para ele em
  `next dev`, com a credencial no `.env.local` de alguém, e o dev ficaria vazio
  — dependemos do conteúdo real para validar ingestão e varredura.

  A separação entra **junto com o deploy**, quando vier acompanhada do que a
  torna real: app de produção apontando para lá, backup, credencial fora da
  máquina de desenvolvimento, e migração rodada numa liberação em vez de por
  quem chamar o drizzle-kit. Aí o dado migra e o `radar_dev` vira cópia de
  trabalho recriável.

- **Produção** — não decidida. Pode ser este mesmo servidor, já que a app vive
  aqui. Vale decidir quando houver um segundo cliente.
