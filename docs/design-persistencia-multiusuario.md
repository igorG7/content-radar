# Desenho — persistência do fluxo operacional para multi-usuário

> **Status: desenho, nada implementado.** Este documento registra a conversa de
> arquitetura de 2026-08-12 sobre migrar a persistência do fluxo operacional de
> arquivos para banco de dados. Não descreve o sistema atual — descreve para
> onde ele iria. As specs 001–009 continuam valendo como descrição do que existe.
>
> Escopo: apenas o eixo operacional **scan → revisão → aprovação → handoff →
> publicação → housekeeping**. O vault da empresa e o `manifest.yaml` ficaram
> deliberadamente de fora (ver §8).

## 1. Ponto de partida

Hoje o `content-radar` é operado por **uma pessoa**. Todo o estado vive em
arquivo: os briefs em `store/briefs/` (quatro diretórios que representam o
estado), o histórico em `store/ledger.jsonl`, a configuração em `manifest.yaml`.
O git é o histórico, e o diretório de estado é o próprio banco de dados.

Isso funciona bem no cenário atual e não é acidente: o `.md` com frontmatter é o
entregável, não uma representação dele; o git dá auditoria de graça; e as skills
leem os arquivos diretamente.

## 2. O que quebra com mais de um operador

O git **não** é o problema. Commits não se sobrescrevem: em clones separados, o
segundo push é recusado e obrigado a integrar; briefs diferentes unem sem
atrito e o mesmo brief gera conflito explícito. Em ambiente de desenvolvimento
com um clone por pessoa, o modelo atual sobrevive.

O que quebra é a **saída do desenvolvimento**:

| Frente | O que acontece |
|---|---|
| Isolamento | Em produção não há clones. Todos escrevem no mesmo working tree, pelo mesmo processo. Duas edições do mesmo brief: a segunda sobrescreve a primeira, sem conflito e sem aviso. A perda acontece antes de qualquer commit. |
| Autoria | Um `git commit` varre o trabalho de todos num commit só, atribuído a quem rodou o comando. |
| Multi-empresa | Conteúdo de cliente no repositório do produto: publicar o app distribui dados de cliente, e cada ação vira commit no repo do produto. |
| Segurança | Isolamento entre clientes passa a depender de *todo* trecho de código montar o path certo. Em banco é cláusula de consulta, verificável num lugar só. |
| Ciclo de vida | Backup por cliente, remoção completa, cota e retenção viram trabalho manual — reimplementando pior o que o banco entrega pronto. |
| Leitura | Montar o dashboard hoje é parsear 33 arquivos YAML por request. Com histórico por cliente, cada tela vira varredura de disco. |

`store/media/`, `store/packages/` e `store/previews/` são gitignored: exclusão de
mídia **já hoje** não deixa rastro no git — o único registro é o `media_purged`
no ledger. Ou seja, o ledger nunca foi redundante com o git.

## 3. Decisão central

**Banco de dados como fonte da verdade do estado operacional.** Arquivos deixam
de ser a persistência e passam a ser, quando necessário, materialização.

O que **não** vai para o banco:

- **Mídia** (binário) → armazenamento de objetos ou direto para o Cloudinary.
- **Package do `radar-handoff`** → artefato gerado a partir do banco, não
  guardado nele; provavelmente download sob demanda em vez de pasta em disco.
- **Vault da empresa** → base de conhecimento, fora deste escopo (§8).

## 4. Princípio: a skill não toca em estado

> A skill deixa de ler e escrever estado. Ela **recebe contexto e devolve
> resultado**. A persistência é responsabilidade do app.

Nas leituras, o app consulta o banco e **injeta a projeção** na execução da
skill. Nas escritas, a skill devolve JSON estruturado e o app grava.

Isso já foi provado em pequena escala: a fatia 2 tirou o `radar-mv` da skill e
o transformou em `web/lib/transitions/mv.ts`, com 11 testes cobrindo as regras
duras. A skill virou um invólucro fino que chama o mesmo módulo — uma
implementação, dois pontos de entrada (app e terminal). Migrar de arquivo para
banco ali é trocar a implementação de uma função já isolada e testada.

## 5. O fluxo, passo a passo

| Etapa | Hoje | No desenho |
|---|---|---|
| `radar-scan` | Skill (LLM) que varre `store/briefs/**` antes de pontuar | Continua agentic — é o único passo com julgamento real. Recebe a projeção de anti-repetição (§6) e o snapshot do vault. Devolve JSON; o app grava. |
| Revisão / edição | App escreve no `.md` | App escreve no banco, com pré-condição por versão para não perder edição concorrente |
| `radar-mv` (aprovar/rejeitar) | **Já é código** | `UPDATE` de estado + `INSERT` do evento, numa transação |
| `radar-handoff` | Skill (LLM) | Código. Lê do banco, sobe hero ao Cloudinary, **gera** o package |
| `radar-mark-published` | Skill (LLM) | Código. Grava `ig_post_url` e `published_at`, muda estado, registra evento |
| `radar-housekeeping` | Skill (LLM) | Código. O banco decide *o quê*; a ação recai sobre blobs |

Só o `radar-scan` permanece agentic. Os outros quatro são determinísticos: dadas
as entradas, a saída é fixa. Converter cada um é o momento natural de trocar a
camada de persistência — a função está sendo reescrita de qualquer forma.

## 6. Projeção de anti-repetição (o ponto que liga skill e dados)

É aqui que o padrão de injeção se concretiza. Hoje o matcher varre quatro
diretórios e parseia YAML; no desenho, recebe o resultado de uma consulta.

**Anti-repetição é o primeiro check, antes de calcular score** — se é redundante,
não pontua, para economizar tokens (spec 003 §8.1). Uma consulta indexada por
`topic_hash` torna esse gate quase gratuito.

### 6.1 As janelas são quatro, não uma

| Estado | Janela |
|---|---|
| `pendente-aprovacao` | **todos**, sem limite de tempo |
| `pendente-publicacao` | **todos**, sem limite de tempo |
| `publicado` | 90 dias |
| `rejeitado` | 30 dias |

Um filtro achatado de 30 dias esconderia publicados entre 30 e 90 dias e
deixaria a fila inteira de fora — re-propondo pauta que já espera aprovação.
Expressar quatro janelas por estado é trivial em SQL e desajeitado em varredura
de diretório: este ponto **favorece** a migração.

### 6.2 Os critérios são três

1. Colisão de `topic_hash`
2. Sobreposição de `source_urls`
3. Colisão de `pillar + icp` **sem** hash, só em `publicado` e nos últimos
   14 dias — a regra anti-saturação

A projeção precisa carregar, por brief: `topic_hash`, `source_urls`, `pillar`,
`icp`, estado e data.

### 6.3 A consulta acontece duas vezes

Checagem dupla (spec 003 §8 + spec 001 §5): o **matcher** compara usando o
`title` do finding, porque a headline ainda não existe naquele estágio; o
**briefer** refaz com a `headline` final. Dois momentos, chaves diferentes.

## 7. O que o banco resolve de tabela

**Atomicidade.** Aprovar um brief hoje são três operações em sequência sem
transação: mover o `.md`, remanejar a mídia, escrever no ledger. Se falhar no
meio, o estado fica inconsistente — o módulo atual escolhe deliberadamente uma
ordem que falhe de forma recuperável, e ainda assim resta reconciliação manual.
Em banco, é uma transação.

**Concorrência.** O banco não impede perda sozinho, mas torna fácil implementar
a política: rejeitar escrita se o registro mudou desde a leitura. A decisão é a
mesma em arquivo ou em banco; as ferramentas é que são melhores.

**Trava de segurança do housekeeping.** A regra "nunca apagar mídia cujo
`cloud_url` ou `cloudinary_public_id` ainda seja nulo ou `<PENDING_CLOUDINARY>`,
porque a cópia local é a única que existe" hoje exige parsear YAML. Em banco
vira condição na consulta.

## 8. Fora do escopo deste documento

Pontos levantados e conscientemente adiados:

- **Vault da empresa** — `/srv/my-mind/Empresas/<cliente>`, 88 arquivos e 9,5 MB
  no caso da Avanz, fora do `store/` e fora do repositório. Toda execução do
  `radar-scan` injeta seis arquivos obrigatórios (~38 KB). É base de
  conhecimento, não estado transacional: texto longo, editado por humano. **É o
  ativo que faz o conteúdo ser bom** — dois clientes com o mesmo pipeline e
  vaults diferentes produzem resultados completamente distintos.
- **`manifest.yaml`** — configuração por cliente, hoje cravada na Avanz
  (`target_company`, `brand_facts`, `search_scopes` com prefeituras da RMBH).
- **Mídia por cliente** e **credenciais Cloudinary por cliente** — hoje um
  arquivo local com a conta da Avanz.
- **Autenticação e papéis** — se todos aprovam ou há hierarquia (revisor ×
  aprovador) muda a fila.
- **Política de commit** — se o app deixa de versionar conteúdo de cliente, o
  ledger passa a ser a única trilha de auditoria.
- **Execução concorrente** — um `radar-scan` real levou 19 minutos
  (ledger, 2026-05-28). Vários clientes em paralelo pedem fila e isolamento.
