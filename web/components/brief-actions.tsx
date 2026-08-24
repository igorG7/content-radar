"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PublishDialog } from "@/components/publish-dialog";
import { useToast } from "@/components/ui/toast";
import {
  IconCheck,
  IconExport,
  IconExternal,
  IconPencil,
} from "@/components/ui/icons";
import { fmtDate } from "@/lib/format";
import { podeExportar } from "@/lib/view/acoes";
import { TRANSITION_ERRORS, type BriefView } from "@/lib/view/brief-view";

export function BriefActions({ brief }: { brief: BriefView }) {
  const router = useRouter();
  const toast = useToast();
  const [publicando, setPublicando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const editar = (
    <Link
      className="btn btn-secondary"
      href={`/briefs/${brief.state}/${brief.slug}/editar`}
    >
      <IconPencil />
      Editar
    </Link>
  );

  /**
   * Baixar o pacote continua disponível depois de publicado.
   *
   * Ele é a referência de como a arte foi feita: quem precisa refazer a peça,
   * mudar o formato ou repostar quer o arquivo de novo. Esconder após a
   * publicação era limite da interface, não regra — o backend nunca impediu.
   */
  const exportar = (
    <a
      className="btn btn-secondary"
      href={`/api/briefs/${brief.slug}/export`}
      download={`${brief.slug}.md`}
      onClick={() =>
        toast({
          tone: "ok",
          title: `Pacote baixado · ${brief.briefId}`,
          detail:
            "Registrado como reexportação — a data da entrega original não muda.",
        })
      }
    >
      <IconExport />
      Baixar pacote
    </a>
  );

  if (brief.state === "pendente-aprovacao") {
    return (
      <div className="row-tight">
        <button
          className="btn btn-ok"
          type="button"
          onClick={async () => {
            if (!brief.heroChoiceDeclared) {
              toast({
                tone: "danger",
                title: "HTTP 422 · HERO_CHOICE_UNDECIDED",
                detail: TRANSITION_ERRORS.HERO_CHOICE_UNDECIDED,
              });
              return;
            }
            const resposta = await fetch(
              `/api/briefs/${brief.slug}/transition`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ direction: "approve" }),
              },
            ).catch(() => null);
            const corpo = await resposta?.json().catch(() => null);
            if (!resposta?.ok) {
              toast({
                tone: "danger",
                title: `HTTP ${resposta?.status ?? "—"} · ${(corpo?.code ?? "TRANSITION_FAILED").toUpperCase()}`,
                detail: corpo?.error ?? TRANSITION_ERRORS.ALREADY_MOVED,
              });
              return;
            }
            toast({
              tone: "ok",
              title: `Aprovado · ${brief.briefId}`,
              detail:
                "Movido para pendente-publicacao. Evento mv-approved gravado no ledger.",
            });
            router.push("/fila");
            router.refresh();
          }}
        >
          Aprovar
        </button>
        {/* Rejeitar exige motivo e apaga mídia: o diálogo mora na fila, e é lá
            que a lista se reorganiza depois da decisão. */}
        <Link className="btn btn-danger" href={`/fila#${brief.slug}`}>
          Rejeitar
        </Link>
        {editar}
      </div>
    );
  }

  if (brief.state === "pendente-publicacao") {
    return (
      <>
        <div className="row-tight">
          <button
            className="btn btn-ok"
            type="button"
            onClick={() => setPublicando(true)}
          >
            <IconCheck />
            Marcar publicado
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setExportando(true)}
          >
            <IconExport />
            Exportar
          </button>
          {editar}
        </div>

        <PublishDialog
          brief={brief}
          open={publicando}
          onClose={() => setPublicando(false)}
          onConfirm={async (dados) => {
            setPublicando(false);
            const resposta = await fetch(`/api/briefs/${brief.slug}/publish`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                igPostUrl: dados.ig_post_url,
                publicadoEm: new Date(dados.published_at).toISOString(),
              }),
            }).catch(() => null);
            const corpo = await resposta?.json().catch(() => null);
            if (!resposta?.ok) {
              toast({
                tone: "danger",
                title: `HTTP ${resposta?.status ?? "—"} · ${(corpo?.code ?? "PUBLISH_FAILED").toUpperCase()}`,
                detail: corpo?.error ?? TRANSITION_ERRORS.ALREADY_MOVED,
              });
              return;
            }
            toast({
              tone: "ok",
              title: `Publicado · ${brief.briefId}`,
              detail: `${fmtDate(dados.published_at)} · evento published gravado com a URL do post.`,
            });
            router.push("/acervo?estado=publicado");
            router.refresh();
          }}
        />

        <Modal
          open={exportando}
          onClose={() => setExportando(false)}
          eyebrow={brief.briefId}
          title="Exportar pacote para o Open Design"
          footer={
            <>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setExportando(false)}
              >
                Fechar
              </button>
              {/* Âncora, não botão com router.push: o destino é um download,
                  e navegação do lado do cliente descartaria o arquivo. */}
              <a
                className="btn btn-primary"
                href={`/api/briefs/${brief.slug}/export`}
                download={`${brief.slug}.md`}
                onClick={() => {
                  setExportando(false);
                  // O rótulo virou "exportar" para a pessoa, mas o nome do
                  // evento no ledger é contrato do backend — continua handoff.
                  toast({
                    tone: "ok",
                    title: `Pacote gerado · ${brief.briefId}`,
                    detail: brief.handoffAt
                      ? "Um .md com copy, direção visual e a hero. Registrado como reexportação."
                      : "Um .md com copy, direção visual e a hero. Evento handoff-finished gravado.",
                  });
                }}
              >
                <IconExport />
                Exportar
              </a>
            </>
          }
        >
          <p className="small">
            O que sai daqui não é o post pronto — é o pacote que um humano leva
            para o Open Design gerar a arte.
          </p>
          <pre className="code" style={{ marginTop: 14 }}>
            <span className="c-com"># {brief.slug}.md</span>
            {"\n"}
            {/* Sem proporção: o pipeline nunca preenche `aspect_ratio`, e
                anunciá-la aqui prometia um dado que o pacote não carrega. */}
            <span className="c-key">A arte</span> skill{" "}
            {brief.odSkillRef ?? "—"} · must_have · avoid_visual{"\n"}
            <span className="c-key">A copy</span> hook, legenda, CTA, hashtags
            {"\n"}
            <span className="c-key">Hero</span>{" "}
            {brief.heroChoice === null
              ? "(sem foto — o Smart Design gera a arte)"
              : (brief.media.find((m) => m.index === brief.heroChoice)?.file ??
                "(não resolvida)")}
            {"\n"}
            <span className="c-key">Por quê</span> pilar e justificativa do
            match
          </pre>
          <p className="field-help" style={{ marginTop: 12 }}>
            A publicação no Instagram continua manual. Depois de publicar, use{" "}
            <span className="num">Marcar publicado</span> para registrar a URL.
          </p>
        </Modal>
      </>
    );
  }

  return (
    <div className="row-tight">
      {brief.igPostUrl && (
        <a
          className="btn btn-secondary"
          href={brief.igPostUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconExternal />
          Ver no Instagram
        </a>
      )}
      {podeExportar(brief.state) ? exportar : null}
      <Link className="btn btn-ghost" href={`/acervo?estado=${brief.state}`}>
        Voltar ao acervo
      </Link>
    </div>
  );
}
