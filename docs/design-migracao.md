# Desenho — migração de arquivos para banco

> **Status: desenho, nada implementado.** Quarto documento da série, ao lado de
> [`design-persistencia-multiusuario.md`](./design-persistencia-multiusuario.md),
> [`design-vault-onboarding.md`](./design-vault-onboarding.md) e
> [`design-manifest-multiempresa.md`](./design-manifest-multiempresa.md).
>
> Os outros três descrevem **o destino**. Este descreve **o caminho** — e é o que
> decide se o plano é executável, porque o sistema está em uso diário enquanto a
> migração acontece.

## 1. O que existe hoje para migrar

| | Volume |
|---|---|
| Briefs | 33 arquivos `.md` com frontmatter, em 4 diretórios de estado |
| Ledger | 208 eventos em JSONL |
| Vault | 88 arquivos, 9,5 MB (~512 KB de texto fora do `archive/`) |
| Mídia | cache local gitignored |
| Configuração | um `manifest.yaml` |

Volume irrelevante para qualquer banco. **O problema não é o dado — é o código.**

## 2. A superfície medida (2026-08-12)

Não existe camada de acesso ao store. O conhecimento de "onde o dado mora" está
espalhado:

| Medida | Valor |
|---|---|
| Arquivos que leem o store | **17** |
| Arquivos que escrevem no store | 8 |
| Pontos de montagem de caminho (`path.join(paths.…)` / `resolvePaths`) | **40** |
| Rotas e páginas chamando `resolvePaths` direto, sem passar por `lib/` | **11** |

Distribuição dos 40 pontos: `lib/transitions/mv.ts` (6), `mv.test.ts` (4),
rotas de `hero` e `brief-editor` (3 cada), e 2 em cada uma das demais páginas e
rotas.

Isso tem **duas** consequências, e a segunda é mais séria:

1. **Migrar exigiria reescrever 17 arquivos simultaneamente.** Cada página e
   rota fala com o disco na primeira pessoa; não há um lugar para trocar a
   implementação.
2. **São 40 pontos onde o escopo do usuário precisaria ser aplicado.** Cada
   montagem de caminho é uma chance de esquecer o `env_id` — e o isolamento
   entre ambientes é a única fronteira que existe no modelo de usuários
   individuais (persistência §2). Quarenta chances, espalhadas por arquivos que
   ninguém revisa em conjunto.

## 3. Fase 0 — a costura (não toca no banco)

**Criar o módulo de acesso que não existe**, ainda implementado sobre arquivos:
`listBriefs`, `getBrief`, `patchBriefFields`, `readMedia`, `events`,
`appendEvent`, `transition`.

É refatoração pura: mesmo comportamento, mesmos testes, nenhuma mudança visível.
Entrega três coisas de uma vez:

- **Um lugar** para trocar arquivo por banco depois
- **Um lugar** para aplicar o escopo do usuário — o `env_id` vira parâmetro do
  módulo, e o isolamento deixa de depender de memória em 40 pontos
- Os 40 pontos viram 1

**É o passo com melhor relação entre custo e risco de todo o plano, e vale mesmo
que a migração para banco não aconteça.**

Vale acompanhar de um **teste de arquitetura** que falhe se algum arquivo fora
da camada de armazenamento voltar a referenciar `resolvePaths`, `briefsDir` ou
`mediaDir`. Sem isso, a costura se desfaz na primeira página nova.

## 4. Fases seguintes

| Fase | O quê | Observação |
|---|---|---|
| 1 | Esquema + importador | O importador lê os 33 briefs, os 208 eventos e o vault e popula o banco. Executável quantas vezes quiser **contra uma cópia** — dá para validar comparando contagens e conteúdo antes de confiar |
| 2 | Troca de leitura | O módulo passa a ler do banco. Como a interface não muda, os consumidores não mudam |
| 3 | Troca de escrita | Transações substituem a sequência `mv` + mídia + ledger, que hoje não é atômica |
| 4 | Injeção nas skills | Projeção de anti-repetição e vault deixam de ser diretórios lidos e viram contexto injetado; o workspace temporário reduz a `vault/` e `media/` |
| 5 | Remoção do backend de arquivo | |

A conversão das skills determinísticas (`radar-mark-published`, `radar-housekeeping`,
`radar-handoff`) cabe na fase 3: converter uma skill em código é o momento
natural de trocar a persistência, porque a função está sendo reescrita de
qualquer forma.

## 5. Riscos

**A anti-repetição falha em silêncio.** É o único ponto sem volta. Se a projeção
estiver errada — janela achatada, critério faltando —, o sistema não quebra:
passa a repetir pauta, e a descoberta acontece quando o conteúdo repetido é
publicado. As quatro janelas por estado e os três critérios estão em
[persistência §7](./design-persistencia-multiusuario.md).

> Avaliado pelo owner em 2026-08-12: risco aceito, sem teste comparativo
> antes do corte. Se a decisão for revista, o teste é barato — rodar os dois
> caminhos lado a lado sobre o mesmo conjunto e comparar as decisões de
> redundância.

**O workspace temporário não tem cláusula `WHERE`.** O caminho do diretório de
execução é string montada em código; um `env_id` errado faz o agente de um
ambiente enxergar o conteúdo de outro. Mitigação: uma função única monta esse
caminho, e nada mais no código concatena diretórios de run.

**Run morto no meio.** Um `radar-scan` leva ~19 minutos. Quando morrer, o
workspace fica órfão com saída parcial — é preciso uma política (ingerir o que
estiver completo ou descartar) e uma varredura de limpeza.

## 6. Em aberto

- **Convivência dos dois backends** durante a transição, ou corte seco por fase.
- **Rollback** — o que fazer se a fase 2 ou 3 falhar em produção.
- **Migração do vault**, que tem forma diferente da dos briefs (documentos, mais
  o content-bank estruturado — ver [vault §5](./design-vault-onboarding.md)).
