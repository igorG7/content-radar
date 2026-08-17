# Desenho — execução do scan: executor, fila e concorrência

> **Status: desenho, nada implementado.** Quinto documento da série, ao lado de
> [`persistência`](./design-persistencia-multiusuario.md),
> [`vault`](./design-vault-onboarding.md),
> [`manifest`](./design-manifest-multiempresa.md) e
> [`migração`](./design-migracao.md).

## 1. Ponto de partida: o app não executa agente nenhum

Verificado em 2026-08-12:

- O **Agent SDK não está instalado** (`@anthropic-ai/claude-agent-sdk` ausente
  do `package.json`)
- Não há biblioteca de fila
- Não existe rota `/api/chat`
- `components/agent-chat.tsx` são 70 linhas de interface: guarda mensagens em
  estado local e não envia para lugar nenhum

Hoje o scan roda **no terminal**, com o operador invocando a skill pelo Claude
Code. Os 18 scans do ledger saíram todos daí.

Ou seja: esta frente não é "tornar concorrente algo que funciona" — é
**construir a execução**, e a concorrência é o segundo problema.

## 2. A restrição que define o desenho

Duração real dos 18 scans registrados no ledger:

| | Minutos |
|---|---|
| Mínimo | 12,2 |
| Mediana | **20,9** |
| Máximo | **63,1** |
| Total no período | 518 |

Quatro scans passaram de 35 minutos. **A variação é de 5×**, e a causa não foi
investigada.

Nada disso cabe num ciclo de requisição HTTP nem pode depender da aba do
navegador ficar aberta. O scan precisa rodar **fora do processo que atende
HTTP**, com estado próprio persistido — sem isso não há progresso na tela, nem
histórico, nem retomada após recarregar a página.

## 3. O que precisa existir

**Um executor.** Processo separado rodando o Agent SDK, que carrega skills e
subagentes a partir de um `cwd` (o workspace temporário — ver
[migração §5](./design-migracao.md)). É o que faz o `/chat` deixar de ser casca.

**Estado de execução persistido.** Ambiente, estágio (pesquisa → filtragem →
redação), início, e o que foi produzido. É o que alimenta o progresso na
interface e o histórico de execuções.

**Uma fila.** O Redis já roda no servidor, então o caminho é curto.

## 4. Concorrência: dois limites, não um

Requisito do owner: *"meu scan não pode depender do término do scan do João."*

Isso se resolve com **dois** limites, e a combinação é o que importa:

| Limite | Valor | Para quê |
|---|---|---|
| **Global de paralelismo** | a dimensionar (§5) | Protege infraestrutura e custo |
| **Por ambiente** | **1 scan simultâneo** | Justiça entre usuários |

O limite por ambiente é o que garante o requisito: sem ele, um usuário dispara
cinco scans, ocupa todas as vagas e os demais esperam. Com ele, cada pessoa
ocupa no máximo uma vaga, e os scans de pessoas diferentes rodam em paralelo.

O segundo disparo do mesmo ambiente é **recusado com mensagem** ("você já tem um
scan rodando"), não enfileirado em silêncio.

## 5. O que realmente limita o paralelismo

**Não é a máquina.** O trabalho é esperar API e rede — o processo fica ocioso a
maior parte dos 21 minutos. Uma máquina hospeda vários sem esforço.

**É o limite de taxa da chave de API.** Como a chave é compartilhada
([manifest §5](./design-manifest-multiempresa.md)), todos os ambientes consomem
do mesmo balde. Scans em paralelo multiplicam a vazão de tokens; passado certo
ponto, atrasam uns aos outros ou recebem erro de limite.

> **Não é dimensionável hoje.** Não existe telemetria de consumo — o ledger não
> registra tokens em lugar nenhum. Sem isso não dá para saber se o teto são 3
> scans simultâneos ou 15. A mesma instrumentação que a decisão de cobrança vai
> exigir resolve isso.

**Segundo limite, mais sutil:** o researcher faz busca e leitura de páginas.
Vários scans em paralelo batendo nas mesmas fontes podem disparar bloqueio
anti-bot — e o `manifest.yaml` já documenta fontes descartadas exatamente por
isso. Convém espaçar requisições por origem, não só limitar scans.

## 6. Deploy mata scan em andamento

Com execuções de 21 a 63 minutos, um `pm2 restart` durante um scan perde o
trabalho e deixa workspace órfão. **Com uso diário, isso acontece na primeira
semana** — não é hipótese remota.

Precisa de decisão explícita: drenar a fila antes de reiniciar (deploy espera os
scans em curso), ou aceitar a perda com limpeza automática do que ficou pela
metade. A política de run morto no meio já estava pendente na
[migração §5](./design-migracao.md); aqui ela ganha uma causa concreta e
frequente.

## 7. Consequências para a interface

Já refletidas no [prompt de front-end](./prompt-design-frontend.md) §4.2, mas
com dois acréscimos vindos desta conversa:

- Ao tentar disparar o segundo scan do mesmo ambiente, a tela **explica a
  recusa** em vez de falhar em silêncio.
- Havendo espera por vaga global, mostrar **posição na fila** — senão
  "iniciando" fica parado por minutos sem explicação.

## 8. Em aberto

- **Onde o executor roda** — mesma máquina do app (mais simples; workspace
  local) ou separado (exige vault e mídia trafegarem).
- **Valor do limite global**, que depende da instrumentação de consumo.
- **Política de deploy** (§6).
- **A cauda de 63 minutos** — quatro scans acima de 35 min. Investigar a causa
  pode valer mais que qualquer ajuste de fila: se for retry, timeout de fonte ou
  loop do agente, o ganho é maior que paralelizar.
