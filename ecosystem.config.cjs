/**
 * Processos do content-radar sob pm2.
 *
 * A instância do systemd varia por máquina, e este arquivo roda nas duas: na de
 * desenvolvimento cada usuário tem a sua (`pm2-igorg7.service`); na VPS de
 * produção há só `pm2-root.service`. Não presuma a de dev ao ler um log ou
 * mandar reiniciar — verifique com `systemctl list-units 'pm2-*'`.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs radar-trabalhador
 *   pm2 save            # grava a lista para o serviço restaurar no boot
 *
 * Os dois processos servem **produção**, contra `radar_prod`. Desenvolvimento
 * roda fora do pm2: `npm run dev` para a app, e o trabalhador à mão quando for
 * preciso testar uma varredura —
 *
 *   cd web && node_modules/.bin/tsx --conditions=react-server \
 *     --env-file=.env.local scripts/trabalhador.mts
 *
 * Duas coisas que já morderam neste comando. As flags vão para o `tsx`, não
 * para o `node`: passadas ao node, o `--conditions` não alcança o processo que
 * carrega os módulos e o `server-only` lança na primeira importação. E é
 * preciso rodar **de dentro de `web/`** — sem `RADAR_ROOT`, a raiz é o pai do
 * diretório de trabalho, e da raiz do repositório ele sobe um nível demais. O
 * pm2 escapa disso porque declara `RADAR_ROOT` no `env`.
 *
 * Um trabalhador só de cada vez, de propósito: dois processos disputariam a
 * mesma credencial da Anthropic, e uma varredura custa de US$ 5 a 7.
 */

/**
 * A raiz é derivada deste arquivo, e não escrita à mão.
 *
 * Com o caminho fixo, um clone de desenvolvimento carregaria uma cópia deste
 * arquivo apontando para `/srv/apps/content-radar`: rodar `pm2 start` de lá
 * comandaria os processos de **produção**, achando que mexia nos próprios. Com
 * `__dirname`, cada árvore só alcança a si mesma — e a de desenvolvimento
 * falha ao não achar `.env.producao`, que é o erro certo.
 */
const raiz = __dirname;

module.exports = {
  apps: [
    {
      name: "radar-trabalhador",
      script: "web/scripts/trabalhador.mts",
      cwd: raiz,
      /**
       * Caminho absoluto e modo `fork`: em `cluster` o pm2 usa o módulo
       * `cluster` do Node, que não sabe lidar com interpretador próprio — o
       * processo nem chega a escrever log, e o gerenciador o reinicia em laço.
       */
      interpreter: `${raiz}/web/node_modules/.bin/tsx`,
      exec_mode: "fork",

      /**
       * `--conditions=react-server` não é opcional: o executor e a camada se
       * marcam com `import "server-only"`, cuja versão default **lança** ao ser
       * carregada fora de um Server Component. Sob essa condição o pacote
       * resolve para um módulo vazio. Sem a flag o processo morre na primeira
       * importação — e o pm2 o reiniciaria em laço.
       */
      /**
       * `--env-file` e não o `env` abaixo: as credenciais de produção ficam no
       * arquivo 600, fora do git e fora da listagem do `pm2 show`, que imprime
       * o `env` inteiro para quem tiver acesso ao pm2.
       */
      interpreter_args: "--conditions=react-server --env-file=web/.env.producao",

      /**
       * O `cwd` é a raiz do radar, mas o app calcula `RADAR_ROOT` como o pai do
       * diretório de trabalho — convenção que vale quando se roda de dentro de
       * `web/`. Declarar explicitamente evita depender de onde o pm2 foi
       * invocado.
       */
      /**
       * Fuso do processo. O sistema desta máquina é UTC e assim fica — ela
       * hospeda apps de outras pessoas, e trocar o fuso do sistema mexeria no
       * log de todas. Declarar aqui alcança só os nossos.
       *
       * Sem isto o log sai em UTC enquanto o banco responde em -03, e às 22h
       * de um dia os dois discordam até da data.
       */
      /**
       * `CLAUDE_CONFIG_DIR` apontado para dentro da instalação. O SDK aceita,
       * como última opção, a sessão interativa em `~/.claude/.credentials.json`
       * — e na VPS esse arquivo existe, no home do root, porque a máquina é
       * operada pelo CLI. Sem esta linha o trabalhador encontra essa sessão e
       * anuncia "Anthropic: sessão do Claude Code" mesmo sem chave nenhuma
       * configurada: o aviso de partida, que existe justamente para uma
       * varredura não terminar vazia em silêncio, passa a mentir.
       *
       * Vale também depois de a chave chegar: enquanto as duas credenciais
       * coexistem quem decide entre elas é o SDK, e o custo dos scans deve cair
       * na conta da empresa, não na assinatura pessoal de quem administra o
       * servidor.
       *
       * Fica em `var/`, que o .gitignore já exclui: é estado da instalação.
       */
      env: {
        RADAR_ROOT: raiz,
        NODE_ENV: "production",
        TZ: "America/Sao_Paulo",
        CLAUDE_CONFIG_DIR: `${raiz}/var/claude-config`,
      },

      /**
       * Uma instância só. O teto de scans simultâneos é global e vive no banco
       * (`fila_pedido`), mas dois trabalhadores no mesmo host disputariam a
       * mesma chave de API sem nada os coordenar além desse teto — e o teto
       * ainda é palpite, sem telemetria de consumo.
       */
      instances: 1,
      autorestart: true,

      /**
       * Tempo para terminar o scan em curso antes de ser morto. O laço trata
       * SIGINT/SIGTERM saindo ao fim da execução atual, e as varreduras medidas
       * levaram de 21 a 26 minutos — matar no meio perde tudo o que a execução
       * fez, e durante a pesquisa isso é quase tudo.
       *
       * Setenta e não trinta: os 30 cobriam só o medido, mas o trabalhador
       * registra execuções de até 63 minutos. Uma dessas seria morta aos 30 de
       * 63, perdendo o scan inteiro. O prazo só corre quando alguém manda
       * parar, então o custo de errar é assimétrico — esperar alguns minutos a
       * mais num deploy é mais barato que perder um scan de US$ 5 a 7.
       *
       * Não é política definitiva: o desenho adiou isso à espera de medição por
       * estágio, que agora existe (design-execucao-scan §9.2).
       */
      kill_timeout: 70 * 60 * 1000,

      /** Reinício em laço é sintoma, não solução: pare e mostre nos logs. */
      max_restarts: 5,
      min_uptime: "60s",
      restart_delay: 10_000,
    },

    {
      name: "radar-web",
      /**
       * Exige `npx next build` antes — `next start` serve o que está em
       * `.next/` e recusa subir sem build. Não é `next dev`: aquele recompila a
       * cada requisição, o que é ótimo para editar e não serve usuário.
       */
      script: "node_modules/next/dist/bin/next",
      args: "start -p 5200 -H 127.0.0.1",
      cwd: `${raiz}/web`,
      exec_mode: "fork",

      /**
       * `-H 127.0.0.1` acima: a app escuta só no loopback. Quem expõe é o
       * nginx. Sem isso ela atende direto na rede, na porta 5200, sem TLS e
       * sem nada na frente.
       *
       * O `--env-file` é o que faz a app falar com `radar_prod`. O Next carrega
       * `.env.local` sozinho, inclusive em produção; a ordem dele põe
       * `process.env` em primeiro lugar, e é por ali que o `--env-file` entra.
       * Sem esta linha, a app de produção sobe contra o banco de
       * desenvolvimento — sem erro nenhum, servindo os dados errados.
       */
      interpreter_args: "--env-file=.env.producao",

      /**
       * `TZ` pelo mesmo motivo do trabalhador: o fuso do sistema não é nosso
       * para mudar.
       *
       * `CLAUDE_CONFIG_DIR` também pelo mesmo motivo, e não por simetria: o
       * chat usa o SDK dentro **deste** processo, não no do trabalhador
       * (pendencias.md item 6 — são três lugares que autenticam, e cada um
       * precisa do seu ensaio). Sem a linha aqui, este processo acharia a
       * sessão do Claude Code do operador em `~/.claude/.credentials.json` e
       * gastaria na assinatura pessoal dele.
       */
      env: {
        /**
         * Declarada, e não herdada do `cwd`. O default é o pai do diretório de
         * trabalho — o que dá certo aqui, porque o `cwd` é `web/`. Mas foi
         * essa dependência silenciosa que fez uma varredura morrer com ENOENT
         * num caminho que ninguém tinha escrito, e o trabalhador ao lado já
         * declara. Depender da convenção num processo e não no outro é a
         * assimetria que confunde quem for mexer depois.
         */
        RADAR_ROOT: raiz,
        TZ: "America/Sao_Paulo",
        CLAUDE_CONFIG_DIR: `${raiz}/var/claude-config`,
      },

      instances: 1,
      autorestart: true,

      /** Requisição HTTP é curta; não há trabalho longo a preservar aqui. */
      kill_timeout: 10_000,

      max_restarts: 10,
      min_uptime: "30s",
      restart_delay: 5_000,
    },
  ],
};
