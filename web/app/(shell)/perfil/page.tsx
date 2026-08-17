import { PerfilClient, type AtividadeEvento } from "@/components/perfil-client";
import { radarStore } from "@/lib/store";
import { eventLabel } from "@/lib/view/ledger-view";

export const dynamic = "force-dynamic";

export default async function Perfil() {
  const ledger = await radarStore().lerLedger();

  // O ledger identifica quem agiu pelo prefixo do ator. Como o painel não tem
  // múltiplos usuários, a atividade "sua" é a atividade humana inteira.
  const atividade: AtividadeEvento[] = ledger.events
    .filter((evento) => /^human/.test(evento.actor ?? ""))
    .reverse()
    .slice(0, 40)
    .map((evento) => ({
      ts: evento.ts,
      event: evento.event,
      rotulo: eventLabel(evento.event),
      briefId: evento.brief_id ?? null,
    }));

  return <PerfilClient atividade={atividade} />;
}
