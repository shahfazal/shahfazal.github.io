---
title: "Élections Municipales 2026"
description: "Prix immobiliers et résultats électoraux — les communes les plus chères votent-elles différemment ?"
date: 2026-04-06
tags:
  [
    "Python",
    "pandas",
    "Plotly",
    "Leaflet",
    "Open Data",
    "France",
    "Élections Municipales 2026",
  ]
cover:
  image: "/img/elections-municipales-2026-cover.png"
  alt: "Choropleth Paris arrondissements — bloc vainqueur et prix m²"
---

Croiser les résultats des élections municipales 2026 avec les prix immobiliers dans 838 communes françaises. Trois visualisations :

- Un nuage de points (prix au m² vs taux d'abstention par bloc politique vainqueur),
- Un diagramme en boîte (distribution des prix par bloc politique),
- Des cartes choroplèthes de Paris, Lyon et Marseille au niveau des arrondissements ou secteurs.

Réalisé pour le [Défi 1](https://defis.data.gouv.fr/defis/elections-municipales-2026-resultats-et-profils-des-electeurs) du concours open data de data.gouv.fr — date limite le 13 avril 2026.

<video autoplay loop muted playsinline style="width:100%;border-radius:6px;margin-bottom:1.5rem;">
  <source src="/img/em-2026.webm" type="video/webm">
</video>

**[→ Voir la visualisation](https://shahfazal.com/elections-municipales-2026/)**

### Mise à jour de dernière minute

Les données DVF 2025 ont été publiées sur data.gouv.fr le 4 avril 2026 — juste quelques heures avant la mise en ligne de ce projet. Plutôt que de différer l'analyse, j'ai opté pour ajouter un **toggle année par année** (2024 vs 2025) directement dans la visualisation.

La comparaison révèle :

- L'évolution des prix médians entre 2024 et 2025 durant l'année électorale
- La stabilité des corrélations entre prix immobiliers et comportement électoral
- Les communes ayant connu les plus fortes variations de prix pendant la campagne

[Quick observation si tu en vois une — e.g., "Les prix ont augmenté de X% en moyenne" ou "La corrélation prix/abstention reste stable"]

### Pourquoi le toggle année n'est pas disponible sur la carte Paris-Lyon-Marseille

La comparaison 2024-2025 révèle des évolutions réelles mais visuellement imperceptibles au niveau des arrondissements :

- **Paris** : hausse généralisée (+38 à +329 €/m² selon l'arrondissement)
- **Marseille** : évolution mixte (-245 à +166 €/m²)
- **Lyon** : tendance à la baisse (-288 à +27 €/m²)

Ces variations représentent 1 à 3 % du prix médian de base. À l'échelle de la carte choroplèthe, cela correspond à une différence de rayon de cercle inférieure à un pixel — invisible à l'œil nu.

Le signal est réel et statistiquement significatif (visible dans le nuage de points et le diagramme en boîte), mais la représentation cartographique par cercles proportionnels ne permet pas de le distinguer visuellement. Pour cette raison, le toggle année reste désactivé sur cet onglet.

### Accessibilité

Cette visualisation a été conçue avec l'accessibilité comme priorité dès le départ :

- **84 attributs ARIA** pour une navigation complète au clavier et compatibilité avec les lecteurs d'écran
- **Skip link** permettant un accès direct au contenu principal
- **Indicateurs de focus visibles** sur tous les éléments interactifs
- **Navigation au clavier complète** (Tab/Shift+Tab, Enter/Space pour activer)
- **Structures sémantiques** pour une hiérarchie claire du contenu

_Malgrès ces efforts, le site n'est pas completement accessibile. Article complet sur l'accessibilité des visualisations de données avec Plotly et Leaflet à venir._

### Méthodologie

Ce projet combine trois sources de données publiques :

- **Résultats électoraux** : Ministère de l'Intérieur, municipales 2026 (2ème tour, 22 mars)
- **Prix immobiliers** : Base DVF 2024 (data.gouv.fr)
- **Données de transport** : Base Permanente des Équipements (BPE) et GTFS

Le pipeline de traitement utilise Jupyter notebooks pour le nettoyage et la jointure des données, avec export vers JSON pour la visualisation interactive. Le projet a rencontré plusieurs défis liés à la qualité des données ouvertes — séparateurs non documentés, codes BPE mal interprétés, flux GTFS fragmentés (342 fichiers distincts). Ces frictions sont documentées dans un log détaillé qui illustre la différence entre "publier" et "ouvrir" des données.

_Article blog complet sur les frictions rencontrées avec les données ouvertes françaises à venir._

[GitHub](https://github.com/shahfazal/elections-municipales-2026)
