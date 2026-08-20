import "server-only";

/**
 * Traduz as recusas da camada de armazenamento em resposta HTTP.
 *
 * Existe porque toda rota faz a mesma coisa: pede o store, chama uma operação
 * de domínio, e precisa transformar dois tipos de recusa em status. Repetir
 * esse `try/catch` em sete arquivos garantia divergência — e foi o que
 * aconteceu: **nenhuma** rota tratava `SemSessao`, então uma chamada sem cookie
 * subia até a borda do Next e virava 500. Um 500 diz "o servidor quebrou"
 * quando a verdade é "você não está autenticado", e é a diferença entre o
 * cliente tentar de novo e o cliente ir fazer login.
 *
 * `StoreError` continua sendo traduzida aqui pelo mesmo motivo: o código da
 * recusa é da camada, e o status é da borda.
 */

import { SemSessao, StoreError } from "./store";

type Manipulador<C> = (request: Request, contexto: C) => Promise<Response>;

export function rota<C>(manipulador: Manipulador<C>): Manipulador<C> {
  return async (request, contexto) => {
    try {
      return await manipulador(request, contexto);
    } catch (erro) {
      if (erro instanceof SemSessao) {
        return Response.json(
          { error: "sessão ausente ou expirada", code: "sem_sessao" },
          { status: 401 },
        );
      }
      if (erro instanceof StoreError) {
        return Response.json(
          { error: erro.message, code: erro.code },
          { status: erro.code === "nao_encontrado" ? 404 : 422 },
        );
      }
      // Qualquer outra coisa é defeito, não recusa prevista: sobe para o Next
      // registrar. Engolir aqui viraria 500 mudo, sem stack em lugar nenhum.
      throw erro;
    }
  };
}
