# Desenho — esquema do banco

> **Status: desenho, nada implementado.** Fecha a decisão de banco levantada em
> [`design-persistencia-multiusuario.md`](./design-persistencia-multiusuario.md)
> §4 e dá forma ao vault em blocos de
> [`design-vault-onboarding.md`](./design-vault-onboarding.md) §5.
>
> Desenhado sobre os dados reais: 33 briefs, 208 eventos de ledger e os seis
> arquivos do `always_load` do vault da Avanz.

## 1. Decisões de base

**PostgreSQL 16**, já em execução no servidor (Mongo e Redis também estão).

**Tabelas compartilhadas com row-level security**, não schema por cliente. A
telemetria de consumo — frente aberta que vira base da cobrança — precisa de
consulta agregada entre clientes; com schema por cliente isso vira laço.

**Dois papéis de banco**, e a distinção é o que faz o RLS valer:

| Papel | Usa | Privilégio |
|---|---|---|
| `radar_owner` | migrações de estrutura, e só | dono das tabelas |
| `radar_app` | a aplicação, o tempo todo, para todos os ambientes | `SELECT/INSERT/UPDATE/DELETE`, sem posse |

Toda tabela recebe `FORCE ROW LEVEL SECURITY` — assim a política vale até para
o dono, e uma string de conexão errada não desliga o isolamento em silêncio.

**Binário não entra no banco.** Mídia e artes vão para armazenamento de objetos,
com prefixo por ambiente. O banco guarda a referência.

> Diagrama das tabelas e relações: [`design-esquema-banco-er.md`](./design-esquema-banco-er.md).

## 2. Isolamento

```sql
-- em toda tabela com ambiente_id
ALTER TABLE brief ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief FORCE  ROW LEVEL SECURITY;

CREATE POLICY isolamento ON brief
  USING      (ambiente_id = current_setting('app.ambiente')::uuid)
  WITH CHECK (ambiente_id = current_setting('app.ambiente')::uuid);
```

`USING` filtra a leitura; `WITH CHECK` impede escrever linha de outro ambiente —
sem ele, dá para inserir dado fora do próprio escopo.

A aplicação define o ambiente ao abrir a transação, num lugar só:

```sql
SET LOCAL app.ambiente = '…';
```

**Teste que sustenta isso:** conectar com a string da aplicação, consultar
`brief` sem definir `app.ambiente`, e exigir zero linhas. Se alguém trocar a
conexão por um papel privilegiado, o teste quebra na hora.

### 2.1 Chave estrangeira composta

Toda referência entre tabelas carrega o ambiente:

```sql
FOREIGN KEY (ambiente_id, pilar_slug) REFERENCES pilar (ambiente_id, slug)
```

Sem o `ambiente_id` na chave, um brief poderia apontar para o pilar de outro
cliente e o banco aceitaria. É o mesmo princípio do RLS aplicado à integridade:
o erro deixa de ser possível em vez de ser evitado por atenção.

## 3. Ambiente e acesso

```sql
CREATE TABLE ambiente (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,           -- 'avanz-imoveis'
  nome         text NOT NULL,
  prefixo_midia text NOT NULL,                 -- prefixo no object storage
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL UNIQUE,
  senha_hash  text NOT NULL,                   -- argon2
  ambiente_id uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ambiente_id, id)
);
```

`ambiente` e `usuario` **não** levam RLS: são as tabelas consultadas *antes* de
haver ambiente definido, no login. O acesso a elas fica restrito por privilégio.

Relação um usuário ↔ um ambiente, como decidido. `ON DELETE CASCADE` a partir de
`ambiente` é o que torna "excluir cliente" uma operação, não um projeto.

## 4. Brief

O critério para coluna versus `jsonb`: **é coluna o que se filtra, ordena ou
junta; é `jsonb` o que só se lê inteiro.**

```sql
CREATE TYPE brief_estado AS ENUM (
  'pendente-aprovacao', 'pendente-publicacao', 'publicado', 'rejeitado'
);

CREATE TABLE brief (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente_id  uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,

  brief_id     text NOT NULL,                  -- '2026-W26-010'
  slug         text NOT NULL,
  estado       brief_estado NOT NULL,

  -- classificação: filtrada e agregada o tempo todo
  pilar_slug   text NOT NULL,
  publico_slug text NOT NULL,
  match_score  numeric(3,2),                   -- null = banco de conteúdo
  borderline   boolean NOT NULL DEFAULT false,
  borderline_motivo text,

  -- anti-repetição
  topic_hash   text NOT NULL,

  -- conteúdo do cliente
  headline     text NOT NULL,
  hook         text,
  caption_draft text,
  cta          text,
  hashtags     text[],

  -- lidos inteiros, nunca por campo
  score_detalhe jsonb,                         -- match_score_breakdown
  evidencias    jsonb,                         -- source_relevance_hints
  origem        jsonb,                         -- scope, source_urls, excerpts
  visual_brief  jsonb,
  destino_od    jsonb,                         -- od_skill_ref + alternativas

  -- escolha da arte: ver §4.1
  hero_indice        smallint,
  hero_decidido_em   timestamptz,
  hero_decidido_por  uuid REFERENCES usuario(id),

  scan_id      uuid REFERENCES scan(id),
  review_notes text,

  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  handoff_em   timestamptz,
  publicado_em timestamptz,
  ig_post_url  text,

  UNIQUE (ambiente_id, brief_id),
  UNIQUE (ambiente_id, id),
  FOREIGN KEY (ambiente_id, pilar_slug)   REFERENCES pilar   (ambiente_id, slug),
  FOREIGN KEY (ambiente_id, publico_slug) REFERENCES publico (ambiente_id, slug)
);

CREATE INDEX ON brief (ambiente_id, estado, criado_em DESC);
CREATE INDEX ON brief (ambiente_id, topic_hash);
CREATE INDEX ON brief (ambiente_id, pilar_slug, publico_slug, criado_em DESC);
```

Os três índices atendem, na ordem: a fila e o acervo; a anti-repetição por
hash; e a janela de redundância pilar+ICP de 14 dias.

### 4.1 A ambiguidade do `hero_choice` morre aqui

Hoje `hero_choice: null` significa duas coisas incompatíveis: *o briefer gravou
o padrão* e *o humano decidiu não usar foto*. Foi o que obrigou a interface a
exigir um clique explícito por sessão.

No esquema isso vira dois campos, e a ambiguidade deixa de existir:

| Situação | `hero_indice` | `hero_decidido_em` |
|---|---|---|
| Ninguém decidiu ainda | `null` | `null` |
| Humano escolheu a foto 0 | `0` | carimbo |
| Humano decidiu não usar foto | `null` | **carimbo** |

A regra da fila passa a ser legível na consulta: só aprova quem tem
`hero_decidido_em` preenchido. A interface continua exigindo o clique, mas
porque o dado exige — não por convenção de tela.

### 4.2 Candidatas de imagem

```sql
CREATE TABLE brief_candidata (
  brief_id     uuid NOT NULL,
  ambiente_id  uuid NOT NULL,
  indice       smallint NOT NULL,
  source_url   text,
  image_url    text,
  objeto_path  text,                           -- no object storage
  cloud_url    text,
  cloudinary_public_id text,
  alt          text,
  license_hint text,
  licensable   boolean,
  mime_type    text,
  PRIMARY KEY (brief_id, indice),
  FOREIGN KEY (ambiente_id, brief_id) REFERENCES brief (ambiente_id, id)
    ON DELETE CASCADE
);
```

Tabela e não `jsonb` porque a licença é consultada por item (a fila mostra "uso
referencial" por foto) e porque a purga de mídia opera candidata a candidata.

## 5. Scan e ledger

```sql
CREATE TABLE scan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente_id uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,
  scan_ref    text NOT NULL,                   -- '2026-W22-scan-001'
  escopo      text NOT NULL,                   -- trends | local | competitors …
  pilar_filtro text,
  alvo_qtd    smallint,
  estado      text NOT NULL,                   -- enfileirado|rodando|concluido|falhou
  vault_versao bigint,                         -- contra qual vault rodou (§6.3)
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  UNIQUE (ambiente_id, scan_ref)
);

CREATE TABLE evento (
  id          bigserial PRIMARY KEY,
  ambiente_id uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,
  ts          timestamptz NOT NULL DEFAULT now(),
  tipo        text NOT NULL,                   -- 'mv-approved', 'published', …
  ator        text NOT NULL,                   -- 'app:radar-web' | 'skill:radar-mv'
  usuario_id  uuid REFERENCES usuario(id),
  brief_id    uuid REFERENCES brief(id) ON DELETE SET NULL,
  scan_id     uuid REFERENCES scan(id) ON DELETE SET NULL,
  de_estado   brief_estado,
  para_estado brief_estado,
  extra       jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX ON evento (ambiente_id, ts DESC);
CREATE INDEX ON evento (ambiente_id, brief_id, ts);
```

**O ledger é append-only.** Nada de `UPDATE` nem `DELETE`: é a trilha de
auditoria, e a única garantia dela é não ser reescrita. Vale negar esses
privilégios a `radar_app` nesta tabela — o banco recusa, e não depende de
ninguém lembrar.

`ON DELETE SET NULL` no brief é deliberado: apagar um brief não pode apagar o
registro de que ele existiu.

Os 21 tipos de evento de hoje entram como estão. `tipo` fica `text` e não `enum`
porque o conjunto cresce a cada skill nova, e migração de enum por isso é atrito
sem ganho.

## 6. Vault

A forma decidida: sequência ordenada de blocos, todos com corpo em prosa, e
identidade estável só onde algo de fora aponta.

### 6.1 Blocos em prosa

```sql
CREATE TABLE vault_bloco (
  ambiente_id uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,
  slug        text NOT NULL,                   -- 'foco-editorial', 'voz'
  titulo      text NOT NULL,
  corpo       text NOT NULL,
  ordem       smallint NOT NULL,               -- ordem de montagem
  escopo      text NOT NULL,                   -- 'sempre' | 'por-pilar'
  contrato    text NOT NULL,                   -- 'obrigatorio'|'degrada'|'opcional'
  versao      bigint NOT NULL DEFAULT 1,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ambiente_id, slug)
);

CREATE TABLE vault_bloco_versao (
  id          bigserial PRIMARY KEY,
  ambiente_id uuid NOT NULL,
  slug        text NOT NULL,
  versao      bigint NOT NULL,
  corpo       text NOT NULL,
  motivo      text NOT NULL,                   -- obrigatório: o "por quê"
  autor_id    uuid REFERENCES usuario(id),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ambiente_id, slug, versao)
);
```

`motivo` é `NOT NULL` de propósito. Prosa não tem validação automática possível,
então o histórico é a única rede de segurança — e histórico sem o porquê
responde metade da pergunta.

**O contrato mínimo é a coluna `contrato`**, não uma lista mantida à parte. A
tela pergunta ao próprio vault se já dá para rodar o primeiro scan:

```sql
SELECT slug FROM vault_bloco
WHERE contrato = 'obrigatorio' AND (corpo IS NULL OR corpo = '');
```

### 6.2 Blocos com identidade

Pilar, público e tema são referenciados de fora — por isso têm tabela própria,
e o corpo em prosa continua ali.

```sql
CREATE TABLE pilar (
  ambiente_id uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,
  slug        text NOT NULL,                   -- 'decisao-inteligente' — imutável
  nome        text NOT NULL,                   -- exibição, livre para mudar
  corpo       text NOT NULL,                   -- tese, estrutura, o que não fazer
  ordem       smallint NOT NULL,
  no_radar    boolean NOT NULL DEFAULT true,   -- 'bastidor' = false
  PRIMARY KEY (ambiente_id, slug)
);

CREATE TABLE publico (
  ambiente_id uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,
  slug        text NOT NULL,                   -- 'comprador'
  nome        text NOT NULL,
  corpo       text NOT NULL,
  padrao      boolean NOT NULL DEFAULT false,  -- 'comprador' quando ambíguo
  PRIMARY KEY (ambiente_id, slug)
);

CREATE TABLE tema (
  ambiente_id uuid NOT NULL,
  pilar_slug  text NOT NULL,
  codigo      text NOT NULL,                   -- 'B10' — atribuído na criação
  categoria   text NOT NULL,                   -- 'B. Financiamento e dinheiro'
  titulo      text NOT NULL,
  angulo      text,
  esgotado_em timestamptz,                     -- null = ativo
  usado_em    timestamptz,
  PRIMARY KEY (ambiente_id, pilar_slug, codigo),
  FOREIGN KEY (ambiente_id, pilar_slug) REFERENCES pilar (ambiente_id, slug)
);

CREATE TABLE guardrail (
  ambiente_id uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,
  slug        text NOT NULL,                   -- 'nao-prometer-aprovacao'
  corpo       text NOT NULL,
  PRIMARY KEY (ambiente_id, slug)
);
```

**`slug` e `codigo` são atribuídos na criação e imutáveis.** Nenhuma rotina os
recalcula a partir da ordem — a ordenação é a coluna `ordem`, separada. É o que
mata as duas quebras silenciosas: renumerar o banco de temas invalidando as
citações antigas, e renomear um pilar quebrando a referência da configuração.

São strings legíveis e não ids opacos porque uma das pontas da referência é um
modelo de linguagem: ele lê o documento montado e devolve
`pilar: decisao-inteligente`, e a justificativa do score cita `§B10` em prosa
para uma pessoa auditar. A chave numérica interna, se houver, não aparece em
brief, configuração nem prompt.

### 6.3 A montagem

O documento que vai para o agente é `vault_bloco` mais os blocos com identidade,
concatenados na ordem — e essa montagem passa a ser código do produto, que pode
degradar sem ninguém perceber. Duas consequências no esquema:

- `scan.vault_versao` registra **contra qual estado do vault o scan rodou**. É o
  que torna respondível "esta pauta ruim saiu de qual versão dos pilares?".
- A interface precisa exibir o documento montado como o agente o lê. Isso é
  leitura derivada, não tabela.

## 7. Configuração

```sql
CREATE TABLE config (
  ambiente_id uuid PRIMARY KEY REFERENCES ambiente(id) ON DELETE CASCADE,
  pesos       jsonb NOT NULL,   -- match_score_weights
  caps        jsonb NOT NULL,   -- match_score_caps
  janelas     jsonb NOT NULL,   -- windows
  volume      jsonb NOT NULL,   -- cadência e slots
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE escopo_busca (
  ambiente_id uuid NOT NULL REFERENCES ambiente(id) ON DELETE CASCADE,
  slug        text NOT NULL,                   -- 'trends', 'local'
  ativo       boolean NOT NULL DEFAULT true,
  PRIMARY KEY (ambiente_id, slug)
);

CREATE TABLE escopo_pilar (                    -- pillars_alvo
  ambiente_id uuid NOT NULL,
  escopo_slug text NOT NULL,
  pilar_slug  text NOT NULL,
  PRIMARY KEY (ambiente_id, escopo_slug, pilar_slug),
  FOREIGN KEY (ambiente_id, escopo_slug) REFERENCES escopo_busca (ambiente_id, slug) ON DELETE CASCADE,
  FOREIGN KEY (ambiente_id, pilar_slug)  REFERENCES pilar        (ambiente_id, slug)
);

CREATE TABLE fonte (
  ambiente_id uuid NOT NULL,
  escopo_slug text NOT NULL,
  slug        text NOT NULL,
  url         text NOT NULL,
  nota        text,                            -- 'anti-bot', 'lead a confirmar'
  ativo       boolean NOT NULL DEFAULT true,
  PRIMARY KEY (ambiente_id, escopo_slug, slug),
  FOREIGN KEY (ambiente_id, escopo_slug) REFERENCES escopo_busca (ambiente_id, slug) ON DELETE CASCADE
);
```

`escopo_pilar` é a tabela que materializa a fronteira que a gente traçou: **o
pilar vem do vault, a fonte é entrada manual.** A chave estrangeira garante que
um escopo não referencie pilar inexistente — hoje isso é string digitada no YAML.

Pesos, caps e janelas ficam em `jsonb` porque são lidos inteiros na execução e
validados na aplicação (soma 1,0, borderline abaixo do threshold). Quebrá-los em
colunas obrigaria migração a cada componente novo de score.

**Segredos não entram aqui.** Ficam fora do banco de configuração, conforme
[`design-manifest-multiempresa.md`](./design-manifest-multiempresa.md).

## 8. O que o importador vai encontrar

Duas coisas medidas no ledger real que a fase 1 precisa tratar:

**O formato do ledger mudou no meio da vida do projeto.** Em 32 dos 208 eventos
os campos `event` e `scan_id` estão **dentro** de `extra`, não no topo — resíduo
do formato antigo. O importador precisa aceitar as duas formas, ou 32 eventos
entram com `tipo` nulo.

**Parte do frontmatter está dobrado em 80 colunas** — `headline` e `hook` de
vários briefs vêm com quebra de linha no meio, resíduo do editor web
(`replaceFrontmatterFields` reserializa o documento inteiro). O importador
precisa parsear YAML de verdade, nunca linha a linha, ou importa headline
truncada.

## 9. Em aberto

- **Retenção do ledger.** Append-only cresce para sempre; falta decidir se há
  janela de arquivamento por ambiente.
- **`handoff_em` com download sob demanda.** Hoje o carimbo torna a skill
  idempotente; com download repetível, falta decidir se ele registra o primeiro
  download ou deixa de existir.
- **Telemetria de consumo** — a tabela que sustenta cobrança e dimensionamento
  de fila ainda não tem desenho; é a frente aberta mais antiga.
- **Vault por estágio.** Hoje o `always_load` é o mesmo para matcher e briefer.
  Com blocos, dá para injetar menos no matcher — falta medir se compensa.
