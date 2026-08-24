import "server-only";

/**
 * Limite de tentativas, por janela deslizante.
 *
 * O login é o alvo óbvio, e não só por força bruta: o argon2 é caro **de
 * propósito**, então cada tentativa custa CPU. Um laço simples contra
 * `/login` consome o processador do servidor inteiro — e neste servidor moram
 * outros projetos. O limite protege tanto a conta quanto a máquina.
 *
 * Mora na memória do processo, e isso tem consequências que vale dizer em vez
 * de descobrir: reiniciar o servidor zera a contagem, e dois processos contam
 * separado. Para um único `next` atrás de um proxy é suficiente; no dia em que
 * houver mais de uma instância, isto precisa ir para o Postgres ou um Redis.
 * Não é a proteção definitiva — é a que impede o laço de shell.
 */

interface Registro {
  /** Instantes das tentativas dentro da janela, do mais antigo ao mais novo. */
  quando: number[];
}

const registros = new Map<string, Registro>();

/**
 * Quantas chaves distintas guardamos antes de limpar as inativas.
 *
 * Sem isto, um atacante variando o IP falsificado no cabeçalho encheria a
 * memória — a defesa viraria o próprio ataque.
 */
const MAX_CHAVES = 10_000;

export interface Veredito {
  ok: boolean;
  /** Quanto falta para a próxima tentativa ser aceita. */
  esperarSegundos: number;
}

export function tentar(
  chave: string,
  opcoes: { max: number; janelaMs: number },
  agora = Date.now(),
): Veredito {
  const inicio = agora - opcoes.janelaMs;

  if (registros.size > MAX_CHAVES) {
    for (const [k, r] of registros) {
      if (r.quando.every((t) => t < inicio)) registros.delete(k);
    }
  }

  const registro = registros.get(chave) ?? { quando: [] };
  const recentes = registro.quando.filter((t) => t >= inicio);

  if (recentes.length >= opcoes.max) {
    // A espera é até a tentativa mais antiga sair da janela, não um valor fixo:
    // quem parou de tentar volta a ser aceito antes de quem continuou.
    const liberaEm = recentes[0] + opcoes.janelaMs;
    registros.set(chave, { quando: recentes });
    return {
      ok: false,
      esperarSegundos: Math.max(1, Math.ceil((liberaEm - agora) / 1000)),
    };
  }

  recentes.push(agora);
  registros.set(chave, { quando: recentes });
  return { ok: true, esperarSegundos: 0 };
}

/** Devolve a chave ao seu estado anterior — para não punir quem acertou. */
export function perdoar(chave: string): void {
  registros.delete(chave);
}

/** Só para teste: a contagem é de processo e não sobrevive a reinício. */
export function esquecerTudo(): void {
  registros.clear();
}
