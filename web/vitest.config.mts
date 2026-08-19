import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    alias: {
      // `server-only` existe para o bundler recusar o módulo num componente de
      // cliente. Em teste não há bundler nem cliente — sem o atalho, o guarda
      // impediria testar justamente o código que ele protege.
      "server-only": new URL("./vitest.server-only.ts", import.meta.url)
        .pathname,
    },
  },
});
