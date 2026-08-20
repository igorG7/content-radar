/**
 * Como um estágio de varredura aparece na tela.
 *
 * Vive fora do componente porque a regra é sutil e foi errada na primeira
 * versão: o evento `scan-stage` marca o **início** do estágio, não o fim, e
 * tratar sua existência como conclusão punha ✓ na pesquisa no instante em que
 * ela começava. Quem usou a tela viu "concluído" durante sete minutos de
 * pesquisa em andamento.
 */

export const ESTAGIOS = [
  ["pesquisa", "Pesquisa"],
  ["filtragem", "Filtragem"],
  ["redacao", "Redação"],
] as const;

export type EstagioId = (typeof ESTAGIOS)[number][0];

export interface EstagioObservado {
  estagio: string;
  minuto: number;
  extra: Record<string, unknown>;
}

export interface LinhaDeEstagio {
  id: EstagioId;
  rotulo: string;
  situacao: "pendente" | "corrente" | "concluido";
  /** Minuto em que entrou, quando já entrou. */
  entrouEm: number | null;
  /**
   * Quanto durou — o intervalo até o próximo estágio começar. `null` enquanto
   * não houver próximo: mostrar o minuto de entrada como se fosse duração é o
   * mesmo erro noutra roupa.
   */
  duracao: number | null;
  extra: Record<string, unknown>;
}

export function linhasDeEstagio(
  observados: EstagioObservado[],
  estadoAtual: string,
): LinhaDeEstagio[] {
  const porId = new Map(observados.map((e) => [e.estagio, e]));

  return ESTAGIOS.map(([id, rotulo], i) => {
    const entrou = porId.get(id);
    const corrente = estadoAtual === id;
    const seguinte = porId.get(ESTAGIOS[i + 1]?.[0] ?? "");

    return {
      id,
      rotulo,
      // Concluído exige as duas coisas: entrou **e** o corrente já é outro.
      situacao: corrente ? "corrente" : entrou ? "concluido" : "pendente",
      entrouEm: entrou?.minuto ?? null,
      duracao:
        entrou && !corrente && seguinte
          ? seguinte.minuto - entrou.minuto
          : null,
      extra: entrou?.extra ?? {},
    };
  });
}
