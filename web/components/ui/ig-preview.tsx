"use client";

import { useState } from "react";
import { useHandle } from "@/lib/session";
import { IconBubble, IconHeart, IconImage, IconSend } from "./icons";

/** Onde o Instagram corta a legenda no feed. */
export const IG_CUT = 125;

/**
 * A arte é um marcador genérico, deliberadamente: as candidatas anexadas ao
 * brief são referência de origem, nunca a peça publicada — ela sai do Open
 * Design a partir do visual_brief. O que a prévia testa é a legenda.
 */
function Arte({ aspectRatio }: { aspectRatio: string }) {
  return (
    <div
      className={`ph-art ${aspectRatio === "3:4" ? "portrait" : ""}`}
      role="img"
      aria-label={`Espaço reservado para a arte, proporção ${aspectRatio}`}
    >
      <IconImage />
      <span>arte {aspectRatio}</span>
    </div>
  );
}

export function IgPreview({
  caption,
  hashtags,
  aspectRatio,
  legenda,
}: {
  caption: string;
  hashtags: string[];
  aspectRatio: string;
  legenda?: string;
}) {
  const handle = useHandle();
  const [aberta, setAberta] = useState(false);

  const flat = (caption || "—").replace(/\n+/g, " ");
  const corta = flat.length > IG_CUT;
  const head = corta ? flat.slice(0, IG_CUT) : flat;
  const rest = corta ? flat.slice(IG_CUT) : "";

  return (
    <>
      <div className="ig-frame">
        <div className="ig-head">
          <span className="ig-avatar" aria-hidden="true">
            {handle.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="ig-handle">{handle}</div>
            <div className="meta" style={{ fontSize: 10 }}>
              Região Metropolitana de BH
            </div>
          </div>
        </div>
        <div className="ig-art">
          <Arte aspectRatio={aspectRatio} />
        </div>
        <div className="ig-actions" aria-hidden="true">
          <IconHeart />
          <IconBubble />
          <IconSend />
        </div>
        <div className="ig-caption">
          <p>
            <strong>{handle}</strong> <span>{head}</span>
            {corta && aberta && <span>{rest}</span>}
            {corta && (
              <button
                className="ig-more"
                type="button"
                onClick={() => setAberta((v) => !v)}
              >
                {aberta ? " menos" : "… mais"}
              </button>
            )}
          </p>
          <p className="ig-tags" style={{ marginTop: 6 }}>
            {hashtags
              .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
              .join(" ")}
          </p>
        </div>
      </div>
      {legenda && (
        <p className="meta" style={{ marginTop: 12, textAlign: "center" }}>
          {legenda}
        </p>
      )}
    </>
  );
}
