/**
 * O Next carrega `.env.local` sozinho; o vitest não. Sem isto os testes de
 * isolamento pulariam sempre — e pulo silencioso num teste de segurança é pior
 * que teste nenhum, porque parece cobertura.
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/**
 * A suíte roda em `radar_teste`, nunca no banco de trabalho.
 *
 * O desvio acontece aqui, e não num `.env.test` à parte, porque um segundo
 * arquivo de env é uma coisa que se esquece de configurar — e o sintoma de
 * esquecer seria a suíte rodando contra dado real sem avisar. Derivando do
 * mesmo URL, não existe o caminho onde alguém erra.
 *
 * Não é preciosismo. O trabalhador do pm2 escuta a fila do banco de trabalho e
 * **reivindica pedido de teste como se fosse varredura de verdade** — chegou a
 * tentar executar, e só parou porque o ambiente de teste não tem vault. A
 * proteção era acidental; esta é deliberada.
 */
const BANCO_DE_TESTE = "radar_teste";

for (const chave of ["DATABASE_URL", "DATABASE_URL_MIGRATIONS"]) {
  const valor = process.env[chave];
  if (!valor) continue;
  const u = new URL(valor);
  u.pathname = `/${BANCO_DE_TESTE}`;
  process.env[chave] = u.toString();
}
