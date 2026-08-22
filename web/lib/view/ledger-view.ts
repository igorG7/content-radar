/** Rótulos dos eventos que as skills realmente escrevem em store/ledger.jsonl. */
export const EVENT_LABELS: Record<string, string> = {
  "scan-started": "Varredura iniciada",
  "scan-finished": "Varredura concluída",
  "brief-created": "Brief criado",
  "brief-corrected": "Brief corrigido",
  "skip-low-score": "Descartado por score",
  "skip-out-of-scope": "Descartado por escopo",
  "skip-redundant": "Descartado por redundância",
  "mv-approved": "Aprovado",
  "mv-rejected": "Rejeitado",
  "mv-reverted": "Transição revertida",
  "handoff-finished": "Handoff concluído",
  "handoff-reexportado": "Pacote baixado de novo",
  "cloudinary-uploaded": "Mídia enviada ao Cloudinary",
  published: "Publicado",
  "housekeeping-finished": "Limpeza de cache concluída",
  "media-purged": "Cache de mídia expurgado",
  "researcher-schema-warning": "Aviso de schema (researcher)",
  "matcher-schema-warning": "Aviso de schema (matcher)",
  "researcher-source-violation": "Fonte fora do manifest",
  "cross-scan-duplicate-detected": "Duplicata entre varreduras",
  "user-restricted-promotion": "Promoção restringida pelo humano",
  "user-deferred-promotion": "Promoção adiada pelo humano",
};

export const EVENT_TONE: Record<string, string> = {
  "mv-approved": "ok",
  published: "ok",
  "handoff-finished": "accent",
  "handoff-reexportado": "",
  "cloudinary-uploaded": "accent",
  "mv-rejected": "danger",
  "mv-reverted": "danger",
  "media-purged": "warn",
  "housekeeping-finished": "warn",
  "researcher-source-violation": "danger",
  "cross-scan-duplicate-detected": "warn",
  "researcher-schema-warning": "warn",
  "matcher-schema-warning": "warn",
};

export function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}
