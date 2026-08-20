ALTER TABLE "scan" ADD COLUMN "pedido_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Os scans que já existem foram pedidos e iniciados no mesmo instante: antes da
-- fila não havia espera entre um e outro. Sem este backfill eles ficariam com
-- pedido_em = agora, e o histórico passaria a dizer que scans de maio foram
-- pedidos hoje.
UPDATE "scan" SET "pedido_em" = "iniciado_em" WHERE "iniciado_em" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "scan" ALTER COLUMN "iniciado_em" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scan" ALTER COLUMN "iniciado_em" DROP NOT NULL;
