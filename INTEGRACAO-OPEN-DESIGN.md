# Integração com Open Design ("Smart Design")

Resumo operacional do sistema downstream do `content-radar`, levantado em
2026-05-27. Serve como referência rápida — a fonte normativa do escopo
continua sendo a spec `docs/specs/001-foundation.md` e o `CLAUDE.md` deste
projeto.

## 1. Identificação do app correto

- **Open Design** (alias interno "Smart Design") é o app que responde em
  `https://design.consultorivandias.com.br`.
- Path no host: `/srv/apps/open-design`
  - Clone de `github.com/nexu-io/open-design` (upstream) via fork
    `github.com/ProdHk/open-design` (origin).
  - Branch em produção: `prod/storage-web-server`.
- `/srv/apps/design-engine` é o **predecessor desativado** (2026-05-17). Não
  está rodando, não é repo git no host, e qualquer rota tipo
  `/api/polish-brief` ou `/api/generate/social-post` pertence a ele —
  **ignorar**.

## 2. Topologia em produção

```
Cloudflare Tunnel  ──►  127.0.0.1:8081  (nginx, Basic Auth)
                              │
                              ▼
                       127.0.0.1:5175  (Next.js UI — open-design-web)
                              │
                              ▼ (loopback, NÃO exposto)
                       127.0.0.1:7457  (daemon HTTP — open-design-daemon)
```

- pm2: `open-design-web` (Next.js) e `open-design-daemon` (Node).
- Definido em `/srv/apps/open-design/ecosystem.config.cjs`.
- Basic Auth: `/etc/nginx/.htpasswd_design`.
- CORS do daemon: `OD_ALLOWED_ORIGINS=https://design.consultorivandias.com.br`
  (só a UI oficial; chamadas de outras origens precisam ajuste).

## 3. Status do repositório (snapshot 2026-05-27)

- `git status -sb`: branch `prod/storage-web-server` em sincronia com
  `origin/prod/storage-web-server` (0 ahead / 0 behind).
- 3 arquivos não rastreados, todos backups locais (`.next.bak-pre-merge-*`,
  `*.upstream.bak`) — não são updates pendentes.
- `upstream` (`nexu-io/open-design`) configurado mas não foi fetched nesta
  verificação; pode haver novidades do projeto público.

## 4. Como integrar via `/api/chat` (modo agentic)

O daemon não expõe `polish-brief`/`social-post`. O caminho equivalente é
disparar uma run agentic dentro de um **projeto existente**.

### Endpoint

`POST http://127.0.0.1:7457/api/chat`  (loopback — ver §5)

### Body mínimo

```json
{
  "agentId": "<id do CLI agent disponível>",
  "message": "<prompt>",
  "projectId": "00da0d59-836a-432f-8d78-23aa75b44115"
}
```

Opcionais: `conversationId`, `skillId`, `designSystemId`, `model`,
`reasoning`, `attachments`.

### Comportamento (`apps/daemon/src/server.ts:7992-8089`)

1. Resolve `cwd` do projeto:
   - Se `metadata.baseDir` existir → usa esse path (projeto "git-linked").
   - Senão → `PROJECTS_DIR/<projectId>/` (pasta interna do daemon).
2. Lista arquivos atuais do projeto e injeta no prompt do agente um bloco
   `Your working directory: <cwd>` + lista de arquivos.
3. Spawn do CLI agent escolhido (`agentId`) com esse `cwd`.
4. Resposta é **SSE streaming**. Para reanexar: `GET /api/runs/:id/events`.
5. Status terminal via `GET /api/runs/:id` → `succeeded` | `failed` |
   `canceled`.

### Projeto Avanz já existente

| campo | valor |
|---|---|
| id | `00da0d59-836a-432f-8d78-23aa75b44115` |
| name | `Avanz Imoveis-final` |
| metadata.kind | `prototype` |
| metadata.importedFrom | `claude-design` |
| metadata.entryFile | `Avanz Brand Book v1.html` |
| metadata.sourceFileName | `Avanz Imoveis-final.zip` |
| baseDir? | **não** (foi importado de zip) |

Como **não** tem `baseDir`, o `cwd` cai na pasta interna do daemon, **não**
em `/srv/my-mind/Empresas/avanz-imoveis/`. Para o agente operar direto no
vault, seria preciso `PATCH /api/projects/:id` setando
`metadata.baseDir = "/srv/my-mind/Empresas/avanz-imoveis"` (ou outro path) —
decisão pendente.

## 5. Ressalvas para o content-radar

1. **Daemon não está exposto externamente.** Só loopback. Opções:
   - Content-radar rodar no mesmo host com acesso ao `:7457`.
   - Publicar o daemon via cloudflared+nginx com auth própria.
2. **Sem auth nativa no daemon.** Loopback é a proteção atual. Expor exige
   adicionar borda autenticada.
3. **Body é SSE.** Cliente precisa consumir `text/event-stream` e
   correlacionar por `runId`.
4. **Avanz está em modo "zip-importado".** Sem `baseDir`, o agente não vê o
   vault de estratégia/manifest. Endereçar antes de implementar o briefer.
5. **Conforme `CLAUDE.md` deste projeto**, o radar não chama API do Open
   Design no primeiro slice — gera só o package + URLs Cloudinary. Esta nota
   documenta o caminho de integração para slices futuros, não autoriza
   acoplamento no slice atual.
