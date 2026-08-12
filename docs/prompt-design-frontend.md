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

O produto deixa de ser ferramenta de uso pessoal e passa a atender **várias
empresas, com várias pessoas em cada**. Isso traz quatro frentes novas de
interface:

1. **Contexto de empresa** — a pessoa opera *uma* empresa por vez e pode ter
   acesso a mais de uma. Trocar de empresa troca tudo: briefs, vault, config.
2. **Onboarding** — empresa nova não tem vault. O sistema conduz a construção.
3. **Dois chats com agente**, com propósitos distintos (§4.2 e §4.3).
4. **Vault editável, com histórico** (§4.4).

## 4. Superfícies a desenhar

### 4.1 Casca e troca de empresa

A empresa ativa precisa estar sempre visível — o custo de operar a empresa
errada é alto (gera conteúdo com a marca errada). Trocar deve ser explícito, e
o estado da tela anterior não deve vazar para a nova empresa.

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

O vault são documentos em prosa (marca, posicionamento, pilares, cadência,
guardrails) mais um **banco de temas** por pilar — hoje 30 temas em seis
categorias no pilar de decisão, por exemplo.

Diferenças que o desenho precisa respeitar:

- **Editar o vault não é editar configuração.** Configuração tem número e
  validação; vault é prosa que molda o comportamento do modelo. O efeito de
  uma edição **não aparece agora** — aparece no próximo scan, em todos os
  briefs. Isso pede histórico e comparação, não validação de campo.
- **Toda alteração pede um motivo.** O histórico útil responde "por que
  mudou", não só "o que mudou". Campo de motivo junto do salvamento.
- **Comparar versões e voltar atrás** precisam ser operações de primeira
  classe, não escondidas.
- **Banco de temas**: os briefs citam temas por código (`§B10`, `§D19`).
  Renumerar quebra silenciosamente as citações antigas. A interface de edição
  não pode sugerir que reordenar é inofensivo.

### 4.5 Configuração

Edita fontes de pesquisa por escopo, volume semanal, thresholds e os pesos que
compõem o score.

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

### 4.7 Conflito de edição

Com mais de uma pessoa, duas edições do mesmo brief podem se cruzar. Hoje a
segunda sobrescreve a primeira em silêncio. A interface precisa de um estado
para "isto mudou desde que você abriu" — com o que mudou e a escolha de
recarregar ou sobrescrever. **Perda silenciosa não é aceitável.**

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

Autenticação e papéis (revisor × aprovador) ainda não estão decididos — desenhe
prevendo o lugar deles, sem implementar. Publicação no Instagram é manual e
continua fora do produto. A arte final é feita no Smart Design; o radar entrega
o pacote.
