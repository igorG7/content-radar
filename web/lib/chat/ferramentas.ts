/**
 * O que o agente do chat pode fazer.
 *
 * São funções sobre a camada de armazenamento, não sobre arquivo. É a injeção
 * por ferramenta que o desenho da migração adiou (design-migracao §5.4), e o
 * chat é onde ela deixa de ser opcional: conversar exige perguntar coisas
 * pontuais — "quais escopos existem?", "o que tem na fila?" — e materializar um
 * diretório inteiro para responder isso seria absurdo.
 *
 * **O ambiente nunca é parâmetro.** Cada ferramenta fecha sobre o `RadarStore`
 * da sessão, e o store já carrega o `SET LOCAL app.ambiente` que sustenta o
 * RLS. Se o ambiente fosse argumento, bastaria o modelo escrever outro id — e a
 * fronteira entre clientes passaria a depender de o modelo se comportar.
 *
 * Deliberadamente **sem ferramenta de escrita em brief**. Aprovar, publicar e
 * exportar são decisão humana com botão próprio; um agente que aprova pauta a
 * pedido de conversa transforma revisão em formalidade.
 */

import { JaRodando, type PedidoDeScan, type RadarStore } from "../store";

/** O que uma ferramenta devolve: dado serializável, para o modelo ler. */
export type Resultado = Record<string, unknown>;

export interface Ferramenta {
  nome: string;
  descricao: string;
  /** Parâmetros aceitos, em linguagem de esquema — o adaptador do SDK traduz. */
  parametros: Record<
    string,
    { tipo: "string" | "number"; descricao: string; obrigatorio?: boolean }
  >;
  executar(
    store: RadarStore,
    args: Record<string, unknown>,
    /**
     * O que a ferramenta sabe sem o modelo dizer. A conversa entra aqui, e não
     * como parâmetro, pelo mesmo motivo do ambiente: id que o modelo escolhe é
     * id que o modelo pode trocar.
     */
    contexto?: { conversaId?: string },
  ): Promise<Resultado>;
}

const escoposDeBusca: Ferramenta = {
  nome: "escopos_de_busca",
  descricao:
    "Os escopos de busca configurados para esta empresa, com as fontes de cada um e os pilares que alimentam. Use antes de pedir uma varredura: o escopo precisa existir e estar ativo.",
  parametros: {},
  async executar(store) {
    const escopos = await store.escoposDeBusca();
    return {
      escopos: escopos.map((e) => ({
        slug: e.slug,
        nome: e.label,
        ativo: e.ativo,
        pilares_que_alimenta: e.pilares,
        fontes: e.fontes
          .filter((f) => f.ativo)
          .map((f) => ({ slug: f.slug, url: f.url, nota: f.nota })),
        fontes_desativadas: e.fontes.filter((f) => !f.ativo).length,
      })),
    };
  },
};

const vocabulario: Ferramenta = {
  nome: "pilares_e_publicos",
  descricao:
    "Os pilares editoriais e os públicos-alvo desta empresa, com a descrição de cada um. É o vocabulário com que se fala de pauta aqui — use os slugs daqui, não invente.",
  parametros: {},
  async executar(store) {
    const v = await store.vocabulario();
    return {
      pilares: v.pilares.map((p) => ({
        slug: p.slug,
        nome: p.nome,
        descricao: p.corpo,
        // Um pilar fora do radar existe na estratégia mas não é gerado aqui —
        // pedir varredura dele produziria zero resultado sem explicação.
        entra_no_radar: p.noRadar,
      })),
      publicos: v.publicos.map((p) => ({
        slug: p.slug,
        nome: p.nome,
        descricao: p.corpo,
        padrao: p.padrao,
      })),
    };
  },
};

const configuracao: Ferramenta = {
  nome: "configuracao",
  descricao:
    "Os parâmetros operacionais: pesos do score, cortes de promoção, janelas de anti-repetição e volume alvo. Consulte para explicar por que uma pauta foi promovida ou descartada.",
  parametros: {},
  async executar(store) {
    const c = await store.configuracao();
    return {
      pesos: c.pesos,
      cortes: c.caps,
      janelas: c.janelas,
      volume: c.volume,
    };
  },
};

const resumoDaFila: Ferramenta = {
  nome: "resumo_da_fila",
  descricao:
    "Quantos briefs existem em cada estado e o que há na fila de aprovação, com pilar, público, score e se a arte já foi decidida.",
  parametros: {},
  async executar(store) {
    const estados = await store.listarTodos();
    const fila = estados.find((e) => e.state === "pendente-aprovacao");
    return {
      por_estado: Object.fromEntries(
        estados.map((e) => [e.state, e.briefs.length]),
      ),
      na_fila: (fila?.briefs ?? []).map((b) => ({
        slug: b.slug,
        brief_id: b.briefId,
        headline: b.headline,
        pilar: b.pillar,
        publico: b.icp,
        score: b.matchScore ?? null,
        borderline: b.borderline,
        arte_decidida: b.heroChoiceDeclared,
      })),
    };
  },
};

const varreduraAtual: Ferramenta = {
  nome: "varredura_atual",
  descricao:
    "A varredura mais recente: se ainda roda, em que estágio está e a posição na fila; se já terminou, quantas pautas gerou, quanto levou e o que ficou incompleto.",
  parametros: {},
  async executar(store) {
    const scan = await store.varreduraRecente();
    if (!scan) return { nenhuma: true };
    return {
      em_andamento: scan.emAndamento,
      encerrada_em: scan.encerradoEm,
      resultado: scan.resultado,
      referencia: scan.scanRef,
      estado: scan.estado,
      pedido: scan.pedido,
      pedida_em: scan.pedidoEm,
      iniciada_em: scan.iniciadoEm,
      posicao_na_fila: scan.posicao,
      estagios: scan.estagios,
    };
  },
};

const pedirVarredura: Ferramenta = {
  nome: "pedir_varredura",
  descricao:
    "Coloca uma varredura na fila. NÃO executa aqui: ela roda noutro processo e leva de 12 a 63 minutos. Confirme escopo e pilar com a pessoa antes de chamar — é trabalho pago que não dá para cancelar pela metade.",
  parametros: {
    escopo: {
      tipo: "string",
      descricao: "Slug de um escopo ativo, vindo de escopos_de_busca.",
      obrigatorio: true,
    },
    pilar: {
      tipo: "string",
      descricao:
        "Slug de um pilar, para restringir a varredura a ele. Omita para todos.",
    },
    alvo: {
      tipo: "number",
      descricao: "Quantos briefs gerar. Omita para usar o volume configurado.",
    },
  },
  async executar(store, args) {
    const escopo = String(args.escopo ?? "");
    const pilar = args.pilar === undefined ? undefined : String(args.pilar);
    const alvo = args.alvo === undefined ? undefined : Number(args.alvo);

    // As mesmas checagens da rota, pelo mesmo motivo: um escopo ou pilar
    // inventado só falharia dentro da execução, com o custo já pago.
    const escopos = await store.escoposDeBusca();
    const escolhido = escopos.find((e) => e.slug === escopo);
    if (!escolhido) {
      return {
        recusado: true,
        motivo: `escopo desconhecido: ${escopo}`,
        escopos_ativos: escopos.filter((e) => e.ativo).map((e) => e.slug),
      };
    }
    if (!escolhido.ativo) {
      return {
        recusado: true,
        motivo: `o escopo ${escolhido.label} está desativado na configuração`,
      };
    }

    if (pilar) {
      const { pilares } = await store.vocabulario();
      const p = pilares.find((x) => x.slug === pilar);
      if (!p) {
        return {
          recusado: true,
          motivo: `pilar desconhecido: ${pilar}`,
          pilares: pilares.map((x) => x.slug),
        };
      }
      if (!p.noRadar) {
        return {
          recusado: true,
          motivo: `o pilar ${p.nome} não entra no radar — a varredura não geraria nada`,
        };
      }
    }

    const pedido: PedidoDeScan = { escopo, pilar, alvo };
    try {
      const r = await store.enfileirarScan(pedido);
      return {
        enfileirada: true,
        referencia: r.scanRef,
        posicao_na_fila: r.posicao,
        aviso:
          "A execução acontece fora desta conversa. Acompanhe com varredura_atual.",
      };
    } catch (erro) {
      if (erro instanceof JaRodando) {
        return { recusado: true, motivo: erro.message, code: "ja_rodando" };
      }
      throw erro;
    }
  },
};

const anexosDaConversa: Ferramenta = {
  nome: "anexos_da_conversa",
  descricao:
    "Os arquivos que a pessoa anexou nesta conversa, com nome e tamanho. Use antes de ler: o conteúdo vem por ler_anexo.",
  parametros: {},
  async executar(store, _args, contexto) {
    if (!contexto?.conversaId) return { anexos: [] };
    const anexos = await store.listarAnexos(contexto.conversaId);
    return {
      anexos: anexos.map((a) => ({
        nome: a.nome,
        bytes: a.bytes,
        enviado_em: a.criadoEm,
      })),
    };
  },
};

const lerAnexo: Ferramenta = {
  nome: "ler_anexo",
  descricao:
    "O conteúdo de um arquivo anexado nesta conversa, por nome. Só arquivos de texto são aceitos no envio, então o que volta é o texto integral.",
  parametros: {
    nome: {
      tipo: "string",
      descricao: "Nome do arquivo, como aparece em anexos_da_conversa.",
      obrigatorio: true,
    },
  },
  async executar(store, args, contexto) {
    if (!contexto?.conversaId) {
      return { erro: "esta conversa não tem anexo" };
    }
    const procurado = String(args.nome ?? "").trim();
    const anexos = await store.listarAnexos(contexto.conversaId);
    const achado = anexos.find((a) => a.nome === procurado);

    if (!achado) {
      // Devolver a lista junto poupa um segundo turno quando o modelo errou o
      // nome por pouco — e diz na cara que o arquivo pedido não está aqui.
      return {
        erro: `não há anexo chamado "${procurado}" nesta conversa`,
        disponiveis: anexos.map((a) => a.nome),
      };
    }

    const { conteudo, nome, bytes } = await store.lerAnexo(achado.id);
    return { nome, bytes, conteudo };
  },
};

export const FERRAMENTAS: Ferramenta[] = [
  escoposDeBusca,
  vocabulario,
  configuracao,
  resumoDaFila,
  varreduraAtual,
  pedirVarredura,
  anexosDaConversa,
  lerAnexo,
];

export const porNome = (nome: string): Ferramenta | undefined =>
  FERRAMENTAS.find((f) => f.nome === nome);
