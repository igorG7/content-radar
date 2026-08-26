-- Um scan rodando por ambiente — justiça entre clientes (design-execucao-scan §4).
--
-- Índice único parcial em vez de trava na aplicação: com trava, o limite
-- depende de todo caminho de código lembrar de pegá-la, e um teste de
-- concorrência passa por acaso quando as chamadas serializam sozinhas. Aqui o
-- banco recusa a segunda inserção independentemente de tempo, ordem ou de quem
-- escreveu o código.

CREATE UNIQUE INDEX "scan_um_rodando_por_ambiente"
  ON "scan" ("ambiente_id")
  WHERE "estado" = 'rodando';
