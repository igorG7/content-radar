"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PublishDialog } from "@/components/publish-dialog";
import { useToast } from "@/components/ui/toast";
import { IconCheck, IconExport, IconExternal, IconPencil } from "@/components/ui/icons";
import { fmtDate } from "@/lib/format";
import { TRANSITION_ERRORS, type BriefView } from "@/lib/view/brief-view";

export function BriefActions({ brief }: { brief: BriefView }) {
  const router = useRouter();
  const toast = useToast();
  const [publicando, setPublicando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const editar = (
    <Link className="btn btn-secondary" href={`/briefs/${brief.state}/${brief.slug}/editar`}>
      <IconPencil />
      Editar
    </Link>
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
            const resposta = await fetch(`/api/briefs/${brief.slug}/transition`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ direction: "approve" }),
            }).catch(() => null);
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
              detail: "Movido para pendente-publicacao. Evento mv-approved gravado no ledger.",
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
          <button className="btn btn-ok" type="button" onClick={() => setPublicando(true)}>
            <IconCheck />
            Marcar publicado
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setExportando(true)}>
            <IconExport />
            Exportar
          </button>
          {editar}
        </div>

        <PublishDialog
          brief={brief}
          open={publicando}
          onClose={() => setPublicando(false)}
          onConfirm={(dados) => {
            setPublicando(false);
            toast({
              tone: "ok",
              title: `Registro validado · ${brief.briefId}`,
              detail: `${fmtDate(dados.published_at)} · a gravação do evento published e a movimentação do arquivo ainda são da skill radar-mark-published; a API web não expõe essa transição.`,
            });
          }}
        />

        <Modal
          open={exportando}
          onClose={() => setExportando(false)}
          eyebrow={brief.briefId}
          title="Exportar pacote para o Open Design"
          footer={
            <>
              <button className="btn btn-secondary" type="button" onClick={() => setExportando(false)}>
                Fechar
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setExportando(false);
                  // O rótulo virou "exportar" para a pessoa, mas o nome do
                  // artefato e o do evento no ledger são contrato do backend —
                  // continuam handoff.
                  toast({
                    title: "Pacote ainda é gerado pela skill",
                    detail: `radar-handoff escreve store/packages/${brief.slug}/ e o evento handoff-finished. A web não dispara o upload ao Cloudinary.`,
                  });
                }}
              >
                <IconExport />
                Exportar
              </button>
            </>
          }
        >
          <p className="small">
            O que sai daqui não é o post pronto — é o pacote que um humano leva para o Open Design
            gerar a arte.
          </p>
          <pre className="code" style={{ marginTop: 14 }}>
            <span className="c-com"># handoff-{brief.briefId}/</span>
            {"\n"}
            <span className="c-key">brief.md</span>            frontmatter completo{"\n"}
            <span className="c-key">caption.txt</span>         legenda final + hashtags{"\n"}
            <span className="c-key">visual-brief.yaml</span>   aspect_ratio{" "}
            {brief.visualBrief.aspectRatio} · must_have · avoid_visual{"\n"}
            <span className="c-key">od_skill_ref</span>        {brief.odSkillRef ?? "—"}
            {"\n"}
            <span className="c-key">hero/</span>               {brief.heroChoice === null
              ? "(vazio — card só-tipografia)"
              : brief.media.find((m) => m.index === brief.heroChoice)?.file ?? "(não resolvida)"}
          </pre>
          <p className="field-help" style={{ marginTop: 12 }}>
            A publicação no Instagram continua manual. Depois de publicar, a skill{" "}
            <span className="num">radar-mark-published</span> grava a URL e move para publicado.
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
      <Link className="btn btn-ghost" href={`/acervo?estado=${brief.state}`}>
        Voltar ao acervo
      </Link>
    </div>
  );
}
