/**
 * O processo que executa as varreduras.
 *
 * Roda **fora** do processo que atende HTTP, porque os scans registrados
 * levaram de 12 a 63 minutos e nenhum ciclo de requisição sobrevive a isso.
 * Fica sob pm2:
 *
 *   pm2 start web/scripts/trabalhador.mts --name radar-trabalhador \
 *     --interpreter web/node_modules/.bin/tsx \
 *     --interpreter-args "--conditions=react-server --env-file=.env.local"
 *
 * `--conditions=react-server` não é detalhe opcional. O executor e a camada
 * marcam-se com `import "server-only"`, cuja versão default **lança** ao ser
 * carregada fora de um Server Component; sob essa condição o pacote resolve
 * para um módulo vazio. Sem a flag o processo morre na primeira importação. A
 * alternativa seria remover a marcação — mas ela é justamente o que impede
 * essas linhas de irem parar num bundle de cliente.
 *
 * Laço, não cron: `girar()` já devolve na hora quando não há nada, e o custo de
 * perguntar ao Postgres a cada poucos segundos é irrelevante perto dos vinte
 * minutos de uma execução. Cron traria o problema oposto — sobreposição de
 * disparos e um teto global que passa a depender de sorte.
 */

import { girar } from "../db/fila";
import { encerrarPool } from "../db/cliente";

/**
 * Intervalo entre perguntas quando a fila está vazia. Cinco segundos: a pessoa
 * aperta o botão e espera ver "iniciando", e latência de polling aqui não
 * compete com a duração da execução.
 */
const OCIOSO_MS = Number(process.env.RADAR_TRABALHADOR_INTERVALO_MS ?? 5000);

/**
 * Espera depois de uma falha do próprio laço — não de um scan que falhou, que
 * `girar` já trata e registra. Isto é para o caso do banco cair: sem a pausa, o
 * processo giraria em erro milhares de vezes por minuto.
 */
const APOS_ERRO_MS = 30_000;

let parando = false;

/**
 * Termina o scan em curso antes de sair. Matar no meio perde tudo o que a
 * execução fez — e durante a pesquisa de dez fontes isso é quase tudo
 * (design-execucao-scan §9.2). O pm2 manda SIGINT e espera; quem decide o
 * prazo é o `kill_timeout` de lá, não este arquivo.
 */
for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, () => {
    if (parando) return;
    parando = true;
    console.log(`[trabalhador] ${sinal} — encerra ao fim do scan atual`);
  });
}

const espera = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

console.log(`[trabalhador] de pé · ocioso a cada ${OCIOSO_MS}ms`);

while (!parando) {
  try {
    const r = await girar();
    if (r.rodou) {
      console.log(`[trabalhador] terminou ${r.scanRef}`);
      // Sem pausa: pode haver outro pedido esperando, e a vaga acabou de abrir.
      continue;
    }
  } catch (erro) {
    console.error("[trabalhador] falha no laço:", (erro as Error).message);
    await espera(APOS_ERRO_MS);
    continue;
  }
  await espera(OCIOSO_MS);
}

await encerrarPool();
console.log("[trabalhador] encerrado");
