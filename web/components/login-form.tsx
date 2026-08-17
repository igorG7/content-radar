"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { entrar, sair, useSessao } from "@/lib/session";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const destino = params.get("next") ?? "/";

  // A tela nunca redireciona sozinha: em preview isso vira um laço sem saída.
  const sessao = useSessao();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erroEmail, setErroEmail] = useState(false);
  const [erroSenha, setErroSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);

  function submeter(event: React.FormEvent) {
    event.preventDefault();
    const emailOk = EMAIL_OK.test(email.trim());
    const senhaOk = senha.length >= 8;
    setErroEmail(!emailOk);
    setErroSenha(!senhaOk);
    if (!emailOk || !senhaOk) return;

    setEntrando(true);
    entrar(email.trim().toLowerCase());
    router.push(destino);
  }

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="brand-mark">content&#8203;·radar</span>
      </div>

      <div className="auth-panel">
        {sessao && (
          <div className="sunken" style={{ marginBottom: 18, padding: "12px 14px" }}>
            <p className="small">
              Você já está conectado como <span className="strong">{sessao.email}</span>.
            </p>
            <div className="row-tight" style={{ marginTop: 10 }}>
              <Link className="btn btn-primary btn-sm" href={destino}>
                Ir para o painel
              </Link>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => sair()}
              >
                Encerrar sessão
              </button>
            </div>
          </div>
        )}

        <h1 className="h2" style={{ textAlign: "center" }}>
          Entrar
        </h1>
        <p className="small muted" style={{ textAlign: "center", marginTop: 6 }}>
          Painel editorial — acesso restrito a quem aprova pauta.
        </p>

        <form className="stack-sm" noValidate style={{ marginTop: 22 }} onSubmit={submeter}>
          <div className={`field ${erroEmail ? "field-invalid" : ""}`}>
            <label htmlFor="email">E-mail</label>
            <input
              className="input"
              type="email"
              id="email"
              autoComplete="username"
              placeholder="voce@empresa.com.br"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErroEmail(false);
              }}
            />
            {erroEmail && <p className="field-error">Informe um e-mail válido.</p>}
          </div>

          <div className={`field ${erroSenha ? "field-invalid" : ""}`}>
            <label htmlFor="senha">Senha</label>
            <input
              className="input"
              type="password"
              id="senha"
              autoComplete="current-password"
              value={senha}
              onChange={(event) => {
                setSenha(event.target.value);
                setErroSenha(false);
              }}
            />
            {erroSenha && <p className="field-error">A senha tem no mínimo 8 caracteres.</p>}
          </div>

          <div className="row-between" style={{ gap: "var(--gap-xs)" }}>
            <label className="small muted row-tight" style={{ gap: 6, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked /> Manter conectado
            </label>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() =>
                toast({
                  tone: "danger",
                  title: "Sem fluxo de recuperação",
                  detail:
                    "Não há serviço de e-mail conectado. Num ambiente real isso dispararia o link de redefinição.",
                })
              }
            >
              Esqueci a senha
            </button>
          </div>

          <button
            className="btn btn-primary btn-block"
            type="submit"
            style={{ marginTop: 6 }}
            disabled={entrando}
          >
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="sunken" style={{ marginTop: 20, padding: "11px 13px" }}>
          <p className="meta" style={{ lineHeight: 1.6 }}>
            Casca sem backend: nenhuma credencial é verificada, nada trafega e não há guarda de rota.
            Entrar com qualquer e-mail e senha leva ao painel — e o <span className="strong">Sair</span>{" "}
            no menu traz de volta para cá.
          </p>
          <p style={{ marginTop: 10 }}>
            <Link className="btn btn-secondary btn-sm btn-block" href="/">
              Ir direto para o painel
            </Link>
          </p>
        </div>
      </div>

      <p className="auth-foot meta">
        content-radar · o pipeline lê e escreve direto no filesystem
      </p>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
