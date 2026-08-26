/**
 * Clona a **configuração** de um ambiente para outro — sem levar conteúdo.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local \
 *     scripts/clonar-ambiente.mts --de=avanz-imoveis --para=avanz-teste \
 *     --email=teste@exemplo.com --senha=<12+ caracteres>
 *
 * Serve para exercitar o caminho inteiro do produto sem tocar no que já existe
 * de um cliente real: o clone nasce com vault, pilares, públicos, escopos,
 * fontes e ajustes idênticos, e com a fila vazia.
 *
 * **Não copia** brief, candidata, evento, scan nem histórico de vault. Não é
 * economia: um clone com os briefs do original começaria com anti-repetição
 * enviesada — a varredura pularia pautas que este ambiente nunca gerou — e o
 * ledger passaria a contar duas vezes a mesma história.
 */

import { Pool } from "pg";
import argon2 from "argon2";

const arg = (nome: string) =>
  process.argv
    .find((a) => a.startsWith(`--${nome}=`))
    ?.split("=")
    .slice(1)
    .join("=");

const de = arg("de");
const para = arg("para");
const email = arg("email");
const senha = arg("senha");

if (!de || !para || !email || !senha) {
  console.error(
    "uso: --de=<slug> --para=<slug> --email=<e-mail> --senha=<12+ caracteres>",
  );
  process.exit(1);
}
if (senha.length < 12) {
  console.error("senha curta demais — mínimo 12 caracteres");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_MIGRATIONS,
});
const cliente = await pool.connect();

/**
 * Copia uma tabela do ambiente de origem para o destino.
 *
 * Cada `insert ... select` roda com `app.ambiente` declarado como o **destino**,
 * porque é o destino que a política de escrita verifica. A leitura da origem
 * acontece antes, noutra transação — ler e escrever ambientes diferentes na
 * mesma transação é justamente o que o RLS existe para impedir.
 */
async function copiar(
  tabela: string,
  colunas: string[],
  origemId: string,
  destinoId: string,
): Promise<number> {
  const lista = colunas.join(", ");

  await cliente.query("begin");
  await cliente.query("select set_config('app.ambiente', $1, true)", [
    origemId,
  ]);
  const { rows } = await cliente.query(
    `select ${lista} from ${tabela} where ambiente_id = $1`,
    [origemId],
  );
  await cliente.query("commit");

  if (rows.length === 0) return 0;

  await cliente.query("begin");
  await cliente.query("select set_config('app.ambiente', $1, true)", [
    destinoId,
  ]);
  for (const linha of rows) {
    const valores = colunas.map((c) => linha[c]);
    const marcadores = colunas.map((_, i) => `$${i + 2}`).join(", ");
    await cliente.query(
      `insert into ${tabela} (ambiente_id, ${lista}) values ($1, ${marcadores})`,
      [destinoId, ...valores],
    );
  }
  await cliente.query("commit");
  return rows.length;
}

try {
  const { rows: origem } = await cliente.query(
    "select id, nome from ambiente where slug = $1",
    [de],
  );
  if (origem.length === 0)
    throw new Error(`ambiente de origem não existe: ${de}`);

  await cliente.query("delete from ambiente where slug = $1", [para]);
  const { rows: destino } = await cliente.query(
    `insert into ambiente (slug, nome, prefixo_midia) values ($1, $2, $3) returning id`,
    [para, `${origem[0].nome} (teste)`, `midia/${para}`],
  );

  const origemId = origem[0].id as string;
  const destinoId = destino[0].id as string;

  await cliente.query(
    `insert into usuario (email, senha_hash, ambiente_id) values ($1, $2, $3)`,
    [email.trim().toLowerCase(), await argon2.hash(senha), destinoId],
  );

  // A ordem importa: fonte referencia escopo_busca, e escopo_pilar referencia
  // os dois lados. Inverter dá violação de chave estrangeira, não silêncio.
  const relatorio: Record<string, number> = {
    pilar: await copiar(
      "pilar",
      ["slug", "nome", "corpo", "ordem", "no_radar", "template"],
      origemId,
      destinoId,
    ),
    publico: await copiar(
      "publico",
      ["slug", "nome", "corpo", "padrao"],
      origemId,
      destinoId,
    ),
    escopo_busca: await copiar(
      "escopo_busca",
      ["slug", "label", "ativo"],
      origemId,
      destinoId,
    ),
    fonte: await copiar(
      "fonte",
      ["escopo_slug", "slug", "url", "nota", "ativo"],
      origemId,
      destinoId,
    ),
    escopo_pilar: await copiar(
      "escopo_pilar",
      ["escopo_slug", "pilar_slug"],
      origemId,
      destinoId,
    ),
    // `usado_em` e `esgotado_em` ficam de fora de propósito: são o rastro de
    // uso do original. Copiá-los faria o clone nascer com temas já gastos.
    tema: await copiar(
      "tema",
      ["pilar_slug", "codigo", "categoria", "titulo", "angulo"],
      origemId,
      destinoId,
    ),
    guardrail: await copiar(
      "guardrail",
      ["slug", "corpo"],
      origemId,
      destinoId,
    ),
    marca: await copiar(
      "marca",
      [
        "canal_principal",
        "telefone_exibicao",
        "telefone_e164",
        "telefone_secundario_e164",
      ],
      origemId,
      destinoId,
    ),
    config: await copiar(
      "config",
      ["pesos", "caps", "janelas", "volume", "visual_base"],
      origemId,
      destinoId,
    ),
    vault_bloco: await copiar(
      "vault_bloco",
      ["slug", "titulo", "corpo", "ordem", "escopo", "contrato", "versao"],
      origemId,
      destinoId,
    ),
  };

  console.log(
    JSON.stringify(
      { ambienteId: destinoId, slug: para, email, copiado: relatorio },
      null,
      2,
    ),
  );
} finally {
  cliente.release();
  await pool.end();
}
