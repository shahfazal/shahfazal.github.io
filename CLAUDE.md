# shahfazal.com — Personal Website

## What this is

Personal portfolio + blog + projects site for shahfazal.
Replaces Medium as primary publishing platform for new posts.

## Stack

- Hugo + PaperMod theme (installed as git submodule at themes/PaperMod)
- GitHub Pages via shahfazal/shahfazal.github.io repo
- Domain: shahfazal.com (Namecheap, purchased March 2026)
- shahfazal.fr to be added later as redirect to .com

## Publishing pipeline

markdown file → git push → GitHub Actions builds Hugo → GitHub Pages → shahfazal.com

## Content structure

- **Projects**: TinyNet, NYC EV charger LSTM, elections viz, Pet Detective (coming)
- **Writing/Blog**: new posts published here first, then cross-posted to Medium with canonical URL set to this site
- **Open Data**: French OpenData / data.gouv.fr work, MCP contributions

## Blog strategy

- Existing Medium posts: leave them, they have SEO/links already
- New posts: publish natively here first, cross-post to Medium via import tool
- Set canonical URL on Medium to shahfazal.com so Google treats site as original source

## In-progress: Elections viz (data.gouv.fr challenge)

- Défi 1: voter profiles + results (deadline April 13 2026)
- Angle: does property price (prix m²) correlate with abstention
  and political bloc?
- Data: commune-level join of election results (Ministère de
  l'Intérieur) + DVF property prices (2024, data.gouv.fr)
- Three tabs: scatter (prix vs abstention by bloc), box plot
  (price distribution by bloc), PLM choropleth (Paris/Lyon/
  Marseille arrondissement maps with Leaflet)
- 838 communes, 2ème tour results, log scale prix axis
- Tech: pandas notebooks (01-04) → clean JSON → standalone
  HTML (Plotly.js + Leaflet) → hosted as static page on this site
- Submit as réutilisation on data.gouv.fr with keyword:
  `defi-municipales-2026-résultats`
- Viz lives at: static/elections-municipales-2026/index.html
- Pre-push hook guards DATA path before deployment

  _**Note:** Original idea to use Transport data was put aside in the interest of time. Too many datasource to wrangle... (maybe in the future)_

## Git hooks

- Pre-push hook at `.github/hooks/pre-push` — blocks push if `const DATA` in `static/elections-municipales-2026/elections-municipales-2026.js` is not exactly `"./data/"`
- One-time local setup required: `git config core.hooksPath .github/hooks`

## Hugo setup status (as of March 27 2026)

- [x] hugo new site scaffolded
- [x] PaperMod theme installed as submodule
- [x] hugo.toml configured
- [x] GitHub Actions workflow added
- [x] DNS pointed from Namecheap to GitHub Pages
- [x] Cloudflare onboarded
