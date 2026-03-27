# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oracle est une application de gestion des priorités basée sur la matrice d'Eisenhower, avec un thème mystique/céleste. Les tâches sont appelées "visions", l'historique "Prophéties Accomplies", et le bouton d'ajout "Révéler".

## Architecture

Monorepo npm workspaces avec deux packages :

- `packages/client` — React + TypeScript + Vite + Tailwind CSS
- `packages/server` — Node.js + Express + TypeScript + Prisma + PostgreSQL

L'ensemble est containerisé via Docker Compose. En développement, les deux packages tournent avec hot reload (HMR côté client, `tsx watch` côté serveur).

## Commands

```bash
# Développement local (depuis la racine)
docker compose up           # Lance db + server + client
docker compose down -v      # Arrêt + suppression des volumes

# Depuis packages/server
npx prisma migrate dev --name <nom>   # Nouvelle migration
npx prisma migrate deploy             # Appliquer les migrations (prod)
npx prisma studio                     # Interface BDD
npm test                              # Tests serveur

# Depuis packages/client
npm run dev                 # Dev standalone (sans Docker)
npm run build               # Build prod
npm run lint                # Lint

# Depuis la racine
npm run lint --workspaces   # Lint tous les packages
npm run build --workspaces  # Build tous les packages
```

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Base de données | PostgreSQL 16 |
| Auth | JWT (access 15min en mémoire + refresh 7j en httpOnly cookie) |
| Validation | Zod (côté serveur uniquement) |
| Containerisation | Docker + Docker Compose |
| CI/CD | GitHub Actions → ghcr.io |

## Schéma de données

Les 4 quadrants (enum `Quadrant`) : `FIRE` (urgent+important), `STARS` (important), `WIND` (urgent), `MIST` (ni l'un ni l'autre). Le champ `quadrant` est **toujours calculé côté serveur** à partir de `urgent` et `important` — ne jamais l'accepter en input client.

Les tâches ont 3 statuts : `ACTIVE`, `DONE`, `ELIMINATED`.

Les migrations sont gérées par Prisma (`prisma/migrations/`). Ne jamais modifier manuellement un fichier de migration déjà commité.

## Auth

- Access token : stocké **en mémoire JS** côté client (jamais localStorage)
- Refresh token : httpOnly cookie sécurisé, rotation à chaque refresh (l'ancien est invalidé)
- Le client HTTP (`src/api/client.ts`) gère le refresh automatique en cas de 401

## Thème

Les CSS custom properties du thème sont définies dans `packages/client/src/index.css`. Utiliser ces variables pour toute couleur, jamais de valeur hex en dur dans les composants. Fonts : Playfair Display (titres) + Nunito (corps), importées via Google Fonts dans `index.css`.

## Stratégie de branches

Modèle Git Flow simplifié :

| Branche | Rôle |
|---------|------|
| `main` | Production — ne reçoit que des PRs depuis `develop` |
| `develop` | Intégration — base de toutes les features |
| `feat/<nom>` | Feature en cours — tirée de `develop`, mergée dans `develop` via PR |

**Règles :**
- Ne jamais commiter directement sur `main` ou `develop`
- Chaque feature démarre par `git checkout -b feat/<nom> develop`
- La PR de mise en production : `develop` → `main`
- Les noms de feature branches suivent le numéro de spec : `feat/01-monorepo-setup`, `feat/02-auth`, etc.

## Specs

Le dossier `specs/` est **ignoré par git** (local only). Les features v1 sont décrites dans `specs/features/v1/`, numérotées `01` à `22` dans l'ordre d'implémentation recommandé. Quand une feature est terminée, renommer le fichier en ajoutant `-done` avant l'extension (ex: `01-feature-monorepo-setup-done.md`).

## Post-feature : notes de découvertes

À la fin de chaque feature, **compléter le fichier spec `-done.md`** avec deux sections :

- **`## Fichiers créés/modifiés`** — tableau listant chaque fichier et son action (Créé / Modifié / Supprimé), avec une note si l'action était inattendue
- **`## Découvertes inattendues`** — tout ce qui a bloqué, surpris ou dévié du plan initial (erreurs d'outils, comportements de libs, pièges de config, breaking changes). Format : titre court + explication + **impact pour les features suivantes**

Puis **mettre à jour les mémoires** dans `/home/elrik/.claude/projects/-home-elrik-Repos-oracle/memory/` pour tout ce qui est transversal (pattern de code établi, comportement d'outil confirmé, décision d'architecture). Voir `MEMORY.md` pour l'index.
