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

import path from "node:path";

export interface Credenciais {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /**
   * Prefixo de todo `public_id` enviado — o que separa uma instalação da outra
   * dentro da mesma conta.
   *
   * Sem ele, o identificador é `<ambiente>/<brief>`, igual em desenvolvimento e
   * em produção: os dois bancos saíram da mesma cópia e carregam os mesmos
   * slugs. O envio usa `overwrite: true`, então subir um brief em dev troca a
   * imagem publicada do mesmo brief em produção, e purgá-lo em dev apaga a de
   * lá. Nada nos dois sistemas reclamaria — a foto simplesmente muda.
   */
  folder?: string;
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
 * Lê as credenciais do ambiente.
 *
 * Antes elas vinham de `.local/cloudinary.env`, herança da skill de handoff, que
 * não existe mais. Com o `.env` por instalação — um de desenvolvimento e um de
 * produção, ambos 600 e fora do git — o arquivo à parte passou a ser um terceiro
 * lugar guardando o mesmo segredo, e um mecanismo a mais para quem for fazer
 * deploy descobrir.
 *
 * Devolve `null` quando falta credencial, e não lança: sem Cloudinary o sistema
 * ainda gera pacote, só não publica mídia. Quebrar a exportação inteira por
 * causa disso trocaria uma limitação por uma pane.
 */
export function credenciais(): Credenciais | null {
  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_FOLDER,
  } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return null;
  }
  return {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    apiSecret: CLOUDINARY_API_SECRET,
    folder: CLOUDINARY_FOLDER?.replace(/^\/+|\/+$/g, "") || undefined,
  };
}

/** O que a camada precisa de quem apaga — a forma que o teste substitui. */
export type Destruidor = (publicId: string) => Promise<void>;

/** O que a camada precisa de um enviador — a forma que o teste substitui. */
export type Enviador = (entrada: {
  bytes: Uint8Array;
  publicId: string;
  nomeArquivo: string;
}) => Promise<Enviado>;

/**
 * Apaga o objeto remoto.
 *
 * Rejeitar um brief apaga a mídia local; sem isto o objeto continua no
 * Cloudinary, cobrado, sem nada apontando para ele. Não é urgente por brief —
 * é urgente por acumular.
 */
export function destruidor(cred: Credenciais): Destruidor {
  return async (publicId) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const parametros = { public_id: publicId, timestamp };

    const form = new FormData();
    for (const [k, v] of Object.entries(parametros)) form.append(k, v);
    form.append("api_key", cred.apiKey);
    form.append("signature", assinar(parametros, cred.apiSecret));

    const resposta = await fetch(
      `https://api.cloudinary.com/v1_1/${cred.cloudName}/image/destroy`,
      { method: "POST", body: form },
    );
    const corpo = (await resposta.json().catch(() => null)) as {
      result?: string;
    } | null;

    /**
     * `not found` é sucesso: o objetivo é que ele não exista. Tratar como erro
     * faria a purga falhar ao rodar duas vezes.
     */
    if (!resposta.ok || !["ok", "not found"].includes(corpo?.result ?? "")) {
      throw new Error(
        `Cloudinary recusou apagar ${publicId}: ${corpo?.result ?? `HTTP ${resposta.status}`}`,
      );
    }
  };
}

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
    /**
     * O prefixo entra no `public_id`, não no parâmetro `folder` da API.
     *
     * São coisas diferentes: `folder` organiza a biblioteca e deixa o
     * identificador igual, que é justamente o que precisa mudar. Quem apaga usa
     * o `cloudinary_public_id` guardado no banco, então prefixar aqui mantém
     * envio e purga falando do mesmo objeto.
     */
    const alvo = cred.folder ? `${cred.folder}/${publicId}` : publicId;
    const parametros: Record<string, string> = {
      public_id: alvo,
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
