import { redirect } from "next/navigation";
import { PerfilClient } from "@/components/perfil-client";
import { sessaoAtual } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/**
 * A sessão vem do cookie, não do navegador.
 *
 * O perfil mostrava um `editor@empresa.com.br` que a própria tela fabricava no
 * `localStorage` quando não encontrava nenhum — então quem entrava com a sua
 * conta via o e-mail de outra pessoa.
 */
export default async function Perfil() {
  const sessao = await sessaoAtual();
  // O layout do shell já redireciona; aqui é o compilador que precisa saber.
  if (!sessao) redirect("/login");

  return (
    <PerfilClient
      sessao={{
        email: sessao.email,
        ambiente: sessao.ambienteNome,
        expiraEm: new Date(sessao.expiraEm).toISOString(),
      }}
    />
  );
}
