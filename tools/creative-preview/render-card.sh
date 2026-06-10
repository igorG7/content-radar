#!/usr/bin/env bash
# render-card.sh — renderiza um preview de criativo de DADO da Avanz (1080x1350).
# Pipeline: envsubst(template) -> chromium headless (conteúdo, SEM rodapé) -> ImageMagick (compõe rodapé).
#
# Uso: render-card.sh <content.env> <saida.png>
# Ex.: ./render-card.sh content/2026-W23-001_mcmv.env /srv/apps/content-radar/store/previews/2026-W23-001_v2.png
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG="$DIR/brand-avanz.config.json"
CONTENT="${1:?uso: render-card.sh <content.env> <saida.png>}"
OUT="${2:?uso: render-card.sh <content.env> <saida.png>}"
FOOTER="$DIR/assets/footer-bar.png"

[ -f "$FOOTER" ] || "$DIR/build-footer.sh" "$FOOTER"

export LOGO_WHITE="file://$DIR/assets/avanz-logo-white.png"
set -a; . "$CONTENT"; set +a   # carrega PILL, KICKER, TITLE, STAT*, NOTE, SOURCE...

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
envsubst < "$DIR/template-card-data.html" > "$TMP/card.html"

chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --user-data-dir="$TMP/profile" --allow-file-access-from-files \
  --force-device-scale-factor=1 --window-size=1080,1350 \
  --screenshot="$TMP/content.png" "file://$TMP/card.html" 2>/dev/null

CY="$(jq -r '.footer.composite_y' "$CFG")"
mkdir -p "$(dirname "$OUT")"
convert "$TMP/content.png" "$FOOTER" -gravity NorthWest -geometry "+0+${CY}" -composite "$OUT"
echo "ok: $OUT ($(convert "$OUT" -format '%wx%h' info:))"
