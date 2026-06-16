# Simulateur paroi — transfert thermique

Simulateur interactif 1D de transfert thermique à travers une paroi (conduction, convection, rayonnement, lames d'air, presets bâtiment).

**Démo en ligne :** après déploiement → `https://TheophileDurdan.github.io/simulateur-paroi/`

## Application (V2)

La version partageable est dans le dossier [`V2/`](V2/). Elle inclut notamment :

- Parois multicouches éditables (presets toit, mur béton, ossature bois)
- Orientation 3D, ensoleillement, profils climat (canicule, saisons)
- Convection ext./int., rayonnement vers le ciel, cavités et lames ventilées
- Ventilation int./ext. et apport chauffage/climatisation

### Lancer en local

```bash
cd V2
npm install
npm run dev
```

→ [http://localhost:5174](http://localhost:5174)

### Build

```bash
cd V2
npm run build
```

## Publier sur GitHub (open source + Pages)

### 1. Créer le dépôt sur GitHub

1. Ouvrez [github.com/new](https://github.com/new)
2. **Repository name** : `simulateur-paroi`
3. **Public**
4. Ne cochez **pas** « Add a README » (un README est déjà dans le projet)
5. Cliquez sur **Create repository**

Gardez la page ouverte : GitHub affiche les commandes `git` — vous pouvez les ignorer et suivre l’étape 2 ci-dessous.

### 2. Pousser le code

Ouvrez le **Terminal** (macOS : Terminal ou l’onglet terminal de Cursor).

#### a) Aller dans le dossier du projet

```bash
cd "/Users/theophiledurdan/Library/CloudStorage/OneDrive-ProjetTEBO/Projet TEBO/09 - Communication/Simulation chaleur"
```

Si vous avez copié le projet ailleurs (recommandé hors OneDrive pour Git), adaptez ce chemin.

#### b) Initialiser Git (une seule fois)

```bash
git init
git branch -M main
```

#### c) Enregistrer tous les fichiers

```bash
git add .
git status
```

Vérifiez que `node_modules/` et `dist/` **n’apparaissent pas** (ils sont ignorés par `.gitignore`).

#### d) Premier commit

```bash
git commit -m "Publication simulateur paroi thermique (open source)"
```

#### e) Lier le dépôt GitHub

Remplacez `VOTRE-USERNAME` par votre identifiant GitHub :

```bash
git remote add origin https://github.com/VOTRE-USERNAME/simulateur-paroi.git
```

Si `git remote add` indique que `origin` existe déjà :

```bash
git remote set-url origin https://github.com/VOTRE-USERNAME/simulateur-paroi.git
```

#### f) Envoyer sur GitHub

```bash
git push -u origin main
```

- La première fois, GitHub peut demander de vous **connecter** (navigateur ou token).
- Si le dépôt est vide sur GitHub, le push doit se terminer sans erreur.

### 3. Activer GitHub Pages

1. Sur GitHub, ouvrez le dépôt **simulateur-paroi**
2. **Settings** → **Pages**
3. **Build and deployment** → **Source** : **GitHub Actions**
4. Onglet **Actions** : le workflow « Deploy V2 to GitHub Pages » doit passer au vert (1–2 min)

### 4. URL à partager

```
https://VOTRE-USERNAME.github.io/simulateur-paroi/
```

Testez cette URL en navigation privée avant de la poster sur LinkedIn.

### Mises à jour ultérieures

Après avoir modifié le code en local :

```bash
git add .
git commit -m "Description de vos changements"
git push
```

Le site en ligne se met à jour automatiquement après le workflow Actions.

## Structure du dépôt

| Dossier | Description |
|---------|-------------|
| `V2/` | Application web (Vite + TypeScript) |
| Racine (hors `V2/`) | Ancienne V1 (référence locale, optionnelle) |

## Licence

[MIT](LICENSE) — libre d’utilisation, modification et partage avec mention de la licence.
