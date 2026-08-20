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

## 5. O relatório de reconciliação do importador

O importador não escreve no banco e segue em frente: ele **produz um relatório**
que a pessoa lê antes de confiar na carga. A alternativa — aviso no meio da
saída — é como a divergência entra no banco sem ninguém ver.

### 5.1 Fonte canônica declarada, não inferida

Vários blocos do vault têm duas origens que descrevem a mesma coisa. O
importador não adivinha qual vale: o mapeamento é explícito na configuração
dele.

| Bloco | Canônica | Secundária | O que compara |
|---|---|---|---|
| `publicos` | `prompts/icp-modifiers.json` | `strategy/positioning.md` | conjunto de códigos |
| `pilares` | `strategy/content-pillars.md` | `manifest.search_scopes.*.pillars_alvo` | códigos citados vs declarados |
| `temas` | `strategy/content-bank/pilar-*.md` | citações nos briefs (`§B10`) | a citação aponta para tema existente? |
| `geografia` | bloco do vault | `manifest.geografia_reframe_floor` | há praça declarada para o piso reancorar? |

**Critério da escolha:** vence a fonte com mais estrutura, porque é a que o
pipeline consome de fato. No caso dos públicos, o `icp-modifiers.json` carrega
overlays de tom, palavras-chave, direção visual e CTA; o `positioning.md`
carrega só nomes.

### 5.2 O relatório mostra o descartado, não só o adotado

```
publicos          ⚠ divergência
  icp-modifiers.json  → comprador, investidor, proprietario
  positioning.md      → primeiro-comprador, sem-banco, investidor, sair-do-aluguel
  em comum            → investidor
  adotado             → icp-modifiers.json (tem overlays de tom, CTA e visual)
  não adotados        → primeiro-comprador, sem-banco, sair-do-aluguel
                        entraram como texto no corpo do bloco
```

Um relatório que dissesse apenas "adotei os três" esconderia exatamente a
informação que importa. Este caso é real: ver
[`design-vault-onboarding.md`](./design-vault-onboarding.md) §8.

### 5.3 Aviso não trava; referência órfã trava

Mesmo padrão da tela de configuração — **erro bloqueia, aviso não**.

**Aviso:** conjuntos divergentes. A carga roda, adota o canônico, e o resto vira
prosa no corpo do bloco.

**Erro:** referência órfã — um escopo de busca citando pilar que não existe, ou
um brief citando `§B10` num banco que não tem `B10`. Não é ambiguidade, é
quebra, e é o que a chave estrangeira composta vai recusar de qualquer forma
([esquema §2.1](./design-esquema-banco.md)). Melhor descobrir no relatório do
que num erro de constraint no meio da carga.

A checagem das citações de tema é a mais valiosa das quatro: é ela que pegaria
uma renumeração silenciosa do content-bank — o modo de falha que motivou os
identificadores estáveis.

### 5.4 Injeção por ferramenta, e por que ainda não

O destino é **a skill não ler arquivo nenhum**. Em vez de materializar
`vault/*.md` e `manifest.yaml`, o executor expõe ferramentas em processo
(servidor MCP do Agent SDK) já escopadas ao ambiente da execução:

| Ferramenta | Responde |
|---|---|
| `vault()` | o documento montado dos blocos |
| `configuracao()` | pesos, limiares, janelas, escopos de busca |
| `antiRepeticao(hash, pilar, publico)` | a pergunta, em vez de entregar 34 frontmatters |
| `registrarBrief(...)` | recebe o resultado estruturado |

Isso muda a natureza do isolamento. Com workspace, o caminho certo é o fácil,
mas o agente **tem** acesso ao sistema de arquivos e poderia ler fora. Com
ferramenta, não existe caminho para pedir outro ambiente: quem responde só sabe
de um.

A anti-repetição ganha junto — em vez de o agente reduzir 34 frontmatters, ele
pergunta e a resposta sai de consulta indexada, que é onde as quatro janelas e
os três critérios deveriam morar.

**Decisão de 2026-08-19: adiado, deliberadamente.** O que existe hoje —
workspace materializado — é ponte, não destino. Foi construído assim para provar
o contrato entre skill e dado antes de otimizar a forma, e essa escolha não foi
sinalizada quando foi feita.

Adiar é seguro **enquanto houver um cliente só**: um agente lendo fora do
workspace encontraria o mesmo dado. O risco aparece no primeiro ambiente novo em
produção, quando "ler fora" passa a significar ler de outro cliente.

**Gatilho para deixar de adiar: o segundo cliente.** Não a passagem do tempo.

O que sobrevive à troca: colheita, ingestão, executor, fila e o teste de
contrato. O que sai: `vault/`, o `manifest.yaml` gerado e os quatro diretórios
de brief materializados.

## 6. Riscos

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

## 7. Em aberto

- **Convivência dos dois backends** durante a transição, ou corte seco por fase.
- **Rollback** — o que fazer se a fase 2 ou 3 falhar em produção.
- **Migração do vault**, que tem forma diferente da dos briefs (blocos, mais o
  content-bank estruturado — ver [vault §5](./design-vault-onboarding.md)). O
  conjunto de blocos está decidido ([vault §7](./design-vault-onboarding.md)).
