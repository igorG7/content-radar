/**
 * Processos do content-radar sob pm2 — o padrão deste servidor, onde cada
 * usuário tem sua instância sob systemd (`pm2-<usuario>.service`).
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs radar-trabalhador
 *   pm2 save            # grava a lista para o serviço restaurar no boot
 *
 * Os dois processos servem **produção**, contra `radar_prod`. Desenvolvimento
 * roda fora do pm2: `npm run dev` para a app, e o trabalhador à mão quando for
 * preciso testar uma varredura —
 *
 *   node --env-file=web/.env.local --conditions=react-server \
 *     web/node_modules/.bin/tsx web/scripts/trabalhador.mts
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
      env: {
        RADAR_ROOT: raiz,
        NODE_ENV: "production",
        TZ: "America/Sao_Paulo",
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
       * Trinta minutos cobre o observado com folga. Não é política definitiva:
       * o desenho adiou isso à espera de medição por estágio, que agora existe
       * (design-execucao-scan §9.2).
       */
      kill_timeout: 30 * 60 * 1000,

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

      /** Mesmo motivo do trabalhador: o fuso do sistema não é nosso para mudar. */
      env: { TZ: "America/Sao_Paulo" },

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
