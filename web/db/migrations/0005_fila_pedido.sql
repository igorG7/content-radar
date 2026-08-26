CREATE TABLE "fila_pedido" (
	"scan_id" uuid PRIMARY KEY NOT NULL,
	"ambiente_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fila_pedido" ADD CONSTRAINT "fila_pedido_ambiente_id_ambiente_id_fk" FOREIGN KEY ("ambiente_id") REFERENCES "public"."ambiente"("id") ON DELETE cascade ON UPDATE no action;