import { defineConfig } from "drizzle-kit";

/**
 * Migração roda como `radar_owner` — o papel dono das tabelas. A aplicação usa
 * `radar_app`, sem posse, que é o que faz o row-level security valer para ela
 * (docs/design-esquema-banco.md §1).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRATIONS!,
  },
  // As políticas de RLS fazem parte do esquema, não de um passo à parte.
  entities: { roles: { provider: "" } },
  verbose: true,
  strict: true,
});
