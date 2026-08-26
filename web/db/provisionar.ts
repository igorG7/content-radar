/**
 * Provisionar não é inserir um usuário — é fazer nascer um ambiente.
 *
 * Cinco coisas de uma vez: o usuário, o ambiente vinculado a ele, a
 * configuração inicial com os defaults do produto, o vault vazio e o prefixo de
 * mídia. Ver docs/design-persistencia-multiusuario.md §2.2.
 *
 * A segunda metade não é do operador: ele cria a conta vazia, e quem preenche o
 * vault é o cliente, pela entrevista dos primeiros passos. Por isso os blocos
 * nascem com estrutura e sem corpo — é esse estado que a interface reconhece
 * para levar à entrevista em vez de exibir um painel zerado.
 */

import argon2 from "argon2";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Os blocos de prosa. Três entradas do catálogo não aparecem aqui porque não
 * são prosa: `fontes` e `ajustes` vivem na configuração, e `contato` na tabela
 * `marca` — o número que vai no rodapé da arte é valor, e escrevê-lo também em
 * prosa criaria duas casas para o mesmo dado.
 */
const BLOCOS_VAZIOS = [
  { slug: "identidade", titulo: "Identidade e origem", contrato: "degrada" },
  { slug: "voz", titulo: "Voz da marca", contrato: "obrigatorio" },
  { slug: "guardrails", titulo: "Guardrails", contrato: "obrigatorio" },
  { slug: "foco", titulo: "Foco editorial", contrato: "obrigatorio" },
  { slug: "geografia", titulo: "Área de atuação", contrato: "obrigatorio" },
  { slug: "publicos", titulo: "Públicos", contrato: "obrigatorio" },
  { slug: "pilares", titulo: "Pilares editoriais", contrato: "obrigatorio" },
  { slug: "cadencia", titulo: "Cadência", contrato: "degrada" },
  { slug: "temas", titulo: "Banco de temas", contrato: "opcional" },
  { slug: "visual", titulo: "Identidade visual", contrato: "degrada" },
] as const;

/**
 * Defaults do produto, não do cliente. Os valores vêm da calibração do matcher
 * e são ajustáveis por ambiente depois — o que é do produto é o *esquema* dos
 * pesos, não os números.
 */
const CONFIG_PADRAO = {
  pesos: {
    pillar_fit: 0.3,
    foco_editorial_fit: 0.25,
    geografia_fit: 0.2,
    icp_fit: 0.15,
    freshness: 0.1,
  },
  caps: {
    pillar_fit_min: 0.3,
    foco_and_geo_combined_min: 0.5,
    icp_ambiguous_cap: 0.45,
    match_score_min: 0.55,
    borderline_min: 0.48,
    geografia_reframe_floor: 0.5,
  },
  janelas: {
    in_flight_check: "all",
    publicado_days: 90,
    rejeitado_days: 30,
    pillar_icp_redundant_days: 14,
  },
  volume: { candidates_per_week_target: 10, posts_por_semana: 4 },
};

export interface AmbienteProvisionado {
  ambienteId: string;
  slug: string;
  email: string;
  blocosVazios: number;
}

export async function provisionar(
  entrada: { slug: string; nome: string; email: string; senha: string },
  urlDono = process.env.DATABASE_URL_MIGRATIONS,
): Promise<AmbienteProvisionado> {
  if (!urlDono) throw new Error("DATABASE_URL_MIGRATIONS ausente");
  if (entrada.senha.length < 12) {
    throw new Error("senha curta demais — mínimo 12 caracteres");
  }

  // argon2id é o padrão da biblioteca e a variante recomendada: resiste tanto a
  // ataque por GPU quanto por canal lateral.
  const senhaHash = await argon2.hash(entrada.senha);

  const pool = new Pool({ connectionString: urlDono });
  const db = drizzle(pool, { schema });

  try {
    return await db.transaction(async (tx) => {
      const [ambiente] = await tx
        .insert(schema.ambiente)
        .values({
          slug: entrada.slug,
          nome: entrada.nome,
          prefixoMidia: `midia/${entrada.slug}`,
        })
        .returning();

      await tx.insert(schema.usuario).values({
        email: entrada.email,
        senhaHash,
        ambienteId: ambiente.id,
      });

      // Daqui para baixo as tabelas têm RLS com FORCE, que vale também para o
      // dono — sem declarar o ambiente, o próprio insert seria recusado.
      await tx.execute(
        sql`select set_config('app.ambiente', ${ambiente.id}, true)`,
      );

      await tx.insert(schema.config).values({
        ambienteId: ambiente.id,
        ...CONFIG_PADRAO,
      });

      await tx.insert(schema.vaultBloco).values(
        BLOCOS_VAZIOS.map((bloco, i) => ({
          ambienteId: ambiente.id,
          slug: bloco.slug,
          titulo: bloco.titulo,
          corpo: "",
          ordem: i + 1,
          escopo: bloco.slug === "temas" ? "por-pilar" : "sempre",
          contrato: bloco.contrato,
        })),
      );

      return {
        ambienteId: ambiente.id,
        slug: ambiente.slug,
        email: entrada.email,
        blocosVazios: BLOCOS_VAZIOS.length,
      };
    });
  } finally {
    await pool.end();
  }
}
