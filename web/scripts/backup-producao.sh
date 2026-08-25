#!/usr/bin/env bash
#
# Backup do banco de produção, com conferência.
#
#   sudo -u postgres /srv/apps/content-radar/web/scripts/backup-producao.sh
#
# Precisa rodar como superusuário do Postgres, e isso não é conveniência: as
# tabelas têm FORCE ROW LEVEL SECURITY, que sujeita até o dono à política. Um
# pg_dump como radar_owner **falha** ou devolve zero linhas — e o arquivo fica
# lá, com tamanho plausível, sem nada dentro. Foi assim que a primeira migração
# criou 22 tabelas vazias achando que tinha copiado tudo.
#
# Por isso a conferência não é opcional aqui: o script conta as linhas dentro do
# dump e compara com o banco. Backup que ninguém confere é backup que não
# existe, e este tem um jeito específico de sair vazio em silêncio.
#
# No cron do root, diariamente às 3h:
#   0 3 * * * su postgres -c /srv/apps/content-radar/web/scripts/backup-producao.sh

set -euo pipefail

# O arquivo sai 600. Um dump deste banco carrega o conteúdo dos clientes e os
# hashes de senha; num servidor compartilhado, o padrão 644 o deixa legível por
# qualquer conta. É a diferença entre guardar e publicar.
umask 077

BANCO="${BANCO:-radar_prod}"
DESTINO="${DESTINO:-/srv/backups/content-radar}"
# Quantas cópias diárias manter. Trinta dias cobrem o tempo entre um estrago
# acontecer e alguém notar, que costuma ser mais longo que se imagina.
MANTER_DIAS="${MANTER_DIAS:-30}"

# As tabelas conferidas. Não são todas de propósito: estas têm volume e são as
# que doem se sumirem — brief é o trabalho, evento é a história.
declare -a CONFERIR=(brief evento consumo vault_bloco)

carimbo="$(date +%Y-%m-%d_%H%M%S)"
arquivo="${DESTINO}/${BANCO}_${carimbo}.sql.gz"

# O diretório é criado uma vez, por quem pode escrever em /srv — não por este
# script. Rodando como postgres, um `mkdir` ali falha, e "Permission denied" no
# meio de um cron às 3h da manhã é uma mensagem que ninguém vai ler.
if [ ! -w "$DESTINO" ]; then
  echo "[backup] não consigo escrever em ${DESTINO}." >&2
  echo "[backup] crie-o uma vez, com dono postgres:" >&2
  echo "" >&2
  echo "  sudo mkdir -p ${DESTINO}" >&2
  echo "  sudo chown postgres:postgres ${DESTINO}" >&2
  echo "" >&2
  echo "[backup] os outros backups do servidor são de root; este é de postgres" >&2
  echo "[backup] porque só o superusuário do Postgres enxerga o banco sob RLS." >&2
  exit 1
fi

echo "[backup] ${BANCO} → ${arquivo}"

# pipefail está no `set -e` acima, e aqui ele é o que importa: sem ele um
# pg_dump que falha passa despercebido porque o gzip termina bem.
pg_dump "$BANCO" | gzip -c > "$arquivo"

# ── conferência ────────────────────────────────────────────────────────────
#
# Conta as linhas de cada COPY dentro do dump e compara com o banco vivo. É
# mais chato que checar o tamanho do arquivo, e é a diferença entre saber que
# há bytes e saber que há dados.

falhou=0
for tabela in "${CONFERIR[@]}"; do
  no_banco="$(psql -d "$BANCO" -tAc "select count(*) from \"${tabela}\"")"

  no_dump="$(
    gzip -dc "$arquivo" | awk -v t="public.${tabela}" '
      $0 ~ "^COPY " t " " { dentro = 1; next }
      dentro && $0 == "\\." { dentro = 0; next }
      dentro { n++ }
      END { print n + 0 }
    '
  )"

  if [ "$no_banco" = "$no_dump" ]; then
    printf '  ok  %-12s %s linhas\n' "$tabela" "$no_banco"
  else
    printf '  DIF %-12s banco %s, dump %s\n' "$tabela" "$no_banco" "$no_dump"
    falhou=1
  fi
done

if [ "$falhou" = "1" ]; then
  # O arquivo ruim fica, com outro nome: apagá-lo esconderia a evidência de por
  # que o backup falhou, e é justamente isso que se quer olhar depois.
  mv "$arquivo" "${arquivo}.SUSPEITO"
  echo "[backup] FALHOU — o dump não bate com o banco." >&2
  echo "[backup] guardado como ${arquivo}.SUSPEITO para diagnóstico." >&2
  echo "[backup] causa provável: rodou sem superusuário e o RLS filtrou tudo." >&2
  exit 1
fi

# ── rotação ────────────────────────────────────────────────────────────────
#
# Só depois de conferir. Apagar o antigo antes de saber que o novo presta é
# como trocar a única cópia por uma que ninguém olhou.
apagados="$(find "$DESTINO" -name "${BANCO}_*.sql.gz" -type f -mtime "+${MANTER_DIAS}" -print -delete | wc -l)"

# Reforça o modo mesmo se o umask do ambiente tiver sido afrouxado por fora.
chmod 600 "$arquivo"

echo "[backup] ok · $(du -h "$arquivo" | cut -f1) · modo $(stat -c %a "$arquivo") · ${apagados} cópia(s) antiga(s) removida(s)"
