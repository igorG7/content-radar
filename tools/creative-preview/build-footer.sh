#!/usr/bin/env bash
# build-footer.sh — desenha a barra-rodapé da Avanz via ImageMagick (determinístico).
# Existe porque o Chromium headless deste servidor corta elementos ancorados no
# rodapé do viewport (ver brand-avanz.config.json#render.known_issues). NÃO migrar pro CSS.
#
# Uso: build-footer.sh [saida.png]   (default: assets/footer-bar.png)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG="$DIR/brand-avanz.config.json"
OUT="${1:-$DIR/assets/footer-bar.png}"
g(){ jq -r "$1" "$CFG"; }

PHONE="$(g '.footer.phone_display')"
WLABEL="$(g '.footer.whatsapp_label' | tr '[:lower:]' '[:upper:]')"
TAGLINE="$(g '.footer.tagline')"
CRECI="$(g '.footer.creci')"
BG="$(g '.footer.bg')"; ORANGE="$(g '.colors.orange')"; GRAY="$(g '.colors.medium_gray')"
H="$(g '.footer.bar_height')"
F_SB="$(g '.fonts.inter_semibold')"; F_B="$(g '.fonts.inter_bold')"; F_M="$(g '.fonts.inter_medium')"

mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# ícone de telefone branco (SVG → PNG)
cat > "$TMP/phone.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
<path fill="#ffffff" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.9c0-.6.5-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1l-2.2 2.3z"/>
</svg>
SVG
convert -background none "$TMP/phone.svg" "$TMP/phone-ic.png"

convert -size "1080x${H}" "xc:${BG}" \
  -fill "$ORANGE" -draw "circle 104,75 104,44" \
  -font "$F_SB" -pointsize 18 -fill "$ORANGE" -gravity NorthWest -annotate +158+46 "$WLABEL" \
  -font "$F_B"  -pointsize 33 -fill white       -gravity NorthWest -annotate +158+70 "$PHONE" \
  -font "$F_SB" -pointsize 23 -fill white       -gravity NorthEast -annotate +72+50 "$TAGLINE" \
  -font "$F_M"  -pointsize 16 -fill "$GRAY"      -gravity NorthEast -annotate +72+86 "$CRECI" \
  "$TMP/footer-bar.png"
convert "$TMP/footer-bar.png" "$TMP/phone-ic.png" -gravity NorthWest -geometry +84+55 -composite "$OUT"
echo "footer-bar: $OUT ($(convert "$OUT" -format '%wx%h' info:))"
