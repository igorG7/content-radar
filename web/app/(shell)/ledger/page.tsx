import { Suspense } from "react";
import { LedgerClient, type BriefRef } from "@/components/ledger-client";
import { Crumb } from "@/components/ui/pieces";
import { IconAlert } from "@/components/ui/icons";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { listAllStates } from "@/lib/store/briefs";
import { readLedger } from "@/lib/store/ledger";

export const dynamic = "force-dynamic";

export default async function Ledger() {
  const paths = resolvePaths(await loadManifest());
  const [ledger, listings] = await Promise.all([readLedger(paths.ledger), listAllStates(paths)]);

  const briefs: BriefRef[] = listings.flatMap((listing) =>
    listing.briefs.map((brief) => ({
      briefId: brief.briefId,
      slug: brief.slug,
      state: brief.state,
      headline: brief.headline ?? brief.slug,
    })),
  );

  // Mais recente primeiro: o arquivo é append-only, então a ordem no disco é
  // cronológica crescente.
  const eventos = [...ledger.events].reverse();

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb items={[{ label: "Painel", href: "/" }, { label: "Ledger" }]} />
          <span className="eyebrow">store/ledger.jsonl · append-only</span>
        </div>
        <h1 className="display" style={{ marginTop: 12 }}>
          Auditoria
        </h1>
        <p className="lead">
          Uma linha JSON por evento, nunca reescrita. É o que permite responder “quem aprovou isso,
          quando, e por quê” sem banco de dados.
        </p>
      </div>

      {ledger.malformedLines.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <IconAlert />
          <div className="alert-body">
            <strong>{ledger.malformedLines.length} linha(s) não parseiam</strong>
            <p className="small" style={{ marginTop: 3 }}>
              Linhas {ledger.malformedLines.join(", ")}. Elas continuam no arquivo — a leitura só as
              ignora.
            </p>
          </div>
        </div>
      )}

      <Suspense>
        <LedgerClient eventos={eventos} briefs={briefs} />
      </Suspense>
    </>
  );
}
