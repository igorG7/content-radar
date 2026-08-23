import { Pool } from "pg";

/**
 * Decide se a suíte tem banco — e recusa-se a ser ambígua sobre isso.
 *
 * Antes cada arquivo de teste trazia sua própria cópia desta sonda, e todas
 * tratavam "não configurado" e "configurado mas fora do ar" do mesmo jeito:
 * `return false`, e os testes se pulavam em silêncio. Isso já custou caro uma
 * vez — o vitest apontado para um banco inexistente deixou **96 testes** serem
 * ignorados e a rodada terminou verde. Uma suíte que fica verde por não ter
 * rodado é pior que uma vermelha, porque ninguém vai investigar.
 *
 * Então a distinção passa a ser explícita:
 *
 *   - ninguém declarou banco  → pular é legítimo (a máquina não tem Postgres)
 *   - declarou e não responde → **lançar**, porque isso é defeito, não ausência
 */
export async function bancoDisponivel(): Promise<boolean> {
  const url = process.env.DATABASE_URL_MIGRATIONS;
  if (!url || !process.env.DATABASE_URL) return false;

  const sonda = new Pool({ connectionString: url });
  try {
    await sonda.query("select 1");
    return true;
  } catch (erro) {
    throw new Error(
      `DATABASE_URL_MIGRATIONS está declarada mas o banco não respondeu: ` +
        `${(erro as Error).message}\n\n` +
        `Não vou pular os testes de banco por causa disso — pulo silencioso ` +
        `aqui já escondeu 96 testes uma vez. Suba o banco, ou desconfigure a ` +
        `variável se a intenção era rodar sem ele.`,
    );
  } finally {
    await sonda.end();
  }
}

/**
 * Além de banco, exige que um ambiente semeado exista.
 *
 * Alguns testes leem a configuração real de um cliente (vault, pilares,
 * contrato de skill) em vez de semear a sua — é justamente o acoplamento com o
 * dado de verdade que lhes dá valor. Num banco recém-criado eles não têm o que
 * ler, e aí pular **é** a resposta certa; o que não pode é pular sem dizer.
 */
export async function ambienteSemeado(slug: string): Promise<boolean> {
  if (!(await bancoDisponivel())) return false;

  const sonda = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATIONS,
  });
  try {
    const { rows } = await sonda.query(
      "select count(*)::int n from ambiente where slug = $1",
      [slug],
    );
    if (rows[0].n === 0) {
      // `console.warn` aqui some: o vitest intercepta console durante a
      // coleta, e um arquivo que se pula inteiro nunca chega a exibir. Escrever
      // direto no stderr é o que atravessa — e sem isto este aviso seria
      // exatamente o pulo silencioso que o arquivo existe para acabar.
      process.stderr.write(
        `\n[teste] PULANDO ${slug}: ambiente ausente neste banco. ` +
          `Semeie-o (scripts/provisionar) ou aponte para um banco que o tenha.\n`,
      );
      return false;
    }
    return true;
  } finally {
    await sonda.end();
  }
}
