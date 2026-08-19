import { ChatClient } from "@/components/chat/chat-client";
import { Crumb } from "@/components/ui/pieces";
import { radarStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Chat() {
  const store = await radarStore();
  const [config, { briefs }] = await Promise.all([
    store.configuracao(),
    store.listarFila(),
  ]);

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb
            items={[{ label: "Painel", href: "/" }, { label: "Chat" }]}
            back={{ href: "/", destino: "Painel" }}
          />
          <span className="eyebrow">components/chat/chat-client.tsx</span>
        </div>
        <h1 className="display" style={{ marginTop: 12 }}>
          Chat com o agente editorial
        </h1>
        <p className="lead">
          A interface está pronta para streaming. O backend ainda não existe —
          nada aqui inventa endpoint, e a UI diz isso na cara.
        </p>
      </div>

      <ChatClient
        fila={{
          total: briefs.length,
          semArte: briefs.filter((b) => !b.heroChoiceDeclared).length,
          borderline: briefs.filter((b) => b.borderline).length,
          matchScoreMin: config.caps.match_score_min,
          borderlineMin: config.caps.borderline_min,
        }}
        agoraIso={new Date().toISOString()}
      />
    </>
  );
}
