CREATE TYPE "public"."brief_estado" AS ENUM('pendente-aprovacao', 'pendente-publicacao', 'publicado', 'rejeitado');--> statement-breakpoint
CREATE TABLE "ambiente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"prefixo_midia" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ambiente_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "brief" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"brief_id" text NOT NULL,
	"slug" text NOT NULL,
	"estado" "brief_estado" NOT NULL,
	"pilar_slug" text NOT NULL,
	"publico_slug" text NOT NULL,
	"match_score" numeric(3, 2),
	"borderline" boolean DEFAULT false NOT NULL,
	"borderline_motivo" text,
	"topic_hash" text NOT NULL,
	"headline" text NOT NULL,
	"hook" text,
	"caption_draft" text,
	"cta" text,
	"hashtags" text[],
	"score_detalhe" jsonb,
	"evidencias" jsonb,
	"origem" jsonb,
	"visual_brief" jsonb,
	"destino_od" jsonb,
	"hero_indice" smallint,
	"hero_decidido_em" timestamp with time zone,
	"hero_decidido_por" uuid,
	"scan_id" uuid,
	"review_notes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"handoff_em" timestamp with time zone,
	"publicado_em" timestamp with time zone,
	"ig_post_url" text,
	CONSTRAINT "brief_ref_uk" UNIQUE("ambiente_id","brief_id"),
	CONSTRAINT "brief_ambiente_id_uk" UNIQUE("ambiente_id","id")
);
--> statement-breakpoint
ALTER TABLE "brief" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brief_candidata" (
	"ambiente_id" uuid NOT NULL,
	"brief_id" uuid NOT NULL,
	"indice" smallint NOT NULL,
	"source_url" text,
	"image_url" text,
	"objeto_path" text,
	"cloud_url" text,
	"cloudinary_public_id" text,
	"alt" text,
	"license_hint" text,
	"licensable" boolean,
	"mime_type" text,
	CONSTRAINT "brief_candidata_brief_id_indice_pk" PRIMARY KEY("brief_id","indice")
);
--> statement-breakpoint
ALTER TABLE "brief_candidata" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "config" (
	"ambiente_id" uuid PRIMARY KEY NOT NULL,
	"pesos" jsonb NOT NULL,
	"caps" jsonb NOT NULL,
	"janelas" jsonb NOT NULL,
	"volume" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "escopo_busca" (
	"ambiente_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "escopo_busca_ambiente_id_slug_pk" PRIMARY KEY("ambiente_id","slug")
);
--> statement-breakpoint
ALTER TABLE "escopo_busca" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "escopo_pilar" (
	"ambiente_id" uuid NOT NULL,
	"escopo_slug" text NOT NULL,
	"pilar_slug" text NOT NULL,
	CONSTRAINT "escopo_pilar_ambiente_id_escopo_slug_pilar_slug_pk" PRIMARY KEY("ambiente_id","escopo_slug","pilar_slug")
);
--> statement-breakpoint
ALTER TABLE "escopo_pilar" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evento" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" text NOT NULL,
	"ator" text NOT NULL,
	"usuario_id" uuid,
	"brief_id" uuid,
	"scan_id" uuid,
	"de_estado" "brief_estado",
	"para_estado" "brief_estado",
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fonte" (
	"ambiente_id" uuid NOT NULL,
	"escopo_slug" text NOT NULL,
	"slug" text NOT NULL,
	"url" text NOT NULL,
	"nota" text,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "fonte_ambiente_id_escopo_slug_slug_pk" PRIMARY KEY("ambiente_id","escopo_slug","slug")
);
--> statement-breakpoint
ALTER TABLE "fonte" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guardrail" (
	"ambiente_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"corpo" text NOT NULL,
	CONSTRAINT "guardrail_ambiente_id_slug_pk" PRIMARY KEY("ambiente_id","slug")
);
--> statement-breakpoint
ALTER TABLE "guardrail" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pilar" (
	"ambiente_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"corpo" text NOT NULL,
	"ordem" smallint NOT NULL,
	"no_radar" boolean DEFAULT true NOT NULL,
	CONSTRAINT "pilar_ambiente_id_slug_pk" PRIMARY KEY("ambiente_id","slug")
);
--> statement-breakpoint
ALTER TABLE "pilar" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "publico" (
	"ambiente_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"corpo" text NOT NULL,
	"padrao" boolean DEFAULT false NOT NULL,
	CONSTRAINT "publico_ambiente_id_slug_pk" PRIMARY KEY("ambiente_id","slug")
);
--> statement-breakpoint
ALTER TABLE "publico" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"scan_ref" text NOT NULL,
	"escopo" text NOT NULL,
	"pilar_filtro" text,
	"alvo_qtd" smallint,
	"estado" text NOT NULL,
	"vault_versao" bigint,
	"iniciado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"encerrado_em" timestamp with time zone,
	CONSTRAINT "scan_ref_uk" UNIQUE("ambiente_id","scan_ref"),
	CONSTRAINT "scan_ambiente_id_uk" UNIQUE("ambiente_id","id")
);
--> statement-breakpoint
ALTER TABLE "scan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tema" (
	"ambiente_id" uuid NOT NULL,
	"pilar_slug" text NOT NULL,
	"codigo" text NOT NULL,
	"categoria" text NOT NULL,
	"titulo" text NOT NULL,
	"angulo" text,
	"esgotado_em" timestamp with time zone,
	"usado_em" timestamp with time zone,
	CONSTRAINT "tema_ambiente_id_pilar_slug_codigo_pk" PRIMARY KEY("ambiente_id","pilar_slug","codigo")
);
--> statement-breakpoint
ALTER TABLE "tema" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email"),
	CONSTRAINT "usuario_ambiente_id_uk" UNIQUE("ambiente_id","id")
);
--> statement-breakpoint
CREATE TABLE "vault_bloco" (
	"ambiente_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"titulo" text NOT NULL,
	"corpo" text NOT NULL,
	"ordem" smallint NOT NULL,
	"escopo" text NOT NULL,
	"contrato" text NOT NULL,
	"versao" bigint DEFAULT 1 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vault_bloco_ambiente_id_slug_pk" PRIMARY KEY("ambiente_id","slug")
);
--> statement-breakpoint
ALTER TABLE "vault_bloco" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vault_bloco_versao" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"versao" bigint NOT NULL,
	"corpo" text NOT NULL,
	"motivo" text NOT NULL,
	"autor_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vault_bloco_versao_uk" UNIQUE("ambiente_id","slug","versao")
);
--> statement-breakpoint
ALTER TABLE "vault_bloco_versao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brief" ADD CONSTRAINT "brief_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief" ADD CONSTRAINT "brief_hero_decidido_por_usuario_id_fk" FOREIGN KEY ("hero_decidido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief" ADD CONSTRAINT "brief_ambiente_id_pilar_slug_pilar_ambiente_id_slug_fk" FOREIGN KEY ("ambiente_id","pilar_slug") REFERENCES "public"."pilar"("ambiente_id","slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief" ADD CONSTRAINT "brief_ambiente_id_publico_slug_publico_ambiente_id_slug_fk" FOREIGN KEY ("ambiente_id","publico_slug") REFERENCES "public"."publico"("ambiente_id","slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief" ADD CONSTRAINT "brief_ambiente_id_scan_id_scan_ambiente_id_id_fk" FOREIGN KEY ("ambiente_id","scan_id") REFERENCES "public"."scan"("ambiente_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_candidata" ADD CONSTRAINT "brief_candidata_ambiente_id_brief_id_brief_ambiente_id_id_fk" FOREIGN KEY ("ambiente_id","brief_id") REFERENCES "public"."brief"("ambiente_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escopo_busca" ADD CONSTRAINT "escopo_busca_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escopo_pilar" ADD CONSTRAINT "escopo_pilar_ambiente_id_escopo_slug_escopo_busca_ambiente_id_slug_fk" FOREIGN KEY ("ambiente_id","escopo_slug") REFERENCES "public"."escopo_busca"("ambiente_id","slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escopo_pilar" ADD CONSTRAINT "escopo_pilar_ambiente_id_pilar_slug_pilar_ambiente_id_slug_fk" FOREIGN KEY ("ambiente_id","pilar_slug") REFERENCES "public"."pilar"("ambiente_id","slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_ambiente_id_brief_id_brief_ambiente_id_id_fk" FOREIGN KEY ("ambiente_id","brief_id") REFERENCES "public"."brief"("ambiente_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento" ADD CONSTRAINT "evento_ambiente_id_scan_id_scan_ambiente_id_id_fk" FOREIGN KEY ("ambiente_id","scan_id") REFERENCES "public"."scan"("ambiente_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fonte" ADD CONSTRAINT "fonte_ambiente_id_escopo_slug_escopo_busca_ambiente_id_slug_fk" FOREIGN KEY ("ambiente_id","escopo_slug") REFERENCES "public"."escopo_busca"("ambiente_id","slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrail" ADD CONSTRAINT "guardrail_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilar" ADD CONSTRAINT "pilar_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publico" ADD CONSTRAINT "publico_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan" ADD CONSTRAINT "scan_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tema" ADD CONSTRAINT "tema_ambiente_id_pilar_slug_pilar_ambiente_id_slug_fk" FOREIGN KEY ("ambiente_id","pilar_slug") REFERENCES "public"."pilar"("ambiente_id","slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_bloco" ADD CONSTRAINT "vault_bloco_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_bloco_versao" ADD CONSTRAINT "vault_bloco_versao_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_bloco_versao" ADD CONSTRAINT "vault_bloco_versao_ambiente_id_slug_vault_bloco_ambiente_id_slug_fk" FOREIGN KEY ("ambiente_id","slug") REFERENCES "public"."vault_bloco"("ambiente_id","slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brief_estado_idx" ON "brief" USING btree ("ambiente_id","estado","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "brief_hash_idx" ON "brief" USING btree ("ambiente_id","topic_hash");--> statement-breakpoint
CREATE INDEX "brief_pilar_publico_idx" ON "brief" USING btree ("ambiente_id","pilar_slug","publico_slug","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "evento_ts_idx" ON "evento" USING btree ("ambiente_id","ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "evento_brief_idx" ON "evento" USING btree ("ambiente_id","brief_id","ts");--> statement-breakpoint
CREATE POLICY "isolamento" ON "brief" AS PERMISSIVE FOR ALL TO public USING ("brief"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("brief"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "brief_candidata" AS PERMISSIVE FOR ALL TO public USING ("brief_candidata"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("brief_candidata"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "config" AS PERMISSIVE FOR ALL TO public USING ("config"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("config"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "escopo_busca" AS PERMISSIVE FOR ALL TO public USING ("escopo_busca"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("escopo_busca"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "escopo_pilar" AS PERMISSIVE FOR ALL TO public USING ("escopo_pilar"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("escopo_pilar"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "evento" AS PERMISSIVE FOR ALL TO public USING ("evento"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("evento"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "fonte" AS PERMISSIVE FOR ALL TO public USING ("fonte"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("fonte"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "guardrail" AS PERMISSIVE FOR ALL TO public USING ("guardrail"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("guardrail"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "pilar" AS PERMISSIVE FOR ALL TO public USING ("pilar"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("pilar"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "publico" AS PERMISSIVE FOR ALL TO public USING ("publico"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("publico"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "scan" AS PERMISSIVE FOR ALL TO public USING ("scan"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("scan"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "tema" AS PERMISSIVE FOR ALL TO public USING ("tema"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("tema"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "vault_bloco" AS PERMISSIVE FOR ALL TO public USING ("vault_bloco"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("vault_bloco"."ambiente_id" = current_setting('app.ambiente', true)::uuid);--> statement-breakpoint
CREATE POLICY "isolamento" ON "vault_bloco_versao" AS PERMISSIVE FOR ALL TO public USING ("vault_bloco_versao"."ambiente_id" = current_setting('app.ambiente', true)::uuid) WITH CHECK ("vault_bloco_versao"."ambiente_id" = current_setting('app.ambiente', true)::uuid);