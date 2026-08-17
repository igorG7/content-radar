# Desenho — persistência do fluxo operacional para multi-usuário

> **Status: desenho, nada implementado.** Este documento registra a conversa de
> arquitetura de 2026-08-12 sobre migrar a persistência do fluxo operacional de
> arquivos para banco de dados. Não descreve o sistema atual — descreve para
> onde ele iria. As specs 001–009 continuam valendo como descrição do que existe.
>
> Escopo: apenas o eixo operacional **scan → revisão → aprovação → handoff →
> publicação → housekeeping**. O vault da empresa e o `manifest.yaml` ficaram
> deliberadamente de fora (ver §9).

## 1. Ponto de partida

Hoje o `content-radar` é operado por **uma pessoa**. Todo o estado vive em
arquivo: os briefs em `store/briefs/` (quatro diretórios que representam o
estado), o histórico em `store/ledger.jsonl`, a configuração em `manifest.yaml`.
O git é o histórico, e o diretório de estado é o próprio banco de dados.

Isso funciona bem no cenário atual e não é acidente: o `.md` com frontmatter é o
entregável, não uma representação dele; o git dá auditoria de graça; e as skills
leem os arquivos diretamente.

## 2. O modelo de usuários (decidido)

**Usuários individuais, um ambiente cada.** Igor e João usam o mesmo sistema,
mas nunca tocam no mesmo dado: cada um tem seus briefs, seu vault e sua
configuração. Não há equipe, papéis, hierarquia nem aprovação em dois níveis.

Relação **um usuário ↔ um ambiente**. Estender para N ambientes por usuário
depois é aditivo; desmontar um modelo de várias empresas por ambiente seria caro.

**O que isso apaga do escopo:** trava otimista e pré-condição por versão nas
escritas, tela de resolução de conflito, papéis dentro de um ambiente, e a
pergunta "quem commita e como quem". Sem dado compartilhado, ninguém sobrescreve
ninguém.

**O que isso não apaga:** o isolamento entre ambientes fica *mais* crítico, por
ser a única fronteira existente — um erro de escopo mistura dados de clientes
sem nenhuma relação entre si.

### 2.1 Autenticação

**Sessão no app, com tela de login própria e logout.** Não Basic Auth do nginx:
apesar de custar quase zero código com cadastro fechado, ele não tem logout, não
deixa o usuário trocar a própria senha, tem UX ruim no celular e vira beco quando
o cadastro abrir.

**Cadastro fechado.** Não há auto-registro: as contas são criadas pelo operador
do produto. Isso elimina verificação de e-mail, proteção contra abuso, aceite de
termos e funil de conversão — a parte mais trabalhosa e arriscada de
autenticação simplesmente não existe.

Senha derivada por KDF moderno (argon2 ou bcrypt). Com a superfície reduzida
pelo cadastro fechado o risco é pequeno, mas autenticação artesanal é fonte
clássica de bug: usar biblioteca estabelecida.

### 2.2 Provisionamento

Criar uma conta não é inserir uma linha de usuário — é fazer nascer um ambiente:

- o usuário
- o ambiente vinculado a ele
- a configuração inicial, herdando os defaults do produto (pesos, caps, janelas)
- o **vault vazio**
- o prefixo de mídia do ambiente

Como é operação rara e feita pelo operador, **script de linha de comando**
resolve — mesmo padrão do `web/scripts/radar-mv.mts`. Painel administrativo
seria construir interface para algo que acontece uma vez por cliente.

**O provisionamento tem duas metades, e a segunda não é do operador:** ele cria
a conta vazia; o usuário preenche o vault pelo fluxo de primeiros passos
(entrevista — ver [`design-vault-onboarding.md`](./design-vault-onboarding.md) §2).

Consequência direta para a interface: **o primeiro login cai num ambiente sem
vault.** O app precisa reconhecer esse estado e levar ao fluxo de primeiros
passos, em vez de exibir um dashboard zerado.

## 3. O que quebra com mais de um operador

O git **não** é o problema. Commits não se sobrescrevem: em clones separados, o
segundo push é recusado e obrigado a integrar; briefs diferentes unem sem
atrito e o mesmo brief gera conflito explícito. Em ambiente de desenvolvimento
com um clone por pessoa, o modelo atual sobrevive.

O que quebra é a **saída do desenvolvimento**:

| Frente | O que acontece |
|---|---|
| Isolamento | Em produção não há clones: o conteúdo de todos os usuários vive no mesmo working tree, servido pelo mesmo processo. Com ambientes individuais não há perda por escrita concorrente, mas a fronteira entre eles passa a depender inteiramente de disciplina de código. |
| Autoria | Um `git commit` varre o conteúdo de todos os ambientes num commit só, atribuído a quem rodou o comando. |
| Multi-empresa | Conteúdo de cliente no repositório do produto: publicar o app distribui dados de cliente, e cada ação vira commit no repo do produto. |
| Segurança | Isolamento entre clientes passa a depender de *todo* trecho de código montar o path certo. Em banco é cláusula de consulta, verificável num lugar só. |
| Ciclo de vida | Backup por cliente, remoção completa, cota e retenção viram trabalho manual — reimplementando pior o que o banco entrega pronto. |
| Leitura | Montar o dashboard hoje é parsear 33 arquivos YAML por request. Com histórico por cliente, cada tela vira varredura de disco. |

`store/media/`, `store/packages/` e `store/previews/` são gitignored: exclusão de
mídia **já hoje** não deixa rastro no git — o único registro é o `media_purged`
no ledger. Ou seja, o ledger nunca foi redundante com o git.

## 4. Decisão central

**Banco de dados como fonte da verdade do estado operacional.** Arquivos deixam
de ser a persistência e passam a ser, quando necessário, materialização.

O que **não** vai para o banco:

- **Mídia** (binário) → armazenamento de objetos ou direto para o Cloudinary.
- **Package do `radar-handoff`** → artefato gerado a partir do banco, não
  guardado nele: **um `.md` para download** (ver §4.1).
- **Vault da empresa** → base de conhecimento, fora deste escopo (§9).

### 4.1 O handoff vira um arquivo, não uma pasta

Hoje o package são cinco arquivos em `store/packages/<slug>/`: `README.md`
(~7,8 KB), `brief.md` (~3,4 KB), `hero.jpg` (~1,4 MB), `hero.cloud-url.txt`
(159 bytes) e `od-skill-ref.txt` (12 bytes). São 19 packages gerados até aqui.

**Quatro dos cinco são texto e cabem num `.md` só.** Viraram arquivos separados
porque o entregável era uma pasta; uma linha com a skill do Open Design não
justifica um arquivo.

O que não cabe é a foto — e ela não precisa caber: **depois do upload, a hero é
uma URL do Cloudinary**, então o documento só a referencia. A cópia local no
package é redundância do desenho atual.

| Situação | Entrega |
|---|---|
| Hero no Cloudinary | **um `.md`** com a URL |
| `hero_choice: null` | **um `.md`** — não há foto, e a skill já trata isso como caminho válido (spec 007 §4) |
| Modo placeholder (Cloudinary não configurado) | `.md` + foto compactados — a cópia local é a única que existe, por isso o `radar-housekeeping` nunca a apaga |

Com a conta Cloudinary única e configurada
([manifest §4](./design-manifest-multiempresa.md)), o modo placeholder tende a
desaparecer no produto — e o `.md` único cobre todos os casos.

**Ganhos:** `store/packages/` deixa de existir (é gitignored e acumula ~1,4 MB
por brief), e o handoff deixa de ser skill para virar código, como já previsto
em §6.

**Decisão pendente:** hoje `handoff_at` marca que o brief foi entregue e torna a
skill idempotente. Com download sob demanda, baixar duas vezes é natural — falta
decidir se o carimbo passa a registrar o primeiro download, ou se deixa de
existir e o estado do brief basta.

## 5. Princípio: a skill não toca em estado

> A skill deixa de ler e escrever estado. Ela **recebe contexto e devolve
> resultado**. A persistência é responsabilidade do app.

Nas leituras, o app consulta o banco e **injeta a projeção** na execução da
skill. Nas escritas, a skill devolve JSON estruturado e o app grava.

Isso já foi provado em pequena escala: a fatia 2 tirou o `radar-mv` da skill e
o transformou em `web/lib/transitions/mv.ts`, com 11 testes cobrindo as regras
duras. A skill virou um invólucro fino que chama o mesmo módulo — uma
implementação, dois pontos de entrada (app e terminal). Migrar de arquivo para
banco ali é trocar a implementação de uma função já isolada e testada.

## 6. O fluxo, passo a passo

| Etapa | Hoje | No desenho |
|---|---|---|
| `radar-scan` | Skill (LLM) que varre `store/briefs/**` antes de pontuar | Continua agentic — é o único passo com julgamento real. Recebe a projeção de anti-repetição (§7) e o snapshot do vault. Devolve JSON; o app grava. |
| Revisão / edição | App escreve no `.md` | App escreve no banco |
| `radar-mv` (aprovar/rejeitar) | **Já é código** | `UPDATE` de estado + `INSERT` do evento, numa transação |
| `radar-handoff` | Skill (LLM) | Código. Lê do banco, sobe hero ao Cloudinary, **gera** o package |
| `radar-mark-published` | Skill (LLM) | Código. Grava `ig_post_url` e `published_at`, muda estado, registra evento |
| `radar-housekeeping` | Skill (LLM) | Código. O banco decide *o quê*; a ação recai sobre blobs |

Só o `radar-scan` permanece agentic. Os outros quatro são determinísticos: dadas
as entradas, a saída é fixa. Converter cada um é o momento natural de trocar a
camada de persistência — a função está sendo reescrita de qualquer forma.

## 7. Projeção de anti-repetição (o ponto que liga skill e dados)

É aqui que o padrão de injeção se concretiza. Hoje o matcher varre quatro
diretórios e parseia YAML; no desenho, recebe o resultado de uma consulta.

**Anti-repetição é o primeiro check, antes de calcular score** — se é redundante,
não pontua, para economizar tokens (spec 003 §8.1). Uma consulta indexada por
`topic_hash` torna esse gate quase gratuito.

### 7.1 As janelas são quatro, não uma

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

### 7.2 Os critérios são três

1. Colisão de `topic_hash`
2. Sobreposição de `source_urls`
3. Colisão de `pillar + icp` **sem** hash, só em `publicado` e nos últimos
   14 dias — a regra anti-saturação

A projeção precisa carregar, por brief: `topic_hash`, `source_urls`, `pillar`,
`icp`, estado e data.

### 7.3 A consulta acontece duas vezes

Checagem dupla (spec 003 §8 + spec 001 §5): o **matcher** compara usando o
`title` do finding, porque a headline ainda não existe naquele estágio; o
**briefer** refaz com a `headline` final. Dois momentos, chaves diferentes.

## 8. O que o banco resolve de tabela

**Atomicidade.** Aprovar um brief hoje são três operações em sequência sem
transação: mover o `.md`, remanejar a mídia, escrever no ledger. Se falhar no
meio, o estado fica inconsistente — o módulo atual escolhe deliberadamente uma
ordem que falhe de forma recuperável, e ainda assim resta reconciliação manual.
Em banco, é uma transação.

**Concorrência — não se aplica no modelo atual.** Com ambientes individuais
(§2), duas pessoas nunca escrevem no mesmo registro. Se um dia houver mais de um
operador por ambiente, a política é rejeitar a escrita quando o registro mudou
desde a leitura — mas isso está fora do escopo hoje.

**Trava de segurança do housekeeping.** A regra "nunca apagar mídia cujo
`cloud_url` ou `cloudinary_public_id` ainda seja nulo ou `<PENDING_CLOUDINARY>`,
porque a cópia local é a única que existe" hoje exige parsear YAML. Em banco
vira condição na consulta.

## 9. Fora do escopo deste documento

Pontos levantados e conscientemente adiados:

Tratados em documentos próprios (não são mais pendências):
[vault](./design-vault-onboarding.md), [manifest e
credenciais](./design-manifest-multiempresa.md), autenticação e provisionamento
(§2.1 e §2.2 deste documento).

Continuam em aberto:

- **Execução concorrente** — um `radar-scan` real levou 19 minutos. Vários
  ambientes em paralelo pedem fila, limite de paralelismo, política para run
  morto no meio, limpeza de workspace órfão e medição de custo.
- **Migração** — este documento descreve o destino, não o caminho. Existem 33
  briefs, 208 eventos de ledger e um sistema em uso diário.
- **Política de commit** — com o conteúdo fora do repositório do produto, o
  ledger passa a ser a única trilha de auditoria de cada ambiente.
- **Execução concorrente** — um `radar-scan` real levou 19 minutos
  (ledger, 2026-05-28). Vários clientes em paralelo pedem fila e isolamento.
