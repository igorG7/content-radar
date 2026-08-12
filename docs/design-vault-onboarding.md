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

### 4.3 Onde o histórico vive

- Vault em arquivo → o git já entrega de graça.
- Vault em banco (cenário multi-empresa) → versão imutável por edição; o
  histórico vira consulta em vez de `git log`.

## 5. Em aberto

- **Onde o vault de cada cliente vive** no cenário multi-empresa — o
  [documento do fluxo operacional](./design-persistencia-multiusuario.md) decidiu
  banco para estado operacional, mas deixou o vault fora: é base de conhecimento
  (texto longo, editado por humano), não estado transacional.
- **Contrato mínimo do vault** — qual o conjunto de arquivos sem o qual o radar
  não roda, e o que é opcional.
- **Quem mantém depois do onboarding** — o cliente, o operador do produto, ou o
  próprio radar aprendendo do que foi aprovado e rejeitado.
- **Realimentação** — se o sistema deve propor entradas novas de content-bank a
  partir dos temas que vêm sendo aprovados.
