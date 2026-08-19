import { VaultBloco } from "@/components/vault/vault-bloco";

export default async function BlocoDoVault({
  params,
}: PageProps<"/config/vault/[bloco]">) {
  const { bloco } = await params;
  return <VaultBloco chave={bloco} />;
}
