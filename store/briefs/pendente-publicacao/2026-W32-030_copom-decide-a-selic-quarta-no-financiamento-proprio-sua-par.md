---
brief_id: 2026-W32-030
slug: 2026-W32-030_copom-decide-a-selic-quarta-no-financiamento-proprio-sua-par
created_at: 2026-08-03T11:20:00-03:00
updated_at: 2026-08-03T17:48:34+00:00

# Origem — pauta pedida pelo humano em 2026-08-03. NÃO veio de radar-scan,
# mas TEM fonte externa verificada (diferente dos W32-025..029).
# ⚠️ REESCRITO em 2026-08-03 por direção humana — ver review_notes.
scope: trends
scan_id: null
source_finding_id: null
source_urls:
  - "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/5?formato=json" # primária canônica — SGS/BCB série 432 (Selic meta)
  - "https://agenciabrasil.ebc.com.br/economia/noticia/2026-08/copom-inicia-nesta-terca-reuniao-para-definir-taxa-basica-de-juros"
source_excerpts:
  - "A Selic está em 14,25% ao ano – menor nível de 2026"
  - "O Copom inicia nesta terça-feira (4) a quinta reunião de 2026"
  - "A decisão sobre a Taxa Selic será anunciada na noite de quarta-feira (5)"
  - "após três reduções consecutivas de 0,25 ponto percentual promovidas pelo Copom nas reuniões de março, abril e junho"
origin: user-request
origin_refs:
  - "strategy/positioning.md#diferenciais-competitivos — Financiamento próprio (sem burocracia bancária)"
  - "strategy/positioning.md#posicionamento — Acessibilidade: entrada facilitada + financiamento próprio"
  - "playbooks/objections.md#2.3 — Banco não me aprova. Vocês vão me aprovar mesmo?"
  - "playbooks/objections.md#2.5 — As parcelas têm correção? Vai virar uma bola de neve?"
  - "playbooks/objections.md#5.2 — Vou esperar mais um pouco / não é o momento"
  - "strategy/content-bank/pilar-2-decisao-inteligente.md#tema-6 — Financiamento próprio vs banco"

# Match com empresa-alvo (spec 003)
pillar: "2-decisao"
icp: comprador
borderline: false
match_score: null # pauta dirigida pelo humano; matcher não rodou
match_score_breakdown: null
source_relevance_hints:
  - "Macro nacional REANCORÁVEL (manifest.anti_repetition.geografia_reframe_floor): Selic é gancho de financiamento, categoria explicitamente listada como reancorável pra RMBH."
why_match: |
  Pilar 2 (Decisão Inteligente) + ICP comprador. Selic é macro nacional, mas cai na
  categoria REANCORÁVEL do manifest (`geografia_reframe_floor: 0.50` — "financiamento,
  índices SBPE/CBIC, MCMV/Caixa").

  O gancho é o diferencial competitivo nº 1 do posicionamento da Avanz: financiamento
  próprio, sem burocracia bancária (positioning.md §Diferenciais). A semana do Copom é o
  momento de maior atenção do ano pra esse diferencial — o país inteiro está discutindo
  juros, e a Avanz entra dizendo que tem um caminho que não passa por essa taxa.

  Ataca de frente duas objeções mapeadas no playbook: a 5.2 ("vou esperar mais um pouco",
  cuja preocupação real é justamente expectativa de queda de juros/preço) e a 2.3 ("banco
  não me aprova"), que é o ICP "Sem-banco" do positioning. E respeita a 2.5 admitindo
  abertamente que existe correção por índice — o post não vende parcela imune a reajuste.

topic_hash: d1b8d4bc8e75e2d7f4cecb66965d4ae2995a12ca

# Conteúdo proposto
format: post_feed_instagram
od_skill_ref: ad-creative
template_ref_avanz: post-mes
headline: "Copom decide a Selic quarta. No financiamento próprio, sua parcela não depende disso"
hook: "O país inteiro vai olhar pra decisão do Copom nesta quarta. Tem um caminho pra comprar lote que não passa por ela."
caption_draft: |
  O país inteiro vai olhar pra decisão do Copom nesta quarta. Tem um caminho pra comprar lote que não passa por ela.

  O Copom se reúne dia 4 e 5 e anuncia a decisão na noite de quarta. A Selic está em 14,25% ao ano, o menor nível de 2026, depois de três cortes seguidos de 0,25 ponto em março, abril e junho. Suba, caia ou fique parada: essa taxa é o preço do dinheiro no banco.

  E é por isso que ela decide muita coisa pra quem depende de crédito bancário — e quase nada pra quem compra com financiamento próprio. Na Avanz o parcelamento é direto com a gente. Não passa por aprovação de banco, não depende de score automático e a parcela não é calculada a partir da Selic. Quem já ouviu "não" do banco começa a conversa aqui do zero.

  Sendo transparente, porque a gente sempre fala isso aberto: tem correção, sim. O índice está escrito no contrato, geralmente IGPM ou INCC conforme o empreendimento. Não é juro composto de banco — é correção de valor. E a gente mostra a simulação em cenários antes de você assinar, inclusive o pior deles.

  Então a pergunta não é o que o Copom vai decidir na quarta. É se a parcela cabe no seu mês. Essa resposta não muda com a reunião — e você pode ter ela hoje.

  Quer sua simulação sem depender da decisão de quarta? Manda 'AVZ-RMBH' no WhatsApp (31) 9 7137-5793.
hashtags:
  [
    avanzimoveis,
    rmbh,
    financiamentoproprio,
    parcelamentodireto,
    lotesrmbh,
    mateusleme,
    selic,
  ]
cta: "Quer sua simulação sem depender da decisão de quarta? Manda 'AVZ-RMBH' no WhatsApp (31) 9 7137-5793."

hero_image_candidates: []
hero_choice: null

visual_brief:
  base_template: post-mes
  aspect_ratio: "3:4" # ⚠️ override humano — 1080x1440. Spec 007 §6 assume 1:1; ver review_notes
  composition_notes: |
    Card de contraste em 3:4 VERTICAL (1080x1440), dois blocos empilhados — a proporção
    vertical pede leitura de cima pra baixo, não lado a lado.

    Bloco de cima, "Crédito bancário": a Selic em número grande e sóbrio (14,25% a.a.) com
    a marcação "Copom decide 05/08" — o lado que depende da reunião. Bloco de baixo,
    "Financiamento próprio Avanz": sem taxa nenhuma, três linhas curtas — "direto com a
    Avanz", "sem análise de score do banco", "parcela não sai da Selic". A assimetria é a
    mensagem: o bloco de cima tem um número que muda quarta, o de baixo não tem número
    dependendo dela. Uma divisória horizontal clara separa os dois.

    Headline no topo. Acima do rodapé, a nota de transparência em corpo menor mas legível:
    "tem correção por índice de contrato (IGPM/INCC) — mostramos a simulação antes".
    Paleta oficial, laranja só no bloco de baixo. Use a altura extra do 3:4 pra respiro
    entre os blocos, não pra adicionar elemento novo.
  must_have:
    - "proporção 3:4 vertical (1080x1440) — NÃO entregar em 1:1"
    - "logo Avanz canto inferior direito"
    - "telefone (31) 9 7137-5793"
    - "os dois lados nomeados: crédito bancário vs financiamento próprio Avanz"
    - "Selic 14,25% a.a. + data da decisão (05/08/2026) SOMENTE no lado do banco"
    - "nota de transparência sobre correção por índice, legível (não em letra miúda)"
    - "paleta oficial Avanz (#0F172A + #F97316 destaque)"
    - "tipografia Inter/Montserrat"
  avoid_visual:
    - "QUALQUER previsão do resultado da reunião (Selic nova, seta de corte)"
    - "número de parcela, entrada, prazo ou taxa do financiamento próprio da Avanz"
    - "sugerir parcela fixa / imune a reajuste (contradiz a nota de transparência)"
    - "logo ou nome de banco / Banco Central / brasão oficial"
    - "'aprovação garantida', 'todo mundo aprovado', 'sem consulta ao SPC'"
    - "seta de gráfico estilo mercado financeiro / day trade"
    - "selos de urgência ('corre', 'última chance', 'aproveite os juros')"

suggested_slot:
  week: 2026-W32
  day: quinta-feira
  rationale: |
    Quinta 06/08 — DEPOIS da decisão (anunciada na noite de 05/08). Publicar antes seria
    apostar no resultado. Alternativa defensável: publicar na quarta 05/08 de manhã, ANTES
    do anúncio, porque a tese ("não depende do resultado") funciona melhor como véspera —
    mas aí o parágrafo 2 precisa perder o "está em 14,25%" ou ganhar "até hoje".
    Prazo de validade curto: se passar de 08/08, reescrever.
ledger_ref: ./store/ledger.jsonl
review_notes: |
  PAUTA PEDIDA PELO HUMANO em 2026-08-03. Tem fonte externa verificada, mas não passou
  por researcher nem matcher — por isso `match_score: null`.

  ⚠️ DOIS OVERRIDES HUMANOS EXPLÍCITOS (2026-08-03, no ato da aprovação):

  1. PROPORÇÃO 3:4 (1080x1440), não 1:1. O campo `visual_brief.aspect_ratio` foi criado
     aqui — NÃO existe no schema da spec 004 e a spec 007 §6 gera o README do package com
     "(1:1)" hardcoded no prompt pro Open Design. O README deste package foi corrigido à
     mão depois do handoff. GAP DE SISTEMA: se 3:4 virar padrão ou opção recorrente,
     `aspect_ratio` precisa entrar no schema da 004 e o template da 007 §6 precisa ler o
     campo em vez de hardcodar 1:1.

  2. TELEFONE SECUNDÁRIO. A peça usa (31) 9 7137-5793 —
     `manifest.target_company.brand_facts.phone_secondary_e164` (+5531971375793) — e NÃO o
     `phone_display` padrão (31) 9 9077-4580. Contraria a regra "telefone vem do manifest
     (brand_facts.phone_display); nunca hardcode" do agente instagram-briefer, por decisão
     humana explícita pra esta peça. É override pontual: os outros briefs W32 seguem com o
     número principal. Se o secundário virar o canal de campanha, atualizar o manifest.

  ⚠️ REESCRITO EM 2026-08-03 (human-directed), mesmo dia da criação. A 1ª versão
  ("Copom decide a Selic nesta quarta. O que muda (e o que não muda) no seu financiamento",
  topic_hash 77fad4ee) era puramente educativa: explicava que SBPE, MCMV e parcelamento
  direto não seguem a Selic ponto a ponto, e terminava em "faça a simulação". Fechava sem
  gancho comercial. O humano redirecionou: o post deve ANUNCIAR a reunião e usar o
  financiamento próprio da Avanz como a resposta — diferencial que independe da taxa.
  Headline, hook, caption, visual_brief e topic_hash foram refeitos.

  ⚠️ AÇÃO OBRIGATÓRIA ANTES DE PUBLICAR — RECONFERIR O NÚMERO. Escrito em 03/08, ANTES da
  decisão. A caption afirma Selic em 14,25% no presente. Se cortarem na noite de 05/08,
  ajustar pra "o Copom decidiu X" ou pro passado ("estava em 14,25% até a reunião"). A
  tese do post sobrevive a qualquer resultado — foi escrita assim de propósito, e agora
  mais ainda: o gancho é justamente que o resultado não importa pro cliente da Avanz.

  ⚠️ TRANSPARÊNCIA RADICAL — PARÁGRAFO 4 NÃO PODE SAIR. O playbook de objeções 2.5
  ("as parcelas têm correção?") manda a Avanz dizer aberto que existe correção por índice
  (IGPM ou INCC conforme o empreendimento), e o princípio de resposta nº 2 do mesmo
  playbook é "transparência radical — admitir quando algo é desvantagem". Sem esse
  parágrafo, o post afirma na prática que a parcela é imune a reajuste, o que é falso e
  contradiz o script que a própria equipe usa no WhatsApp. O gancho honesto é
  "não depende da SELIC", não "não tem reajuste". A nota também tem que aparecer na arte,
  legível — não em letra miúda de rodapé.

  GUARDRAIL "não prometer aprovação garantida" (ops/guardrails.md + objeção 2.3) — checado.
  A copy diz que quem ouviu "não" do banco "começa a conversa aqui do zero", que é
  factual, e NÃO diz que será aprovado. A arte está proibida de sugerir aprovação certa.

  VERIFICAÇÃO DE FONTE (03/08/2026):
    - Selic meta 14,25% em 03/08/2026 conferida na SÉRIE PRIMÁRIA do BCB (SGS 432, via
      api.bcb.gov.br). Não é repasse de jornal.
    - Datas da reunião (4 e 5/08, 5ª reunião de 2026, decisão na noite de quarta) e os três
      cortes de 0,25 pp em março/abril/junho vêm da Agência Brasil, publicada em 03/08 11:46.
    - bcb.gov.br/controleinflacao/taxaselic devolveu página sem conteúdo (renderizada por
      JS). A API do SGS resolveu.
    - "Financiamento próprio" é termo canônico da Avanz, não invenção: positioning.md
      §Identidade, §Posicionamento e §Diferenciais competitivos ("sem burocracia bancária").

  ⚠️ FONTE FORA DO MANIFEST: `api.bcb.gov.br` e `agenciabrasil.ebc.com.br` NÃO estão em
  `manifest.search_scopes.trends.sources`. Foram usadas porque o humano pediu a pauta
  explicitamente. RECOMENDAÇÃO: adicionar `bcb-sgs` ao scope `trends` do manifest.

  LIMITE DURO — NENHUM NÚMERO DA OFERTA. Nenhuma taxa, entrada, prazo ou valor de parcela
  do financiamento próprio aparece na copy ou na arte. O radar não tem as condições reais
  da Avanz. Os únicos números da peça são a Selic (14,25%) e a data da reunião.

  NÃO PREVÊ O RESULTADO. A caption não diz se vai cortar ou manter, e a arte está
  proibida de sugerir.

  ANTI-REPETIÇÃO: o W32-026 (pendente-aprovacao, slot W34) compara consórcio ×
  financiamento × parcelamento direto por custo. Aqui o parcelamento direto aparece como
  resposta ao Copom, com recorte comercial. Recortes diferentes, mas NÃO publicar os dois
  na mesma quinzena — se este for bem, vale adiar o 026.
handoff_at: 2026-08-03T17:48:34+00:00
package_path: ./store/packages/2026-W32-030_copom-decide-a-selic-quarta-no-financiamento-proprio-sua-par/README.md
handoff_mode: no-hero    # sem foto (hero_image_candidates: []); Cloudinary nao acionado

---

# Copom decide a Selic quarta. No financiamento próprio, sua parcela não depende disso

O país inteiro vai olhar pra decisão do Copom nesta quarta. Tem um caminho pra comprar lote que não passa por ela.

O Copom se reúne dia 4 e 5 e anuncia a decisão na noite de quarta. A Selic está em 14,25% ao ano, o menor nível de 2026, depois de três cortes seguidos de 0,25 ponto em março, abril e junho. Suba, caia ou fique parada: essa taxa é o preço do dinheiro no banco.

E é por isso que ela decide muita coisa pra quem depende de crédito bancário — e quase nada pra quem compra com financiamento próprio. Na Avanz o parcelamento é direto com a gente. Não passa por aprovação de banco, não depende de score automático e a parcela não é calculada a partir da Selic. Quem já ouviu "não" do banco começa a conversa aqui do zero.

Sendo transparente, porque a gente sempre fala isso aberto: tem correção, sim. O índice está escrito no contrato, geralmente IGPM ou INCC conforme o empreendimento. Não é juro composto de banco — é correção de valor. E a gente mostra a simulação em cenários antes de você assinar, inclusive o pior deles.

Então a pergunta não é o que o Copom vai decidir na quarta. É se a parcela cabe no seu mês. Essa resposta não muda com a reunião — e você pode ter ela hoje.

Quer sua simulação sem depender da decisão de quarta? Manda 'AVZ-RMBH' no WhatsApp (31) 9 7137-5793.

---

## Por que entra (decisão humana, sem matcher)

> Pilar 2 (Decisão Inteligente) · ICP comprador · `scope: trends` · `match_score: null`
>
> Pauta pedida pelo humano em 2026-08-03 e **reescrita no mesmo dia** por direção humana:
> a peça anuncia a reunião e usa o **financiamento próprio** (diferencial competitivo nº 1
> do positioning) como a resposta que independe da taxa. Selic 14,25% conferida na série
> primária do BCB (SGS 432).

## ⚠️ Antes de publicar

1. **Reconferir a Selic** — o brief foi escrito antes da decisão de 05/08. A tese sobrevive
   a qualquer resultado; o número não.
2. **O parágrafo da correção não pode sair.** Objeção 2.5 do playbook + princípio de
   transparência radical. O gancho é "não depende da Selic", nunca "não tem reajuste".

## Visual brief (resumo)

- **Skill OD recomendada**: `ad-creative`
- **Hero**: sem foto → arte gerada (card de contraste: banco com Selic × financiamento próprio sem taxa)
- **`hero_choice`**: `null`
- **Proibido na arte**: previsão do resultado, número da oferta Avanz, sugerir parcela sem reajuste, "aprovação garantida"
