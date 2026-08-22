/**
 * Processos do content-radar sob pm2 — o padrão deste servidor, onde cada
 * usuário tem sua instância sob systemd (`pm2-<usuario>.service`).
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs radar-trabalhador
 *   pm2 save            # grava a lista para o serviço restaurar no boot
 *
 * Só o trabalhador está aqui. O app web ainda roda em `next dev`, que é modo de
 * desenvolvimento — recompila a cada requisição e não serve usuário real. Pô-lo
 * de pé exige `next build` + `next start` atrás de nginx, que é a conversa de
 * deploy, ainda sem decisão.
 */

module.exports = {
  apps: [
    {
      name: "radar-trabalhador",
      script: "web/scripts/trabalhador.mts",
      cwd: "/srv/apps/content-radar",
      /**
       * Caminho absoluto e modo `fork`: em `cluster` o pm2 usa o módulo
       * `cluster` do Node, que não sabe lidar com interpretador próprio — o
       * processo nem chega a escrever log, e o gerenciador o reinicia em laço.
       */
      interpreter: "/srv/apps/content-radar/web/node_modules/.bin/tsx",
      exec_mode: "fork",

      /**
       * `--conditions=react-server` não é opcional: o executor e a camada se
       * marcam com `import "server-only"`, cuja versão default **lança** ao ser
       * carregada fora de um Server Component. Sob essa condição o pacote
       * resolve para um módulo vazio. Sem a flag o processo morre na primeira
       * importação — e o pm2 o reiniciaria em laço.
       */
      interpreter_args: "--conditions=react-server --env-file=web/.env.local",

      /**
       * O `cwd` é a raiz do radar, mas o app calcula `RADAR_ROOT` como o pai do
       * diretório de trabalho — convenção que vale quando se roda de dentro de
       * `web/`. Declarar explicitamente evita depender de onde o pm2 foi
       * invocado.
       */
      env: { RADAR_ROOT: "/srv/apps/content-radar", NODE_ENV: "production" },

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
  ],
};
