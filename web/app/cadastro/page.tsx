import { CadastroForm } from "@/components/cadastro-form";
import { ToastProvider } from "@/components/ui/toast";

// Fora do shell do app, como o login: quem chega aqui ainda não tem ambiente.
export default function Cadastro() {
  return (
    <ToastProvider>
      <main className="auth-wrap" id="conteudo">
        <CadastroForm />
      </main>
    </ToastProvider>
  );
}
