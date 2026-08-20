-- ON DELETE SET NULL numa chave estrangeira composta anula TODAS as colunas da
-- chave — inclusive ambiente_id, que é NOT NULL. O efeito é que apagar um brief
-- **falha**, em vez de preservar o evento sem o vínculo.
--
-- A intenção segue a mesma do desenho: apagar um brief não pode apagar o
-- registro de que ele existiu. O Postgres 15+ permite dizer quais colunas
-- anular, e é isso que faltava.

ALTER TABLE "evento" DROP CONSTRAINT "evento_ambiente_id_brief_id_brief_ambiente_id_id_fk";--> statement-breakpoint
ALTER TABLE "evento" DROP CONSTRAINT "evento_ambiente_id_scan_id_scan_ambiente_id_id_fk";--> statement-breakpoint

ALTER TABLE "evento" ADD CONSTRAINT "evento_ambiente_id_brief_id_brief_ambiente_id_id_fk"
  FOREIGN KEY ("ambiente_id","brief_id") REFERENCES "brief"("ambiente_id","id")
  ON DELETE SET NULL ("brief_id");--> statement-breakpoint

ALTER TABLE "evento" ADD CONSTRAINT "evento_ambiente_id_scan_id_scan_ambiente_id_id_fk"
  FOREIGN KEY ("ambiente_id","scan_id") REFERENCES "scan"("ambiente_id","id")
  ON DELETE SET NULL ("scan_id");--> statement-breakpoint

-- Mesma armadilha em brief.scan_id: apagar um scan derrubaria o ambiente_id do
-- brief, e a exclusão falharia.
ALTER TABLE "brief" DROP CONSTRAINT "brief_ambiente_id_scan_id_scan_ambiente_id_id_fk";--> statement-breakpoint
ALTER TABLE "brief" ADD CONSTRAINT "brief_ambiente_id_scan_id_scan_ambiente_id_id_fk"
  FOREIGN KEY ("ambiente_id","scan_id") REFERENCES "scan"("ambiente_id","id")
  ON DELETE SET NULL ("scan_id");
