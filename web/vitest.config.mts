import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    alias: {
      // O código da app importa por `@/`, resolvido pelo tsconfig. O vitest não
      // lê `paths`, então sem isto qualquer módulo da app importado num teste
      // falha por pacote não encontrado.
      "@": new URL(".", import.meta.url).pathname.replace(/\/$/, ""),
      // `server-only` existe para o bundler recusar o módulo num componente de
      // cliente. Em teste não há bundler nem cliente — sem o atalho, o guarda
      // impediria testar justamente o código que ele protege.
      "server-only": new URL("./vitest.server-only.ts", import.meta.url)
        .pathname,
    },
  },
});
