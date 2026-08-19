import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefEditorClient } from "@/components/brief-editor-client";
import { EmptyState } from "@/components/ui/pieces";
import type { BriefState } from "@/lib/manifest";
import { radarStore } from "@/lib/store";
import { STATE_META, scoringOf, toBriefView } from "@/lib/view/brief-view";

export const dynamic = "force-dynamic";

// A edição só existe nos estados em que o brief ainda muda; o resto é read-only.
const EDITAVEIS: BriefState[] = ["pendente-aprovacao", "pendente-publicacao"];

function isEditavel(value: string): value is BriefState {
  return (EDITAVEIS as string[]).includes(value);
}

export default async function EditarBrief({
  params,
}: PageProps<"/briefs/[state]/[slug]/editar">) {
  const { state, slug } = await params;

  if (!isEditavel(state)) {
    const rotulo =
      STATE_META[state as BriefState]?.label.toLowerCase() ?? state;
    return (
      <div className="panel">
        <div className="panel-body">
          <EmptyState
            title="Este brief não é editável"
            body={`Briefs em ${rotulo} são read-only. A edição só aceita pendente-aprovacao e pendente-publicacao.`}
            action={
              <Link
                className="btn btn-secondary"
                href={`/briefs/${state}/${slug}`}
              >
                Ver o detalhe
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const store = await radarStore();
  const [manifest, encontrado] = await Promise.all([
    store.manifest(),
    store.buscarBrief(slug, state).catch(() => null),
  ]);
  if (!encontrado) notFound();

  return (
    <BriefEditorClient brief={toBriefView(encontrado, scoringOf(manifest))} />
  );
}
