CREATE TABLE "conversa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"sessao_agente" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversa_ambiente_id_uk" UNIQUE("ambiente_id","id")
);
--> statement-breakpoint
ALTER TABLE "conversa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mensagem" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"conversa_id" uuid NOT NULL,
	"papel" text NOT NULL,
	"corpo" text NOT NULL,
	"ferramentas" text[],
	"modelo" text,
	"esforco" text,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mensagem" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_conversa_fk" FOREIGN KEY ("ambiente_id","conversa_id") REFERENCES "public"."conversa"("ambiente_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mensagem_conversa_idx" ON "mensagem" USING btree ("ambiente_id","conversa_id","ts");--> statement-breakpoint
CREATE POLICY "isolamento" ON "conversa" AS PERMISSIVE FOR ALL TO public USING ("conversa"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("conversa"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "mensagem" AS PERMISSIVE FOR ALL TO public USING ("mensagem"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("mensagem"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
-- FORCE, e não só ENABLE: sem ele o dono da tabela ignora a política, e o
-- isolamento passaria a depender de com qual papel a conexão foi aberta. O
-- drizzle-kit só emite ENABLE, então cada tabela nova precisa desta linha —
-- ver 0001_protecoes.sql, onde as primeiras dezessete foram tratadas.
ALTER TABLE "conversa" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mensagem" FORCE ROW LEVEL SECURITY;
