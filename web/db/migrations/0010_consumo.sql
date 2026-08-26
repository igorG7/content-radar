CREATE TABLE "consumo" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"origem" text NOT NULL,
	"scan_id" uuid,
	"conversa_id" uuid,
	"modelo" text NOT NULL,
	"input_tokens" bigint NOT NULL,
	"output_tokens" bigint NOT NULL,
	"cache_leitura_tokens" bigint NOT NULL,
	"cache_escrita_tokens" bigint NOT NULL,
	"buscas_web" bigint DEFAULT 0 NOT NULL,
	"custo_usd" numeric(12, 6) NOT NULL,
	"extra" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consumo" ADD CONSTRAINT "consumo_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumo" ADD CONSTRAINT "consumo_scan_fk" FOREIGN KEY ("ambiente_id","scan_id") REFERENCES "public"."scan"("ambiente_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumo" ADD CONSTRAINT "consumo_conversa_fk" FOREIGN KEY ("ambiente_id","conversa_id") REFERENCES "public"."conversa"("ambiente_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consumo_ambiente_idx" ON "consumo" USING btree ("ambiente_id","criado_em");--> statement-breakpoint
CREATE INDEX "consumo_scan_idx" ON "consumo" USING btree ("ambiente_id","scan_id");--> statement-breakpoint
CREATE POLICY "isolamento" ON "consumo" AS PERMISSIVE FOR ALL TO public USING ("consumo"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("consumo"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
-- O drizzle-kit emite apenas ENABLE. Sem FORCE, o dono da tabela ignora a
-- política — e o dono é quem roda migração e script, exatamente os caminhos
-- onde um vazamento passaria despercebido.
ALTER TABLE "consumo" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Append-only, pelo mesmo motivo do ledger: consumo é registro do que
-- aconteceu. Se dá para reescrever, deixa de servir para conferir fatura.
REVOKE UPDATE, DELETE ON TABLE "consumo" FROM radar_app;
