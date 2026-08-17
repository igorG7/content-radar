# Desenho — configuração (manifest) no cenário multi-empresa

> **Status: desenho, nada implementado.** Registra a conversa de arquitetura de
> 2026-08-12. Terceiro documento da série, ao lado de
> [`design-persistencia-multiusuario.md`](./design-persistencia-multiusuario.md)
> (fluxo operacional) e [`design-vault-onboarding.md`](./design-vault-onboarding.md)
> (base de conhecimento).

## 1. O manifest são quatro coisas num arquivo só

Hoje `manifest.yaml` tem nove seções que parecem homogêneas porque há um único
operador, que é também quem construiu o sistema. Em multi-empresa elas se
separam por **dono, ciclo de vida e sigilo**:

| Camada | Seções | Onde vive |
|---|---|---|
| **Produto** | esquema do scoring, componentes que existem, defaults iniciais | Repositório, versionado com o código |
| **Configuração do cliente** | `search_scopes`, `funnel`, `cadence`, valores de `anti_repetition` | Banco, por cliente, editável na tela |
| **Identidade e fiação** | `target_company` (slug, referência ao vault, `always_load`, `per_pillar`, `brand_facts`) | Banco, definida no onboarding |
| **Infraestrutura e segredos** | `cloudinary`, `open_design`, `storage` | Fora da tela do cliente; segredos cifrados em repouso |

## 2. A fronteira produto × cliente

**O esquema é do produto; os valores são do cliente.**

- **Do produto:** a fórmula (soma ponderada), *quais* componentes existem
  (pilar, ICP, foco editorial, geografia, atualidade), o mecanismo de caps.
  Um cliente pode zerar o peso de geografia, mas não pode inventar um
  componente `tom_de_voz_fit` — o matcher não sabe calculá-lo.
- **Do cliente:** os valores dos pesos, os thresholds, as janelas.

Os pesos **não** são configuração global. Eles carregam premissas de negócio,
não de engenharia: `geografia_fit` valer 0,20 faz sentido para quem opera uma
região metropolitana; para uma empresa de atuação nacional deveria pesar quase
zero. Um valor único para todos imporia a estratégia de um cliente aos demais.

### 2.1 Resolução em camadas

O produto entrega **defaults** (os 0,30 / 0,25 / 0,20 / 0,15 / 0,10 já
calibrados em `docs/calibracao-matcher.md`); cada cliente **sobrepõe** o que for
dele; a resolução acontece em tempo de execução.

Quem nunca mexer recebe um padrão sensato em vez de uma tela em branco — e
melhorias no default beneficiam quem não customizou.

## 3. Sensível ≠ secreto

Duas categorias com tratamentos opostos:

| | Risco | Tratamento |
|---|---|---|
| **Secreto** — credenciais Cloudinary, auth do Open Design, chave de API | Vazamento | Cifrado em repouso, nunca exibido de volta, nunca gravado em arquivo que a tela escreve |
| **Sensível** — pesos, caps, janelas | Dano por edição sem entendimento | **Visível e explicado**, com barreira, histórico e registro de quem mudou |

O sensível precisa de contexto, não de sigilo. Esconder os pesos não protege
ninguém; explicar o que cada um faz, sim.

## 4. Mídia: conta Cloudinary única

**Decisão: uma conta, isolamento por pasta parametrizada por cliente.** N contas
multiplicariam onboarding, rotação de credenciais, monitoramento e faturamento
para resolver algo que o caminho da pasta já resolve. O padrão já existe hoje
(`folder: content-radar/avanz`).

Consequências aceitas e como tratá-las:

- **O isolamento vira convenção de nome, não fronteira de conta.** O risco real
  não é enumeração — é um **bug de montagem de caminho** misturando pastas de
  dois clientes. Mitigação: validar o prefixo do cliente em toda escrita e
  leitura, mesma lição da rota de mídia (`app/api/media/[state]/[file]`).
- **`public_id` recebe sufixo aleatório**, não timestamp. Timestamp em segundos
  são ~86 mil valores por dia — enumerável por quem souber a data. Um sufixo
  aleatório de ~10 caracteres custa o mesmo e fecha a porta.
- **Cota e custo ficam agregados.** Sem atribuição nativa por cliente; se isso
  virar necessidade, medir do lado da aplicação.

Dimensionamento honesto: o conteúdo são fotos de notícia e arte gerada, não dado
sensível. O controle de prefixo vale mais que o do sufixo.

## 5. Chave de API do modelo

**Decisão atual: a chave é nossa**, compartilhada. A chave por cliente fica em
aberto.

O trade-off, para quando a decisão for retomada:

- **Chave do cliente** — atribuição de custo automática, limites de taxa
  isolados, tecnicamente mais limpo. Mas exige que ele crie conta na Anthropic
  e cole uma chave: barreira grande de onboarding para o perfil corretor de
  imóveis, e fonte constante de suporte (expirou, sem crédito, colada errada).
  Um scan leva ~19 minutos — falha de chave no meio precisa ser explicada de
  forma compreensível.
- **Chave nossa** — sem fricção de onboarding, ao custo de medir consumo por
  cliente na aplicação para cobrar.

A escolha depende do cliente-alvo: agência ou gente técnica tolera a chave
própria; o corretor, provavelmente não.

## 6. Como a configuração chega ao pipeline

Mesmo padrão do fluxo operacional: **o app resolve, a skill recebe.**

O app monta a configuração efetiva (default do produto + sobreposição do
cliente) e injeta na execução. O manifest é pequeno, então isso é barato.

Vale registrar o que o manifest faz com o vault, porque é fonte de confusão:
ele **não busca** o vault — ele **aponta** para ele. Declara a referência
(`target_company.vault_path`), a lista do `always_load` e o mapa `per_pillar`.
Quem lê e injeta é a skill, no momento da execução. O manifest é a **fiação**
entre pipeline e base de conhecimento. Hoje são caminhos absolutos deste
servidor; no produto, viram referência ao vault daquele cliente.

## 7. O que muda seção a seção

| Seção | Hoje | No desenho |
|---|---|---|
| `project` | Metadados do produto | Some do escopo de cliente |
| `target_company` | Slug, caminho do vault, `always_load`, `per_pillar`, `brand_facts` | Banco, por cliente; definido no onboarding |
| `search_scopes` | Fontes por escopo | Banco, por cliente, **editável na tela** |
| `funnel` | Alvo semanal | Banco, por cliente, **editável na tela** |
| `cadence` | Pilares por dia | Banco, por cliente, **editável na tela** |
| `anti_repetition` | Pesos, caps, janelas | Esquema no produto; **valores por cliente**, com default |
| `cloudinary` | Conta e credenciais da Avanz | Conta única compartilhada; pasta por cliente |
| `open_design` | Endpoints + UUID do projeto da Avanz | Endpoints como infra; projeto por cliente |
| `storage` | Caminhos de diretório | **Desaparece** — 15 linhas que deixam de existir quando o estado vai para o banco |

## 8. Em aberto

- **Chave de API por cliente** (§5).
- **`brand_facts` duplica o vault de propósito.** O comentário no manifest diz
  que é para evitar parsing repetido do `brand.json`. Com o vault dentro do
  produto, essa duplicação deixa de ser otimização e vira sincronização a
  manter — vale reavaliar.
- **Quanto do sensível expor a quem.** Se os pesos ficam na tela principal, numa
  área avançada, ou só para administrador.
- **Projeto do Open Design por cliente** — hoje o UUID está cravado no arquivo.
