import { ChatClient } from "@/components/chat-client";
import { Crumb } from "@/components/ui/pieces";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { listState } from "@/lib/store/briefs";

export const dynamic = "force-dynamic";

export default async function Chat() {
  const manifest = await loadManifest();
  const paths = resolvePaths(manifest);
  const { briefs } = await listState("pendente-aprovacao", paths);

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb items={[{ label: "Painel", href: "/" }, { label: "Chat" }]} />
          <span className="eyebrow">components/chat-client.tsx</span>
        </div>
        <h1 className="display" style={{ marginTop: 12 }}>
          Chat com o agente editorial
        </h1>
        <p className="lead">
          A interface está pronta para streaming. O backend ainda não existe — nada aqui inventa
          endpoint, e a UI diz isso na cara.
        </p>
      </div>

      <ChatClient
        fila={{
          total: briefs.length,
          semArte: briefs.filter((b) => !b.heroChoiceDeclared).length,
          borderline: briefs.filter((b) => b.borderline).length,
          matchScoreMin: manifest.anti_repetition.match_score_min,
          borderlineMin: manifest.anti_repetition.borderline_min,
        }}
      />
    </>
  );
}
