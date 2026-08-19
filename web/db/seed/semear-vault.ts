/**
 * Grava o vault lido de `docs/vault-avanz.md` num ambiente.
 *
 * Roda como `radar_owner`, que também é barrado pelo FORCE ROW LEVEL SECURITY —
 * por isso declara `app.ambiente` na própria transação, igual à aplicação. Não
 * é contorno: é a mesma porta, e o teste de isolamento passa por ela.
 *
 * Idempotente: rodar de novo atualiza o que mudou e não duplica nada. O
 * importador vai rodar contra cópia várias vezes até as contagens baterem.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema";
import {
  extrairGuardrails,
  extrairSubBlocos,
  extrairTemas,
  lerVaultDaAvanz,
  type BlocoLido,
} from "./vault";

export interface ResultadoSemeadura {
  blocos: number;
  pilares: number;
  publicos: number;
  guardrails: number;
  temas: number;
  /** Pilar a que o banco de temas pertence — hoje o documento traz um só. */
  temasDoPilar: string;
}

/** O banco de temas do documento é o do pilar de decisão. */
const PILAR_DOS_TEMAS = "decisao-inteligente";

/** Público assumido quando a pauta não deixa claro — teto de score em 0,45. */
const PUBLICO_PADRAO = "comprador";

/** Fora do escopo do radar: vive em stories, decisão humana ad-hoc. */
const FORA_DO_RADAR = new Set(["bastidor"]);

export async function semearVault(
  ambienteId: string,
  urlDono = process.env.DATABASE_URL_MIGRATIONS,
): Promise<ResultadoSemeadura> {
  if (!urlDono) throw new Error("DATABASE_URL_MIGRATIONS ausente");

  const blocos = await lerVaultDaAvanz();
  const acha = (slug: string): BlocoLido => {
    const bloco = blocos.find((b) => b.slug === slug);
    if (!bloco) throw new Error(`bloco ausente depois da leitura: ${slug}`);
    return bloco;
  };

  const pilares = extrairSubBlocos(acha("pilares").corpo);
  const publicos = extrairSubBlocos(acha("publicos").corpo);
  const guardrails = extrairGuardrails(acha("guardrails").corpo);
  const temas = extrairTemas(acha("temas").corpo);

  if (!pilares.some((p) => p.slug === PILAR_DOS_TEMAS)) {
    throw new Error(
      `o banco de temas aponta para "${PILAR_DOS_TEMAS}", que não está nos pilares`,
    );
  }
  if (!publicos.some((p) => p.slug === PUBLICO_PADRAO)) {
    throw new Error(
      `o público padrão "${PUBLICO_PADRAO}" não está no bloco de públicos`,
    );
  }

  const pool = new Pool({ connectionString: urlDono });
  const db = drizzle(pool, { schema });

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.ambiente', ${ambienteId}, true)`,
      );

      for (const bloco of blocos) {
        await tx
          .insert(schema.vaultBloco)
          .values({
            ambienteId,
            slug: bloco.slug,
            titulo: bloco.titulo,
            corpo: bloco.corpo,
            ordem: bloco.ordem,
            escopo: bloco.escopo,
            contrato: bloco.contrato,
          })
          .onConflictDoUpdate({
            target: [schema.vaultBloco.ambienteId, schema.vaultBloco.slug],
            set: {
              titulo: bloco.titulo,
              corpo: bloco.corpo,
              ordem: bloco.ordem,
              escopo: bloco.escopo,
              contrato: bloco.contrato,
              atualizadoEm: new Date(),
            },
          });

        await tx
          .insert(schema.vaultBlocoVersao)
          .values({
            ambienteId,
            slug: bloco.slug,
            versao: 1,
            corpo: bloco.corpo,
            motivo: "importado do vault de arquivos da Avanz",
          })
          .onConflictDoNothing();
      }

      // Pilares antes de temas: o tema referencia o pilar por chave composta.
      for (const pilar of pilares) {
        await tx
          .insert(schema.pilar)
          .values({
            ambienteId,
            slug: pilar.slug,
            nome: pilar.nome,
            corpo: pilar.corpo,
            ordem: pilar.ordem,
            noRadar: !FORA_DO_RADAR.has(pilar.slug),
          })
          .onConflictDoUpdate({
            target: [schema.pilar.ambienteId, schema.pilar.slug],
            set: { nome: pilar.nome, corpo: pilar.corpo, ordem: pilar.ordem },
          });
      }

      for (const publico of publicos) {
        await tx
          .insert(schema.publico)
          .values({
            ambienteId,
            slug: publico.slug,
            nome: publico.nome,
            corpo: publico.corpo,
            padrao: publico.slug === PUBLICO_PADRAO,
          })
          .onConflictDoUpdate({
            target: [schema.publico.ambienteId, schema.publico.slug],
            set: { nome: publico.nome, corpo: publico.corpo },
          });
      }

      for (const guardrail of guardrails) {
        await tx
          .insert(schema.guardrail)
          .values({ ambienteId, slug: guardrail.slug, corpo: guardrail.corpo })
          .onConflictDoUpdate({
            target: [schema.guardrail.ambienteId, schema.guardrail.slug],
            set: { corpo: guardrail.corpo },
          });
      }

      for (const tema of temas) {
        await tx
          .insert(schema.tema)
          .values({
            ambienteId,
            pilarSlug: PILAR_DOS_TEMAS,
            codigo: tema.codigo,
            categoria: tema.categoria,
            titulo: tema.titulo,
            angulo: tema.angulo,
          })
          .onConflictDoUpdate({
            target: [
              schema.tema.ambienteId,
              schema.tema.pilarSlug,
              schema.tema.codigo,
            ],
            set: {
              categoria: tema.categoria,
              titulo: tema.titulo,
              angulo: tema.angulo,
            },
          });
      }

      return {
        blocos: blocos.length,
        pilares: pilares.length,
        publicos: publicos.length,
        guardrails: guardrails.length,
        temas: temas.length,
        temasDoPilar: PILAR_DOS_TEMAS,
      };
    });
  } finally {
    await pool.end();
  }
}
