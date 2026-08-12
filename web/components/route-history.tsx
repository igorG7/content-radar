import Link from "next/link";

type RouteHistoryItem = {
  label: string;
  href?: string;
  icon?: string;
};

export function RouteHistory({ items }: { items: RouteHistoryItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="route-history" aria-label="Histórico de rotas">
      {items.map((item, index) => {
        return (
          <span key={`${item.label}-${index}`} className="route-history__part">
            {index > 0 && <span className="route-history__separator" aria-hidden="true">&lt;</span>}
            {item.href ? (
              <Link href={item.href} className="route-history__link">
                {item.label}
              </Link>
            ) : (
              <span className="route-history__current" aria-current="page">
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
