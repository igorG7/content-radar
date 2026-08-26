-- Os privilégios da aplicação passam a viver num grupo, não num papel de login.
--
-- Até aqui as migrações revogavam pelo nome (`REVOKE ... FROM radar_app`), e o
-- `ALTER DEFAULT PRIVILEGES` concedia ao mesmo nome. Isso amarrava a garantia de
-- append-only a um papel específico: um segundo papel de aplicação — produção
-- com credencial própria — nasceria com UPDATE e DELETE em `evento` e `consumo`,
-- e nada avisaria. O ledger continuaria gravando; só deixaria de valer como
-- registro, que é a única coisa que ele é.
--
-- Com o grupo, a regra vale para quem for membro, hoje e depois. Papel novo de
-- aplicação = mais um `GRANT radar_apps TO ...`, e ele herda tanto o que pode
-- quanto o que não pode.

-- Criar papel exige superusuário, e migração roda como dono. Falhar aqui, com
-- texto, é melhor do que falhar oito linhas abaixo com "role does not exist".
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'radar_apps') THEN
    RAISE EXCEPTION 'o grupo radar_apps não existe. Crie-o como superusuário antes de migrar — scripts/papeis-de-producao.mts imprime o SQL.';
  END IF;
END $$;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO radar_apps;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO radar_apps;--> statement-breakpoint
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO radar_apps;--> statement-breakpoint

-- As mesmas duas de sempre, agora no grupo.
REVOKE UPDATE, DELETE ON TABLE "evento" FROM radar_apps;--> statement-breakpoint
REVOKE UPDATE, DELETE ON TABLE "consumo" FROM radar_apps;--> statement-breakpoint

-- Sem isto o resto não serve para nada: privilégio concedido direto no papel
-- sobrevive a um REVOKE feito no grupo. `radar_app` continuaria podendo apagar
-- evento por um caminho que ninguém está mais olhando.
-- Guardado por existência: numa instalação nova — a VPS de produção — o papel
-- de desenvolvimento não existe, e citá-lo cruamente aborta a migração em
-- `role does not exist`. Onde ele existe, o REVOKE continua sendo o que faz o
-- resto valer.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'radar_app') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM radar_app';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM radar_app';
  END IF;
END $$;--> statement-breakpoint

-- E as tabelas que ainda não existem. O default privileges anterior apontava
-- para `radar_app`; mantê-lo faria cada migração futura reabrir o buraco que
-- as linhas acima acabaram de fechar.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'radar_app') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM radar_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM radar_app';
  END IF;
END $$;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO radar_apps;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO radar_apps;
