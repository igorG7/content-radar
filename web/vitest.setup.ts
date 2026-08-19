/**
 * O Next carrega `.env.local` sozinho; o vitest não. Sem isto os testes de
 * isolamento pulariam sempre — e pulo silencioso num teste de segurança é pior
 * que teste nenhum, porque parece cobertura.
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
