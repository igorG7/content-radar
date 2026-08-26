# Diagrama ER — esquema do banco

> Acompanha [`design-esquema-banco.md`](./design-esquema-banco.md), onde estão o
> DDL completo, as políticas de RLS e as decisões por trás de cada tabela.
>
> **Status: desenho, nada implementado.**

## Como ler

Três agrupamentos: o **eixo operacional** (brief, scan, evento, candidatas — o
que muda toda semana), o **vault** (blocos, pilares, públicos, temas, guardrails
— o que molda o conteúdo) e a **configuração** (escopos, fontes, pesos — o que
pesa na hora de pontuar).

`ambiente` é o vértice de tudo: é dele que sai o isolamento por row-level
security e é por ele que a exclusão de um cliente cascateia.

```mermaid
erDiagram
    ambiente ||--o{ usuario : "um por ambiente"
    ambiente ||--o{ brief : ""
    ambiente ||--o{ scan : ""
    ambiente ||--o{ evento : ""
    ambiente ||--|| config : ""
    ambiente ||--o{ vault_bloco : ""
    ambiente ||--o{ pilar : ""
    ambiente ||--o{ publico : ""
    ambiente ||--o{ guardrail : ""
    ambiente ||--o{ escopo_busca : ""

    scan ||--o{ brief : "gera"
    scan ||--o{ evento : ""

    brief ||--o{ brief_candidata : "fotos candidatas"
    brief ||--o{ evento : "trilha de auditoria"
    pilar ||--o{ brief : "classifica"
    publico ||--o{ brief : "classifica"
    usuario |o--o{ brief : "decidiu a arte"
    usuario |o--o{ evento : "autor"

    vault_bloco ||--o{ vault_bloco_versao : "historico com motivo"
    pilar ||--o{ tema : "banco de temas"
    pilar ||--o{ escopo_pilar : "alimenta"
    escopo_busca ||--o{ escopo_pilar : "declara"
    escopo_busca ||--o{ fonte : "entrada manual"

    ambiente {
        uuid id PK
        text slug UK
        text prefixo_midia
    }
    usuario {
        uuid id PK
        citext email UK
        text senha_hash
        uuid ambiente_id FK
    }
    brief {
        uuid id PK
        uuid ambiente_id FK
        text brief_id UK
        brief_estado estado
        text pilar_slug FK
        text publico_slug FK
        numeric match_score
        boolean borderline
        text topic_hash
        text headline
        text caption_draft
        jsonb score_detalhe
        jsonb visual_brief
        smallint hero_indice
        timestamptz hero_decidido_em
        uuid scan_id FK
    }
    brief_candidata {
        uuid brief_id PK
        smallint indice PK
        text objeto_path
        text cloud_url
        boolean licensable
    }
    scan {
        uuid id PK
        text scan_ref UK
        text escopo
        text estado
        bigint vault_versao
    }
    evento {
        bigserial id PK
        timestamptz ts
        text tipo
        text ator
        uuid brief_id FK
        uuid scan_id FK
        jsonb extra
    }
    vault_bloco {
        uuid ambiente_id PK
        text slug PK
        text corpo
        smallint ordem
        text escopo
        text contrato
        bigint versao
    }
    vault_bloco_versao {
        bigserial id PK
        text slug FK
        bigint versao
        text corpo
        text motivo
    }
    pilar {
        uuid ambiente_id PK
        text slug PK
        text nome
        text corpo
        boolean no_radar
    }
    publico {
        uuid ambiente_id PK
        text slug PK
        text corpo
        boolean padrao
    }
    tema {
        text pilar_slug PK
        text codigo PK
        text categoria
        text titulo
        timestamptz esgotado_em
    }
    guardrail {
        uuid ambiente_id PK
        text slug PK
        text corpo
    }
    config {
        uuid ambiente_id PK
        jsonb pesos
        jsonb caps
        jsonb janelas
    }
    escopo_busca {
        uuid ambiente_id PK
        text slug PK
        boolean ativo
    }
    escopo_pilar {
        text escopo_slug PK
        text pilar_slug PK
    }
    fonte {
        text escopo_slug PK
        text slug PK
        text url
        text nota
    }
```

Três leituras que o diagrama torna visíveis:

- **`pilar` é o nó mais referenciado do sistema** — classifica brief, agrupa
  tema e é declarado por escopo de busca. É por isso que o slug dele ser
  imutável não é preciosismo: três caminhos apontam para lá.
- **`evento` recebe de brief, scan e usuário, e não devolve para ninguém.** É
  folha por natureza — append-only, com `ON DELETE SET NULL` para que apagar um
  brief não apague o registro de que ele existiu.
- **`escopo_pilar` é a única ponte entre o vault e a configuração.** À esquerda
  dela, entrada manual (fontes); à direita, vocabulário do vault (pilares).
