import { z } from "zod";
import { radarStore } from "@/lib/store";
import { rota } from "@/lib/rota";
import { patchManifest } from "@/lib/config/manifest-edit";
import { validateManifestText } from "@/lib/config/validate";

const Body = z.object({
  edits: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])).min(1),
        value: z.unknown(),
      }),
    )
    .min(1),
});

export const PATCH = rota(async (request: Request) => {
  // Sessão antes do corpo, pelo mesmo motivo de `/api/anexos`: quem não está
  // autenticado não deve conseguir nem descobrir o formato esperado, muito
  // menos fazer o servidor decodificar o que mandou.
  const store = await radarStore();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "corpo inválido: esperado { edits: [...] }" },
      { status: 400 },
    );
  }

  // Valida antes de gravar em qualquer lugar: uma edição correta sozinha ainda
  // pode quebrar invariante que atravessa campos (pesos somando 1,0,
  // borderline abaixo do threshold).
  const raw = await store.lerManifestBruto();
  let projecao: string;
  try {
    projecao = patchManifest(raw, parsed.data.edits);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 422 });
  }

  const { errors, warnings } = validateManifestText(projecao);
  if (errors.length > 0) {
    return Response.json(
      { error: "configuração inválida", errors, warnings },
      { status: 422 },
    );
  }

  try {
    await store.gravarConfiguracao(parsed.data.edits);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 422 });
  }

  return Response.json({ ok: true, warnings });
});
