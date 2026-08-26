"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { cadastrarAcao, type EstadoCadastro } from "@/app/cadastro/acoes";
import { slugDoNome } from "@/lib/slug";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SENHA_MINIMA = 12;

export function CadastroForm() {
  const [estado, submeter, criando] = useActionState<EstadoCadastro, FormData>(
    cadastrarAcao,
    {},
  );
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const slug = slugDoNome(nome);
  const emailRuim = email.length > 0 && !EMAIL_OK.test(email);
  const senhaCurta = senha.length > 0 && senha.length < SENHA_MINIMA;

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="brand-mark">content&#8203;·radar</span>
      </div>

      <div className="auth-panel">
        <h1 className="h2" style={{ textAlign: "center" }}>
          Criar conta
        </h1>
        <p
          className="small muted"
          style={{ textAlign: "center", marginTop: 6 }}
        >
          Uma empresa, um radar. Depois do cadastro vêm as perguntas que ensinam
          ao sistema sobre o seu negócio.
        </p>

        <form
          className="stack-sm"
          noValidate
          style={{ marginTop: 22 }}
          action={submeter}
        >
          <div className="field">
            <label htmlFor="nome">Nome da empresa</label>
            <input
              className="input"
              type="text"
              id="nome"
              name="nome"
              autoComplete="organization"
              placeholder="Avanz Imóveis"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
            />
            {slug && (
              <p className="field-help">
                Endereço interno: <span className="num">{slug}</span>
              </p>
            )}
          </div>

          <div className={`field ${emailRuim ? "field-invalid" : ""}`}>
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
              onChange={(event) => setEmail(event.target.value)}
            />
            {emailRuim && (
              <p className="field-error">Informe um e-mail válido.</p>
            )}
          </div>

          <div className={`field ${senhaCurta ? "field-invalid" : ""}`}>
            <label htmlFor="senha">Senha</label>
            <input
              className="input"
              type="password"
              id="senha"
              name="senha"
              autoComplete="new-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
            <p className={senhaCurta ? "field-error" : "field-help"}>
              No mínimo {SENHA_MINIMA} caracteres.
            </p>
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
            disabled={criando}
          >
            {criando ? "Criando…" : "Criar conta"}
          </button>
        </form>
      </div>

      <p className="auth-foot meta">
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
