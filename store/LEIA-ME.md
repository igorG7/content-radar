# Este diretório está congelado

**Desde 2026-08-20, a fonte da verdade é o Postgres.** O que está aqui é a
fotografia do store de arquivos no momento em que ele foi importado — briefs,
ledger, mídia e packages — e **não é mais atualizado por nada**.

O app não lê nem escreve daqui. Quem quiser o estado atual de um brief consulta
o banco (ou a interface); quem quiser saber o que aconteceu consulta a tabela
`evento`, não o `ledger.jsonl`.

## Por que continua no repositório

Porque a importação é verificável contra ele. O relatório de reconciliação
(`docs/design-migracao.md` §5) compara arquivo por arquivo com o que entrou no
banco, e apagar a origem tiraria a única forma de refazer essa conferência.

Depois de a ferramenta rodar em produção por um ciclo completo, esta pasta pode
sair — a decisão fica registrada aqui quando for tomada.

## O que mudou junto

As três skills determinísticas que mexiam nestes arquivos deixaram de existir:

| Antes | Agora |
| --- | --- |
| `radar-mv` | transição na interface (`aplicarTransicao`) |
| `radar-mark-published` | botão "Marcar publicado" (`marcarPublicado`) |
| `radar-handoff` | botão "Exportar", que baixa um `.md` (`exportar`) |

Elas eram código escrito em prosa: liam frontmatter, moviam arquivo, gravavam
evento. Mudança de estado com regra fixa não precisa de um modelo decidindo —
precisa de uma transação. `radar-scan`, que é o oposto disso, continua skill.
