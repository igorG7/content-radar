import Link from "next/link";
import { loadManifest, resolvePaths } from "@/lib/manifest";
import { listState } from "@/lib/store/briefs";
import { BriefCard, type QueueBrief } from "@/components/brief-card";

export const dynamic = "force-dynamic";

export default async function Queue() {
  const paths = resolvePaths(await loadManifest());
  const { briefs, failures } = await listState("pendente-aprovacao", paths);

  // Absolute server paths stay on the server.
  const queue: QueueBrief[] = briefs.map((brief) => ({
    slug: brief.slug,
    briefId: brief.briefId,
    headline: brief.headline,
    hook: brief.hook,
    pillar: brief.pillar,
    icp: brief.icp,
    matchScore: brief.matchScore,
    borderline: brief.borderline,
    borderlineReason: brief.borderlineReason,
    whyMatch: brief.whyMatch,
    sourceUrls: brief.sourceUrls,
    storedHeroChoice: brief.heroChoiceDeclared ? brief.heroChoice : undefined,
    candidates: brief.candidates.map((candidate) => ({
      index: candidate.index,
      fileName: candidate.fileName,
      exists: candidate.exists,
      alt: candidate.alt,
      licenseHint: candidate.licenseHint,
      licensable: candidate.licensable,
    })),
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 font-sans">
      <header className="mb-8">
        <Link href="/" className="text-xs text-zinc-500 hover:underline">
          ← dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Fila de aprovação</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {queue.length} brief(s) aguardando. A escolha da arte é registrada nesta sessão — um
          `hero_choice` já gravado não conta como decisão sua.
        </p>
      </header>

      {failures.length > 0 && (
        <p className="mb-6 rounded border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950">
          {failures.length} brief(s) ilegíveis nesta pasta.
        </p>
      )}

      <ul className="space-y-4">
        {queue.map((brief) => (
          <BriefCard key={brief.slug} brief={brief} />
        ))}
        {queue.length === 0 && <li className="text-sm text-zinc-500">Nada pendente.</li>}
      </ul>
    </main>
  );
}
