import { Suspense } from "react";
import { ArchiveClient } from "@/components/archive-client";
import { Crumb } from "@/components/ui/pieces";
import { radarStore } from "@/lib/store";
import { scoringOf, toBriefView } from "@/lib/view/brief-view";

export const dynamic = "force-dynamic";

export default async function Acervo() {
  const store = await radarStore();
  const [manifest, listings] = await Promise.all([
    store.manifest(),
    store.listarTodos(),
  ]);
  const scoring = scoringOf(manifest);

  const briefs = listings
    .filter((l) => l.state !== "pendente-aprovacao")
    .flatMap((l) => l.briefs.map((b) => toBriefView(b, scoring)));

  const windows = manifest.anti_repetition.windows;
  const janelas = [
    windows?.pillar_icp_redundant_days ?? 14,
    windows?.rejeitado_days ?? 30,
    windows?.publicado_days ?? 90,
  ].filter((value, index, all) => all.indexOf(value) === index);

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb
            items={[{ label: "Painel", href: "/" }, { label: "Acervo" }]}
            back={{ href: "/", destino: "Painel" }}
          />
          <span className="eyebrow">store/briefs/ · leitura</span>
        </div>
        <h1 className="display" style={{ marginTop: 12 }}>
          Acervo
        </h1>
        <p className="lead">
          O que já saiu da fila. Consultar antes de aprovar algo parecido é a
          defesa contra repetição — as janelas de anti-repetição são de{" "}
          {janelas.join(", ")} dias.
        </p>
      </div>

      <Suspense>
        <ArchiveClient
          briefs={briefs}
          janelas={janelas}
          agoraIso={new Date().toISOString()}
        />
      </Suspense>
    </>
  );
}
