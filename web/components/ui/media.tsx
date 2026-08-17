"use client";

import type { MediaView } from "@/lib/view/brief-view";
import { IconCheck } from "./icons";

function Face({ media, compact }: { media: MediaView; compact?: boolean }) {
  if (media.missing || !media.url) {
    return (
      <span className="ph-img missing" aria-hidden="true">
        {compact ? "ausente" : "⚠ ausente do cache"}
      </span>
    );
  }
  return (
    <span className="media-photo-wrap" aria-hidden="true">
      {/* O cache vive fora de public/ e é servido por /api/media — o otimizador
          do next/image não acrescenta nada a um arquivo local e efêmero. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="media-photo" src={media.url} alt="" loading="lazy" />
    </span>
  );
}

function Foot({ media }: { media: MediaView }) {
  return (
    <span className="media-foot">
      <span className="media-name" title={media.file ?? undefined}>
        {media.file ?? "sem arquivo"}
      </span>
      {media.licensable === false ? (
        <span
          className="pill pill-danger pill-bare"
          style={{ justifySelf: "start" }}
          title="Sem cessão comercial"
        >
          s/ licença
        </span>
      ) : media.missing ? (
        <span className="pill pill-warn pill-bare" style={{ justifySelf: "start" }}>
          ausente
        </span>
      ) : (
        <span className="meta" style={{ fontSize: 10 }}>
          licença {media.licensable === true ? "ok" : "não declarada"}
        </span>
      )}
    </span>
  );
}

export function MediaTile({
  media,
  position,
  selected,
  compact,
  onSelect,
}: {
  media: MediaView;
  /** Posição na lista — é o número do atalho de teclado, 1 a 9. */
  position: number;
  selected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const inner = (
    <>
      <span className="media-key">{position}</span>
      <span className="media-check">
        <IconCheck />
      </span>
      <Face media={media} compact={compact} />
      <Foot media={media} />
    </>
  );

  if (!onSelect) return <div className="media-tile">{inner}</div>;

  return (
    <button
      className="media-tile"
      type="button"
      aria-pressed={selected}
      aria-label={`Candidata ${position}: ${media.missing ? "ausente do cache" : media.alt ?? media.file ?? ""}`}
      onClick={onSelect}
    >
      {inner}
    </button>
  );
}

/** "Sem foto" é escolha explícita, não ausência de escolha: ela tem tile. */
export function MediaNoneTile({
  selected,
  compact,
  onSelect,
}: {
  selected: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className="media-tile"
      type="button"
      aria-pressed={selected}
      aria-label="Sem foto — card só-tipografia, o Open Design compõe a arte"
      onClick={onSelect}
    >
      <span className="media-key">0</span>
      <span className="media-check">
        <IconCheck />
      </span>
      <span className="ph-img none-choice" aria-hidden="true">
        sem foto
      </span>
      <span className="media-foot">
        <span className="media-name">hero_choice: null</span>
        <span className="meta" style={{ fontSize: 10 }}>
          {compact ? "tipografia" : "Open Design compõe"}
        </span>
      </span>
    </button>
  );
}
