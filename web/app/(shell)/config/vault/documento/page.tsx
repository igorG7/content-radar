import Link from "next/link";
import { VaultDocumento } from "@/components/vault/vault-documento";
import { Crumb } from "@/components/ui/pieces";

export default function DocumentoMontado() {
  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb
            items={[
              { label: "Painel", href: "/" },
              { label: "Configuração", href: "/config" },
              { label: "Vault", href: "/config/vault" },
              { label: "Documento montado" },
            ]}
            back={{ href: "/config/vault", destino: "Vault" }}
          />
          <span className="eyebrow">contexto da varredura</span>
        </div>
        <div className="row-between" style={{ marginTop: 12 }}>
          <h1 className="display">Documento montado</h1>
          <Link className="btn btn-secondary" href="/config/vault">
            Voltar aos blocos
          </Link>
        </div>
        <p className="lead" style={{ marginTop: 12 }}>
          É exatamente isto que vai como contexto na próxima varredura — os blocos na ordem, sem
          metadado no meio. Montar o documento é responsabilidade do produto, então ver o resultado é
          a única forma de perceber se ele degradou.
        </p>
      </div>

      <VaultDocumento />
    </>
  );
}
