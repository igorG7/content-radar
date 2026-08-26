import type { Manifest } from "@/lib/manifest";

/**
 * A configuração do ambiente por cima do manifest lido do disco.
 *
 * O manifest é um arquivo só, e a configuração é por cliente. Sem esta
 * projeção, toda tela que lê `store.manifest()` mostrava o valor do arquivo,
 * não o do ambiente: a pessoa mudava a meta de 10 para 5 na tela de
 * configuração, o banco gravava 5, e o painel seguia anunciando 10.
 *
 * Passou despercebido porque o ambiente **dono** do manifest tem os dois
 * lugares escritos na mesma gravação — só quem não é dono via a divergência.
 * É o mesmo defeito de fundo do dia: dado num lugar, leitura noutro.
 */

type Config = {
  pesos: Record<string, unknown>;
  caps: Record<string, unknown>;
  janelas: Record<string, unknown>;
  volume: Record<string, unknown>;
};

type Objeto = Record<string, unknown>;

/**
 * Grava a chave onde o manifest já a tem.
 *
 * `caps` é ambíguo na volta: `grupoDe` manda tanto
 * `anti_repetition.match_score_caps.X` quanto `anti_repetition.X` para o mesmo
 * grupo. Quem desempata é o próprio manifest — a chave vai onde ela já existe,
 * e não onde a gente adivinharia. Chave que não existe em lugar nenhum é
 * descartada: inventar caminho no manifest criaria configuração que nenhuma
 * skill lê.
 */
function ondeJaExiste(
  alvos: (Objeto | undefined)[],
  chave: string,
  valor: unknown,
): void {
  for (const alvo of alvos) {
    if (alvo && chave in alvo) {
      alvo[chave] = valor;
      return;
    }
  }
}

export function projetarConfig(manifest: Manifest, config: Config): Manifest {
  // Cópia rasa por nível tocado: mutar o objeto do `loadManifest` faria a
  // projeção de um ambiente vazar para o próximo que lesse o mesmo cache.
  const m = structuredClone(manifest) as unknown as Objeto;

  const funnel = (m.funnel ?? {}) as Objeto;
  for (const [chave, valor] of Object.entries(config.volume)) {
    funnel[chave] = valor;
  }
  m.funnel = funnel;

  const anti = (m.anti_repetition ?? {}) as Objeto;
  const pesos = anti.match_score_weights as Objeto | undefined;
  const caps = anti.match_score_caps as Objeto | undefined;
  const janelas = anti.windows as Objeto | undefined;

  for (const [chave, valor] of Object.entries(config.pesos)) {
    ondeJaExiste([pesos], chave, valor);
  }
  for (const [chave, valor] of Object.entries(config.janelas)) {
    ondeJaExiste([janelas], chave, valor);
  }
  for (const [chave, valor] of Object.entries(config.caps)) {
    ondeJaExiste([caps, anti], chave, valor);
  }
  m.anti_repetition = anti;

  return m as unknown as Manifest;
}
