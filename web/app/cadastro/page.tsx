import { notFound } from "next/navigation";
import { CadastroForm } from "@/components/cadastro-form";
import { cadastroAberto } from "@/lib/cadastro-aberto";
import { ToastProvider } from "@/components/ui/toast";

// Fora do shell do app, como o login: quem chega aqui ainda não tem ambiente.
export default function Cadastro() {
  // 404 e não uma mensagem de "fechado": a existência da tela não é informação
  // que interesse a quem tentar a URL.
  if (!cadastroAberto()) notFound();

  return (
    <ToastProvider>
      <main className="auth-wrap" id="conteudo">
        <CadastroForm />
      </main>
    </ToastProvider>
  );
}
