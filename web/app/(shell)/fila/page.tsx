import { Suspense } from "react";
import { QueueClient } from "@/components/queue/queue-client";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { listState } from "@/lib/store/briefs";
import { scoringOf, toBriefView } from "@/lib/view/brief-view";

export const dynamic = "force-dynamic";

export default async function Fila() {
  const manifest = await loadManifest();
  const paths = resolvePaths(manifest);
  const { briefs, failures } = await listState("pendente-aprovacao", paths);
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
