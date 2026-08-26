CREATE TABLE "anexo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"conversa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"conteudo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anexo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_conversa_fk" FOREIGN KEY ("ambiente_id","conversa_id") REFERENCES "public"."conversa"("ambiente_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anexo_conversa_idx" ON "anexo" USING btree ("ambiente_id","conversa_id","criado_em");--> statement-breakpoint
CREATE POLICY "isolamento" ON "anexo" AS PERMISSIVE FOR ALL TO public USING ("anexo"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("anexo"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
-- O drizzle-kit emite apenas ENABLE. Sem FORCE o dono da tabela ignora a
-- política, e o dono é quem roda migração e script.
ALTER TABLE "anexo" FORCE ROW LEVEL SECURITY;
