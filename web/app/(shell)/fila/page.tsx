import { Suspense } from "react";
import { QueueClient } from "@/components/queue/queue-client";
import { radarStore } from "@/lib/store";
import { scoringOf, toBriefView } from "@/lib/view/brief-view";

export const dynamic = "force-dynamic";

export default async function Fila() {
  const store = radarStore();
  const [manifest, { briefs, failures }] = await Promise.all([
    store.manifest(),
    store.listarFila(),
  ]);
  const scoring = scoringOf(manifest);

  // Caminho absoluto do servidor não atravessa a fronteira: o client recebe a view.
  const fila = briefs.map((b) => toBriefView(b, scoring));

  return (
    <Suspense>
      <QueueClient
        briefs={fila}
        ilegiveis={failures.length}
        scoring={{ matchScoreMin: scoring.matchScoreMin, borderlineMin: scoring.borderlineMin }}
      />
    </Suspense>
  );
}
