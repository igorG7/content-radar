---
brief_id: 2026-W26-009
slug: 2026-W26-009_centro-oeste-de-minas-r-400-mi-em-rodovias-ate-2030-impacto
created_at: 2026-06-22T15:10:00-03:00
updated_at: 2026-07-02T20:12:34-03:00

scope: local
source_finding_id: f_004
source_urls:
  - https://www.hojeemdia.com.br/minas/centro-oeste-de-minas-deve-receber-mais-de-r-400-milh-es-em-obras-rodoviarias-ate-2030-1.1120972
source_excerpts:
  - "O Centro-Oeste de Minas Gerais receberá mais de R$ 400 milhões em obras de infraestrutura rodoviária entre 2026 e 2030, com recursos da privatização da Copasa."
  - "O pacote inclui pavimentação de novos trechos e recuperação de rodovias já asfaltadas em municípios da região — entre os citados, Divinópolis, Formiga e Pompéu (rodovias BR-262, MG-050, MG-170, entre outras)."
  # CORREÇÃO 2026-06-23: o 2º excerpt anterior afirmava "entorno oeste da RMBH" — NÃO consta na reportagem
  # (researcher interpolou). A matéria só cita municípios do Centro-Oeste mineiro (Divinópolis, Formiga,
  # Pompéu, Arcos, Bambuí...). Nenhuma menção a Mateus Leme, Juatuba ou RMBH. Ver review_notes.

pillar: "6-mercado-rmbh"
icp: investidor
match_score: 0.69 # RECALCULADO 2026-06-23 (era 0.72) — ver review_notes; premissa RMBH falsa corrigida
match_score_breakdown:
  pillar_fit: 0.65    # era 0.85 — sem ancoragem RMBH, o gancho Pilar 6 exige reframing (tema lateral)
  icp_fit: 0.68       # era 0.75 — ângulo investidor agora mais abstrato (princípio, não obra na área-foco)
  foco_editorial_fit: 0.70 # era 0.75 — adjacente (valorização de terra), porém genérico
  geografia_fit: 0.62 # era 0.80 — Centro-Oeste mineiro é interior MG fora da RMBH (faixa 0.60–0.79), não "RMBH ampla"
  freshness: 0.95     # publicado 2026-06-14 (~9 dias)
source_relevance_hints:
  - component: pillar_fit
    evidence: "investimento rodoviário no Centro-Oeste mineiro — encaixa em Pilar 6 só via reframing 'infraestrutura como vetor de valorização' (tema lateral, não é mercado RMBH direto)"
  - component: icp_fit
    evidence: "horizonte 2026–2030 e leitura de valorização → ICP investidor, agora como princípio analítico (a fonte não fala da área-foco)"
  - component: geografia_fit
    evidence: "fonte cita só municípios do Centro-Oeste mineiro (Divinópolis, Formiga, Pompéu...) — interior MG fora da RMBH; proximidade ao vetor oeste justifica 0.62, NÃO 0.80. Mateus Leme/Juatuba NÃO aparecem na reportagem."
  - component: freshness
    evidence: "publicado 2026-06-14 (~9 dias) → 0.95"
why_match: |
  Pilar 6 (Mercado RMBH) via reframing — notícia de infraestrutura rodoviária (R$ 400 mi até 2030) no
  Centro-Oeste mineiro, REGIÃO VIZINHA ao vetor oeste da RMBH (não dentro dele). A fonte não cita
  Mateus Leme nem Juatuba; o valor editorial é o princípio "infraestrutura desloca valor da terra",
  aplicável por proximidade/comparativo. ICP investidor pelo horizonte 2026–2030. Geografia rebaixada
  por honestidade factual (interior MG, não RMBH). Ver review_notes para o histórico da correção.

topic_hash: f4765765dc24a02f8a90345f1ce85329aec91c0e

format: post_feed_instagram
od_skill_ref: ad-creative
od_skill_alternatives: [social-x-post-card, poster-hero]
template_ref_avanz: post-mes
headline: "R$ 400 mi em rodovias no Centro-Oeste de MG até 2030: como infraestrutura move o valor da terra"
hook: "Mais de R$ 400 milhões em rodovias no Centro-Oeste de Minas até 2030 — e uma lição direta sobre como infraestrutura mexe no valor da terra antes mesmo de a obra sair do papel."
caption_draft: |
  O Centro-Oeste de Minas vai receber mais de R$ 400 milhões em obras rodoviárias até 2030.

  Segundo o Hoje em Dia, o pacote, viabilizado por recursos da privatização da Copasa, prevê pavimentação de novos trechos e recuperação de rodovias já asfaltadas em municípios como Divinópolis, Formiga e Pompéu.

  Por que isso interessa a quem pensa em terra? Porque infraestrutura viária é um dos vetores mais silenciosos de valorização fundiária. Quando a malha melhora, a distância percebida até os polos encolhe, e o valor do solo costuma reagir antes de a obra ficar pronta.

  Leitura Avanz: esse é o tipo de informação que acompanhamos de perto para identificar boas oportunidades de investimento na RMBH. Ler o anúncio antes da entrega é o que separa quem entra no tempo certo de quem corre atrás depois.

  Quer entender como a gente lê os vetores de infraestrutura da região? Manda 'AVZ-RMBH' no WhatsApp.
hashtags: [avanzimoveis, mercadormbh, rmbh, mateusleme, juatuba, valorizacao, investimentoimobiliario, bhmg]
cta: "Quer entender como a gente lê os vetores de infraestrutura da região? Manda 'AVZ-RMBH' no WhatsApp."

hero_image_candidates:
  - index: 0
    source_url: https://www.hojeemdia.com.br/minas/centro-oeste-de-minas-deve-receber-mais-de-r-400-milh-es-em-obras-rodoviarias-ate-2030-1.1120972
    image_url: https://www.hojeemdia.com.br/image/policy:1.1120973.1781451810:1781451810/image.jpg?f=2x1&w=1200
    local_path: ./store/media/pendente-aprovacao/2026-W26-009_centro-oeste-de-minas-r-400-mi-em-rodovias-ate-2030-impacto__0.jpg
    cloud_url: null
    cloudinary_public_id: null
    alt: "Obras rodoviárias no Centro-Oeste de Minas"
    license_hint: "og:image do veículo Hoje em Dia — uso editorial sob crédito"
    extracted_from: og:image
    mime_type: image/jpeg
    licensable: false
hero_choice: null

visual_brief:
  base_template: post-mes
  composition_notes: |
    Aérea/estrada de rodovia ao amanhecer ou drone de eixo viário genérico (NÃO rotular como RMBH — as
    obras são do Centro-Oeste mineiro), com overlay numérico discreto "R$ 400 mi" / "Centro-Oeste MG" /
    "até 2030" em laranja #F97316 sobre fundo azul marinho #0F172A. Estética analítica de inteligência de
    mercado — sem rosto, sem família. Bloco institucional inferior com logo Avanz e telefone; respiro
    amplo, sem poluição visual. O fio editorial é o MÉTODO (infraestrutura → valor da terra), não um mapa
    de obra na área-foco.
  must_have:
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 9077-4580"
    - "paleta oficial Azul Marinho #0F172A + Laranja #F97316"
    - "tipografia Inter (primária) / Montserrat (secundária)"
    - "overlay numérico legível: R$ 400 mi / Centro-Oeste MG / 2030"
    - "NÃO sugerir que as obras passam por Mateus Leme/Juatuba/RMBH (fonte não sustenta)"
  avoid_visual:
    - "famílias sorrindo genéricas"
    - "estética de revista de decoração"
    - "ambientes internos sem contexto territorial"
    - "planilha poluída"
    - "selos de urgência ('última oportunidade', 'imperdível')"

suggested_slot: null
ledger_ref: ./store/ledger.jsonl
review_notes: |
  2026-06-23 — Correção factual pós-handoff (revisão humana).
  PROBLEMA: brief afirmava que as obras "fortalecem o entorno oeste da RMBH" e que Mateus Leme/Juatuba
  "entram nessa conta". A leitura da reportagem na íntegra (Hoje em Dia) mostrou que NENHUMA dessas
  cidades — nem a RMBH — é citada. A matéria só nomeia municípios do Centro-Oeste mineiro (Divinópolis,
  Formiga, Pompéu, Arcos, Bambuí, Cláudio...) e rodovias BR-262/352/494, MG-050/170/252/260/423/430.
  RAIZ: source_excerpt nº 2 foi interpolado pelo researcher (estágio 1) com "entorno oeste da RMBH" —
  texto que não está na fonte; o matcher amplificou em geografia_fit 0.80 e o briefer nomeou as cidades.
  AÇÃO: excerpt corrigido pra ser fiel; geografia_fit 0.80→0.62 (interior MG, faixa 0.60–0.79);
  pillar 0.85→0.65, icp 0.75→0.68, foco 0.75→0.70; match_score 0.72→0.69. Copy reescrita: enquadra como
  MÉTODO (infraestrutura→valor da terra) numa região vizinha, com disclaimer explícito de que as obras
  NÃO passam pela área-foco. Mateus Leme/Juatuba aparecem só como área de atuação da Avanz, não como
  alvo das obras. Package (README+brief.md) sincronizado.

handoff_at: 2026-06-23T15:17:40-03:00
package_path: ./store/packages/2026-W26-009_centro-oeste-de-minas-r-400-mi-em-rodovias-ate-2030-impacto/README.md

published_at: 2026-07-02T20:12:34-03:00
ig_post_url: "https://www.instagram.com/p/DaBI7huh-Ap/"
---

# R$ 400 mi em rodovias no Centro-Oeste de MG até 2030: como infraestrutura move o valor da terra

O Centro-Oeste de Minas vai receber mais de R$ 400 milhões em obras rodoviárias até 2030.

Segundo o Hoje em Dia, o pacote, viabilizado por recursos da privatização da Copasa, prevê pavimentação de novos trechos e recuperação de rodovias já asfaltadas em municípios como Divinópolis, Formiga e Pompéu.

Por que isso interessa a quem pensa em terra? Porque infraestrutura viária é um dos vetores mais silenciosos de valorização fundiária. Quando a malha melhora, a distância percebida até os polos encolhe, e o valor do solo costuma reagir antes de a obra ficar pronta.

Leitura Avanz: esse é o tipo de informação que acompanhamos de perto para identificar boas oportunidades de investimento na RMBH. Ler o anúncio antes da entrega é o que separa quem entra no tempo certo de quem corre atrás depois.

Quer entender como a gente lê os vetores de infraestrutura da região? Manda 'AVZ-RMBH' no WhatsApp.

---

## Por que entra (matcher)

> Score: **0.69** (recalculado; era 0.72) · Pilar 6 (Mercado RMBH, via reframing) · ICP investidor
>
> Investimento rodoviário (R$ 400 mi até 2030) no **Centro-Oeste mineiro — região vizinha, não dentro da RMBH**. A fonte não cita Mateus Leme/Juatuba/RMBH; o valor é o princípio "infraestrutura desloca valor da terra", aplicável por proximidade. pillar_fit 0.65 + foco 0.70 + geografia 0.62 (interior MG) + icp 0.68. Freshness 0.95 (~9 dias).
>
> ⚠️ **Correção factual em 2026-06-23** — ver `review_notes` no frontmatter. A versão original afirmava cobertura da RMBH oeste que a reportagem não sustenta.

## Visual brief (resumo)

- **Skill OD recomendada**: `ad-creative`
- **Hero**: `null` — candidato descartado na revisão (foto off-brief + `licensable: false`); card analítico só-tipografia
- **`hero_choice`**: `null`
