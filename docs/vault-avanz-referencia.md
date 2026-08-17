# Vault da Avanz — instância de referência

> **O que este documento é:** o vault da Avanz expresso na forma de blocos
> decidida em [`design-vault-onboarding.md`](./design-vault-onboarding.md) §5 —
> qual é o conjunto de blocos, o que cada um contém, quais são obrigatórios para
> o radar funcionar, e onde o conteúdo de hoje mora.
>
> Serve a três propósitos: é o **contrato** (o que o produto exige de qualquer
> empresa), o **alvo da migração** do vault atual, e o **gabarito da entrevista**
> de primeiros passos — cada bloco corresponde a uma pergunta.
>
> **Status: desenho.** O vault real continua em
> `/srv/my-mind/Empresas/avanz-imoveis`, em árvore de arquivos.

## 1. Ponto de partida medido

O vault da Avanz tem ~90 arquivos. O radar lê **6 deles em toda execução**
(`manifest.target_company.always_load`) e mais alguns sob demanda por pilar:

| Arquivo | Bytes | Vira |
|---|---|---|
| `identity/brand.md` | 1.736 | identidade, voz, identidade visual |
| `strategy/positioning.md` | 3.289 | posicionamento, área de atuação, produtos, públicos |
| `strategy/content-pillars.md` | 10.062 | pilares (6 blocos com id), o que não entra |
| `strategy/cadencia-editorial.md` | 16.728 | cadência — ver §5.1, quase tudo é deliberação |
| `prompts/icp-modifiers.json` | 5.104 | públicos (3 blocos com id) |
| `ops/guardrails.md` | 1.544 | guardrails (blocos com id) |
| **Total** | **38.463** | |

Sob demanda: `strategy/content-bank/pilar-*.md` (banco de temas) e
`prompts/post-*.json` (templates de prompt — não são vault, ver §6).

## 2. Índice dos blocos

`obrigatório` = sem ele o pipeline não roda. `degrada` = roda, com perda de
qualidade. `opcional` = não afeta o radar.

| # | Bloco | Id? | Contrato | Origem hoje |
|---|---|---|---|---|
| 1 | Identidade e origem | — | degrada | `brand.md` |
| 2 | Posicionamento e promessa | — | degrada | `positioning.md` |
| 3 | Voz da marca | — | **obrigatório** | `brand.md` |
| 4 | **Foco editorial** | — | **obrigatório** | **não existe** — ver §4.1 |
| 5 | Área de atuação | — | **obrigatório** | `positioning.md` |
| 6 | Públicos (ICPs) | **sim** | **obrigatório** | `icp-modifiers.json` |
| 7 | Pilares editoriais | **sim** | **obrigatório** | `content-pillars.md` |
| 8 | O que não entra | — | **obrigatório** | `content-pillars.md` |
| 9 | Guardrails | **sim** | **obrigatório** | `guardrails.md` |
| 10 | Cadência | — | degrada | `cadencia-editorial.md` |
| 11 | Banco de temas | **sim** | degrada | `content-bank/pilar-*.md` |
| 12 | Identidade visual | — | opcional (importa no Smart Design) | `brand.md`, `logo/` |
| 13 | Contato e CTA | — | **obrigatório** | `manifest.brand_facts` — ver §4.2 |

**Mínimo para o primeiro scan:** blocos 3, 4, 5, 6, 7, 8, 9, 13.

## 3. Os blocos, um a um

Cada bloco traz a **pergunta que o gera** na entrevista — é o critério de
coerência da divisão (design-vault-onboarding §5.2).

### 3.1 Identidade e origem — prosa, degrada

> *Conta a história da empresa como você contaria pra um cliente novo.*

Curadoria imobiliária orientada à decisão. Não vende imóveis: organiza o
caminho para a decisão certa. Tagline "Entender para atender". Evolução de
"Ivan Dias Imóveis" (5 anos) para marca corporativa. Avanz = avanço, direção.

Arquétipos: o Guia + o Estrategista. Princípios: clareza antes de volume,
orientação antes de venda, confiança antes de conversão.

### 3.2 Posicionamento e promessa — prosa, degrada

> *Por que um cliente deveria escolher vocês, e não a imobiliária da esquina?*

Facilitadora de aquisição patrimonial, não vendedora de lote. Quatro pilares de
posicionamento: acessibilidade (financiamento próprio), transparência,
velocidade, confiança. Diferencial competitivo mais concreto: **financiamento
próprio, sem burocracia bancária**.

### 3.3 Voz da marca — prosa, **obrigatório**

> *Como a empresa fala? E como ela não fala?*

Especialista acessível: direto, transparente, orientador, humano, didático sem
ser técnico demais.

Evitar: juridiquês, linguagem burocrática, promessas exageradas, formalidade
excessiva.

**Por que é obrigatório:** o briefer escreve headline, hook, legenda e CTA. Sem
este bloco ele escreve em voz genérica — e a copy é o entregável.

### 3.4 Foco editorial — prosa, **obrigatório**, e **não existe hoje**

> *O que entra e o que não entra? Dê o caso de fronteira.*

O foco que o radar aplica é:

> Lotes, sítios e chácaras na RMBH. Casa pronta **só** MCMV, e só com simulação
> Caixa prévia.

**Este bloco não existe no vault.** Ver §4.1 — é a lacuna mais séria deste
levantamento.

### 3.5 Área de atuação — prosa, **obrigatório**

> *Onde vocês atuam, e onde vocês não atuam?*

RMBH, com foco principal em Mateus Leme, Esmeraldas, Ribeirão das Neves,
Juatuba, Jaboticatubas e Caetanópolis.

**Por que é obrigatório:** `geografia_fit` é componente do score, e o manifest
tem um piso de geografia para pauta nacional relevante (SBPE/CBIC, MCMV/Caixa).

### 3.6 Públicos (ICPs) — blocos com id, **obrigatório**

> *Quem são as pessoas que compram de vocês? Descreva uma de cada tipo.*

Três blocos, cada um com id estável, corpo em prosa e overlays:

| Id | Corpo |
|---|---|
| `comprador` | Primeira aquisição, perfil família. Dores: medo de errar, excesso de opções, falta de orientação. Registro humano-próximo, didático, paciente. Evitar jargão financeiro, ROI, % de valorização. |
| `investidor` | Busca valorização. Dores: falta de análise técnica, risco, tempo de retorno opaco. Registro analítico, dado-suportado. Evitar linguagem aspiracional. |
| `proprietario` | Quer vender com estratégia, nem sempre com pressa. Dores: baixa visibilidade, posicionamento errado, medo de imobiliária genérica. Registro consultivo, sereno. Evitar promessa de venda rápida. |

Cada bloco carrega ainda palavras-chave de copy, direção visual (o que buscar e
o que evitar) e um padrão de CTA.

Default quando o ICP é ambíguo: `comprador`, com teto de score em 0,45.

**Atenção:** o `positioning.md` declara *quatro* públicos com outros nomes —
primeiro-comprador, sem-banco, investidor, sair-do-aluguel. Ver §4.3.

### 3.7 Pilares editoriais — blocos com id, **obrigatório**

> *Que tipos de conteúdo vocês publicam? Para cada um: qual é a tese, e o que
> seria um post ruim desse tipo?*

Seis blocos. Cada um tem id estável, tese, formato, estrutura, exemplos, e — o
campo que mais importa — **o que não fazer**.

| Id proposto | Código atual | Tese | No radar? |
|---|---|---|---|
| `imovel-da-semana` | `1-imovel` | Mostrar o disponível com curadoria. Não é feirão de lote. | sim |
| `decisao-inteligente` | `2-decisao` | Ensinar o cliente a comprar bem. | sim |
| `inteligencia-imobiliaria` | `3-inteligencia` | Autoridade técnica: IA e automação aplicadas ao imobiliário. | sim |
| `bastidor` | `4-bastidor` | Quem está atrás da operação. | **não** — vive em stories, decisão humana ad-hoc |
| `quem-comprou` | `5-quem-comprou` | Prova social. +400 clientes. | sim |
| `mercado-rmbh` | `6-mercado-rmbh` | Autoridade local. Notícia da região com análise. | sim |

O campo "não fazer" é operacionalmente o mais valioso, e é bem específico:
*"última oportunidade!!!"* e emoji de fogo no pilar 1; clickbait tipo *"10 dicas
que nenhuma imobiliária te conta"* no pilar 2; bastidor genérico de cafezinho no
pilar 4; repostar notícia sem análise no pilar 6.

**Sobre os ids:** ver §5.2 — o número na frente do código atual é a parte
posicional e deve sair.

**Sobre a maturidade:** `content-pillars.md` está marcado `status: draft-v0` e
abre com *"Validar com o Ivan antes de virar plano editorial"*. A validação
nunca foi registrada — mas os pilares são usados em produção há meses. Na
migração, isso vira uma versão com motivo explícito, e a pendência morre.

### 3.8 O que não entra — prosa, **obrigatório**

> *Que tipo de post você não quer ver publicado, mesmo que dê engajamento?*

Feng shui e conteúdo de revista; "bom dia, segunda-feira" e calendário sem
propósito; frase motivacional sobre o sonho da casa própria sem ligação
concreta com produto; repost de meme; selfie sem narrativa; urgência fabricada
tipo "compre antes que acabe".

Há também o teste positivo: cada peça precisa servir a um de quatro objetivos —
atrair lead qualificado, educar, construir autoridade, mover para o WhatsApp.
**Conteúdo que não serve nenhum é descartado, mesmo que pareça bonito.**

### 3.9 Guardrails — blocos com id, **obrigatório**

> *O que uma IA falando em nome da empresa nunca pode fazer?*

Restrições, cada uma um bloco operável:

- não prometer aprovação garantida
- não inventar informações sobre imóveis
- não fornecer valores sem contexto
- não fugir do escopo imobiliário

Mais as diretrizes de condução (entender o perfil antes de sugerir; evitar
resposta longa e teórica; direcionar para próximo passo claro) e a regra de
ouro: **toda interação caminha para um próximo passo claro; se não há avanço,
há falha na condução.**

### 3.10 Cadência — prosa, degrada

> *Quantos posts por semana, e o que vai em cada dia?*

A decisão vigente: **4 posts/semana** como base sustentável, com plano de
escalar para 7. Distribuição por dia da semana e por pilar.

O manifest do radar já carrega a distribuição em `pillars_by_day_base` e a
estratégia de excedente. Ver §5.1 — o arquivo de origem é 16 KB dos quais a
maior parte é deliberação, não decisão.

### 3.11 Banco de temas — blocos com id, degrada

> *Sobre que assuntos vocês já sabem que querem falar?*

Um conjunto por pilar. O do `decisao-inteligente` tem **30 temas em seis
categorias**: A documentação e segurança jurídica, B financiamento e dinheiro,
C avaliação técnica, D perfil e timing, E valorização, F processo e expectativa.

Cada tema é um gancho pronto, com título e ângulo — *"Construir vs comprar
pronto em 2026 — comparativo real com m² da região"*.

**Os briefs citam por código.** Um brief da fila justifica o score com *"banco
Pilar 2 §B10 (construir vs comprar) e §D19 (quando NÃO é hora)"*. Ver §5.2: a
numeração atual é global e contínua de 1 a 30, então **remover um tema
renumeraria todos os seguintes** e invalidaria as citações antigas em silêncio.

O arquivo prevê marcar `[USADO YYYY-MM-DD]` ao lado do tema — hoje manual. Como
bloco, isso vira estado (ativo/esgotado) com data.

### 3.12 Identidade visual — prosa + binários, opcional para o radar

> *Como a marca se parece?*

Azul marinho `#0F172A`, laranja `#F97316`, neutros. Inter e Montserrat.

O radar não usa: quem consome é o Smart Design. Binários (logo, artes) ficam
fora do banco, no armazenamento de objetos.

### 3.13 Contato e CTA — prosa, **obrigatório**

> *Qual telefone aparece na arte, e para onde o post manda a pessoa?*

WhatsApp como canal principal. Número de exibição `(31) 9 9077-4580`, canônico
`+5531990774580`, secundário `+5531971375793`.

**Hoje isso não está no vault** — está copiado no `manifest.yaml` do radar, em
`brand_facts`, com o comentário de que é para evitar reparsear `brand.json`. Ver
§4.2.

## 4. Lacunas encontradas

### 4.1 O foco editorial não tem casa

**É a lacuna mais séria.** A regra que o radar mais aplica — *lotes, sítios e
chácaras; casa pronta só MCMV com simulação Caixa prévia* — **não existe como
conteúdo em lugar nenhum do vault**. Ela vive em dois lugares, nenhum deles
apropriado:

- no `CLAUDE.md` deste repositório, como instrução de sessão;
- no `manifest.yaml`, como **comentário** ao lado do peso:
  `foco_editorial_fit: 0.25 # lotes/sítios/chácaras vs casa pronta`.

Ou seja: o peso do critério é configuração, mas **o critério em si é comentário
de YAML**. Um segundo cliente não teria onde declarar o equivalente.

Pior, o vault *contradiz* a regra. O `positioning.md` lista sob produtos:
*"Casas (MCMV, médio padrão, alto padrão)"*. Médio e alto padrão estão fora do
escopo do radar — mas o briefer lê esse arquivo em toda execução.

**Consequência para o produto:** foco editorial é bloco obrigatório de primeira
classe, e a entrevista precisa de uma pergunta dedicada a ele — provavelmente a
pergunta de maior alavancagem do onboarding inteiro.

### 4.2 O contato mora no manifest, não no vault

`brand_facts` no `manifest.yaml` é cópia de campos do `brand.json` do vault,
feita para evitar parsing repetido. É desnormalização deliberada e documentada —
mas no produto multi-empresa **o telefone é dado do cliente, e o lugar dele é o
vault**. O manifest fica com configuração operacional.

### 4.3 Dois conjuntos de públicos, incompatíveis

| Fonte | Públicos |
|---|---|
| `icp-modifiers.json` (o que o radar usa) | comprador, investidor, proprietario |
| `positioning.md` (lido na mesma execução) | primeiro-comprador, sem-banco, investidor, sair-do-aluguel |

Os dois entram no contexto do briefer ao mesmo tempo. O segundo conjunto é mais
específico e provavelmente mais útil comercialmente — "sem-banco" é exatamente
quem o financiamento próprio atende — mas o score pontua pelo primeiro.

**Precisa ser resolvido antes da migração**, não durante: são recortes
diferentes do mesmo público, não sinônimos, e escolher um é decisão editorial do
cliente. Com blocos identificados, essa duplicação deixa de ser possível.

## 5. Duas correções que a migração precisa fazer

### 5.1 A cadência injeta deliberação, não decisão

`cadencia-editorial.md` é **16,7 KB — 43% de tudo que entra em toda execução** —
e a estrutura dele é um memorando de decisão: "as 2 opções na mesa", "análise de
cada opção", "recomendação", "quando ajustar".

O radar não precisa do raciocínio; precisa da conclusão, que já está replicada
no `manifest.yaml` (`pillars_by_day_base`, `extra_slots_strategy`).

O bloco de cadência deve conter **a decisão vigente e o motivo dela em poucas
linhas**. A análise das alternativas é histórico — e agora tem onde morar: o
motivo da versão. Sozinho, isso corta perto de um terço do contexto injetado em
toda execução.

### 5.2 Identificadores: o que muda e o custo

**Pilares.** O código atual (`2-decisao`) embute posição. O slug proposto
(`decisao-inteligente`) não. Custo real: 33 briefs no store e as referências em
`manifest.search_scopes.*.pillars_alvo` usam o código antigo — é migração
única e mecânica, feita junto com a importação, não edição pela interface.

**Temas do banco.** A numeração é global e contínua de 1 a 30, com a letra
indicando a categoria (`B10` = categoria B, tema 10). Remover um tema renumera
todos os seguintes.

A regra a estabelecer no código: **o código do tema e o slug do pilar são
atribuídos na criação e são imutáveis.** Nenhuma rotina pode recalculá-los a
partir da ordem atual. Reordenar, recategorizar e renomear mexem em outros
campos.

**Formato:** string legível, não id opaco. Uma das pontas da referência é um
modelo de linguagem — ele lê o documento montado e devolve `pillar: decisao-inteligente`
no brief, e a justificativa do score cita o tema em prosa para uma pessoa
auditar. UUID quebraria as duas coisas. A chave numérica interna do banco é
detalhe de implementação e não aparece em brief, configuração nem prompt.

## 6. O que fica de fora do contrato

**Do vault atual, o radar não consome** — e portanto não vira bloco: CRM e
schema de dados, plano e código de ETL, auditorias de site e CSS, PRD de
produto, opções de servidor de e-mail, KPIs comerciais, playbooks de WhatsApp e
de objeções, SEO, OKRs, time. São ~80 dos ~90 arquivos.

Isso não é descarte: é fronteira. Aquele material continua sendo o espaço de
trabalho da consultoria; o vault do produto é o recorte que o radar lê.

**Os `prompts/post-*.json` também não são vault.** São templates de geração,
parte do produto, iguais para todo cliente — o que varia entre clientes é o que
os alimenta, e isso já está nos blocos.

**As métricas por pilar** (KPI primário e secundário, em `content-pillars.md`)
não entram: o radar não mede desempenho de post. Se um dia houver
realimentação, elas voltam à discussão.

## 7. Em aberto

- **Ordem de montagem** — em que sequência os blocos viram o documento único
  injetado na execução, e se ela varia por estágio (o matcher não precisa da
  identidade visual).
- **Recorte por estágio** — hoje `always_load` é o mesmo para matcher e briefer.
  Com blocos, dá para injetar menos no matcher; falta medir se compensa.
- **Resolução dos dois conjuntos de ICP** (§4.3) — decisão editorial do cliente,
  não técnica.
- **Estado do banco de temas** — o `[USADO YYYY-MM-DD]` manual vira estado com
  data, mas falta decidir se o radar marca sozinho ao aprovar um brief que citou
  o tema.
