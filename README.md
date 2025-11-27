# OS-Tools
A list of small tools for simple small tasks

## 🛠️ Boîte à outils

**[🎯 Ouvrir la boîte à outils](https://oliviersud.github.io/OS-Tools/boite-a-outils.html)**

> La boîte à outils regroupe tous les outils dans une même interface, avec une navigation par catégories et un accès rapide. C'est le point d'entrée recommandé.

La boîte à outils permet d'accéder facilement à tous les outils disponibles, organisés par catégorie.

## 📁 Outils disponibles indépendamment

### 2D
- **[GIF Creator](https://oliviersud.github.io/OS-Tools/Outils/2D-GIF-creator.html)** : Crée des animations GIF ou APNG à partir d'images importées. Options principales : durée par image, boucle, redimensionnement (par défaut la taille est celle de la première image importée) et choix du nombre de couleurs pour la palette GIF.
- **[Color Replacement](https://oliviersud.github.io/OS-Tools/Outils/2D-color-replacement.html)** : Remplace une couleur source par une couleur cible dans une image (tolérance et prévisualisation).
- **[Sprite Sheet Cutter](https://oliviersud.github.io/OS-Tools/Outils/2D-Sprite-sheet-cutter.html)** : Découpe automatiquement une feuille de sprites en images individuelles en fonction de la grille ou des repères.
- **[Image to Vector](https://oliviersud.github.io/OS-Tools/Outils/2D-Image-to-vector.html)** : Convertit des images bitmap en SVG vectoriel basique (idéal pour logos simples et formes).
- **[Normal Map Generator](https://oliviersud.github.io/OS-Tools/Outils/3D-normal-map-generator.html)** : Génére des normal maps à partir d'images de hauteur pour usage 3D / shaders.
- **[Remove Color as Alpha](https://oliviersud.github.io/OS-Tools/Outils/2D-Remove-color-as-alpha.html)** : Rend transparente une couleur choisie dans une image raster (utile pour enlever un fond).
- **[SVG Remove Color](https://oliviersud.github.io/OS-Tools/Outils/2D-svg-remove-color.html)** : Supprime ou remplace une couleur d'un fichier SVG (éditable).

### 3D
- **[JSON to GLTF](https://oliviersud.github.io/OS-Tools/Outils/3D-Json-to-OBJ-STL.html)** : Convertit des données 3D au format JSON vers GLTF/OBJ/STL selon besoin (export pour visualisation ou impression 3D).
- **[JSON to GLB](https://oliviersud.github.io/OS-Tools/Outils/3D-Json-to-GLB.html)** : Convertit des fichiers JSON 3D au format GLB (GLTF binaire) pour une meilleure compression et compatibilité avec les viewers 3D modernes. Inclut validation de la géométrie et optimisation automatique.

### Vidéo
- **[Timelapse to MP4](https://oliviersud.github.io/OS-Tools/Outils/Video-Timelaps-to-MP4.html)** : Assemble une séquence d'images en une vidéo MP4 avec réglage de la cadence (fps) et encodage simple.


## 📝 Notes et conseils

- Les outils sont faits pour être légers et fonctionner entièrement côté client (navigateur) sans envoi de fichiers sur un serveur.
- Pour le GIF Creator : la taille par défaut utilisée est celle de la première image importée ; la réduction du nombre de couleurs produit une palette globale utilisée pour toutes les frames afin de réduire la taille du fichier exporté.
- Roughness Map Generator (Normal Map tool) : nouvelle option pour générer une texture de roughness depuis la heightmap. Contrôles disponibles : intensité des tons sombres / tons clairs, réglages de niveaux (noir / gamma / blanc) et inversion noir/blanc. La texture générée est automatiquement appliquée au viewer dans le champ roughness du matériau PBR (si la version de Babylon utilisée supporte roughnessTexture, sinon un fallback est utilisé).
- Si vous avez besoin de fonctionnalités avancées (meilleure quantification, dithering fin, optimisation additionnelle), signalez-le et je peux intégrer des bibliothèques supplémentaires ou options avancées.
