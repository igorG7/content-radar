/**
 * Vault — os blocos que definem o vocabulário editorial.
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
 *
 * Esta tela é casca: os blocos vivem no localStorage, não no store. A
 * persistência real está desenhada em docs/design-vault-onboarding.md.
 */

export type Criticidade = "obrigatorio" | "degrada" | "opcional" | "default";
export type EstadoBloco = "preenchido" | "pendente-obrigatorio" | "pendente-opcional" | "trancado";

export interface Bloco {
  key: string;
  titulo: string;
  pergunta: string | null;
  criticidade: Criticidade;
  dependeDe: string | null;
  temId: boolean;
  tipo: "bloco" | "config";
  href?: string;
  resumo: string;
  porque?: string;
  conteudo: string | null;
}

export const BLOCOS: Bloco[] = [
  {
    key: "identidade",
    titulo: "Identidade e origem",
    pergunta: "Quem é a marca, de onde ela veio e por que alguém escolheria ela?",
    criticidade: "degrada",
    dependeDe: null,
    temId: false,
    tipo: "bloco",
    resumo: "Posicionamento, origem e os princípios que valem quando entram em conflito.",
    conteudo: `A operação é curadoria imobiliária orientada à decisão. Não vende imóvel: organiza o caminho até a decisão certa. A promessa é entender o perfil antes de oferecer qualquer coisa.

Nasceu como marca pessoal de corretor e virou operação estruturada. O nome mudou; o jeito de atender, não.

Os arquétipos são o Guia e o Estrategista — seguro, calmo, objetivo, prestativo. Os princípios de experiência, na ordem em que valem quando conflitam:

1. Clareza antes de volume
2. Orientação antes de venda
3. Confiança antes de conversão
4. Simplicidade antes de complexidade
5. Velocidade antes de perfeição`,
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
    conteudo: `Fala como quem já explicou isso mil vezes e não perdeu a paciência. Frase curta, verbo no presente, número quando existe número. Nada de rodeio antes do assunto.

O que a marca não diz:

- superlativo de corretor — "oportunidade única", "imperdível", "não perca"
- pergunta retórica na abertura
- promessa de retorno, valorização ou aprovação
- explicação que trata o leitor como leigo; explica sem infantilizar

Um post bom termina com a pessoa sabendo o que fazer em seguida. Um post ruim termina com ela impressionada.`,
  },
  {
    key: "guardrails",
    titulo: "Guardrails",
    pergunta: "Que restrições a marca impõe a si mesma, e como ela conduz uma conversa?",
    criticidade: "obrigatorio",
    dependeDe: null,
    temId: true,
    tipo: "bloco",
    resumo: "Restrições operáveis item a item, condução e a regra de ouro.",
    porque: "Sem eles nada impede o texto de prometer o que não pode ser prometido.",
    conteudo: `## Restrições

- \`nao-prometer-aprovacao\` — nunca prometer aprovação garantida de crédito ou financiamento
- \`nao-inventar-imovel\` — nunca inventar informação sobre um imóvel: metragem, documentação, valor, disponibilidade
- \`nao-valor-sem-contexto\` — nunca citar valor solto, sem a condição que o explica
- \`nao-sair-do-escopo\` — não sair do escopo imobiliário

## Condução

- entender o perfil antes de sugerir opção
- evitar resposta longa e teórica; priorizar clareza e ação
- manter tom humano e natural
- direcionar sempre para um próximo passo concreto: simulação, visita, fechamento

## Regra de ouro

Toda interação caminha para um próximo passo claro. Se não há avanço, há falha na condução.`,
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
    porque: "Sem ele o filtro aceita tudo — a fila enche de assunto que não gera decisão.",
    conteudo: `Entra o que muda a decisão de quem compra lote, sítio, chácara ou casa do programa popular com simulação bancária prévia: mudança de regra, obra que altera acesso, número que reposiciona uma praça.

Não entra lançamento de terceiro, imóvel urbano pronto de alto padrão, leilão, nem assunto que gere contato que a operação não atende.

O teste é sempre o mesmo: alguém decide diferente depois de ler isto? Se não, é informação — não é pauta.`,
  },
  {
    key: "publicos",
    titulo: "Públicos",
    pergunta: "Para quem a marca fala, e como cada um decide?",
    criticidade: "obrigatorio",
    dependeDe: "foco",
    temId: true,
    tipo: "bloco",
    resumo: "Os perfis que o score usa como componente. Cada um com código estável.",
    porque: "Sem eles falta um dos cinco componentes do score.",
    conteudo: `- \`investidor-lote\` — compra terreno para revender ou segurar. Decide por matemática: preço do m², módulo mínimo, o que a infraestrutura faz com o valor. Quer número, não adjetivo.
- \`familia-mcmv\` — compra a primeira casa pelo programa popular. Decide por segurança: cabe no orçamento, o financiamento sai, a documentação está limpa. Precisa de passo a passo, não de urgência.
- \`refugio-sitio\` — procura sítio ou chácara para uso próprio. Decide pela sensação, mas trava na documentação: outorga de água, georreferenciamento, acesso.`,
  },
  {
    key: "pilares",
    titulo: "Pilares e cadência",
    pergunta: "Em que assuntos a marca fala com autoridade, e em que proporção?",
    criticidade: "obrigatorio",
    dependeDe: "publicos",
    temId: true,
    tipo: "bloco",
    resumo: "Os eixos que classificam todo brief. A configuração aponta para estes códigos.",
    porque: "Sem eles não há como classificar o que a varredura encontra.",
    conteudo: `- \`oportunidade\` — o que abriu agora e fecha depois: mudança de regra, janela de preço, lote que entrou no mercado. Só entra com a condição que explica a janela; sem a condição, vira anúncio.
- \`educacao-financiamento\` — como o dinheiro funciona: simulação prévia, teto de renda, o que aprova e o que reprova. Casa pronta só entra sendo do programa popular e com simulação bancária prévia. Sem isso não é este pilar, é outro assunto.
- \`regiao\` — o que acontece no território e mexe com preço: obra, plano diretor, equipamento público novo.
- \`bastidores\` — como a operação trabalha. Serve para confiança, não para conversão. Nunca é o pilar de maior volume.

Cadência da semana: 2 de oportunidade, 1 de educação, 1 de região, 1 de bastidores.`,
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
    conteudo: null,
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
    conteudo: `- \`modulo-minimo\` — pertence a \`regiao\`. Mudança de módulo mínimo em plano diretor e o efeito na conta do investidor.
- \`outorga-agua\` — pertence a \`educacao-financiamento\`. Outorga de uso de água em imóvel rural: quando exige, quanto demora.
- \`teto-renda\` — pertence a \`educacao-financiamento\`. Faixas do programa popular e o que muda quando o teto é reajustado.`,
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
    resumo: "Não vem da marca nem da entrevista: é default do produto, ajustável a qualquer momento.",
    conteudo: null,
  },
  {
    key: "visual",
    titulo: "Identidade visual",
    pergunta: "Como a marca se parece?",
    criticidade: "degrada",
    dependeDe: null,
    temId: false,
    tipo: "bloco",
    resumo: "Logo, paleta e tipografia. Pesa na geração da arte, não na varredura.",
    conteudo: `Os arquivos — logo, paleta, tipografia — ficam no mesmo armazenamento da mídia, fora do banco de blocos.

A paleta é fria e sóbria: azul-tinta como cor de texto e de marca, papel quente como fundo. Sem gradiente, sem sombra decorativa. A tipografia de display é serifada; o corpo, sem serifa; número em mono, sempre tabular.

Este bloco não entra na varredura — ele é lido na hora de gerar a arte.`,
  },
];

export interface BlocoAceito {
  versao: number;
  em: string;
  motivo?: string | null;
  conteudo?: string | null;
}

export type Aceitos = Record<string, BlocoAceito>;

/**
 * `completo` é o app em regime: vault preenchido, pipeline rodando.
 * `onboarding` é o primeiro acesso: quase tudo vazio, pipeline parado.
 * Trocar por ?vault=onboarding na URL; a escolha persiste como o tema.
 */
export type ModoVault = "completo" | "onboarding";

export const SEEDS: Record<ModoVault, Aceitos> = {
  completo: {
    identidade: { versao: 2, em: "2026-05-04T10:20:00-03:00" },
    voz: { versao: 3, em: "2026-06-02T15:41:00-03:00" },
    guardrails: { versao: 1, em: "2026-04-28T09:05:00-03:00" },
    foco: { versao: 2, em: "2026-05-19T11:12:00-03:00" },
    publicos: { versao: 1, em: "2026-04-29T14:33:00-03:00" },
    pilares: { versao: 4, em: "2026-06-18T08:57:00-03:00" },
    fontes: { versao: 1, em: "2026-05-02T16:00:00-03:00" },
    ajustes: { versao: 1, em: "2026-04-28T09:40:00-03:00" },
  },
  onboarding: {
    identidade: { versao: 1, em: "2026-06-22T09:31:00-03:00" },
  },
};

export interface BlocoMapeado extends Bloco {
  preenchido: boolean;
  versao: number;
  atualizado_em: string | null;
  motivo: string | null;
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
    const aceito = aceitos[bloco.key];
    const preenchido = Boolean(aceito);
    const dep = bloco.dependeDe ? BLOCOS.find((b) => b.key === bloco.dependeDe) ?? null : null;
    // A trava vale só para a primeira vez: com o bloco já preenchido, reabrir
    // não exige repassar pelo bloqueador.
    const trancado = !preenchido && Boolean(dep) && !aceitos[bloco.dependeDe!];

    return {
      ...bloco,
      preenchido,
      versao: preenchido ? aceito.versao : 0,
      atualizado_em: preenchido ? aceito.em : null,
      motivo: preenchido ? aceito.motivo ?? null : null,
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
  const faltam = mapa.filter((b) => b.criticidade === "obrigatorio" && !b.preenchido);
  return {
    preenchidos: mapa.filter((b) => b.preenchido).length,
    total: mapa.length,
    faltam,
    podeRodar: faltam.length === 0,
  };
}

export function conteudoDe(aceitos: Aceitos, key: string): string | null {
  const catalogo = BLOCOS.find((b) => b.key === key);
  return aceitos[key]?.conteudo ?? catalogo?.conteudo ?? null;
}

/**
 * O documento montado: o que o modelo recebe, na ordem, sem metadado. Bloco
 * vazio vira lacuna explícita — ver o buraco é metade do valor.
 */
export function documentoDe(aceitos: Aceitos) {
  return mapaDe(aceitos)
    .filter((b) => b.tipo === "bloco")
    .map((b) => ({
      key: b.key,
      titulo: b.titulo,
      conteudo: b.preenchido ? conteudoDe(aceitos, b.key) : null,
    }));
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
