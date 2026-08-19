"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { IconCheck } from "@/components/ui/icons";
import { fmtDate, doCampo, paraCampo } from "@/lib/format";
import { TRANSITION_ERRORS, type BriefView } from "@/lib/view/brief-view";

const IG_URL =
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]{5,}\/?(\?.*)?$/;

export interface PublishData {
  ig_post_url: string;
  published_at: string;
}

/**
 * Mesmo contrato da skill radar-mark-published: a URL do post é o que fecha o
 * ciclo, e a data é a que ordena o acervo e conta na anti-repetição. Vive num
 * componente só porque acervo e detalhe abrem exatamente este diálogo —
 * divergir as duas validações seria a forma mais fácil de deixar passar um
 * registro inconsistente por uma das portas.
 */
export function PublishDialog({
  brief,
  open,
  onClose,
  onConfirm,
}: {
  brief: BriefView | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (dados: PublishData) => void;
}) {
  const agora = new Date();
  const [url, setUrl] = useState("");
  const [quando, setQuando] = useState(() => paraCampo(agora));
  const [erroUrl, setErroUrl] = useState<string | null>(null);
  const [erroData, setErroData] = useState<string | null>(null);

  if (!brief) return null;

  function confirmar() {
    if (!brief) return;
    const limpa = url.trim();
    if (!limpa) return setErroUrl(TRANSITION_ERRORS.IG_URL_REQUIRED);
    if (!IG_URL.test(limpa))
      return setErroUrl(TRANSITION_ERRORS.IG_URL_INVALID);
    if (!quando) return setErroData(TRANSITION_ERRORS.PUBLISHED_AT_REQUIRED);

    const data = new Date(doCampo(quando));
    if (Number.isNaN(data.getTime()))
      return setErroData(TRANSITION_ERRORS.PUBLISHED_AT_REQUIRED);
    if (data > new Date())
      return setErroData(TRANSITION_ERRORS.PUBLISHED_AT_FUTURE);
    if (brief.approvedAt && data < new Date(brief.approvedAt)) {
      return setErroData(
        `${TRANSITION_ERRORS.PUBLISHED_AT_BEFORE_APPROVAL} Aprovado em ${fmtDate(brief.approvedAt)}.`,
      );
    }

    onConfirm({ ig_post_url: limpa, published_at: doCampo(quando) });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={brief.briefId}
      title="Marcar como publicado?"
      footer={
        <>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-ok" type="button" onClick={confirmar}>
            <IconCheck />
            Marcar publicado
          </button>
        </>
      }
    >
      <p className="small">
        A publicação no Instagram é manual. Isto apenas registra que ela
        aconteceu: move o arquivo para{" "}
        <span className="num">store/briefs/publicado/</span> e grava o evento{" "}
        <span className="num">published</span> no ledger com a URL e o horário.
      </p>
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="ig-url">
          URL do post{" "}
          <span className="muted">— obrigatória, vai para o ledger</span>
        </label>
        <input
          className="input"
          type="url"
          id="ig-url"
          data-autofocus
          inputMode="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setErroUrl(null);
          }}
          aria-invalid={erroUrl ? true : undefined}
          placeholder="https://www.instagram.com/p/DXk2f9mAvz1/"
        />
        {erroUrl && <p className="field-error">{erroUrl}</p>}
        <p className="field-help">
          É por ela que o acervo mostra “ver no Instagram” e que a
          anti-repetição sabe o que já foi ao ar.
        </p>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="ig-data">
          Publicado em <span className="muted">— agora, por padrão</span>
        </label>
        <input
          className="input"
          type="datetime-local"
          id="ig-data"
          style={{ maxWidth: 260 }}
          value={quando}
          max={paraCampo(agora)}
          min={
            brief.approvedAt ? paraCampo(new Date(brief.approvedAt)) : undefined
          }
          onChange={(event) => {
            setQuando(event.target.value);
            setErroData(null);
          }}
          aria-invalid={erroData ? true : undefined}
        />
        {erroData && <p className="field-error">{erroData}</p>}
        <p className="field-help">
          Ajuste se o post foi ao ar antes de você registrar aqui. É esta data
          que ordena o acervo e conta nas janelas de anti-repetição.
        </p>
      </div>
    </Modal>
  );
}
