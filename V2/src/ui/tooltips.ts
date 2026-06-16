import type { ClimatePreset } from "../presets/climatePresets";
import type { WallPreset } from "../presets/wallPresets";
import { SKY_COVER_LABELS, type SkyCover } from "../skyCover";

/** Définit l'infobulle native (`title`) d'un élément interactif. */
export function setNativeTip(el: HTMLElement, text: string): void {
  if (text) el.title = text;
  else el.removeAttribute("title");
}

export const TIPS = {
  play: "Lancer la simulation temporelle (températures, transferts thermiques)",
  pause: "Mettre la simulation en pause",
  speed:
    "Vitesse du temps simulé : combien de secondes simulées s'écoulent en 1 seconde réelle",
  speed10: "×10 — 1 s réelle = 10 s simulées",
  speed100: "×100 — 1 s réelle = 1 min 40 simulées",
  speed1000: "×1000 — 1 s réelle ≈ 17 min simulées",
  extAutoOn:
    "Mode profil horaire : T ext. suit le graphique bleu. Cliquer pour passer au réglage manuel (thermomètre extérieur).",
  extAutoOff:
    "Mode manuel : glisser le thermomètre air ext. (paroi, à gauche). Cliquer pour suivre le profil horaire du graphique.",
  resetTemps:
    "Réinitialiser toutes les températures (paroi, air intérieur, cavités) et le temps simulé à zéro",
  fullscreen: "Afficher le simulateur en plein écran (Échap pour quitter)",
  exitFullscreen: "Quitter le plein écran (ou touche Échap)",
  wallPresets: "Exemples de parois courantes (couches, épaisseurs et orientation)",
  wallPreset: (preset: WallPreset) =>
    `Charger « ${preset.name} » : composition type et orientation de la paroi étudiée`,
  layersHeader:
    "Liste des couches de la paroi, de l'extérieur (haut de liste) vers l'intérieur (bas)",
  addLayer: "Ajouter une couche de matériau solide à la paroi",
  simTime: "Temps écoulé depuis le début de la simulation",
  extModeAuto:
    "Température extérieure lue sur le profil horaire — éditez la courbe bleue du graphique",
  extModeManual:
    "Température extérieure réglée manuellement — glissez le thermomètre bleu à gauche de la paroi",
  solarChart:
    "Rayonnement solaire reçu par la paroi (% du maximum). Cliquez pour ajouter un point, glissez pour modifier, clic sans déplacement pour supprimer",
  tempChart:
    "Profil horaire de T air ext. (bleu). Cliquez pour ajouter un point, glissez pour modifier, clic sans déplacement pour supprimer",
  wallView:
    "Coupe de la paroi : barres colorées = températures. Thermomètres air ext. (gauche) et int. (droite).",
  wallViewManual:
    "Glissez la barre thermomètre extérieure (gauche) pour régler T air ext. en mode manuel",
  facade3d:
    "Orientation de la paroi : glisser horizontalement (azimut), verticalement (inclinaison 0° = toit, 90° = mur)",
  ventilation:
    "Renouvellement d'air intérieur (vol/h). 0 = étanche, 1 = un volume d'air neuf par heure",
  latitude: "Latitude du site en degrés (Nord +, Sud −). Influence la hauteur du soleil",
  season: "Profil climatique : applique une date, une courbe T ext. et une température initiale",
  seasonOption: (preset: ClimatePreset) =>
    `${preset.label} — date ${preset.monthDay}, T init. ${preset.initialTemp} °C, profil extérieur associé`,
  date: "Date du jour simulé (déclinaison solaire et position du soleil dans l'année)",
  skyCover:
    "Couverture du ciel : modifie le soleil reçu et le rayonnement infrarouge du ciel vers la paroi",
  skyCoverOption: (cover: SkyCover) => {
    const tips: Record<SkyCover, string> = {
      clear: "Ciel dégagé — soleil maximal, ciel froid la nuit (fort refroidissement radiatif)",
      hazy: "Ciel voilé — soleil atténué, ciel intermédiaire",
      overcast: "Ciel couvert — peu de direct, ciel proche de T air (faible refroidissement radiatif)",
    };
    return `${SKY_COVER_LABELS[cover]} — ${tips[cover]}`;
  },
  heating:
    "Apport thermique à l'air intérieur en W/m². Positif = chauffage, négatif = climatisation",
  layerMoveUp: "Déplacer la couche vers l'extérieur (côté gauche de la paroi)",
  layerMoveDown: "Déplacer la couche vers l'intérieur (côté droit de la paroi)",
  layerColor: "Couleur d'affichage de la couche dans la coupe de paroi",
  layerMaterial: "Type de matériau de la couche",
  layerThickness: "Épaisseur de la couche en millimètres",
  layerRho: "Masse volumique ρ (kg/m³) — plus elle est élevée, plus la couche est inerte",
  layerCp: "Chaleur massique cp (J/kg·K) — capacité à stocker la chaleur",
  layerLambda: "Conductivité thermique λ (W/m·K) — vitesse de transfert par conduction",
  layerEpsilon:
    "Émissivité infrarouge ε (0–1) — échange radiatif avec les surfaces voisines et le ciel",
  layerToggleOff: "Désactiver cette couche (ignorée par la simulation, conservée dans la liste)",
  layerToggleOn: "Réactiver cette couche dans la simulation",
  layerDelete: "Supprimer définitivement cette couche",
} as const;

export const LEGEND_TIPS = {
  schedule:
    "Température de l'air extérieur (bleu). Courbe éditable sur le graphique en mode T ext. auto",
  airInt: "Température de l'air dans le volume intérieur (convection paroi + ventilation)",
  wallExt: "Température de la face extérieure de la paroi (premier nœud côté extérieur)",
  wallInt: "Température de la face intérieure de la paroi (dernier nœud côté pièce)",
  feltInt:
    "Température intérieure ressentie : moyenne entre T air int. et T face intérieure de paroi",
} as const;
