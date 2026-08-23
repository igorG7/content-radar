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

  /**
   * Fora do try acima de propósito: esquema atrasado não é falha de conexão, e
   * embrulhar um no outro produziu "o banco não respondeu: o banco está 1
   * migração atrás", que manda investigar a coisa errada.
   */
  const outra = new Pool({ connectionString: url });
  try {
    await esquemaEmDia(outra);
  } finally {
    await outra.end();
  }
  return true;
}

/**
 * Recusa rodar contra um esquema atrasado.
 *
 * A suíte roda no `radar_teste` e as migrações costumam ser aplicadas no banco
 * de trabalho primeiro. Sem esta checagem o sintoma é `relation "x" does not
 * exist` espalhado por vários arquivos, que parece defeito do código novo — foi
 * o que aconteceu na primeira migração depois de separar os bancos, e custou
 * minutos até eu perceber que o código estava certo e o banco é que estava
 * velho.
 *
 * Compara o que existe na pasta de migrações com o que o banco registra ter
 * aplicado. Contagem basta: as migrações só crescem, e nenhuma é reescrita.
 */
async function esquemaEmDia(sonda: Pool): Promise<void> {
  const { readdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "db", "migrations");
  const naPasta = (await readdir(dir)).filter((f) => f.endsWith(".sql")).length;

  const { rows } = await sonda.query<{ n: number }>(
    "select count(*)::int as n from drizzle.__drizzle_migrations",
  );
  const aplicadas = rows[0]?.n ?? 0;

  if (aplicadas < naPasta) {
    throw new Error(
      `o banco de teste está ${naPasta - aplicadas} migração(ões) atrás ` +
        `(${aplicadas} de ${naPasta}). Rode:

` +
        `  npx tsx --env-file=.env.local scripts/preparar-banco-de-teste.mts
`,
    );
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
