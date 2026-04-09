---
title: "Élections Municipales 2026: Prix Immobiliers et Comportement Électoral"
description: "Prix immobiliers et résultats électoraux: les communes les plus chères votent-elles différemment ?"
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
  alt: "Choropleth Paris arrondissements bloc vainqueur et prix m²"
---

Ce projet explore le lien entre les **prix immobiliers** et les **comportements électoraux** lors du 2ème tour des élections municipales 2026 en France. Une question centrale : _Les communes où les prix au m² sont élevés votent-elles différemment ?_

Réalisé pour le [Défi 1](https://defis.data.gouv.fr/defis/elections-municipales-2026-resultats-et-profils-des-electeurs) du concours open data de data.gouv.fr date limite le 13 avril 2026.

**[→ Voir la visualisation](https://shahfazal.com/elections-municipales-2026/)**

### En bref

- **5 visualisations clés :**
  1. **Histogramme empilé** : Vue d’ensemble de la composition des blocs politiques par tranche de prix immobilier.
  2. **Boite à moustaches** : Taux d'Abstention par bloc
  3. **Boîte à moustaches** : Distribution des prix immobiliers par bloc politique. Les communes les plus chères se situent en haut, tandis que les communes les moins chères se trouvent en bas.
  4. **Cartes interactives** : Résultats électoraux et prix au m² dans les arrondissements de Paris, Lyon et Marseille.
  5. **Nuage de points** : Taux d'abstention vs. prix au m², coloré par bloc politique vainqueur.

- **Sources de données :**
  - Résultats électoraux (Ministère de l'Intérieur)
  - Prix immobiliers (DVF 2024/2025, data.gouv.fr)

- **Accessibilité :**
  Cette visualisation a été conçu pour être accessible avec des attributs ARIA, indicateurs de focus visibles. Malgré ces efforts, certaines limitations persistent. Un article détaillé sur l’accessibilité des visualisations avec Plotly et Leaflet est en préparation.

### Méthodologie

Le pipeline de traitement utilise Jupyter notebooks pour l'exploration, nettoyage et la jointure des données, avec export vers JSON pour la visualisation interactive.

_Article blog complet sur les frictions rencontrées avec les données ouvertes françaises à venir._

[GitHub](https://github.com/shahfazal/elections-municipales-2026)
