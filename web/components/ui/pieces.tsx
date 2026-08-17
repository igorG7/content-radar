import Link from "next/link";
import type { ReactNode } from "react";
import type { BriefState } from "@/lib/manifest";
import { STATE_META } from "@/lib/view/brief-view";
import { IconArrowLeft, IconInbox } from "./icons";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <IconInbox />
      <p className="h3">{title}</p>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function StatePill({ state }: { state: BriefState }) {
  const meta = STATE_META[state];
  return <span className={`pill pill-${meta.tone}`}>{meta.short}</span>;
}

export interface CrumbItem {
  label: string;
  href?: string;
}

/**
 * Navegação dupla: a trilha inteira fica visível e o botão de voltar leva um
 * nível acima. Os dois leem o mesmo `back` — no detalhe do brief o destino
 * varia com o estado, e trilha e botão divergirem seria pior que não ter
 * botão. Painel e login não têm nível acima, então não recebem `back`.
 */
export function Crumb({
  items,
  tail,
  back,
}: {
  items: CrumbItem[];
  tail?: ReactNode;
  back?: { href: string; destino: string };
}) {
  const trilha = (
    <nav className="crumb" aria-label="Trilha da navegação">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} style={{ display: "contents" }}>
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
      {tail}
    </nav>
  );

  if (!back) return trilha;

  // O rótulo visível é "Voltar" — curto, sempre no mesmo lugar — e o destino
  // vai no nome acessível, para quem usa leitor de tela não precisar caçar a
  // trilha ao lado.
  const rotulo = `Voltar para ${back.destino}`;
  return (
    <div className="crumb-row">
      {trilha}
      <Link className="crumb-back" href={back.href} aria-label={rotulo} title={rotulo}>
        <IconArrowLeft />
        <span>Voltar</span>
      </Link>
    </div>
  );
}

/** Contador de caracteres com os mesmos limites do zod em /api/brief-editor. */
export function Counter({ value, limit }: { value: number; limit: number }) {
  const ratio = value / limit;
  const tone = ratio > 1 ? " counter-over" : ratio > 0.9 ? " counter-near" : "";
  return (
    <span className={`counter${tone}`}>
      {value} / {limit}
    </span>
  );
}

export const LIMITES = { headline: 240, hook: 1200, caption: 8000, hashtags: 40 } as const;
