/**
 * Catálogo dos blocos do vault — **metadado de produto, não conteúdo**.
 *
 * A divisão importa: a pergunta que gera o bloco, o porquê de ele ser
 * obrigatório e de quem ele depende são iguais para todo cliente, e vivem
 * aqui. O corpo em prosa é do cliente e vive no banco, versionado com motivo
 * (tabela `vault_bloco`).
 *
 * Um bloco é prosa. Alguns carregam identidade estável, porque algo de fora
 * aponta para eles (a configuração referencia pilar por código; o brief carrega
 * o público). O conteúdo NÃO é quebrado em campos: o que faz um pilar funcionar
 * é a ressalva no parágrafo, e coluna curta não comporta ressalva.
 *
 * Duas etapas não produzem bloco de vault — produzem configuração. Fontes e
 * ajustes numéricos são trabalho manual acumulado, sem origem na marca. Elas
 * aparecem no mapa porque fazem parte da sequência, e apontam para a tela de
 * Configuração em vez de abrir conversa.
 */

export type Criticidade = "obrigatorio" | "degrada" | "opcional" | "default";
export type EstadoBloco =
  "preenchido" | "pendente-obrigatorio" | "pendente-opcional" | "trancado";

export interface Bloco {
  key: string;
  titulo: string;
  pergunta: string | null;
  criticidade: Criticidade;
  dependeDe: string | null;
  temId: boolean;
  /**
   * Como o bloco se preenche, e de onde vem o estado dele:
   *
   * - `bloco` — prosa, guardada em `vault_bloco`, injetada no documento.
   * - `campo` — valores estruturados em tabela própria. Continua sendo etapa e
   *   exigência; o que muda é que o dado tem uma casa só, e a interface pede
   *   formulário em vez de caixa de texto.
   * - `config` — vive na configuração operacional e aponta para /config.
   */
  tipo: "bloco" | "campo" | "config";
  href?: string;
  resumo: string;
  porque?: string;
}

export const BLOCOS: Bloco[] = [
  {
    key: "identidade",
    titulo: "Identidade e origem",
    pergunta:
      "Quem é a marca, de onde ela veio e por que alguém escolheria ela?",
    criticidade: "degrada",
    dependeDe: null,
    temId: false,
    tipo: "bloco",
    resumo:
      "Posicionamento, origem e os princípios que valem quando entram em conflito.",
  },
  {
    key: "voz",
    titulo: "Voz da marca",
    pergunta: "Como a marca fala — e o que ela nunca diz?",
    criticidade: "obrigatorio",
    dependeDe: null,
    temId: false,
    tipo: "bloco",
    resumo: "Registro, ritmo da frase e a lista do que não se escreve.",
    porque: "Sem ela cada post sai num registro diferente do anterior.",
  },
  {
    key: "guardrails",
    titulo: "Guardrails",
    pergunta:
      "Que restrições a marca impõe a si mesma, e como ela conduz uma conversa?",
    criticidade: "obrigatorio",
    dependeDe: null,
    temId: true,
    tipo: "bloco",
    resumo: "Restrições operáveis item a item, condução e a regra de ouro.",
    porque:
      "Sem eles nada impede o texto de prometer o que não pode ser prometido.",
  },
  {
    key: "foco",
    titulo: "Foco editorial",
    pergunta: "O que entra na pauta e o que não entra?",
    criticidade: "obrigatorio",
    dependeDe: null,
    temId: false,
    tipo: "bloco",
    resumo: "O filtro que decide se um assunto vira pauta ou fica de fora.",
    porque:
      "Sem ele o filtro aceita tudo — a fila enche de assunto que não gera decisão.",
  },
  {
    key: "geografia",
    titulo: "Área de atuação",
    pergunta:
      "Onde a operação atua — e o que fazer com notícia de alcance nacional?",
    criticidade: "obrigatorio",
    dependeDe: null,
    temId: false,
    tipo: "bloco",
    resumo: "As praças que contam e a regra para pauta que vem de fora delas.",
    porque:
      "Sem ela o segundo maior componente do score (20%) é julgado sem referência: nada diz quais praças contam.",
  },
  {
    key: "contato",
    titulo: "Contato e CTA",
    pergunta: "Qual número aparece na arte, e para onde o post manda a pessoa?",
    criticidade: "obrigatorio",
    dependeDe: null,
    temId: false,
    // Campo e não prosa: o número que vai no rodapé da arte é valor, e a skill
    // o injeta no must_have do briefing visual. Escrevê-lo em prosa criaria
    // duas casas para o mesmo dado — e elas discordam na primeira edição.
    tipo: "campo",
    href: "/config/vault/contato",
    resumo: "O canal de destino e o número que vai no rodapé da arte.",
    porque:
      "Sem ele o CTA fica sem destino e a arte sai sem o número do rodapé.",
  },
  {
    key: "publicos",
    titulo: "Públicos",
    pergunta: "Para quem a marca fala, e como cada um decide?",
    criticidade: "obrigatorio",
    dependeDe: "foco",
    temId: true,
    tipo: "bloco",
    resumo:
      "Os perfis que o score usa como componente. Cada um com código estável.",
    porque: "Sem eles falta um dos cinco componentes do score.",
  },
  {
    key: "pilares",
    titulo: "Pilares editoriais",
    pergunta: "Em que assuntos a marca fala com autoridade?",
    criticidade: "obrigatorio",
    dependeDe: "publicos",
    temId: true,
    tipo: "bloco",
    resumo:
      "Os eixos que classificam todo brief. A configuração aponta para estes códigos.",
    porque: "Sem eles não há como classificar o que a varredura encontra.",
  },
  {
    key: "cadencia",
    titulo: "Cadência",
    pergunta: "Quantos posts por semana, e em que proporção entre os pilares?",
    criticidade: "degrada",
    dependeDe: "pilares",
    temId: false,
    tipo: "bloco",
    resumo: "O ritmo sustentável e a divisão da semana entre os pilares.",
    porque:
      "Sem ela o radar não sabe quantas pautas buscar nem como distribuí-las — gera volume que não vira publicação.",
  },
  {
    key: "fontes",
    titulo: "Fontes de pesquisa",
    pergunta: "Onde a varredura procura, e quais pilares cada grupo alimenta?",
    criticidade: "obrigatorio",
    dependeDe: "pilares",
    temId: false,
    tipo: "config",
    href: "/config",
    resumo:
      "A lista de domínios é decisão operacional e vive no manifest. Do vault vem só o vocabulário de pilar que cada grupo alimenta.",
    porque: "Sem elas não há onde procurar.",
  },
  {
    key: "temas",
    titulo: "Banco de temas",
    pergunta: "Que assuntos recorrentes já valem uma pauta própria?",
    criticidade: "opcional",
    dependeDe: "pilares",
    temId: true,
    tipo: "bloco",
    resumo:
      "Nasce vazio e enche com o uso. Cada tema pertence a um pilar e é citado por código nos briefs.",
  },
  {
    key: "ajustes",
    titulo: "Pesos, limiares e volume",
    pergunta: null,
    criticidade: "default",
    dependeDe: null,
    temId: false,
    tipo: "config",
    href: "/config",
    resumo:
      "Não vem da marca nem da entrevista: é default do produto, ajustável a qualquer momento.",
  },
  {
    key: "visual",
    titulo: "Identidade visual",
    pergunta: "Como a marca se parece?",
    criticidade: "degrada",
    dependeDe: null,
    temId: false,
    tipo: "bloco",
    resumo:
      "Logo, paleta e tipografia. Pesa na geração da arte, não na varredura.",
  },
];

/**
 * O estado do vault vem do banco: `corpo` vazio é bloco por preencher. Não há
 * rascunho meio-salvo — bloco confirmado é uma versão, e retomar é continuar de
 * onde a lista de vazios começa.
 */
export interface BlocoVault {
  slug: string;
  titulo: string;
  corpo: string;
  ordem: number;
  escopo: string;
  contrato: string;
  versao: number;
  atualizadoEm: string;
}

export type Aceitos = Record<string, BlocoVault>;

/** Indexa por slug o que o banco devolveu. */
export function porSlug(
  blocos: BlocoVault[],
  config: { temFontes: boolean; temAjustes: boolean; temContato: boolean } = {
    temFontes: false,
    temAjustes: false,
    temContato: false,
  },
): Aceitos {
  const aceitos: Aceitos = Object.fromEntries(
    blocos.filter((b) => b.corpo !== "").map((b) => [b.slug, b]),
  );

  // Blocos de tipo `config` — fontes e ajustes — não têm linha no vault: o
  // conteúdo deles é configuração. Sem isto ficariam eternamente por preencher,
  // e `fontes`, que é obrigatório, travaria um ambiente já configurado.
  const sintetico = (slug: string, titulo: string): BlocoVault => ({
    slug,
    titulo,
    corpo: "(configuração)",
    ordem: 0,
    escopo: "config",
    contrato: "obrigatorio",
    versao: 1,
    atualizadoEm: new Date(0).toISOString(),
  });

  if (config.temFontes) {
    aceitos.fontes = sintetico("fontes", "Fontes de pesquisa");
  }
  if (config.temContato) {
    aceitos.contato = sintetico("contato", "Contato e CTA");
  }
  if (config.temAjustes) {
    aceitos.ajustes = sintetico("ajustes", "Pesos, limiares e volume");
  }
  return aceitos;
}

export interface BlocoMapeado extends Bloco {
  preenchido: boolean;
  versao: number;
  atualizado_em: string | null;
  trancado: boolean;
  bloqueador: Bloco | null;
  estado: EstadoBloco;
}

/**
 * Quatro estados, e a diferença entre eles é a diferença entre "ainda não é
 * hora" e "falta você fazer": trancado · pendente obrigatório · pendente
 * opcional · preenchido.
 */
export function mapaDe(aceitos: Aceitos): BlocoMapeado[] {
  return BLOCOS.map((bloco) => {
    const gravado = aceitos[bloco.key];
    const preenchido = Boolean(gravado);
    const dep = bloco.dependeDe
      ? (BLOCOS.find((b) => b.key === bloco.dependeDe) ?? null)
      : null;
    // A trava vale só para a primeira vez: com o bloco já preenchido, reabrir
    // não exige repassar pelo bloqueador.
    const trancado = !preenchido && Boolean(dep) && !aceitos[bloco.dependeDe!];

    return {
      ...bloco,
      preenchido,
      versao: gravado?.versao ?? 0,
      atualizado_em: gravado?.atualizadoEm ?? null,
      trancado,
      bloqueador: trancado ? dep : null,
      estado: trancado
        ? "trancado"
        : preenchido
          ? "preenchido"
          : bloco.criticidade === "obrigatorio"
            ? "pendente-obrigatorio"
            : "pendente-opcional",
    };
  });
}

export interface Progresso {
  preenchidos: number;
  total: number;
  faltam: BlocoMapeado[];
  podeRodar: boolean;
}

export function progressoDe(aceitos: Aceitos): Progresso {
  const mapa = mapaDe(aceitos);
  const faltam = mapa.filter(
    (b) => b.criticidade === "obrigatorio" && !b.preenchido,
  );
  return {
    preenchidos: mapa.filter((b) => b.preenchido).length,
    total: mapa.length,
    faltam,
    podeRodar: faltam.length === 0,
  };
}

export function conteudoDe(aceitos: Aceitos, key: string): string | null {
  return aceitos[key]?.corpo ?? null;
}

/**
 * O documento montado: o que o modelo recebe, na ordem, sem metadado. Bloco
 * vazio vira lacuna explícita — ver o buraco é metade do valor.
 */
export function documentoDe(aceitos: Aceitos) {
  return (
    mapaDe(aceitos)
      // Só prosa: campo e config chegam ao agente como valor estruturado, não
      // como texto — e repetir o valor aqui criaria a segunda casa.
      .filter((b) => b.tipo === "bloco")
      .map((b) => ({
        key: b.key,
        titulo: b.titulo,
        conteudo: b.preenchido ? conteudoDe(aceitos, b.key) : null,
      }))
  );
}

export const ROTULO: Record<EstadoBloco, string> = {
  trancado: "trancado",
  preenchido: "preenchido",
  "pendente-obrigatorio": "falta para rodar",
  "pendente-opcional": "opcional",
};

export const CRITICIDADE: Record<Criticidade, string> = {
  obrigatorio: "obrigatório",
  degrada: "degrada sem",
  opcional: "opcional",
  default: "default do produto",
};
