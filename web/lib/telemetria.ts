/**
 * Traduz o que o SDK devolve sobre consumo no que a tabela `consumo` guarda.
 *
 * Fica separado do executor e do chat porque os dois precisam da mesma coisa e
 * porque isto é a parte que tem regra — e regra sem teste é onde o número
 * plausível e errado nasce.
 */

/** O recorte de `ModelUsage` que nos interessa; o resto vai para `extra`. */
export interface UsoDeModelo {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  canonicalModel?: string;
  provider?: string;
}

export interface LinhaDeConsumo {
  modelo: string;
  inputTokens: number;
  outputTokens: number;
  cacheLeituraTokens: number;
  cacheEscritaTokens: number;
  buscasWeb: number;
  custoUsd: string;
  extra: Record<string, unknown> | null;
}

/**
 * Converte `modelUsage` em linhas.
 *
 * **Não somar entre resultados.** O SDK documenta que `modelUsage` é cumulativo
 * dentro de uma chamada de `query()`: cada resultado carrega o total corrente,
 * não o incremento. Quem acumular a cada mensagem de resultado conta o mesmo
 * gasto várias vezes — e o erro cresce com a duração da execução, que é
 * justamente quando o número importa. Guarde o último e grave uma vez só.
 *
 * O custo vira string de propósito: o driver entrega `numeric` como string, e
 * passar por `number` no meio do caminho introduz erro de ponto flutuante em
 * algo que existe para ser somado.
 */
export function linhasDeConsumo(
  modelUsage: Record<string, UsoDeModelo> | undefined,
): LinhaDeConsumo[] {
  if (!modelUsage) return [];

  return (
    Object.entries(modelUsage)
      .map(([modelo, uso]) => ({
        modelo,
        inputTokens: uso.inputTokens ?? 0,
        outputTokens: uso.outputTokens ?? 0,
        cacheLeituraTokens: uso.cacheReadInputTokens ?? 0,
        cacheEscritaTokens: uso.cacheCreationInputTokens ?? 0,
        buscasWeb: uso.webSearchRequests ?? 0,
        custoUsd: (uso.costUSD ?? 0).toFixed(6),
        extra:
          uso.canonicalModel || uso.provider
            ? {
                ...(uso.canonicalModel
                  ? { canonicalModel: uso.canonicalModel }
                  : {}),
                ...(uso.provider ? { provider: uso.provider } : {}),
              }
            : null,
      }))
      /**
       * Modelo que não consumiu nada não vira linha. O SDK às vezes lista modelo
       * com tudo zerado — resultado de erro na partida, segundo a documentação —
       * e guardar isso encheria a tabela de linhas que não somam nada e ainda
       * apareceriam no detalhamento por modelo como se tivessem custado.
       */
      .filter(
        (l) =>
          l.inputTokens > 0 ||
          l.outputTokens > 0 ||
          l.cacheLeituraTokens > 0 ||
          l.cacheEscritaTokens > 0 ||
          l.buscasWeb > 0,
      )
  );
}

/** Soma para exibição. O custo é somado como número só na hora de mostrar. */
export function totalDe(linhas: LinhaDeConsumo[]): {
  custoUsd: number;
  tokens: number;
  buscasWeb: number;
} {
  return {
    custoUsd: linhas.reduce((n, l) => n + Number(l.custoUsd), 0),
    tokens: linhas.reduce(
      (n, l) =>
        n +
        l.inputTokens +
        l.outputTokens +
        l.cacheLeituraTokens +
        l.cacheEscritaTokens,
      0,
    ),
    buscasWeb: linhas.reduce((n, l) => n + l.buscasWeb, 0),
  };
}
