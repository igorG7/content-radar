import { z } from "zod";
import { radarStore } from "@/lib/store";
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

export async function PATCH(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "corpo inválido: esperado { edits: [...] }" }, { status: 400 });
  }

  const store = radarStore();
  const raw = await store.lerManifestBruto();

  let output: string;
  try {
    output = patchManifest(raw, parsed.data.edits);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 422 });
  }

  // Validate the whole document, not the individual edit: an edit that is fine
  // on its own can still break an invariant that spans fields.
  const { errors, warnings } = validateManifestText(output);
  if (errors.length > 0) {
    return Response.json({ error: "configuração inválida", errors, warnings }, { status: 422 });
  }

  await store.gravarManifestBruto(output);
  return Response.json({ ok: true, warnings });
}
