# content-radar

Pipeline de pesquisa de mercado + match com perfil de empresa + briefing de
criativos para Instagram. Empresa-alvo configurada no
[`manifest.yaml`](./manifest.yaml).

**Status**: foundation completa (specs 001–005 + 007 escritas — todas as
peças do 1º slice; implementação 0%). Próxima sessão começa pela
[`HANDOFF.md`](./HANDOFF.md).

## Visão de 30 segundos

```
internet ── researcher ── matcher ── planner ── briefer ── store/briefs/pendente-aprovacao/*.md
                            │           │                        +  store/media/pendente-aprovacao/
                            │           └── store/calendar/      │
                            └── perfil empresa (vault)           ▼
                                                    revisão humana → mv pendente-publicacao/
                                                                            │
                                                                            ▼
                                                    skill radar-handoff:
                                                       • upload Cloudinary
                                                       • gera package em store/packages/<slug>/
                                                                            │
                                                                            ▼
                                                    humano abre Smart Design
                                                       (design.consultorivandias.com.br)
                                                       e gera o post
                                                                            │
                                                                            ▼
                                                    skill radar-mark-published →
                                                       mv → store/{briefs,media}/publicado/
                                                                            │
                                                                            ▼
                                                    anti-repetição (90d)
```

Implementação detalhada na **spec inicial**:
[`docs/specs/001-foundation.md`](./docs/specs/001-foundation.md).

## Empresa-alvo: Avanz Imóveis

Perfil estruturado em `/srv/my-mind/Empresas/avanz-imoveis/` — `content-radar`
lê `manifest.yaml`, `strategy/*`, `prompts/*` da empresa-alvo. Não duplica
conteúdo, só referencia.

Foco editorial declarado pela Avanz (manifest 2026-05-03):
- **Sim**: lotes, sítios, chácaras
- **Não**: casas prontas (exceto MCMV com simulação Caixa prévia)
- **Áreas**: RMBH (Mateus Leme, Esmeraldas, Juatuba)

## Sistema downstream: Open Design (Smart Design)

A entrega NÃO é o post final — é um **package** que alimenta o
**Open Design** (`/srv/apps/open-design`, rebrandado "Smart Design",
servindo `https://design.consultorivandias.com.br`).

> ⚠️ Open Design substituiu o `design-engine` v1.0 em 2026-05-17. Qualquer
> referência a "design-engine" neste projeto é histórica — todo handoff é
> pra Open Design.

Detalhes da integração: spec 001 §8.

## Mídia: Cloudinary

Fotos hero vão pra **Cloudinary** após aprovação (resposta §11.L da spec).
`store/media/` local é apenas cache (gitignored). Conta Cloudinary a definir
— ver §11.N pendente.

## Disparo

Sob demanda via comandos Claude Code (skills em `.claude/skills/`),
rodando com o `cwd` neste diretório — skills/agentes são descobertos só aqui.

## Specs

Ordem de leitura recomendada:

1. **[`HANDOFF.md`](./HANDOFF.md)** — start aqui. Estado atual, decisões
   resolvidas, próximas ações.
2. **[`INTEGRACAO-OPEN-DESIGN.md`](./INTEGRACAO-OPEN-DESIGN.md)** — auditoria
   do sistema downstream (Smart Design @ design.consultorivandias.com.br).
3. **[`docs/specs/001-foundation.md`](./docs/specs/001-foundation.md)** —
   arquitetura, lifecycle, contratos, decisões §11.A–N (O, P pendentes).
   _v0.5.0._
4. **[`docs/specs/002-researcher.md`](./docs/specs/002-researcher.md)** —
   subagente `market-researcher` (estágio 1: WebSearch+WebFetch).
   _v0.1.0._
5. **[`docs/specs/003-matcher.md`](./docs/specs/003-matcher.md)** —
   subagente `avanz-matcher` (estágio 2: score + filtragem). Resolve §11.I
   com `match_score_min: 0.55`. _v0.1.0._
6. **[`docs/specs/004-briefer.md`](./docs/specs/004-briefer.md)** —
   subagente `instagram-briefer` (estágio 4: síntese final). Formaliza
   JSON-schema do brief + matriz pilar→skill do Open Design. _v0.1.1._
7. **[`docs/specs/005-skill-scan.md`](./docs/specs/005-skill-scan.md)** —
   skills `radar-scan` (orquestrador do pipeline) e `radar-mv`
   (transição de estado + ledger). _v0.1.0._
8. **[`docs/specs/007-handoff.md`](./docs/specs/007-handoff.md)** —
   skill `radar-handoff` (upload Cloudinary signed + geração do package
   pro humano operar no Smart Design; inclui `--placeholder-mode` pra
   rodar sem credenciais). _v0.1.0._

Pendentes (próximas sessões): spec 006 (review), 008 (mark-published),
009 (housekeeping), 010 (skill custom no Open Design), 011 (planner),
012 (API direta).

## Histórico

[`CHANGELOG.md`](./CHANGELOG.md) — versionado por SemVer.
