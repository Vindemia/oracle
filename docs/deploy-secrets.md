# Secrets de déploiement (CI → serveur)

Depuis `feat/ci-deploy-sync`, les workflows `deploy-prod.yml` et `deploy-dev.yml` écrivent
le `.env` du serveur **à chaque déploiement**, à partir des secrets définis dans les
environnements GitHub `production` et `development`. Le fichier `docker-compose.prod.yml`
(+ `scripts/backup.sh`) est copié depuis le dépôt à chaque déploiement — il n'est plus
maintenu à la main sur le serveur.

**Conséquence** : toute variable absente d'un environnement GitHub sera écrite comme une
chaîne vide dans le `.env` du serveur au prochain déploiement. Il faut donc renseigner
les deux environnements **avant** le premier déploiement suivant le merge de cette PR,
sous peine de casser la prod (DB_PASSWORD vide, JWT_SECRET vide, etc.).

## Étapes

1. Créer l'environnement `development` dans **Settings → Environments** (l'environnement
   `production` existe déjà).
2. Pour chaque environnement, ajouter les secrets ci-dessous avec les valeurs **actuelles**
   du `.env` correspondant sur le serveur (`~/oracle/.env` pour `production`,
   `~/oracle-dev/.env` pour `development`) — ce sont les mêmes valeurs qu'aujourd'hui,
   il n'y a rien à régénérer sauf pour les variables marquées *(nouvelle)*.

| Secret | Description | Statut |
|---|---|---|
| `DB_PASSWORD` | Mot de passe Postgres | existant sur le serveur |
| `JWT_SECRET` | Secret JWT access token | existant sur le serveur |
| `JWT_REFRESH_SECRET` | Secret JWT refresh token | existant sur le serveur |
| `CORS_ORIGIN` | Origine autorisée (URL du client) | existant sur le serveur |
| `PORT` | Port du serveur Node | existant sur le serveur |
| `CLIENT_PORT` | Port du client (nginx) | existant sur le serveur |
| `VAPID_PUBLIC_KEY` | Clé publique push | existant sur le serveur |
| `VAPID_PRIVATE_KEY` | Clé privée push | existant sur le serveur |
| `VAPID_SUBJECT` | `mailto:` du push | existant sur le serveur |
| `SMTP_URL` | URL SMTP (reset mot de passe) | **nouvelle, optionnelle** — laisser vide tant qu'il n'y a pas de fournisseur SMTP ; `forgot-password` dégrade proprement sans elle (log console en dev, pas de 500 en prod) |
| `MAIL_FROM` | Expéditeur des emails | **nouvelle, optionnelle** — idem `SMTP_URL` |
| `FEEDBACK_GITHUB_TOKEN` | PAT fine-grained, scope `issues:write`. **Nom du secret différent de la variable d'env** (`GITHUB_FEEDBACK_TOKEN` dans le `.env`) : GitHub interdit tout secret préfixé `GITHUB_` | **nouvelle** — sans elle, les échos restent en base sans jamais devenir des issues |
| `FEEDBACK_GITHUB_REPO` | `owner/repo` cible des issues échos (`Vindemia/oracle`). Idem, nom de secret ≠ nom de variable d'env (`GITHUB_FEEDBACK_REPO`) | **nouvelle** |
| `RCLONE_REMOTE` | Remote rclone pour copie hors machine des dumps (optionnel) | **nouvelle, optionnelle** — laisser vide si pas de copie hors machine souhaitée |
| `RCLONE_KEEP` | Nombre de dumps conservés côté remote (défaut 30) | **nouvelle, optionnelle** |

Les valeurs actuelles des variables "existant sur le serveur" peuvent être lues via :
```bash
ssh dockervm "cat ~/oracle/.env"       # production
ssh dockervm "cat ~/oracle-dev/.env"   # development
```

`DOCKER_REGISTRY` et `TAG` ne sont **pas** dans cette liste : ils sont déjà injectés
directement par le workflow (`export DOCKER_REGISTRY=... / TAG=...`) et n'ont pas besoin
d'être dupliqués en secret.

## Une fois les secrets renseignés

Le prochain push sur `main` (dev) ou tag `vX.Y.Z` (prod) déploiera automatiquement le
`.env` et le `docker-compose.prod.yml` à jour — plus d'édition manuelle sur le serveur.
