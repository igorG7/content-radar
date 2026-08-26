import { ChatClient } from "@/components/chat/chat-client";
import { Crumb } from "@/components/ui/pieces";

export const dynamic = "force-dynamic";

/**
 * O resumo da fila não vem mais daqui. O agente pergunta pelas ferramentas, e
 * pré-carregar um número que ele não usa só o deixaria desatualizado na tela.
 */
export default async function Chat() {
  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb
            items={[{ label: "Painel", href: "/" }, { label: "Chat" }]}
            back={{ href: "/", destino: "Painel" }}
          />
        </div>
        <h1 className="display" style={{ marginTop: 12 }}>
          Chat com o agente editorial
        </h1>
        <p className="lead">
          Converse sobre a fila, os pilares e a configuração — e peça a
          varredura por aqui. O que ele sabe vem do banco deste ambiente, e
          rodar a varredura é enfileirar: ela acontece fora da conversa.
        </p>
      </div>

      <ChatClient agoraIso={new Date().toISOString()} />
    </>
  );
}
