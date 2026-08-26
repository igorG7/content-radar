import { createHash } from "node:crypto";

/**
 * A identidade de assunto de um brief — o que a anti-repetição compara.
 *
 * Calculado aqui, em código, e não pedido ao modelo. A spec 004 §9.5 manda o
 * briefer computar SHA1 via `sha1sum` no Bash, usando uma lista canônica de
 * stopwords em `.claude/skills/_shared/` que **não existe no repositório** —
 * então cada execução normalizava do seu jeito. Dois briefs sobre o mesmo
 * assunto podiam gerar hashes diferentes, e a anti-repetição falharia calada:
 * nada acusa uma comparação que nunca casa.
 *
 * Hash é função pura da headline. Função pura é código.
 */

/**
 * Stopwords do português. Curta de propósito — artigos, preposições,
 * conjunções e verbos de ligação. Palavra de conteúdo fica, porque é ela que
 * distingue "Selic encarece o crédito" de "Selic favorece o investidor".
 *
 * Escritas com acento e comparadas **sem**: a normalização tira o acento antes
 * de filtrar, então uma lista acentuada nunca casaria com nada. Manter a grafia
 * correta aqui e desacentuar na hora de montar o conjunto é o que impede a
 * lista de parecer certa e não funcionar.
 */
const semAcento = (p: string) =>
  p.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const STOPWORDS = new Set(
  [
    "a",
    "à",
    "às",
    "ao",
    "aos",
    "as",
    "o",
    "os",
    "um",
    "uma",
    "uns",
    "umas",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "d",
    "em",
    "na",
    "no",
    "nas",
    "nos",
    "por",
    "pela",
    "pelo",
    "pelas",
    "pelos",
    "para",
    "pra",
    "pro",
    "com",
    "sem",
    "sob",
    "sobre",
    "entre",
    "até",
    "após",
    "ante",
    "desde",
    "e",
    "ou",
    "mas",
    "porém",
    "que",
    "se",
    "como",
    "quando",
    "onde",
    "é",
    "são",
    "foi",
    "foram",
    "ser",
    "está",
    "estão",
    "ter",
    "tem",
    "têm",
    "seu",
    "sua",
    "seus",
    "suas",
    "este",
    "esta",
    "esse",
    "essa",
    "isso",
    "mais",
    "menos",
    "já",
    "não",
    "sim",
    "muito",
    "também",
  ].map(semAcento),
);

/**
 * Normaliza a headline: minúsculas, sem acento, sem pontuação, sem stopwords.
 *
 * A ordem importa: tirar pontuação antes de separar palavras é o que impede
 * "crédito:" de sobreviver como token próprio.
 */
export function normalizarHeadline(headline: string): string {
  return headline
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p !== "" && !STOPWORDS.has(p))
    .join(" ")
    .slice(0, 200);
}

/** SHA1 hex da headline normalizada — 40 caracteres, como a spec define. */
export function topicHash(headline: string): string {
  return createHash("sha1")
    .update(normalizarHeadline(headline), "utf8")
    .digest("hex");
}
