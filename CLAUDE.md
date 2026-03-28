# shahfazal.com — Personal Website

## What this is
Personal portfolio + blog + projects site for shahfazal (Faz Moh).
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
- Angle: does public transport access (BPE dataset) correlate with abstention/turnout?
- Extended angle: transport access + political nuance (simplified schema: Gauche / Centre / Droite / Extrême droite / Divers)
- Data: commune-level join of election results + BPE transport indicators + INSEE population
- Tech: pandas notebook → clean JSON → Plotly.js → hosted as static page on this site
- Submit as réutilisation on data.gouv.fr with keyword: defi-municipales-2026-résultats

## Hugo setup status (as of March 27 2026)
- [x] hugo new site scaffolded
- [x] PaperMod theme installed as submodule
- [ ] hugo.toml configured
- [ ] GitHub Actions workflow added
- [ ] DNS pointed from Namecheap to GitHub Pages
