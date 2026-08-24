import { LoginForm } from "@/components/login-form";
import { cadastroAberto } from "@/lib/cadastro-aberto";
import { ToastProvider } from "@/components/ui/toast";

// Fora do shell do app: sem nav, sem badge, sem guarda de rota.
export default function Login() {
  return (
    <ToastProvider>
      <main className="auth-wrap" id="conteudo">
        <LoginForm cadastroAberto={cadastroAberto()} />
      </main>
    </ToastProvider>
  );
}
