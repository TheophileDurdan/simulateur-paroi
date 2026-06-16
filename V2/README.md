# Simulation chaleur V2

Évolution du modèle thermique 1D (le projet principal à la racine reste en V1).

## Modèle physique

- **Convection** aux frontières (`h_ext` fonction de l'inclinaison, `h_int` intérieur)
- **Lame d'air** sans discrétisation (convection + rayonnement IR entre faces)
- **Émissivité** `ε` par matériau (modifiable dans le panneau)
- **Feuille d'aluminium** 1 mm (ε ≈ 0,04)
- Rayonnement IR **T⁴** dans les cavités fermées
- Absorptivité solaire `α` par matériau (face extérieure)

## Lancer

### En un clic (comme la V1)

Double-cliquez sur **`Lancer V2.command`** à la racine du dossier — le navigateur s’ouvre sur **http://localhost:5174/**.

### Hors ligne (sans serveur)

Double-cliquez sur **`Ouvrir V2 (hors ligne).webloc`** ou sur **`V2/dist/index.html`**.

### Ligne de commande

```bash
cd V2
npm install
npm run dev
```

Puis **http://localhost:5174/** (la V1 reste sur le port 5173).

## Paroi démo cavité + Al

Dans `src/presets/parisHeatwave.ts`, remplacer `parisHeatwaveLayers()` par `cavityRadiationDemoLayers()` dans `materials.ts` pour tester brique + lame d'air + feuille Al + laine.
