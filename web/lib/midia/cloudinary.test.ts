import { afterEach, describe, expect, it, vi } from "vitest";
import { assinar, credenciais, enviador } from "./cloudinary";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const CRED = { cloudName: "c", apiKey: "k", apiSecret: "s" };

/** Captura o que foi enviado, sem sair da máquina. */
function fingirCloudinary() {
  const visto: { campos: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: FormData }) => {
      const campos: Record<string, string> = {};
      for (const [k, v] of init.body.entries()) {
        if (typeof v === "string") campos[k] = v;
      }
      visto.push({ campos });
      return {
        ok: true,
        json: async () => ({
          secure_url: `https://res.cloudinary.com/c/${campos.public_id}.jpg`,
          public_id: campos.public_id,
        }),
      };
    }),
  );
  return visto;
}

afterEach(() => vi.unstubAllGlobals());

describe("o prefixo do Cloudinary", () => {
  it("entra no public_id, e não no parâmetro folder", async () => {
    /**
     * `folder` na API só arruma a biblioteca: o identificador continua igual, e
     * é o identificador que colide. Se um dia alguém "simplificar" isto para
     * `folder`, dev e produção voltam a escrever no mesmo objeto.
     */
    const visto = fingirCloudinary();
    await enviador({ ...CRED, folder: "content-radar/prod" })({
      bytes: new Uint8Array([1]),
      publicId: "avanz-imoveis/2026-W35-001",
      nomeArquivo: "hero.jpg",
    });
    expect(visto[0].campos.public_id).toBe(
      "content-radar/prod/avanz-imoveis/2026-W35-001",
    );
    expect(visto[0].campos.folder).toBeUndefined();
  });

  it("assina o identificador já prefixado", async () => {
    // A assinatura cobre os parâmetros enviados. Assinar o id sem prefixo e
    // mandar o com daria "Invalid Signature" — erro que não fala de pasta.
    const visto = fingirCloudinary();
    const cred = { ...CRED, folder: "p" };
    await enviador(cred)({
      bytes: new Uint8Array([1]),
      publicId: "a/b",
      nomeArquivo: "hero.jpg",
    });
    const assinados = { ...visto[0].campos };
    const assinatura = assinados.signature;
    // Nenhum dos dois entra na base assinada — a chave vai à parte.
    delete assinados.signature;
    delete assinados.api_key;
    expect(assinatura).toBe(assinar(assinados, cred.apiSecret));
  });

  it("sem prefixo, o identificador fica como veio", async () => {
    // Compatibilidade com o que já subiu: a purga usa o public_id guardado no
    // banco, e o que está lá foi escrito sem prefixo.
    const visto = fingirCloudinary();
    await enviador(CRED)({
      bytes: new Uint8Array([1]),
      publicId: "a/b",
      nomeArquivo: "hero.jpg",
    });
    expect(visto[0].campos.public_id).toBe("a/b");
  });

  it("o ambiente vence o arquivo da conta", async () => {
    /**
     * As credenciais são da conta e valem para as duas instalações; a pasta é
     * da instalação. Se o arquivo mandasse, produção herdaria a pasta de
     * desenvolvimento e a separação existiria só no .env.
     */
    const raiz = await mkdtemp(path.join(tmpdir(), "radar-"));
    await mkdir(path.join(raiz, ".local"));
    await writeFile(
      path.join(raiz, ".local", "cloudinary.env"),
      "CLOUDINARY_CLOUD_NAME=c\nCLOUDINARY_API_KEY=k\nCLOUDINARY_API_SECRET=s\nCLOUDINARY_FOLDER=do-arquivo\n",
    );

    // O vitest carrega o .env.local, que tem a pasta de desenvolvimento — sem
    // limpar, este teste leria a configuração da máquina em vez do arquivo.
    vi.stubEnv("CLOUDINARY_FOLDER", undefined);
    expect((await credenciais(raiz))?.folder).toBe("do-arquivo");

    vi.stubEnv("CLOUDINARY_FOLDER", "do-ambiente");
    expect((await credenciais(raiz))?.folder).toBe("do-ambiente");
  });

  it("barra sobrando não vira pasta vazia", async () => {
    // "content-radar/prod/" produziria "…/prod//avanz-imoveis/…", que o
    // Cloudinary aceita como um nível a mais — e a purga não acharia de volta.
    const raiz = await mkdtemp(path.join(tmpdir(), "radar-"));
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "c");
    vi.stubEnv("CLOUDINARY_API_KEY", "k");
    vi.stubEnv("CLOUDINARY_API_SECRET", "s");
    vi.stubEnv("CLOUDINARY_FOLDER", "/content-radar/prod/");
    expect((await credenciais(raiz))?.folder).toBe("content-radar/prod");
  });
});
