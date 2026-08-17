import Link from "next/link";
import type { ReactNode } from "react";
import type { BriefState } from "@/lib/manifest";
import { STATE_META } from "@/lib/view/brief-view";
import { IconInbox } from "./icons";

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

export function Crumb({ items, tail }: { items: CrumbItem[]; tail?: ReactNode }) {
  return (
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
