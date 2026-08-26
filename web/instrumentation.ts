/**
 * Diz em que banco a app vai mexer, uma vez, quando o servidor sobe.
 *
 * Errar o `--env-file` não produz erro nenhum: a app sobe, responde 200, e
 * serve o banco errado. O Next carrega `.env.local` sozinho — inclusive em
 * produção —, então uma instalação de produção lançada sem a flag encosta em
 * desenvolvimento sem nada reclamar.
 *
 * Não dá para descobrir isso olhando o processo: o `--env-file` popula o
 * `process.env` de dentro, e não aparece em `/proc/<pid>/environ`. Nem sempre
 * dá para descobrir pelo Postgres, porque o pool é preguiçoso e pode não ter
 * conexão aberta. Uma linha no log resolve, e é lida no minuto em que alguém
 * desconfia.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[radar] de pé · sem DATABASE_URL: backend de arquivo");
    return;
  }

  // Só nome e papel. A URL inteira carrega a senha, e log é o lugar onde
  // segredo vaza sem ninguém decidir por isso.
  const alvo = new URL(url);
  console.log(
    `[radar] de pé · banco ${alvo.pathname.slice(1)} como ${alvo.username}` +
      ` · cadastro ${process.env.CADASTRO_ABERTO === "1" ? "ABERTO" : "fechado"}`,
  );
}
