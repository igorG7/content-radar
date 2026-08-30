---
brief_id: 2026-W34-032
slug: 2026-W34-032_360m-o-que-da-pra-fazer-nesse-tamanho-de-lote
created_at: 2026-08-18T17:20:00-03:00
updated_at: 2026-08-18T17:52:00-03:00

# Origem — NÃO vem de scan. Pauta pedida pelo humano na sessão de 2026-08-18.
scope: evergreen # ⚠️ fora do enum do manifest — mesma pendência de sistema do W26-016/W32-027
scan_id: null
source_finding_id: null
source_urls: []
source_excerpts: []
origin: content-bank
origin_refs:
  - "strategy/content-bank/pilar-1-imovel-da-semana.md#tema-3 — Frente x fundo: qual a profundidade ideal pra um projeto"
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-18 — Tamanho ideal do lote pra projeto de 2, 3 ou 4 quartos"
  - "strategy/content-pillars.md#pilar-1 — estrutura: código > localização > preço > 3 atributos > por que esse"

# Match com empresa-alvo (spec 003)
pillar: "1-imovel"
icp: comprador
borderline: false
match_score: null # pauta humana, sem finding pra pontuar
match_score_breakdown: null
source_relevance_hints: []
why_match: |
  Pilar 1 (Imóvel da semana) + ICP comprador. O comprador de primeiro lote não consegue
  converter metragem em projeto: 360 m² é um número abstrato até alguém desenhar o que
  cabe ali. O post faz essa tradução e ancora num lote real do estoque.

  O ângulo que separa isso de "render bonito de imobiliária" é a forma do lote: 360 m² em
  12 × 30 e 360 m² em 9 × 40 são a mesma área e projetos diferentes. Dizer isso é exatamente
  a tese do Pilar 1 no `content-pillars.md` — "mostrar o que está disponível, com curadoria.
  Não é feirão de lote" — e é o tipo de observação que só quem conhece o estoque faz.

topic_hash: 8e3c07a91d5b46f2ac8901e7b3d24f5068ca1e97

# Conteúdo proposto
format: post_feed_instagram # CARROSSEL de 5 cards — schema só tem este const (spec 004 §4.2)
carousel: true # campo informativo; NÃO está no schema — ver review_notes
od_skill_ref: poster-hero # Pilar 1 usa poster-hero (matriz spec 004 §5); peça é visual-first
template_ref_avanz: post-imovel
headline: "360 m² em Mateus Leme: o que dá pra fazer nesse tamanho de lote"
hook: "Metragem só vira decisão quando você consegue enxergar a casa dentro dela."
caption_draft: |
  Metragem só vira decisão quando você consegue enxergar a casa dentro dela.

  360 m² é um número que não diz muita coisa sozinho — porque o que decide o projeto não é só a área, é a forma. Dois lotes de 360 m² podem render casas bem diferentes, e é isso que quase ninguém olha no anúncio.

  Se o lote vier com frente larga, tipo 12 metros de frente por 30 de fundo, cabe com folga uma casa térrea de 3 quartos, com vaga coberta na frente e quintal nos fundos — e a construção ocupa cerca de um terço do terreno. Sobra espaço pra área gourmet depois, pra criança correr, pra segunda vaga quando o carro chegar.

  Se vier mais estreito e profundo, tipo 9 por 40, o mesmo 360 dá outro projeto: casa mais comprida, quintal longo em vez de largo, lazer bem separado da parte de dormir. Exige mais atenção com iluminação e ventilação no miolo da casa, e em compensação entrega privacidade que lote curto não dá.

  Nem melhor nem pior: diferente. É por isso que a gente não vende metragem, vende lote — dois terrenos com a mesma área podem servir a projetos completamente diferentes, e a hora de descobrir isso é antes de comprar, não no primeiro croqui com o arquiteto.

  Uma ressalva honesta: os desenhos acima são possibilidades, não projeto aprovado. Recuos, taxa de ocupação e área mínima construída mudam conforme o município e conforme o memorial do loteamento — a gente confere isso com você antes de você fechar qualquer coisa.

  Temos lotes de 360 m² disponíveis em Mateus Leme. Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente mostra as opções e o que dá pra construir em cada uma.
hashtags:
  [
    avanzimoveis,
    rmbh,
    lotesrmbh,
    lote360,
    construirdozero,
    primeiroimovel,
    mateusleme,
    imoveldasemana,
  ]
cta: "Temos lotes de 360 m² disponíveis em Mateus Leme. Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente mostra as opções e o que dá pra construir em cada uma."

hero_image_candidates: []
hero_choice: null # Pilar 1 pede foto — ver PENDÊNCIA no review_notes

# Ficha do produto âncora — dados do humano (sessão 2026-08-18).
# DESVIO CONSCIENTE da estrutura do Pilar 1 (content-pillars.md pede código + preço):
# o humano dispensou os dois. Sem eles a peça ancora em localização + metragem +
# disponibilidade. Registrado em review_notes.
produto_ancora:
  loteamento: "Estrela do Sul" # informado pelo humano; sem registro no vault nem no site
  municipio: "Mateus Leme"
  codigo_avz: null # dispensado pelo humano em 2026-08-18
  metragem: "360 m²"
  dimensoes: null # frente × fundo ainda não informados — por isso a peça mostra DOIS cenários
  preco_ou_entrada: null # dispensado pelo humano — não citar preço nem condição
  status: disponivel
  atributos_chave: [] # PENDENTE — 3 itens; enriquecem o card 5, não bloqueiam
  por_que_esse: null # PENDENTE — 1 frase

visual_brief:
  base_template: post-imovel
  aspect_ratio: "4:5" # 1080x1350
  format_note: "CARROSSEL de 5 cards (Pilar 1 pede 3–6). Sequência abaixo."
  composition_notes: |
    Carrossel de 5 cards em 4:5. Os cards 2 e 3 são o coração da peça: duas vistas de topo
    (plantas esquemáticas) do MESMO 360 m² em formatos diferentes — desenho limpo, tipo
    ilustração editorial, NÃO render fotorrealista de construtora e NÃO planta técnica com
    cotas. Os dois cards precisam ter EXATAMENTE a mesma linguagem gráfica e a mesma área
    visual aparente: é a comparação que carrega o argumento, e ela só funciona se o leitor
    sentir que é a mesma metragem nos dois. Fundo claro nos cards de desenho pra leitura da
    planta, azul marinho #0F172A nos cards de texto, laranja #F97316 marcando só a área
    construída. O carimbo "possibilidade, não projeto aprovado" vai nos DOIS cards de desenho.
  slides:
    - n: 1
      role: capa
      text: "360 m² em Mateus Leme: o que dá pra fazer nesse tamanho"
      note: |
        Subtítulo obrigatório, é a tese da peça: "a mesma área rende projetos diferentes —
        a forma do lote decide". Silhueta do lote em traço com a casa insinuada dentro.
        Metragem em Inter Bold, grande. Sem foto de fachada pronta — a peça é sobre imaginar.
    - n: 2
      role: cenario-frente-larga
      text: "Se vier com frente larga (12 × 30): casa térrea de 3 quartos, vaga coberta na frente, quintal nos fundos — cerca de um terço do lote construído."
      note: |
        Vista de topo esquemática: faixa da frente (vaga + jardim), volume da casa ao centro,
        quintal nos fundos. Laranja #F97316 só no volume construído.
        SEM cotas, SEM medida de recuo, SEM área construída em m².
        A dimensão aparece como HIPÓTESE ("se vier"), nunca como ficha do lote — as medidas
        reais do Estrela do Sul não foram informadas.
        Carimbo legível no próprio card: "possibilidade ilustrativa — não é projeto aprovado".
    - n: 3
      role: cenario-lote-profundo
      text: "Se vier estreito e profundo (9 × 40): casa mais comprida, quintal longo, lazer separado da parte de dormir."
      note: |
        MESMA linguagem gráfica do card 2, mesma área visual — muda só a proporção do retângulo
        e a implantação. Legenda curta com o trade-off honesto: "mais privacidade; exige atenção
        com luz e ventilação no miolo da casa".
        Mesmas proibições e mesmo carimbo do card 2.
    - n: 4
      role: o-que-confirmar
      text: "Recuos, taxa de ocupação e área mínima mudam por município e pelo memorial do loteamento."
      note: |
        Card sóbrio, texto curto. É o que protege a peça e, de quebra, posiciona a Avanz como quem
        confere isso pelo cliente. Fecha com "a gente confere antes de você fechar".
        NÃO transformar em letra miúda e NÃO fundir com os cards de desenho.
    - n: 5
      role: cta-produto
      text: "Temos lotes de 360 m² disponíveis em Mateus Leme."
      note: |
        Fundo laranja #F97316. WhatsApp (31) 9 9077-4580 + código 'AVZ-RMBH' legíveis. Logo Avanz.
        SEM preço e SEM condição de pagamento (dispensados pelo humano em 2026-08-18).
        SEM código AVZ (idem). Se os 3 atributos chave chegarem, entram aqui como bullets curtos.
        NÃO escrever "últimas unidades" nem nada que sugira escassez — "disponível" é o fato.
  must_have:
    - "carimbo 'possibilidade ilustrativa — não é projeto aprovado' legível NOS CARDS 2 E 3"
    - "cards 2 e 3 com a mesma linguagem gráfica e a mesma área visual aparente — muda só a proporção"
    - "as dimensões (12 × 30 / 9 × 40) apresentadas como hipótese ('se vier'), nunca como ficha do lote"
    - "laranja #F97316 marcando apenas a área construída nos cards 2 e 3"
    - "subtítulo da capa com a tese: a forma do lote decide o projeto"
    - "logo Avanz no primeiro e no último card"
    - "telefone (31) 9 9077-4580 no card 5"
    - "card 5 sem preço, sem condição de pagamento e sem código AVZ (dispensados pelo humano)"
    - "paleta oficial Avanz (#0F172A + #F97316 destaque)"
    - "tipografia Inter (títulos) / Montserrat (apoio)"
    - "proporção 4:5 consistente nos 5 cards"
  avoid_visual:
    - "render fotorrealista de casa pronta — a peça é esquemática, e render vira promessa de produto"
    - "planta técnica com cotas, medidas de recuo ou área construída em m²"
    - "citar recuo, taxa de ocupação ou coeficiente em número — não temos memorial nem plano diretor"
    - "piscina, adega, home theater ou qualquer item aspiracional que infle a expectativa do programa"
    - "'projeto aprovado', 'planta aprovada', 'obra pronta pra começar'"
    - "preço por m², valor do lote ou condição de pagamento — dispensados pelo humano em 2026-08-18"
    - "apresentar 12 × 30 ou 9 × 40 como se fossem as medidas reais do lote do Estrela do Sul"
    - "selo de urgência, 'últimas unidades', emoji de fogo"

suggested_slot:
  week: 2026-W35
  day: terça-feira
  rationale: "Pilar 1 tem slot terça e sábado (content-pillars.md). Depende da ficha do produto chegar — sem ela, não publica."
ledger_ref: ./store/ledger.jsonl
review_notes: |
  PAUTA HUMANA (sessão 2026-08-18). Sem scan; `match_score: null` e `scope: evergreen` fora do
  enum — mesma pendência de sistema do W26-016 / W32-027 / W34-031.

  DESVIO CONSCIENTE DA ESTRUTURA DO PILAR 1. `content-pillars.md` define a estrutura como
  "foto > código (AVZ-XXXX) > localização > preço > 3 atributos > 1 frase de por que esse".
  O humano dispensou **código e preço** em 2026-08-18. A peça ancora, então, em localização
  (Mateus Leme) + metragem (360 m²) + disponibilidade. Consequência: o post fica mais perto de
  um Pilar 1 institucional do que de "imóvel da semana" clássico — funciona, mas não gera a
  urgência de ficha. Se a intenção for converter direto, os 3 atributos chave e a frase de
  "por que esse" ainda cabem no card 5 e fariam diferença.

  DIMENSÕES NÃO INFORMADAS — VIRARAM O CONTEÚDO. O humano não tem frente × fundo dos lotes.
  Em vez de assumir 12 × 30 (que seria invenção), a peça mostra DOIS cenários — 12 × 30 e
  9 × 40 — sempre como hipótese ("se vier..."), nunca como ficha do lote. Isso resolveu o
  problema de fonte E deu o melhor argumento da peça: mesma área, projetos diferentes, a forma
  decide. É a tese do Pilar 1 ("curadoria, não feirão"). Quando as medidas reais chegarem, dá
  pra fazer a v2 com um cenário só, específico do Estrela do Sul.

  ENQUADRAMENTO: "possível visão de projeto" (decisão do humano, 2026-08-18) — aspiracional,
  não planta aprovada. Por isso: carimbo "possibilidade ilustrativa" nos DOIS cards de desenho;
  nada de cota, recuo em metros, taxa de ocupação ou área construída em m²; programa conservador
  (térrea 3 quartos, ~1/3 de ocupação) que é folgado em qualquer parâmetro urbano usual e não
  depende de norma municipal específica.

  PARÂMETROS DE MATEUS LEME — BUSCADOS, NÃO OBTIDOS (2026-08-18). O município tem Plano Diretor
  na LC 25/2006, com uso e ocupação do solo na LC 58/2014 (alterada pela LC 134/2025, que mexeu
  em perímetro urbano e parâmetros de expansão). Os valores numéricos de recuo, taxa de ocupação
  e permeabilidade estão nos ANEXOS dessas leis, que não abriram na busca. Por isso a peça segue
  sem citar número — o que já era a decisão. Fonte usada: `prefeitura-mateus-leme` /
  legislação municipal, dentro do `manifest.search_scopes.local`.
  O memorial descritivo do loteamento continua ausente (humano confirmou não ter) e costuma ser
  MAIS restritivo que a lei — é a razão de o card 4 existir.

  SÉRIE: estrutura desenhada pra reaproveitar por metragem (500, 1.000 m²) e por loteamento —
  trocam os cards 2/3 e a ficha do card 5. Marcar como template quando o primeiro sair.

  ANTI-REPETIÇÃO: nenhum brief do store trata de aproveitamento de metragem. O W26-021
  (publicado) fala de conferir metragem no IPTU — assunto diferente (divergência de área
  registrada), sem sobreposição.

  CARROSSEL FORA DO SCHEMA: mesmo caso do W34-031 — `format` é const `post_feed_instagram` e a
  sequência vive em `visual_brief.slides`. Formalizar exige editar a spec 004.

---

# 360 m²: o que dá pra fazer nesse tamanho de lote

Metragem só vira decisão quando você consegue enxergar a casa dentro dela.

360 m² é um número que não diz muita coisa sozinho. Então vamos desenhar: num lote de 12 metros de frente por 30 de fundo, cabe com folga uma casa térrea de 3 quartos, com vaga coberta na frente e quintal nos fundos — e a construção ocupa cerca de um terço do terreno. O resto é o que a maioria esquece de considerar na hora de comparar preço por metro quadrado: espaço para a área gourmet depois, para a criança correr, para a segunda vaga quando o carro chegar.

Agora o detalhe que muda tudo e quase ninguém olha no anúncio: a forma. Os mesmos 360 m² num lote de 9 metros de frente por 40 de fundo dão outro projeto — casa mais estreita e comprida, iluminação natural mais difícil no miolo, quintal longo em vez de largo. Nem melhor nem pior: diferente. Frente larga favorece casa horizontal e garagem dupla; lote profundo favorece quem quer separar bem a área de lazer da casa.

É por isso que a gente não vende metragem, vende lote. Dois terrenos com a mesma área e o mesmo preço podem servir a projetos completamente diferentes — e a hora de descobrir isso é antes de comprar, não no primeiro croqui com o arquiteto.

Uma ressalva honesta: o desenho acima é uma possibilidade, não projeto aprovado. Recuos, taxa de ocupação e área mínima construída mudam conforme o município e conforme o memorial do loteamento — a gente confere isso com você antes de você fechar qualquer coisa.

Quer ver os lotes que temos nessa metragem? Manda 'AVZ-RMBH' no WhatsApp (31) 9 9077-4580 que a gente mostra as opções e o que dá pra construir em cada uma.

---

## Por que entra (decisão humana, sem matcher)

> Pilar 1 (Imóvel da semana) · ICP comprador · `match_score: null` (não veio de scan)
>
> Pauta pedida pelo humano em 2026-08-18: mostrar uma possível visão de projeto e o quanto
> a metragem rende, com gancho para o estoque de 360 m² em Mateus Leme.

## Visual brief (resumo)

- **Skill OD recomendada**: `poster-hero` (Pilar 1, peça visual-first)
- **Formato**: **carrossel de 5 cards** em 4:5 (sequência em `visual_brief.slides`)
- **Hero**: sem foto → desenho esquemático gerado; Pilar 1 normalmente pede foto do lote
- **`hero_choice`**: `null`
- **Proibido na arte**: render fotorrealista, cotas/recuos em número, piscina e afins,
  "projeto aprovado", preço/condição, apresentar 12 × 30 ou 9 × 40 como medida real do lote
