# content-radar — instruções de sessão

Este arquivo é carregado automaticamente pelo Claude Code quando o cwd está
dentro de `/srv/apps/content-radar/`. Skills e subagentes em `.claude/` são
descobertos apenas neste ambiente.

## Escopo

`content-radar` faz pipeline de **pesquisa → match → planejamento → briefing**
para gerar pautas de Instagram para a empresa-alvo configurada no
[`manifest.yaml`](./manifest.yaml) (atualmente: **Avanz Imóveis**).

A entrega NÃO é o post final — é um **package** que alimenta o
**Open Design** (rebrandado "Smart Design", `https://design.consultorivandias.com.br`).

## Sistema downstream — Open Design (não confundir!)

- **Open Design** = `/srv/apps/open-design` + `design.consultorivandias.com.br`
  → este é o sistema vivo, com auth Basic Auth via nginx, arquitetura
  skill-based + design-loop.
- **design-engine** = `/srv/apps/design-engine` → predecessor desativado em
  2026-05-17. Existe ainda no FS mas **NÃO usar**. Qualquer menção a
  endpoints como `/api/polish-brief` ou `/api/generate/social-post` é do
  sistema VELHO — ignorar.

## Antes de qualquer trabalho relevante

1. Ler a spec atual: [`docs/specs/001-foundation.md`](./docs/specs/001-foundation.md)
2. Ler `manifest.yaml` deste projeto
3. Ler `INTEGRACAO-OPEN-DESIGN.md` se for tocar a integração com o sistema
   downstream (Open Design / Smart Design)
4. Ler o `manifest.yaml` da empresa-alvo (`target_company.manifest`)
5. Respeitar o **foco editorial declarado** pela Avanz: lotes, sítios,
   chácaras na RMBH; casas prontas **só** MCMV com simulação Caixa prévia.

## Princípios

- **Não inventar**: se a fonte não está em `manifest.search_scopes.*.sources`
  ou em uma lista explícita do usuário, perguntar antes de buscar.
- **Não publicar**: o radar não publica em rede social nem chama API do
  Open Design diretamente no primeiro slice — só gera package e Cloudinary
  URLs. Publicação no IG é manual.
- **Anti-repetição**: antes de propor uma pauta, checar `store/briefs/**`
  (todos os 4 diretórios) por pauta equivalente nos últimos 30–90 dias
  (regra detalhada na spec §5).
- **Stories vs feed**: o radar só gera briefs de **feed**. Pilar 4 (Bastidor)
  está fora do escopo do radar — vive nos stories e é decisão humana ad-hoc.
- **Pautas redundantes** (mesmo pilar+ICP recentes): **pular** silenciosamente,
  não gerar brief (resposta §11.J).

## Mídia

- Local `store/media/` é cache (gitignored).
- Cloudinary é fonte da verdade após `radar-handoff`.
- Conta Cloudinary ainda a definir (§11.N pendente).

## Idioma

- Conversação e arquivos do projeto: português brasileiro.
- Código: identificadores e comentários em inglês.
- Commits (se for criar repo): Conventional Commits em inglês.

## Não cobertos pelo agente local (consulte agentes globais)

- Alterações em `/srv/`, `systemctl`, `apt`, firewall → siga regras do
  `/etc/claude-code/CLAUDE.md` global e use o agente `manager` se aplicável.
- Deploy do próprio content-radar → ainda não definido (ver pendência na spec).
