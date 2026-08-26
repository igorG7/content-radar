"use client";

import { useVault } from "@/components/vault-provider";
import { Prosa } from "@/components/ui/prosa";
import { documentoDe } from "@/lib/vault/blocos";

export function VaultDocumento() {
  const { aceitos, progresso } = useVault();
  const doc = documentoDe(aceitos);
  const preenchidos = doc.filter((s) => s.conteudo);
  const caracteres = preenchidos.reduce(
    (n, s) => n + (s.conteudo?.length ?? 0),
    0,
  );

  return (
    <>
      <div className="row-between" style={{ marginBottom: 24 }}>
        <p className="meta">
          {preenchidos.length} de {doc.length} blocos
          <span className="dot-sep" />
          <span className="num">{caracteres.toLocaleString("pt-BR")}</span>{" "}
          caracteres
        </p>
        {progresso.podeRodar ? (
          <span className="pill pill-ok">contexto completo</span>
        ) : (
          <span className="pill pill-warn">
            {progresso.faltam.length} bloco(s) obrigatório(s) fora
          </span>
        )}
      </div>

      <div className="panel">
        <div
          className="panel-body"
          style={{ padding: "var(--gap-xl) var(--gap-lg)" }}
        >
          <div className="doc-montado">
            {doc.map((secao) => (
              <section className="doc-secao" key={secao.key}>
                <h2>{secao.titulo}</h2>
                {secao.conteudo ? (
                  <Prosa texto={secao.conteudo} />
                ) : (
                  <p className="doc-lacuna">
                    Bloco vazio — este trecho não vai no contexto. O agente
                    trabalha sem ele.
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>

      <p className="field-help" style={{ marginTop: 16, textAlign: "center" }}>
        Fontes, pesos e limiares não aparecem aqui: eles são configuração, não
        contexto de marca.
      </p>
    </>
  );
}
