"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { entrarAcao, type EstadoLogin } from "@/app/login/acoes";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Form() {
  const params = useSearchParams();
  const destino = params.get("next") ?? "/";

  // A verificação acontece no servidor, contra a tabela `usuario`. O que fica
  // aqui é só o que evita ida inútil: formato do e-mail e senha não vazia.
  const [estado, submeter, entrando] = useActionState<EstadoLogin, FormData>(
    entrarAcao,
    {},
  );
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erroEmail, setErroEmail] = useState(false);
  const [erroSenha, setErroSenha] = useState(false);

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="brand-mark">content&#8203;·radar</span>
      </div>

      <div className="auth-panel">
        <h1 className="h2" style={{ textAlign: "center" }}>
          Entrar
        </h1>
        <p
          className="small muted"
          style={{ textAlign: "center", marginTop: 6 }}
        >
          Painel editorial — acesso restrito a quem aprova pauta.
        </p>

        <form
          className="stack-sm"
          noValidate
          style={{ marginTop: 22 }}
          action={submeter}
        >
          <input type="hidden" name="destino" value={destino} />
          <div className={`field ${erroEmail ? "field-invalid" : ""}`}>
            <label htmlFor="email">E-mail</label>
            <input
              className="input"
              type="email"
              id="email"
              name="email"
              autoComplete="username"
              placeholder="voce@empresa.com.br"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErroEmail(false);
              }}
            />
            {erroEmail && (
              <p className="field-error">Informe um e-mail válido.</p>
            )}
          </div>

          <div className={`field ${erroSenha ? "field-invalid" : ""}`}>
            <label htmlFor="senha">Senha</label>
            <input
              className="input"
              type="password"
              id="senha"
              name="senha"
              autoComplete="current-password"
              value={senha}
              onChange={(event) => {
                setSenha(event.target.value);
                setErroSenha(false);
              }}
            />
            {erroSenha && (
              <p className="field-error">A senha tem no mínimo 8 caracteres.</p>
            )}
          </div>

          <div className="row-between" style={{ gap: "var(--gap-xs)" }}>
            <label
              className="small muted row-tight"
              style={{ gap: 6, cursor: "pointer" }}
            >
              <input type="checkbox" defaultChecked /> Manter conectado
            </label>
          </div>

          {estado.erro && (
            <p className="field-error" role="alert" style={{ marginTop: 4 }}>
              {estado.erro}
            </p>
          )}

          <button
            className="btn btn-primary btn-block"
            type="submit"
            style={{ marginTop: 6 }}
            disabled={entrando}
          >
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>

      <p className="auth-foot meta">
        content-radar · acesso restrito — contas são criadas pelo operador
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
