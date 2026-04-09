# CLAUDE.md

## Projet

Oracle — gestion des priorités (matrice d'Eisenhower), thème mystique/céleste. Les tâches sont des "visions", l'historique "Prophéties Accomplies", le bouton d'ajout "Révéler".

Monorepo npm workspaces. Containerisé via Docker Compose (hot reload en dev).

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma + PostgreSQL 16 |
| Auth | JWT (access 15min mémoire + refresh 7j httpOnly cookie) |
| Validation | Zod (serveur uniquement) |
| CI/CD | GitHub Actions → ghcr.io |

## Structure

```
packages/
├── client/src/
│   ├── api/client.ts        # HTTP singleton, token mémoire, refresh auto sur 401
│   ├── components/          # UI réutilisables (AppShell, TaskCard, TagSelector…)
│   ├── context/             # AuthContext, ToastContext
│   ├── hooks/               # useTasks, useTags, useAuth — optimistic update + rollback
│   ├── pages/               # LoginPage, RegisterPage, SettingsPage
│   ├── types/index.ts       # Task, Tag, Quadrant, TaskStatus, User
│   ├── utils/               # animations, colors, dates, quadrant
│   ├── views/               # MatrixView, HistoryView, FocusView
│   └── index.css            # CSS custom properties du thème (jamais de hex en dur)
└── server/src/
    ├── auth/                # middleware, router, service, tests
    ├── tasks/               # router, tests
    ├── tags/                # router, tests
    ├── lib/prisma.ts        # singleton Prisma
    ├── lib/tags.ts          # taskInclude + serialize()
    ├── app.ts               # Express app
    ├── error.middleware.ts  # AppError handler
    └── index.ts             # entrypoint
    prisma/
    ├── schema.prisma
    ├── seed.ts
    └── migrations/
```

## Schéma de données

Quadrants (`FIRE` urgent+important, `STARS` important, `WIND` urgent, `MIST` ni l'un ni l'autre) — **toujours calculé côté serveur**, jamais accepté en input client.

Statuts tâche : `ACTIVE`, `DONE`, `ELIMINATED`. Actions : `POST /tasks/:id/complete|eliminate|reactivate`.

Tags : `name`, `icon`, `color`, `isDefault`, `userId`. Tags `isDefault: true` partagés entre utilisateurs.

## Patterns serveur

- **`taskInclude` + `serialize()`** : la relation `Task ↔ Tag` passe par `TaskTag`. Toujours utiliser `taskInclude` et `serialize()` — ne jamais retourner le modèle Prisma brut.
- **`AppError`** : lever `new AppError(message, statusCode)` pour toute erreur métier.
- Ne jamais modifier manuellement un fichier de migration déjà commité.

## Auth

- Access token : en mémoire JS (jamais localStorage)
- Refresh token : httpOnly cookie, rotation à chaque refresh

## Convention Git

Trunk-based development — une seule branche long-lived : `main`.

| Branche | Rôle |
|---------|------|
| `main` | Trunk — reçoit uniquement des PRs depuis `feat/*` ou `fix/*` |
| `feat/<nom>` | Feature — tirée de `main`, mergée dans `main` via PR |
| `fix/<nom>` | Correctif — même cycle que les features |

Les releases se font en créant un **tag sémantique** sur `main` (ex: `v1.2.0`) — déclenche automatiquement le déploiement en production. Ne jamais commiter directement sur `main`.

## Commandes

```bash
# Racine
docker compose up                              # dev (db + server + client)
docker compose down -v                         # arrêt + suppression volumes

# packages/server
npx prisma migrate dev --name <nom>            # nouvelle migration
npx prisma migrate deploy                      # appliquer migrations (prod)
npm test                                       # tests serveur

# packages/client
npm run dev                                    # dev standalone
npm run build && npm run lint                  # build + lint
```

## Specs & post-feature

`specs/features/v1/` (ignoré par git) — numérotées `01`–`22`. Quand terminée : renommer en `-done.md` et compléter avec :
- `## Fichiers créés/modifiés` — tableau fichier / action / note
- `## Découvertes inattendues` — ce qui a bloqué ou surpris + impact pour les features suivantes

Puis mettre à jour les mémoires dans `/home/elrik/.claude/projects/-home-elrik-Repos-oracle/memory/`.
