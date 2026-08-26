-- Duas proteções que o esquema do Drizzle não expressa.

-- 1. FORCE ROW LEVEL SECURITY
--
-- ENABLE sozinho não vale para o dono da tabela: o Postgres deixa quem criou
-- ignorar as próprias políticas. Como as migrações rodam como `radar_owner`,
-- que é o dono, uma string de conexão errada na aplicação desligaria o
-- isolamento em silêncio. Com FORCE, a política vale para todo mundo.
--
-- Consequência conhecida, medida em teste: o importador roda como `radar_owner`
-- e também é bloqueado — precisa declarar `app.ambiente` a cada lote. É o
-- comportamento desejado, não um obstáculo.

ALTER TABLE "brief" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brief_candidata" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "escopo_busca" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "escopo_pilar" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evento" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fonte" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guardrail" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pilar" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "publico" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scan" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tema" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vault_bloco" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vault_bloco_versao" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- 2. O ledger é append-only, e isso não pode depender de disciplina
--
-- É a trilha de auditoria: a única garantia dela é não ser reescrita. As
-- permissões padrão concedem CRUD à aplicação em toda tabela nova; aqui as duas
-- que reescrevem são retiradas. O banco recusa, e ninguém precisa lembrar.
--
-- `radar_owner` mantém UPDATE e DELETE — retenção e arquivamento são operação
-- de manutenção, não de aplicação.

REVOKE UPDATE, DELETE ON TABLE "evento" FROM "radar_app";
