import "server-only";

/**
 * Upload assinado para o Cloudinary.
 *
 * Sem SDK: o upload assinado é um POST multipart com uma assinatura SHA-1 dos
 * parâmetros ordenados mais o segredo. São vinte linhas, contra uma dependência
 * a mais no bundle do servidor e outra superfície para manter atualizada.
 *
 * Quem chama é a escolha da arte (`gravarEscolhaHero`), não o export. Escolher
 * é a decisão de verdade — depois dela, aprovar já apaga as candidatas não
 * escolhidas —, e subir ali deixa o export instantâneo, que é o momento em que
 * a pessoa está indo fazer a peça.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface Credenciais {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface Enviado {
  url: string;
  publicId: string;
}

/**
 * Assina os parâmetros como o Cloudinary exige: pares `chave=valor` ordenados
 * por chave, unidos por `&`, com o segredo concatenado ao fim.
 *
 * A ordenação não é estética — assinatura fora de ordem é recusada, e o erro
 * que volta fala de assinatura inválida, não de ordem.
 */
export function assinar(
  parametros: Record<string, string>,
  apiSecret: string,
): string {
  const base = Object.keys(parametros)
    .sort()
    .map((k) => `${k}=${parametros[k]}`)
    .join("&");
  return createHash("sha1")
    .update(base + apiSecret)
    .digest("hex");
}

/**
 * Lê as credenciais do ambiente, caindo para `.local/cloudinary.env` quando não
 * estiverem exportadas.
 *
 * O arquivo é a convenção que já existia aqui (`manifest.cloudinary
 * .credentials_env`), gitignored e em modo 600. Copiar os valores para o
 * `.env.local` criaria um segundo lugar com o mesmo segredo — e dois lugares
 * com segredo é um a mais para vazar.
 */
export async function credenciais(raiz: string): Promise<Credenciais | null> {
  let { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const texto = await readFile(
      path.join(raiz, ".local", "cloudinary.env"),
      "utf8",
    ).catch(() => null);
    if (!texto) return null;

    const lidos = new Map<string, string>();
    for (const linha of texto.split("\n")) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#")) continue;
      const i = limpa.indexOf("=");
      if (i > 0) lidos.set(limpa.slice(0, i).trim(), limpa.slice(i + 1).trim());
    }
    CLOUDINARY_CLOUD_NAME ??= lidos.get("CLOUDINARY_CLOUD_NAME");
    CLOUDINARY_API_KEY ??= lidos.get("CLOUDINARY_API_KEY");
    CLOUDINARY_API_SECRET ??= lidos.get("CLOUDINARY_API_SECRET");
  }

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return null;
  }
  return {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    apiSecret: CLOUDINARY_API_SECRET,
  };
}

/** O que a camada precisa de um enviador — a forma que o teste substitui. */
export type Enviador = (entrada: {
  bytes: Uint8Array;
  publicId: string;
  nomeArquivo: string;
}) => Promise<Enviado>;

/**
 * Sobe os bytes com um `public_id` estável.
 *
 * Estável de propósito: reescolher a arte sobrescreve o **mesmo** objeto em vez
 * de criar outro. Fica um asset por brief, sem órfão pago na conta quando a
 * pessoa clica em três candidatas antes de decidir — e a purga futura sabe
 * exatamente o que apagar.
 *
 * A URL carrega a versão, que muda quando o **conteúdo** muda — subir os mesmos
 * bytes devolve a mesma URL (verificado contra a conta real). Trocar de
 * candidata troca os bytes, então quem chama precisa regravar o que recebeu em
 * vez de supor que a URL antiga continua apontando para a foto certa.
 */
export function enviador(cred: Credenciais): Enviador {
  return async ({ bytes, publicId, nomeArquivo }) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const parametros: Record<string, string> = {
      public_id: publicId,
      timestamp,
      overwrite: "true",
      invalidate: "true",
    };

    const form = new FormData();
    for (const [k, v] of Object.entries(parametros)) form.append(k, v);
    form.append("api_key", cred.apiKey);
    form.append("signature", assinar(parametros, cred.apiSecret));
    form.append(
      "file",
      new Blob([bytes as unknown as BlobPart]),
      path.basename(nomeArquivo),
    );

    const resposta = await fetch(
      `https://api.cloudinary.com/v1_1/${cred.cloudName}/image/upload`,
      { method: "POST", body: form },
    );

    const corpo = (await resposta.json().catch(() => null)) as {
      secure_url?: string;
      public_id?: string;
      error?: { message?: string };
    } | null;

    if (!resposta.ok || !corpo?.secure_url || !corpo.public_id) {
      throw new Error(
        `Cloudinary recusou o upload: ${corpo?.error?.message ?? `HTTP ${resposta.status}`}`,
      );
    }

    return { url: corpo.secure_url, publicId: corpo.public_id };
  };
}
