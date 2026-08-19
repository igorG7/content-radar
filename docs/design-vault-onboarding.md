# Desenho — vault da empresa: onboarding, edição e histórico

> **Status: desenho, nada implementado.** Registra a conversa de arquitetura de
> 2026-08-12 sobre o vault no cenário multi-empresa. Complementa
> [`design-persistencia-multiusuario.md`](./design-persistencia-multiusuario.md),
> que trata do fluxo operacional e deixou o vault explicitamente de fora.

## 1. O que o vault é hoje

`/srv/my-mind/Empresas/avanz-imoveis` — **88 arquivos, 9,5 MB**, fora do
`store/` e fora do repositório do content-radar. Tem inclusive um
`manifest.yaml` próprio, que não é o nosso.

Não é um arquivo de personalidade de marca: é o **espaço de trabalho inteiro da
empresa**, e o radar é apenas um dos consumidores. Fora do `archive/` (artes
prontas e PNGs pesados) sobram ~512 KB de texto, distribuídos assim:

| Pasta | Arquivos | Natureza |
|---|---|---|
| `archive/` | 26 | Artes e posts já produzidos |
| `ops/` | 15 | Operação: CRM, ETL, endpoints, KPIs, time, guardrails |
| `strategy/` | 12 | Posicionamento, pilares, cadência, OKRs, SEO, content-bank |
| `intel/` | 10 | Auditorias, baselines, PRD, questionários |
| `identity/` | 7 | Marca, logo, paleta |
| `channels/` | 7 | Instagram, site, WhatsApp |
| `prompts/` | 4 | Templates por pilar |
| `playbooks/` | 4 | Objeções, conversas, WhatsApp |

### 1.1 O recorte que o radar consome

Declarado em `manifest.target_company` do content-radar:

- **`always_load`** (~38 KB injetados em **toda** execução): `identity/brand.md`,
  `strategy/positioning.md`, `strategy/content-pillars.md`,
  `strategy/cadencia-editorial.md`, `prompts/icp-modifiers.json`,
  `ops/guardrails.md`
- **`per_pillar`**, sob demanda: `strategy/content-bank/pilar-*.md` e os
  `prompts/post-*.json`

### 1.2 O que o radar ignora

CRM (`ops/systems/crm-v1.md`, `crm-v2.md`, schema Mongo), plano de ETL e código
(`ops/deploy/etl-v1-to-v2.ts`), auditorias de site e CSS, PRD de produto, opções
de servidor de e-mail, KPIs comerciais, playbooks de WhatsApp e objeções, SEO,
OKRs, time.

**Consequência para o produto:** a pergunta não é "como migrar o vault", é **qual
recorte dele o produto precisa**. Um cliente novo não vai trazer CRM e auditoria
de CSS modelados. O produto precisa de um contrato explícito: *estes arquivos,
com esta estrutura, é o que o radar lê.*

## 2. Onboarding: o sistema ajuda a construir o vault

Um cliente novo não chega com `content-pillars.md` e `guardrails.md` prontos —
chega com um Instagram e uma ideia vaga da marca. Então o vault é
**pré-requisito que o produto ajuda a produzir**, não que o cliente entrega.

### 2.1 O precedente

Isso não é invenção: o vault da Avanz **foi construído por entrevista**. Existem
`intel/v2-prd-questionario.md` (7,3 KB de perguntas) e
`v2-prd-questionario-respondido.md` (21,8 KB de respostas). As perguntas estão em
linguagem de dono de negócio, não de sistema:

- "Conta a história da Avanz como você contaria pra um cliente novo"
- "Por que um cliente deveria escolher a Avanz?"
- "Tem alguma palavra ou frase que **não** quer que apareça?"

De respostas assim saíram `brand.md`, `positioning.md` e os demais. O onboarding
automatiza um processo que já existe e já provou funcionar.

### 2.2 Onde isso roda

**É o fluxo de primeiros passos do produto.** A conta nasce provisionada mas com
o vault vazio (ver [persistência](./design-persistencia-multiusuario.md) §2.2),
então o primeiro login leva direto aqui — não a um dashboard zerado, que
comunicaria falha em vez de começo.

A tela de chat (Agent SDK) é o lugar natural. Um formulário de 40 campos
afugenta; uma entrevista conduzida — uma pergunta por vez, aprofundando quando a
resposta é rasa — é exatamente o que o harness faz bem. A tela já existe; falta
a skill de onboarding.

### 2.3 Três níveis de dificuldade

Nem todo arquivo exige entrevista:

| Nível | O quê | Como obter |
|---|---|---|
| Só o cliente sabe | História, valores, foco editorial, o que **não** dizer, telefone, canal principal | Entrevista |
| Derivável do que já é público | Tom de voz, temas recorrentes, ICP aparente | Ler Instagram e site — é o que o `market-researcher` já faz com WebSearch/WebFetch |
| Template do produto | Estrutura dos pilares, cadência, guardrails base | Modelo + ajuste fino |

O segundo nível chega **pré-preenchido para o cliente corrigir**. Encurta a
conversa e melhora a resposta: revisar é mais fácil que criar do zero.

### 2.4 O risco a vigiar

O que faz os briefs da Avanz serem bons não é *ter* pilares — é ter
*"lotes, sítios e chácaras na RMBH; casa pronta só MCMV com simulação Caixa
prévia"*. Uma entrevista mal conduzida produz "queremos gerar valor para nossos
clientes", e aí todo o pipeline downstream fica **correto e inútil**.

**A qualidade do onboarding é o teto de qualidade do produto.** A skill de
entrevista merece o mesmo cuidado que o matcher recebeu.

## 3. Vault vivo: o que as telas cobrem e o que não cobrem

O vault inicial é ponto de partida; depois ele é incrementado. Mas há duas
coisas sendo tratadas como uma só, e só metade tem interface:

| | Onde vive | Tela hoje |
|---|---|---|
| Fontes de pesquisa, pesos, thresholds, volume | `manifest.yaml` | ✅ `/config` |
| Marca, posicionamento, pilares, cadência, guardrails | vault | ❌ nenhuma |
| Content-bank | vault | ❌ nenhuma |

### 3.1 São naturezas diferentes

Editar `manifest.yaml` é **configuração**: números e listas, com invariantes
verificáveis no momento do salvamento (pesos somam 1.0, borderline abaixo do
threshold).

Editar `content-pillars.md` ou `guardrails.md` é mais próximo de **engenharia de
prompt**: prosa longa que molda o comportamento do modelo, sem validação
automática possível, cujo efeito só aparece no próximo scan. Pede
pré-visualização e histórico mais do que validação de schema.

### 3.2 O content-bank é referência ativa, não documento morto

O banco do Pilar 2 tem **30 temas em seis categorias** (A: documentação,
B: financiamento, C: avaliação técnica, D: perfil e timing, E: valorização,
F: processo). E o pipeline **cita os temas por código**: um brief da fila
justifica seu score com *"banco Pilar 2 §B10 (construir vs comprar) e §D19
(quando NÃO é hora)"*.

Ou seja: quando um tema novo aparece com frequência, o lugar dele é o banco;
quando um tema se esgota, alguém precisa marcar. Hoje esse trabalho é manual,
no editor de texto.

## 4. Histórico de versões

Se a edição do vault for oferecida pelo produto, versionar não é conforto — é
requisito. Três razões, em ordem de força:

**1. É a única rede de segurança possível.** O manifest tem invariantes que
travam o salvamento; prosa não tem nenhuma. Se alguém reescrever `guardrails.md`
e piorar o resultado, nada acusa no momento — só o histórico permite voltar.

**2. O efeito é diferido e difuso.** Uma linha alterada em `content-pillars.md`
não quebra nada hoje: muda o caráter de **todos** os briefs a partir do próximo
scan. Quando a queda de qualidade for notada, "o que mudou e quando" precisa ser
respondível.

**3. Correlacionar versão com resultado.** Todo brief carrega `scan_id` e data.
Com o vault versionado, dá para responder "esta pauta ruim saiu de qual versão
dos pilares?" — e medir se uma mudança melhorou ou piorou a saída. O projeto já
faz essa disciplina à mão para o matcher (`docs/calibracao-matcher.md` tem
baseline, premissas por alavanca, projeção e sinais que confirmam ou refutam).
Versionar o vault estende isso para a parte que hoje não é medida.

### 4.1 O histórico útil inclui o *porquê*

É o padrão que o projeto já usa: os comentários do `manifest.yaml` carregam
`§11.V`, `resolveu §11.I`, o registro das fontes descartadas por anti-bot e dos
leads a confirmar. Um campo de motivo junto de cada versão vale mais que dez
diffs sem contexto.

### 4.2 Alerta: identificadores do content-bank precisam ser estáveis

Os briefs citam temas por código (`§B10`, `§D19`). **Se uma edição renumerar as
categorias, as citações dos briefs antigos passam a apontar para o tema errado,
silenciosamente.** Se o banco virar editável por interface, os temas precisam de
identificador que não dependa de posição.

O mesmo vale para os pilares, que o `manifest.yaml` referencia por código em
`search_scopes.*.pillars_alvo`: renomear quebra a referência sem avisar. A forma
decidida em §5.1 resolve os dois casos por construção.

## 5. Onde o vault vive

**Decisão: banco, modelado como documento.** O vault sofre exatamente os mesmos
problemas do store de briefs — isolamento entre clientes, backup, exclusão
completa, ciclo de vida — e a solução é a mesma pelas mesmas razões.

São **512 KB de texto por cliente**: irrelevante para o banco. Isolamento vira
cláusula de consulta, exclusão de cliente vira remoção em cascata, escrita é
atômica, e o backup é o mesmo do resto do sistema.

O que fica em aberto é a **forma**, e ela mudou de decisão — ver §5.1.

### 5.1 Blocos, não um documento único

> **Revisão de 2026-08-13.** A versão anterior desta seção dizia "não decompor a
> prosa em campos", com o argumento de que a skill lê o vault inteiro na
> execução. **O argumento não se sustenta:** ler junto não obriga a guardar
> junto — o documento completo pode ser montado na hora. A decisão abaixo
> substitui aquela.

O vault é uma **sequência ordenada de blocos**. Cada bloco tem corpo em prosa;
alguns blocos têm, além disso, **identidade estável**. Não são duas naturezas
convivendo — é uma forma só, com uma propriedade a mais onde ela é necessária.

**O critério da identidade:** um bloco ganha id quando *algo fora do vault aponta
para ele*. Nada mais.

| Parte | Identidade | Quem aponta |
|---|---|---|
| Pilares | sim | `manifest.search_scopes.*.pillars_alvo`, campo `pillar` de todo brief, filtros da fila |
| ICPs | sim | componente `icp_fit` do score, campo `icp` do brief |
| Banco de temas | sim | os briefs citam por código (`§B10`, `§D19`) |
| Guardrails | sim | é lista de verdade; item a item é operável |
| História, valores, posicionamento, voz | não | ninguém endereça um parágrafo da história |

Um pilar, portanto, **não** é um registro com colunas `nome`/`descricao`: é um id
estável mais um parágrafo que explica o que ele é e o que não é. O risco de
decompor nunca foi a decomposição — era o esquema fino demais para caber a
ressalva que faz o vault funcionar (*"casa pronta só MCMV com simulação Caixa
prévia"*). Bloco com corpo em prosa preserva isso.

**O que essa forma resolve por construção:** os dois modos de quebra silenciosa
registrados neste documento — renumerar o content-bank invalidando as citações
antigas (§4.2) e renomear um pilar quebrando a referência no manifest — deixam
de exigir vigilância. Com id estável, viram integridade referencial.

### 5.2 O critério de coerência da divisão

Divisão precisa de teste, senão vira gosto. O teste: **cada bloco responde uma
pergunta, e a pergunta é a mesma que a entrevista faz.**

Não é arbitrário — o vault nasceu de entrevista (§2.1), o onboarding *é* uma
entrevista, e editar depois é reabrir uma pergunta. Alinhando a costura às
perguntas, as três coisas ficam coerentes de graça. Sintoma de divisão errada:
se não dá para escrever a pergunta que gera um bloco, ele é pedaço de outro.

**Não herdar a árvore de pastas atual.** `identity/`, `strategy/`, `ops/`,
`channels/` organizam um espaço de consultoria, não o que o radar consome — a
maior parte é ignorada (§1.2) e o que ele lê está espalhado por três pastas. A
árvore de hoje é o mapa de origem do importador, não o modelo.

### 5.3 A montagem passa a ser artefato do produto

Na execução o app monta os blocos na ordem declarada e injeta o texto como
contexto, em vez de passar caminhos de arquivo — mesmo padrão do fluxo
operacional.

Isso transfere para o produto uma responsabilidade que hoje é de quem escreveu o
vault à mão: ordem, cabeçalhos, ligação entre seções, o que entra por pilar. **É
código que pode degradar sem ninguém perceber.** Requisito derivado: a pessoa
precisa conseguir **ver o documento montado, exatamente como o agente vai lê-lo**
— o que já é ganho sobre hoje, onde ninguém vê o que foi injetado.

### 5.4 Binários ficam fora do banco

Logo, paleta e as artes do `archive/` vão para o mesmo armazenamento de objetos
da mídia dos briefs, com a mesma pasta por cliente.

## 6. Consequências para o onboarding

A divisão em blocos não é só decisão de armazenamento: ela **dá forma à
entrevista**, que antes tinha etapas arbitradas para caber na tela.

> uma pergunta → um bloco → uma etapa → uma versão

- **Progresso vira medida, não estimativa** — blocos preenchidos sobre blocos
  existentes, e não mente quando o conjunto mudar.
- **O contrato mínimo vira propriedade**, não lista mantida à parte: uma marca
  em cada bloco, e a interface pergunta ao próprio vault se já dá para rodar o
  primeiro scan.
- **Salvamento parcial deixa de ser caso especial** — não há estado meio-salvo:
  bloco confirmado é versão, bloco não confirmado ainda não existe. Retomar é
  continuar de onde a lista de vazios começa.
- **As telas que dependem do vault nomeiam o que falta**, porque o que falta tem
  nome.

### 6.1 Ordem: só dependência de insumo tranca

Quase toda parte "pega contexto" da anterior. Se isso travar, trava tudo — então
a distinção importa:

- **Dependência de contexto**: a conversa fica melhor citando a anterior, mas
  acontece sem ela. O agente só perde uma referência para puxar. **Não tranca.**
- **Dependência de insumo**: a parte consome a saída da anterior e não tem como
  ser gerada sem ela. **Tranca.**

A cadeia dura é curta: **foco editorial → públicos → pilares → fontes por escopo
e banco de temas.** Pilares são propostos a partir de foco e públicos; um escopo
declara quais pilares alimenta; um tema pertence a um pilar.

História, valores, voz e identidade visual não dependem de nada — e são
justamente as partes que podem **abrir a entrevista enquanto a leitura do
Instagram e do site roda em segundo plano** (§2.3), de modo que o
pré-preenchimento chega a tempo das partes que dependem dele.

A trava vale só para **gerar** o bloco pela primeira vez. Com tudo preenchido,
editar volta a ser livre: abrir os pilares não deve exigir repassar pelo foco
editorial.

### 6.2 O que mantém isso sendo entrevista, e não cadastro

O risco de blocos e etapas é virar formulário — cada bloco um campo, cada etapa
uma tela. Aí a qualidade do onboarding (§2.4) morre e sobra cadastro. Três
exigências contra isso:

- **Dentro da parte continua sendo conversa** de várias trocas, com o agente
  aprofundando quando a resposta vem rasa — não uma pergunta com caixa de texto.
- **Continuidade entre as partes**: o agente cita o que já foi dito (*"você
  falou que não quer parecer imobiliária de fachada; isso vale como
  guardrail?"*). É o que separa entrevista em partes de sequência de formulários.
- **O todo visível desde o começo** e o documento crescendo ao lado — saber
  quantas conversas são e ver o que está sendo produzido muda a disposição de
  começar e é o controle de qualidade da pessoa.

## 7. O conjunto de blocos (decidido)

**Treze blocos**, decididos em 2026-08-17. A base é o catálogo implementado em
`web/lib/vault/blocos.ts`, com uma mudança: **cadência sai de dentro de pilares
e vira bloco próprio**. Pelo critério de coerência de §5.2, *"em que assuntos a
marca fala"* e *"quantos posts por semana"* são duas perguntas, logo dois blocos.

| Bloco | Contrato | Id? |
|---|---|---|
| identidade | degrada | — |
| voz | obrigatório | — |
| guardrails | obrigatório | sim |
| foco | obrigatório | — |
| geografia | obrigatório | — |
| contato | obrigatório | — |
| publicos | obrigatório | sim |
| pilares | obrigatório | sim |
| cadencia | degrada | — |
| fontes | obrigatório | — (tipo config) |
| temas | opcional | sim |
| ajustes | default do produto | — (tipo config) |
| visual | degrada | — |

Duas fusões da versão anterior ficam mantidas, porque passam no mesmo critério:
posicionamento é parte de *"quem é a marca e por que alguém a escolheria"*, e
"o que não entra" é parte de *"o que entra na pauta e o que não entra"*.

`fontes` e `ajustes` são de tipo `config`: aparecem no mapa porque fazem parte
da sequência, mas apontam para a tela de configuração em vez de abrir conversa,
e não entram no documento montado.

## 8. Os públicos: um conflito que não era conflito (decidido)

O vault da Avanz declarava dois conjuntos de ICP, e ambos citavam
`identity/brand.json#/target_audience` como fonte:

- `prompts/icp-modifiers.json` — **comprador, investidor, proprietário**
- `strategy/positioning.md` — primeiro-comprador, sem-banco, investidor,
  sair-do-aluguel

**Só o primeiro deriva da fonte de fato.** O `brand.json` tem exatamente três
perfis, e é o que o `icp-modifiers.json` consome. O `positioning.md` lista
quatro que não existem lá e aponta para lá como se existissem.

Mas os quatro nomes **não são invenção do posicionamento**: circulam no
vocabulário operacional da empresa em cinco lugares independentes — playbook de
objeções, templates de WhatsApp, matriz de autonomia do CRM, KPIs comerciais
(*"20–45 dias para primeiro-comprador, 5–15 para investidor"*) e plano de SEO.

São **dois eixos distintos que ganharam o mesmo nome**:

| Eixo | Valores | O que muda |
|---|---|---|
| O que a pessoa quer fazer com o imóvel | comprador · investidor · proprietário | o registro da copy: didático, analítico, consultivo |
| Em que situação ela está | primeiro-comprador · sem-banco · sair-do-aluguel | objeção, tempo de fechamento, jornada no CRM |

E os três do segundo eixo são recortes de **comprador** — nenhum é investidor
ou proprietário.

**Decisão: os três códigos do score permanecem.** Os perfis situacionais entram
como recortes descritos na prosa do bloco `publicos`, que é exatamente o que a
forma de bloco existe para comportar. Elevar um deles a código misturaria dois
eixos numa dimensão só do score — e o componente `icp_fit` já tem teto quando o
público fica ambíguo.

Custo de migração: **zero**. Os 33 briefs já carregam esses valores.

**Correção pendente no vault da empresa:** o `positioning.md` aponta para uma
fonte que não confirma o que ele afirma. Vale ajustar a referência, ou trazer os
quatro perfis para o corpo do bloco `publicos` como segmentos.

## 9. Em aberto
- **Quem mantém depois do onboarding** — o cliente, o operador do produto, ou o
  próprio radar aprendendo do que foi aprovado e rejeitado.
- **Realimentação** — se o sistema deve propor entradas novas de content-bank a
  partir dos temas que vêm sendo aprovados.
- **Reimportação** — proposta: nunca sobrescreve em silêncio (entra como versão
  nova, com motivo), não toca no manifest, e referências a pilares que deixaram
  de existir são apontadas para a pessoa resolver, nunca descartadas.
