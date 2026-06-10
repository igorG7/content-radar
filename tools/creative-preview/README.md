# creative-preview — toolkit de preview de criativo (Avanz)

> Gera um **preview de criativo** (PNG 1080×1350) a partir de um brief do content-radar,
> alinhado à identidade visual real da Avanz Imóveis. Serve pra **validar a direção visual**
> antes do humano operar o Smart Design.

## ⚠️ Escopo (leia antes)

Isto é **EXPERIMENTAL** e **NÃO** faz parte do pipeline spec'd do content-radar:

- O radar entrega `brief.md` + `package` (spec 001 §8.3 opção 1). A **arte oficial** sai do
  **Smart Design** (Open Design @ design.consultorivandias.com.br), operada por **humano**.
- Este toolkit **NÃO publica** no IG, **NÃO chama** a Open Design API, **NÃO sobe** pro Cloudinary.
- É um preview local pra acelerar a aprovação humana / servir de referência fiel pro Smart Design.
- Conceitualmente, é um primeiro protótipo do **GAP 2** (pipeline de geração) do audit
  `intel/audits/criativos-gap-analysis-2026-05-04.md` do vault Avanz.

## Arquivos

| Arquivo | Papel |
|---|---|
| `brand-avanz.config.json` | Config canônica: tokens de cor, fontes, logo, rodapé, formatos. **Fonte da verdade** do toolkit. |
| `template-card-data.html` | Template do card de **dado** (Pilar 2/3/6). Variáveis `${...}` preenchidas por `render-card.sh`. |
| `build-footer.sh` | Desenha a barra-rodapé (telefone + tagline + CRECI) via ImageMagick. Roda 1x; cacheia em `assets/footer-bar.png`. |
| `render-card.sh` | Orquestra: `envsubst` template → Chromium (conteúdo) → ImageMagick (compõe rodapé). |
| `content/<slug>.env` | Conteúdo editorial de **um** card (uma por brief). |
| `assets/avanz-logo-white.png` | Logo branca extraída do brandbook (ver GAP 1 abaixo). |
| `assets/footer-bar.png` | Rodapé pré-renderizado (gerado por `build-footer.sh`). |

## Como usar

```bash
cd /srv/apps/content-radar/tools/creative-preview

# 1) (uma vez, ou quando mudar telefone/tagline na config)
./build-footer.sh

# 2) renderiza um card a partir de um content .env
./render-card.sh content/2026-W23-001_mcmv.env \
  /srv/apps/content-radar/store/previews/2026-W23-001_mcmv-2026__creative-preview-v2.png
```

Pra um **novo brief**: copie `content/2026-W23-001_mcmv.env`, edite os campos
(`KICKER`, `TITLE`, `STAT1_*`, `STAT2_*`, `NOTE`, `SOURCE`) e rode `render-card.sh`.
Os valores aceitam HTML simples (`<b>`, `<small>`); escape `$` como `\$` (ex.: `R\$`).

## Mapeamento de marca (de onde vêm as decisões)

- **Cores / tipografia / formato**: `brand.json#visual_identity` (navy `#0F172A`, laranja `#F97316`,
  Inter) + formato 4:5 observado no criativo real `archive/.../arte-final.png`.
- **Logo (A-bússola + AVANZ Imóveis + CRECI 8638)**: `identity/logo/logo.png`.
- **Geometria angular navy + acento laranja diagonal**: assinatura observada no `arte-final.png`.
- **Rodapé (círculo laranja + telefone + "Entender para atender")**: réplica do `arte-final.png`;
  telefone vem de `brand_facts` do `manifest.yaml` do content-radar (canônico em
  `brand.json#digital_behavior.conversion_logic.main_number`).

## ⚠️ Chromium gotcha (por que o rodapé é ImageMagick)

O Chromium headless **deste servidor** renderiza qualquer elemento ancorado no **rodapé do
viewport** deslocado pra baixo do canvas — testado e **falha** com `position:fixed`,
`position:absolute; bottom:0`, flex `margin-top:auto` e CSS Grid `auto/1fr/auto`. O cabeçalho e
o conteúdo central renderizam corretos; só o rodapé escapa.

**Solução:** o conteúdo é renderizado **sem rodapé**, e o rodapé é desenhado de forma
determinística com ImageMagick (`build-footer.sh`) e **composto** por cima
(`-geometry +0+1200 -composite`). **Não** tente mover o rodapé pro HTML — vai cortar de novo.

Cache de `file://` do Chromium também pode reusar render antigo; `render-card.sh` usa
`--user-data-dir` efêmero pra evitar.

## Limitações conhecidas (TODO)

- **GAP 1 — logo não-vetorial:** `assets/avanz-logo-white.png` foi extraída do brandbook PNG
  (trim + recolor navy→branco), não é SVG limpo. Trocar quando `logo-mono-white.svg` existir.
- **GAP 5 — sem banco de fotos:** este template é **só-tipografia** (card de dado). A `brand.json`
  pede **foto real** (drone/lotes/pessoas) e o estilo real é foto-led. Falta um template foto-led
  + banco de fotos curado da Avanz.
- **Um template só:** existe só o card de **dado** (Pilar 2/3/6). Faltam variantes (imóvel/Pilar 1,
  depoimento/Pilar 5, carrossel, story) — alinhado ao GAP 6 do audit.
- **Sem variação por ICP** (GAP 4): mesmo visual pra comprador/investidor.

## Reproduzir os assets de marca (referência)

A logo branca foi gerada assim (a partir do brandbook):

```bash
SRC=/srv/my-mind/Empresas/avanz-imoveis/identity/logo/logo.png
convert "$SRC" -fuzz 8% -trim +repage logo-real.png        # recorta a logo
convert logo-real.png -fuzz 45% -fill white -opaque "#16294a" assets/avanz-logo-white.png
```
