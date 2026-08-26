import { VaultBloco } from "@/components/vault/vault-bloco";
import { CampoContato } from "@/components/vault/campo-contato";
import { radarStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Blocos de prosa abrem a entrevista; blocos de campo abrem formulário. O
 * desvio acontece aqui, e não dentro do editor, porque são telas de naturezas
 * diferentes — não variações da mesma.
 */
export default async function BlocoDoVault({
  params,
}: PageProps<"/config/vault/[bloco]">) {
  const { bloco } = await params;

  if (bloco === "contato") {
    const store = await radarStore();
    return <CampoContato atual={await store.contato()} />;
  }

  return <VaultBloco chave={bloco} />;
}
