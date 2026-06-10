# Coleta de conteúdo de concorrentes no Instagram — possibilidades

> Companion de [`competitor-ig-candidates.md`](./competitor-ig-candidates.md).
> Resumo das rotas para **ler o que os concorrentes postam** e fazer benchmark.
> Decisão de mecanismo ainda pendente. Data: 2026-06-04.

## O que dá e o que não dá (vale para QUALQUER rota)

O Instagram **não expõe publicamente** as métricas que de fato dizem "isso é bom":

- ✅ Dá pra obter: legenda, data, tipo (img/carrossel/vídeo), permalink, mídia,
  **likes e comentários** (números públicos), seguidores.
- ❌ Não dá pra obter de terceiros (nem por API, nem por scraping — não está no
  HTML público): **salvamentos, compartilhamentos, alcance, impressões,
  views de reel** e **Stories**. Saves/alcance são métricas privadas da conta.

→ Conclusão: likes+comentários são **proxy** de desempenho. Para "qualidade real"
(saves/alcance) não existe rota legal. O valor maior pro radar é **detectar
saturação de pauta** (anti-repetição) e **inspirar formato**, não copiar número.

## Rota A — Graph API da Meta (oficial) ✅ recomendada

Dois endpoints úteis:

- **Business Discovery** (por `@`): posts de feed + likes/comentários +
  seguidores de **contas Business/Creator públicas**.
- **Hashtag Search** (por tema, sem precisar do `@`): top/recent media de uma
  hashtag — bom pra sentir tendência regional. Cota: **~30 hashtags únicas / 7
  dias** por usuário.

| Aspecto | Avaliação |
|---|---|
| Cobertura | Feed dos concorrentes + engajamento público. Sem Stories/Reels-insights. |
| Restrição | Só contas **Business/Creator** (perfil pessoal retorna nada). |
| Setup | App Meta + conta Business da Avanz vinculada a uma Página + **App Review** (dias de burocracia). |
| Custo | Gratuito. |
| Risco jurídico / ToS | **Baixo** — é o canal oficial. |
| Manutenção | Baixa (API estável). |

## Rota B — Ferramenta paga (Apify, Phantombuster, Brand24, etc.)

Serviços que entregam dados de perfil/hashtag já prontos via dashboard ou API.

| Aspecto | Avaliação |
|---|---|
| Cobertura | Geralmente mais ampla que a Graph API (alcançam contas não-business, às vezes Reels/Stories públicos). |
| Setup | Baixo — plug-and-play. |
| Custo | Assinatura mensal (US$30–200+ conforme volume). |
| Risco jurídico / ToS | **Médio** — elas fazem a coleta e assumem parte do risco, mas o dado ainda vem de scraping; checar LGPD no contrato. |
| Manutenção | Baixa (elas absorvem quebras). |
| Observação | Bom se quiser velocidade e não tiver conta Business pronta. Continua sem saves/alcance reais. |

## Rota C — Piloto próprio com Playwright (scraping) ⚠️ desaconselhado em produção

Automação de browser lendo perfis públicos (MCP Playwright já disponível aqui).

| Aspecto | Avaliação |
|---|---|
| Cobertura | O que está na tela pública (feed, contadores). Sem saves/alcance. |
| Setup | Médio, mas **quebra com frequência** (mudança de DOM, login wall). |
| Custo | Tempo de manutenção alto. |
| Risco jurídico / ToS | **Alto** — viola ToS; risco de bloqueio de IP/conta; exposição LGPD. |
| Uso recomendado | Só **piloto pontual** para avaliar 1 perfil, nunca rotina de produção. |

## Recomendação

1. **Tendência de pauta** → Hashtag Search (Graph API). Não precisa dos `@`,
   pega o clima da região. Limitado pela cota de 30 hashtags/7 dias.
2. **Benchmark por concorrente** → Business Discovery (Graph API), depois de
   confirmar que os `@` aprovados são contas Business.
3. **Ferramenta paga** entra se a burocracia do App Review for empecilho ou se
   precisar de cobertura além de feed.
4. **Playwright** só como teste exploratório, ciente do risco — nunca como fonte
   recorrente do pipeline.

> Limitação que vale aceitar conscientemente: nenhuma rota entrega
> **salvamentos/alcance** de concorrente. O radar deve usar engajamento público
> como sinal aproximado, focando em **o que repete** (saturação) e **como é
> apresentado** (formato), não em métricas absolutas.
