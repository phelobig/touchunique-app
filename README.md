# Application — Touch Unique Gestion

Sources de l’application. Le dossier **à publier** est `../deploy/app/` (généré par `python ../deploy/prepare.py`), car le téléversement web de GitHub aplatit les dossiers.

Fichiers clés :

- `index.html` — coquille, navigation, panneau assistant, modales, toasts.
- `styles.css` — thème sombre / clair, responsive, `prefers-reduced-motion`.
- `data.js` — miroir généré du catalogue et du contenu.
- `automation.js` — copie de `../ai/engine.js` (moteur local).
- `store.js` — base `tus_app_db_v1`, import des leads `tus_site_leads_v1`.
- `sync.js` — liaison temps réel avec le site (`BroadcastChannel` + `tus_sync_v1`).
- `app.js` — vues, actions, assistant, cycle autopilot, export/import.
- `assets/` — données miroir, images catalogue, portraits et icônes.

Fonctions testées : import d’un lead depuis le site, score « chaud », création automatique de projet et de tâches, cycle autopilot, génération de pack de contenu (5 cartes), file sociale, suggestions boutique, export CSV/JSON. Lighthouse : Accessibilité 100, Bonnes pratiques 100, SEO 100.

Les connecteurs non configurés restent explicitement « Non connecté » dans les réglages : aucune publication ni paiement simulé.
