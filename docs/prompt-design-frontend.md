# Prompt — design de front-end do content-radar (produto multi-empresa)

> Documento para ser entregue a quem for desenhar/implementar a interface.
> Escrito para ser lido sem contexto prévio da conversa que o originou.
> Decisões de arquitetura por trás: [`design-persistencia-multiusuario.md`](./design-persistencia-multiusuario.md)
> e [`design-vault-onboarding.md`](./design-vault-onboarding.md).

---

## 1. O que é o produto

O **content-radar** gera pautas de Instagram para uma empresa. Ele pesquisa
conteúdo público, filtra o que casa com a estratégia editorial da empresa,
escreve o rascunho do post e entrega um pacote — a arte final é feita em outro
sistema (Smart Design). **O radar não publica.**

O fluxo operacional, do começo ao fim:

```
scan → revisão humana → aprovação → handoff → publicação (manual) → limpeza
```

Vocabulário que aparece na interface e precisa ser respeitado:

| Termo | Significado |
|---|---|
| **Brief** | A pauta gerada. Tem headline, hook, rascunho de legenda, hashtags, CTA e um briefing visual. É o entregável. |
| **Pilar** | Eixo editorial (ex.: "2-decisao", "6-mercado-rmbh"). Define o tipo de conteúdo. |
| **ICP** | Público-alvo do brief: comprador, investidor ou proprietário. |
| **Score** | 0 a 1, quanto o brief casa com a estratégia. Decomposto em componentes (pilar, ICP, foco editorial, geografia, atualidade), cada um com uma evidência textual. |
| **Borderline** | Brief com score marginal. Não é erro: é "decida você". |
| **Hero** | A foto do post. Pode ser uma das candidatas ou nenhuma — nesse caso o Smart Design gera a arte. |
| **Vault** | Base de conhecimento da empresa: marca, posicionamento, pilares editoriais, cadência, guardrails, banco de temas. É o que faz o conteúdo ser bom. |
| **Manifest** | Configuração operacional: fontes de pesquisa, pesos do score, thresholds, volume semanal. |

## 2. Direção visual

**Design novo, do zero.** Não há compromisso com nenhuma interface anterior.

Visual **clean e moderno**, com boas práticas de UI/UX: hierarquia tipográfica
clara, espaçamento generoso, contraste adequado, estados de foco visíveis,
comportamento responsivo, e feedback explícito para carregamento, erro e vazio.
Nada de ornamento que não ajude a decidir.

O produto é uma **ferramenta de trabalho, usada com frequência e por períodos
longos** — a pessoa vai revisar dezenas de pautas por semana. Densidade de
informação e leitura confortável importam mais que impacto na primeira tela.

Funcionalmente, o produto já cobre hoje: painel geral, fila de aprovação,
detalhe e edição de brief, acervo histórico, chat e configuração. Trate isso
como escopo funcional a redesenhar, não como referência visual.

**O desenho precisa servir ao fluxo descrito nas seções 3 a 5, não o
contrário.** As regras ali não são preferências de estilo: vêm de operar o
sistema de verdade, e várias delas existem porque a ausência causou erro. Uma
proposta visualmente excelente que ignore, por exemplo, a distinção entre
"valor padrão gravado" e "escolha do humano" (§4.6) faz a pessoa publicar
conteúdo que ela não aprovou. Quando estilo e comportamento entrarem em
conflito, o comportamento vence — e vale perguntar antes de decidir sozinho.

### 2.1 Paleta

Definida e **verificada em WCAG AA** (texto ≥ 4,5:1). Os valores de contraste
abaixo são sobre o fundo do respectivo tema.

**Tema claro**

| Papel | Hex | Contraste |
|---|---|---|
| Fundo | `#F6F8FC` | papel azulado, não branco puro |
| Superfície (cards) | `#FFFFFF` | — |
| Borda | `#D5DDEA` | — |
| Texto forte | `#0B132B` | 17,3:1 |
| Texto corpo | `#1F2B47` | 13,2:1 |
| Texto suave | `#52627E` | 5,8:1 |
| **Acento** | `#0E7C7B` | 4,7:1 |
| Sucesso | `#0F7040` | 5,8:1 |
| Perigo | `#B3261E` | 6,2:1 |
| Atenção | `#8A5300` | 6,0:1 |

**Tema escuro**

| Papel | Hex | Contraste |
|---|---|---|
| Fundo | `#0B132B` | — |
| Superfície (cards) | `#151E3A` | — |
| Borda | `#2B3A5C` | — |
| Texto forte | `#EAF0FB` | 16,1:1 |
| Texto corpo | `#C6D2E8` | 12,1:1 |
| Texto suave | `#90A2C0` | 7,1:1 |
| **Acento** | `#5BC0BE` | 8,5:1 |
| Sucesso | `#45C98A` | 8,7:1 |
| Perigo | `#FF8A80` | 8,1:1 |
| Atenção | `#F0B252` | 9,8:1 |

Botões: branco sobre o acento claro dá 5,0:1; o navy `#0B132B` sobre o acento
escuro dá 8,5:1. Ambos servem como fundo de botão sólido.

**Regras que sustentam a paleta:**

- **Nenhum neutro é cinza puro.** Todos carregam azul, o que faz o conjunto
  parecer intencional em vez de template com uma cor de destaque. O fundo claro
  é papel levemente azulado — em sessões longas cansa menos, e faz os cards
  brancos ganharem relevo sem depender de sombra.
- **O acento tem duas versões, e isso não é opcional.** O petróleo claro
  (`#5BC0BE`) dá 2,2:1 sobre branco e é ilegível no tema claro; por isso a
  versão escurecida (`#0E7C7B`). É a mesma cor conceitual, calibrada por tema.
- **As semânticas invertem entre temas**: escuras e dessaturadas no claro,
  claras e mais vivas no escuro. Um vermelho legível sobre branco some sobre
  navy.
- **Cor nunca carrega significado sozinha.** Aprovar e rejeitar precisam de
  ícone ou rótulo além da cor — deuteranopia confunde exatamente verde e
  vermelho.
- Se alguma cor for substituída, **recalcule o contraste**. O ganho da paleta
  está em ter sido medida, não em ser bonita.

## 3. O que muda

O produto deixa de ser ferramenta de uso pessoal e passa a atender **vários
usuários, cada um com seu próprio ambiente isolado**.

Não é trabalho em equipe: os ambientes não se cruzam, não há papéis nem
hierarquia, e duas pessoas nunca editam o mesmo dado. Cada usuário tem seus
briefs, seu vault e sua configuração.

Isso traz três frentes novas de interface:

1. **Onboarding** — ambiente novo não tem vault. O sistema conduz a construção.
2. **Dois chats com agente**, com propósitos distintos (§4.2 e §4.3).
3. **Vault editável, com histórico** (§4.4).

## 4. Superfícies a desenhar

### 4.1 Casca e identidade do ambiente

Cada usuário tem um ambiente, e ele deve estar identificado na interface — o
custo de operar o ambiente errado é alto (gera conteúdo com a marca errada).

Hoje a relação é **um usuário, um ambiente**. Deixe o lugar previsto para
troca de ambiente sem construí-la: é extensão provável, não requisito atual.

A casca precisa acomodar o logout (§4.7) e o estado de ambiente ainda não
configurado.

### 4.2 Chat de scan (operacional)

Dispara e acompanha a geração de pautas.

- **Entrada parametrizada**, não conversa livre: escopo de busca, pilar
  opcional, quantidade alvo. As opções vêm da configuração da empresa — se uma
  fonte nova for adicionada em `/config`, ela aparece aqui automaticamente.
- **Ensaio antes do disparo**: existe modo de pré-visualização que mostra o
  plano sem gerar nada nem consumir crédito. Trate como primeira classe, não
  como opção escondida — é o que dá segurança para apertar o botão.
- **Execução longa**: um scan real levou **19 minutos**. Não pode bloquear a
  tela nem depender da aba ficar aberta. Precisa de progresso por estágio
  (pesquisa → filtragem → redação), possibilidade de sair e voltar, e histórico
  de execuções anteriores.
- **Resultado**: os briefs gerados entram na fila de aprovação. O chat deve
  levar até lá, não terminar em becos.

### 4.3 Chat de vault (entrevista de onboarding)

Constrói a base de conhecimento da empresa conversando com o dono do negócio.

- **É entrevista, não formulário.** Uma pergunta por vez, em linguagem de dono
  de negócio ("conta a história da empresa como você contaria pra um cliente
  novo", "tem alguma palavra que você **não** quer que apareça"), aprofundando
  quando a resposta é rasa.
- **Documento sendo construído fica visível ao lado.** A pessoa precisa ver o
  que suas respostas estão produzindo, e poder corrigir antes de confirmar.
- **Parte chega pré-preenchida.** O sistema lê o que a empresa já publica
  (Instagram, site) e propõe tom de voz, temas recorrentes e público aparente.
  Revisar é mais fácil que criar do zero — o desenho deve favorecer correção
  sobre digitação.
- **É longo e precisa ser retomável.** Ninguém termina numa sessão. Progresso
  por seção, salvamento parcial, e a possibilidade de voltar depois.
- **O risco a combater é a resposta genérica.** "Queremos gerar valor para
  nossos clientes" produz pautas corretas e inúteis. A interface deve empurrar
  para o específico — exemplos concretos, contraste ("isso sim / isso não"),
  devolutiva quando a resposta ficou vaga.

Os dois chats compartilham componentes visuais, mas **não** são a mesma tela:
um dispara trabalho de máquina, o outro extrai conhecimento de pessoa.

### 4.4 Vault: leitura, edição e histórico

O vault é uma **sequência ordenada de blocos**: marca, história, voz,
posicionamento, foco editorial, públicos, pilares, cadência, guardrails e um
banco de temas por pilar — hoje 30 temas em seis categorias no pilar de decisão,
por exemplo.

**Todo bloco tem corpo em prosa.** Alguns têm, além disso, identidade estável —
os que são referenciados de fora: pilares, públicos, temas do banco e cada
guardrail. Um pilar não é um campo com rótulo: é um id mais um parágrafo que
explica o que ele é **e o que não é**. É nesse parágrafo que mora a diferença
entre um vault que funciona e um que não — *"casa pronta só no programa popular,
com simulação bancária prévia"* não cabe em campo curto. **O editor precisa
convidar a esse nível de detalhe**, não a preencher um rótulo.

Na hora da execução o sistema **monta os blocos num documento único** e entrega
ao agente. Isso gera um requisito de interface: a pessoa precisa conseguir ver
o documento montado, exatamente como o agente vai lê-lo. É o único jeito de
saber o que o sistema realmente está usando.

Diferenças que o desenho precisa respeitar:

- **Editar o vault não é editar configuração.** Configuração tem número e
  validação; vault é prosa que molda o comportamento do modelo. O efeito de
  uma edição **não aparece agora** — aparece no próximo scan, em todos os
  briefs. Isso pede histórico e comparação, não validação de campo.
- **Toda alteração pede um motivo.** O histórico útil responde "por que
  mudou", não só "o que mudou". Campo de motivo junto do salvamento.
- **Comparar versões e voltar atrás** precisam ser operações de primeira
  classe, não escondidas.
- **Banco de temas**: os briefs citam temas por código (`§B10`, `§D19`), e a
  configuração referencia pilares por código. O identificador é estável e
  independe da posição — mas a interface **não deve exibir a ordem como se fosse
  o identificador**, ou reordenar vai parecer renumerar.

### 4.5 Configuração

Edita fontes de pesquisa por escopo, volume semanal, thresholds e os pesos que
compõem o score.

**Relação com o vault — os dois convivem, com uma direção de dependência.** O
vault *define* o vocabulário editorial; a configuração o *referencia* por
código. Num mesmo escopo de busca, os dois aparecem lado a lado:

- **quais pilares aquele escopo alimenta** → escolha dentro do vocabulário do
  vault, não texto digitado;
- **a lista de fontes** → **entrada manual, e continua sendo.** Que site vale a
  pena, qual bloqueia robô, qual deu resultado é decisão operacional e não se
  deriva de marca nem de posicionamento. O agente pode sugerir candidatas; a
  lista é da pessoa.

Pesos, limiares e volume não vêm do vault: são default do produto, ajustáveis.

Consequência de ordem: **a configuração não pode ser preenchida antes do vault
existir** — os códigos de pilar ainda não foram criados.

Dois padrões que valem para o resto do produto:

- **Erro bloqueia, aviso não.** Pesos que não somam 1.0 impedem o salvamento;
  uma inconsistência editorial apenas alerta.
- **Validação antes da ida ao servidor.** A soma dos pesos aparece ao vivo e o
  botão desabilita antes de tentar salvar.

### 4.6 Fila de aprovação

A tela mais usada do produto — é onde a decisão acontece, e onde a pessoa passa
a maior parte do tempo. Os cinco comportamentos abaixo foram descobertos
operando de verdade; são **requisito, não preferência**:

- **A escolha da arte é da sessão, não do arquivo.** O sistema grava um valor
  padrão de "sem foto" quando gera o brief — então um valor já gravado **não
  significa que alguém decidiu**. Aprovar só libera depois de uma escolha
  explícita nesta visita.
- **Aprovar sem foto apaga as candidatas do cache, e isso é irreversível.**
  Pede confirmação — mas só quando existem fotos a perder. Se não há nenhuma
  candidata, confirmar o nada é ruído.
- **Licença de imagem é texto visível, não tooltip.** Fotos podem ser "uso
  referencial", o que restringe o uso. Quem decide precisa ver isso.
- **Brief borderline mostra o motivo, não só o selo.** É justamente onde a
  decisão é difícil.
- **Rejeitar é terminal e apaga toda a mídia.** A interface deve deixar claro,
  e o motivo da rejeição fica registrado.

### 4.7 Entrada: login e primeiro acesso

**Tela de login própria**, com autenticação de sessão de verdade e **logout
visível** na interface. Não há tela de cadastro: as contas são criadas fora do
produto, então não desenhe auto-registro, recuperação por e-mail nem aceite de
termos.

**O primeiro acesso cai num ambiente vazio.** A conta nasce provisionada mas sem
vault — sem marca, sem pilares, sem guardrails. Nesse estado o produto **não tem
o que mostrar**: um dashboard com quatro contadores zerados comunica falha, não
começo. Então o primeiro login não vai para o painel: vai para os primeiros
passos (§4.8).

### 4.8 Primeiros passos: da conta vazia ao primeiro scan

Esta é a superfície mais importante do produto e a mais fácil de subestimar.
Ela é usada **uma vez por cliente**, o que tenta a tratá-la como acessório — mas
é ela que produz o vault, e **a qualidade do vault é o teto de qualidade de tudo
o que o sistema gera depois**. Um onboarding raso não causa erro visível: causa
meses de pautas corretas e inúteis.

#### O que este fluxo é

Uma **entrevista conduzida por agente** (§4.3) que termina com o vault escrito.
Não é um assistente de configuração de 6 telas, e não é um formulário longo.

O modelo não foi inventado: o vault da empresa atual foi construído exatamente
assim, por questionário em linguagem de dono de negócio — *"conta a história como
você contaria pra um cliente novo"*, *"por que um cliente deveria escolher
vocês?"*, *"tem alguma palavra que você **não** quer que apareça?"*. Sete blocos
de perguntas viraram os arquivos de marca, posicionamento e guardrails. O fluxo
automatiza um processo que já existe e já provou funcionar — o desenho deve
preservar esse registro de conversa, não traduzi-lo para rótulos de campo.

#### Três origens de resposta, e elas se parecem diferentes na tela

Nem toda informação vem da mesma fonte, e a interface precisa deixar isso óbvio
— porque o que se pede da pessoa muda em cada caso:

| Origem | Exemplos | O que a pessoa faz |
|---|---|---|
| **Só o cliente sabe** | História, valores, foco editorial, o que a marca não diz, canal de contato | Responde. É aqui que a entrevista aprofunda. |
| **Derivável do que já é público** | Tom de voz, temas recorrentes, público aparente | **Corrige** uma proposta já preenchida. |
| **Template do produto** | Estrutura de pilares, cadência, guardrails base, pesos do score | Confirma ou ajusta. Já vem funcionando. |

O segundo grupo é o que mais encurta a conversa: o sistema lê o Instagram e o
site da empresa e chega com proposta pronta. **Revisar é mais fácil que criar do
zero**, então o desenho deve favorecer correção sobre digitação — mostrar o texto
proposto editável e a evidência de onde ele saiu, não um campo em branco com
uma sugestão escondida atrás de um botão.

#### A leitura do público é trabalho longo — e vem antes

Ler Instagram e site é a mesma natureza do scan (§4.2): minutos, não segundos,
e sujeito a falhar em fonte que bloqueia robô. Duas consequências:

- **Não pode ser tela de espera.** Ou a entrevista começa pelas perguntas que
  não dependem dela (história, valores, o que não dizer) enquanto a leitura roda
  em segundo plano, ou o fluxo é retomável e a pessoa volta quando ficar pronto.
  O desenho deve escolher e deixar claro.
- **Precisa funcionar sem.** Se a empresa não tem site, ou o Instagram não é
  legível, o fluxo continua — só perde o pré-preenchimento. Não é erro, é um
  caminho normal.

#### Retomada é requisito, não conforto

Ninguém termina numa sessão. O fluxo precisa de:

- **progresso legível** — quantas etapas existem, onde estou, o que já ficou
  pronto;
- **salvamento parcial de verdade** — sair no meio de uma resposta longa e
  voltar sem perdê-la;
- **entrada de volta óbvia** — enquanto estiver incompleto, retomar os primeiros
  passos é a ação primária da casca, não um link no rodapé.

#### As etapas não são invenção da tela

A divisão das etapas vem da estrutura do vault (§4.4), não de um agrupamento
escolhido para caber no ecrã. A cadeia é:

> uma pergunta → um bloco do vault → uma etapa → uma versão

Três consequências práticas:

- **O progresso é contagem, não estimativa.** "Etapa 2 de 6" não é número
  escrito à mão: é bloco preenchido sobre bloco existente. Não mente quando o
  conjunto mudar.
- **Não existe estado meio-salvo.** Bloco confirmado é uma versão; bloco não
  confirmado ainda não existe. Retomar é continuar de onde a lista de vazios
  começa — o salvamento parcial deixa de ser caso especial de interface.
- **Editar depois é reabrir a mesma pergunta**, com a resposta anterior na tela.
  Por isso o desenho da etapa e o desenho da edição de vault (§4.4) são a mesma
  tela em dois momentos, não duas telas.

#### Ordem: só trava o que consome a saída do anterior

Quase toda etapa ganha citando a anterior. Se isso travar, trava tudo — então:

- **Dependência de contexto** — a conversa fica melhor com a anterior, mas
  acontece sem ela. **Não tranca.**
- **Dependência de insumo** — a etapa consome a saída da anterior e não tem como
  ser gerada sem ela. **Tranca.**

A cadeia travada é curta: **foco editorial → públicos → pilares → fontes de
pesquisa e banco de temas**. Os pilares são propostos a partir do foco e dos
públicos; um escopo de busca declara quais pilares alimenta; um tema pertence a
um pilar.

História, valores, voz e identidade visual não dependem de nada — e são
exatamente as que devem **abrir a entrevista enquanto a leitura do Instagram e
do site roda em segundo plano**, para o pré-preenchimento chegar a tempo.

Duas regras para o mapa de etapas:

- **Etapa trancada diz por que, e leva ao bloqueador** — "precisa de pilares
  definidos", com o caminho. Item cinza sem explicação é a diferença entre
  "ainda não é hora" e "quebrado".
- **A trava vale só para a primeira vez.** Com tudo preenchido, editar é livre:
  abrir os pilares não pode exigir repassar pelo foco editorial.

#### O adversário do fluxo é a resposta genérica

O que faz as pautas da empresa atual serem boas não é *ter* pilares — é ter
*"lotes, sítios e chácaras na região metropolitana; casa pronta só no programa
popular, com simulação bancária prévia"*. Uma entrevista mal conduzida produz
*"queremos gerar valor para nossos clientes"* — e o pipeline inteiro fica
correto e inútil, sem nada acusando o problema.

O que a interface pode fazer contra isso:

- **exemplo concreto no lugar do rótulo abstrato** — o texto de apoio de cada
  pergunta vale mais que o título dela;
- **pedir contraste** — "isso sim / isso não" extrai especificidade melhor que
  uma pergunta aberta. Um campo de exclusão ao lado do campo de inclusão em
  toda seção de escopo;
- **devolutiva quando a resposta ficou vaga** — o agente repergunta; a interface
  precisa acomodar essa repergunta como parte natural da conversa, não como
  erro de validação em vermelho;
- **mostrar consequência** — sempre que possível, exibir o efeito da resposta
  ("com este foco, uma pauta sobre X seria descartada"). É o argumento mais
  forte que existe para a pessoa ser específica.

#### O documento em construção fica visível

A entrevista escreve arquivos. A pessoa precisa ver o que as respostas dela
estão produzindo, ao lado da conversa, e poder corrigir **antes** de confirmar.
Sem isso, ela responde no escuro e descobre o resultado só quando as pautas
saírem erradas.

Cada seção confirmada é uma versão do vault — o que conecta este fluxo
diretamente ao histórico do §4.4. A primeira versão de cada documento nasce
aqui, com "criado no onboarding" como motivo.

#### O fim: quando termina e o que acontece

Existe um **contrato mínimo** — o conjunto de informações sem o qual o radar não
consegue rodar — e existe o resto, que melhora o resultado mas pode esperar. A
interface precisa separar os dois com clareza, porque a diferença é entre *"já
dá para fazer o primeiro scan"* e *"ainda falta"*.

Isso é uma marca em cada bloco, não uma lista mantida à parte: a tela pergunta
ao próprio vault se já dá para rodar. O que **degrada sem travar** deve ser dito
com essas palavras — quem pula precisa saber o que está trocando. Sem história e
valores, por exemplo, o pipeline roda e a copy sai correta e sem alma.

Ao atingir o mínimo, o caminho para o **primeiro scan** é a ação evidente. E o
primeiro scan merece tratamento especial: é onde a pessoa descobre se as
respostas dela produziram algo bom. Use o modo de ensaio do §4.2 — mostrar o
plano antes de gastar — como ponte entre os dois.

**O fluxo não desaparece depois.** Terminado o onboarding, ele vira a edição de
vault do §4.4: mesmo conteúdo, mesma entrevista disponível para aprofundar uma
seção, agora com histórico e comparação. Não desenhe uma tela de boas-vindas
descartável — desenhe a primeira visita de uma tela que continua existindo.

#### Enquanto está incompleto, o resto do produto não fica vazio

Fila, acervo e configuração dependem do vault. Nesse estado elas devem
**explicar o que falta e levar de volta aos primeiros passos**, com o motivo
específico — "sem pilares editoriais definidos, o radar não sabe o que procurar"
— em vez de exibirem um estado vazio genérico ou, pior, um zero que parece
resultado.

## 5. Invariantes que valem para tudo

- **Ação destrutiva e irreversível pede confirmação** — mas confirmação vazia
  (sem nada a perder) é ruído que ensina a clicar sem ler.
- **Trabalho longo nunca bloqueia a tela** e sobrevive a fechar a aba.
- **Estado do arquivo ≠ decisão do humano.** Sempre que um valor padrão puder
  ser confundido com escolha deliberada, a interface desfaz a ambiguidade.
- **Toda mudança de estado é registrada** com autor e momento. O histórico é a
  trilha de auditoria do produto.
- **Idioma da interface: português do Brasil.**

## 6. Fora de escopo

Autenticação existe e tem tela própria (§4.7), mas **não há papéis nem
hierarquia** — o modelo é de ambientes individuais, não de equipe. Não desenhe
aprovação em dois níveis, atribuição de tarefa ou resolução de conflito entre
pessoas: nada disso existe. Publicação no Instagram é manual e
continua fora do produto. A arte final é feita no Smart Design; o radar entrega
o pacote.
