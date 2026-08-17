import Link from "next/link";
import { ConfigClient, type ConfigEscopo } from "@/components/config-client";
import { ConfigTabs } from "@/components/config-tabs";
import { Crumb } from "@/components/ui/pieces";
import { manifestWarnings } from "@/lib/config/validate";
import { radarStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Configuracao() {
  const store = radarStore();
  const [manifest, listings] = await Promise.all([store.manifest(), store.listarTodos()]);

  const warnings = manifestWarnings(manifest);

  const escopos: ConfigEscopo[] = Object.entries(manifest.search_scopes).map(([key, scope]) => ({
    key,
    label: scope.label,
    sources: scope.sources,
    pillarsAlvo: scope.pillars_alvo ?? [],
  }));

  const windows = manifest.anti_repetition.windows ?? {};
  const janelas = Object.entries(windows)
    .filter(([, dias]) => typeof dias === "number")
    .map(([chave, dias]) => ({ chave, dias: dias as number }));

  const scores = listings
    .flatMap((l) => l.briefs)
    .map((b) => b.matchScore)
    .filter((s): s is number => typeof s === "number");

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <Crumb
            items={[{ label: "Painel", href: "/" }, { label: "Configuração" }]}
            back={{ href: "/", destino: "Painel" }}
          />
          <span className="eyebrow">manifest.yaml · raiz do projeto</span>
        </div>
        <h1 className="display" style={{ marginTop: 12 }}>
          Configuração
        </h1>
        <ConfigTabs />
        <p className="lead" style={{ marginTop: 16 }}>
          Os números que governam o pipeline. A gravação é um patch cirúrgico: só as chaves
          alteradas são reescritas e os comentários do YAML são preservados. O vocabulário editorial
          que estes campos referenciam mora na aba <Link className="link" href="/config/vault">Vault</Link>.
        </p>
      </div>

      <ConfigClient
        inicial={{
          weeklyTarget: manifest.funnel.candidates_per_week_target,
          matchScoreMin: manifest.anti_repetition.match_score_min,
          borderlineMin: manifest.anti_repetition.borderline_min,
          weights: manifest.anti_repetition.match_score_weights,
          escopos,
          janelas,
          scores,
          avisos: warnings,
        }}
      />
    </>
  );
}
