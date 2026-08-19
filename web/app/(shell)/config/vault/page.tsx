import Link from "next/link";
import { ConfigTabs } from "@/components/config-tabs";
import { VaultMap } from "@/components/vault/vault-map";
import { Crumb } from "@/components/ui/pieces";

export default function Vault() {
  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb
            items={[
              { label: "Painel", href: "/" },
              { label: "Configuração", href: "/config" },
              { label: "Vault" },
            ]}
            back={{ href: "/config", destino: "Configuração" }}
          />
          <span className="eyebrow">blocos versionados · prosa</span>
        </div>
        <h1 className="display" style={{ marginTop: 12 }}>
          Configuração
        </h1>
        <ConfigTabs />
        <div
          className="row-between"
          style={{ marginTop: 16, alignItems: "flex-start", gap: 16 }}
        >
          <p className="lead" style={{ flex: "1 1 460px", minWidth: 0 }}>
            O vocabulário editorial da marca, em blocos de prosa. Cada bloco
            responde uma pergunta, e o que você confirma vira versão. Na
            varredura eles são montados num documento único e entregues ao
            agente como contexto — diferente da aba Operação, aqui não há
            invariante para validar na gravação: o efeito só aparece no próximo
            scan.
          </p>
          <Link className="btn btn-secondary" href="/config/vault/documento">
            Ver documento montado
          </Link>
        </div>
      </div>

      <VaultMap />
    </>
  );
}
