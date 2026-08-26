CREATE TABLE "marca" (
	"ambiente_id" uuid PRIMARY KEY NOT NULL,
	"canal_principal" text NOT NULL,
	"telefone_exibicao" text,
	"telefone_e164" text,
	"telefone_secundario_e164" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marca" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "config" ADD COLUMN "visual_base" jsonb;--> statement-breakpoint
ALTER TABLE "pilar" ADD COLUMN "template" jsonb;--> statement-breakpoint
ALTER TABLE "marca" ADD CONSTRAINT "marca_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "isolamento" ON "marca" AS PERMISSIVE FOR ALL TO public USING ("marca"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("marca"."ambiente_id" = current_setting('app.ambiente', true)::uuid);
-- FORCE: a política vale também para o dono, como nas demais (0001).
ALTER TABLE "marca" FORCE ROW LEVEL SECURITY;
