import { Pool, type PoolClient } from "pg";

/**
 * Acesso exclusivo à fila, para os testes que a manipulam inteira.
 *
 * `reivindicar()` pega o pedido mais antigo de **qualquer** ambiente, e um dos
 * testes marca todos os pendentes de uma vez — operações que existem porque a
 * fila é do servidor, não de um cliente. Dois arquivos de teste fazendo isso em
 * paralelo roubam linhas um do outro, e o sintoma sai longe da causa: posição
 * que não confere, pedido reivindicado por quem não o criou.
 *
 * O lock é consultivo e por sessão: cada arquivo o segura do primeiro ao último
 * teste, então os arquivos serializam **entre si** sem tornar a suíte inteira
 * sequencial. Serializar tudo custaria segundos em cada rodada para resolver o
 * acoplamento de dois arquivos.
 *
 * Não substitui um banco só para testes, que é o que separaria a suíte de um
 * trabalhador rodando de verdade.
 */

/** Número arbitrário e estável: o que importa é os dois arquivos usarem o mesmo. */
const CHAVE = 8_142_026;

let cliente: PoolClient | null = null;
let pool: Pool | null = null;

export async function tomarFila(): Promise<void> {
  if (!process.env.DATABASE_URL_MIGRATIONS) return;
  pool = new Pool({ connectionString: process.env.DATABASE_URL_MIGRATIONS });
  cliente = await pool.connect();
  await cliente.query("select pg_advisory_lock($1)", [CHAVE]);
}

export async function devolverFila(): Promise<void> {
  if (!cliente || !pool) return;
  await cliente.query("select pg_advisory_unlock($1)", [CHAVE]);
  cliente.release();
  await pool.end();
  cliente = null;
  pool = null;
}
