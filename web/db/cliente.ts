/**
 * Conexão com o Postgres e o único lugar que declara o ambiente da sessão.
 *
 * O row-level security depende de `app.ambiente` estar definido na transação.
 * Esquecer é o modo de falha óbvio — e silencioso, porque a consulta não
 * quebra: ela devolve zero linhas. Por isso `comAmbiente()` é a única porta:
 * quem quer tocar em dado de cliente passa por ela, e o SET LOCAL vem junto.
 *
 * `SET LOCAL` e não `SET`: o valor morre com a transação. Num pool de conexões,
 * `SET` vazaria o ambiente de um request para o próximo.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;

function poolDaApp(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL ausente — a camada de banco precisa da conexão de radar_app",
    );
  }
  // Um pool por processo. `radar_app` não é dono de tabela nenhuma, que é o que
  // faz as políticas valerem para ele (docs/design-esquema-banco.md §1).
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export const db = () => drizzle(poolDaApp(), { schema });

export type Db = ReturnType<typeof db>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Roda o trabalho dentro de uma transação com o ambiente declarado. Tudo que lê
 * ou escreve dado de cliente passa por aqui.
 */
export async function comAmbiente<T>(
  ambienteId: string,
  trabalho: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db().transaction(async (tx) => {
    // set_config em vez de interpolar em SET LOCAL: aceita parâmetro e não abre
    // espaço para injeção pelo identificador do ambiente.
    await tx.execute(
      sql`select set_config('app.ambiente', ${ambienteId}, true)`,
    );
    return trabalho(tx);
  });
}

export async function encerrarPool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
