# Restauration de la base de données Oracle

Procédure de restauration des dumps Postgres produits par le service
`db-backup` (voir `docker-compose.prod.yml` et `scripts/backup.sh`).

## Où sont les dumps ?

- **Dumps quotidiens** : `oracle-YYYY-MM-DD.dump`, dans le volume Docker
  `backups` sur le serveur de production. 14 conservés en local (rotation
  automatique).
- **Dumps pré-migration** : `pre-deploy-<sha7>.dump`, créés juste avant chaque
  déploiement (`deploy-prod.yml`), même volume.
- **Copie hors machine** (si `RCLONE_REMOTE` configuré) : mêmes noms de
  fichiers, sur le remote rclone configuré (S3, autre serveur, etc.), avec sa
  propre rotation (`RCLONE_KEEP`, défaut 30).

Format : `pg_dump -Fc` (custom format compressé), lisible avec `pg_restore`.

## Lister les dumps disponibles

```bash
# Sur le serveur de prod, dans le dossier du repo (ex: ~/oracle)
docker compose -f docker-compose.prod.yml exec db-backup ls -la /backups
```

## Restaurer sur le serveur existant (écrase la base actuelle)

**Attention** : cette procédure remplace entièrement le contenu de la base
`oracle`. À utiliser en cas de corruption de données ou de migration ratée.

1. Arrêter le serveur applicatif pour éviter les écritures concurrentes :

   ```bash
   docker compose -f docker-compose.prod.yml stop server
   ```

2. Copier le dump choisi dans un emplacement accessible, ou l'utiliser
   directement depuis le volume `backups` (déjà monté dans `db-backup`) :

   ```bash
   docker compose -f docker-compose.prod.yml exec db-backup \
     sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges /backups/oracle-2026-07-08.dump'
   ```

   - `--clean --if-exists` : supprime les objets existants avant de les
     recréer (évite les conflits avec les données actuelles).
   - `--no-owner --no-privileges` : évite les erreurs de rôles si le dump a
     été fait avec un utilisateur différent.

3. Vérifier les données restaurées (voir section « Vérifications »
   ci-dessous).

4. Redémarrer le serveur applicatif :

   ```bash
   docker compose -f docker-compose.prod.yml start server
   ```

## Restaurer sur une machine neuve

Cas d'un nouveau serveur de production (migration d'hébergeur, disque HS,
etc.) :

1. Cloner le repo et se placer dedans, configurer `.env` (voir
   `.env.example`) avec les mêmes `DB_PASSWORD` que l'ancien serveur (ou un
   nouveau — indifférent pour la restauration tant que le dump n'a pas
   d'ownership sur cet utilisateur, ce que `--no-owner` gère).

2. Récupérer un dump récent :
   - Depuis le remote hors machine (`rclone copy <remote>/oracle-YYYY-MM-DD.dump ./restore/`)
     si `RCLONE_REMOTE` était configuré sur l'ancien serveur — c'est le seul
     cas qui survit à la perte totale de la machine ;
   - Sinon, depuis une sauvegarde manuelle du volume `backups` si elle existe.

3. Démarrer uniquement la db :

   ```bash
   docker compose -f docker-compose.prod.yml up -d db
   ```

4. Copier le dump dans le volume `backups` (ex: via un conteneur temporaire ou
   `docker cp`), puis restaurer :

   ```bash
   docker run --rm --network <réseau-compose> \
     -e PGPASSWORD=<DB_PASSWORD> \
     -v <dossier-contenant-le-dump>:/dump \
     postgres:16-alpine \
     pg_restore -h db -U oracle -d oracle --no-owner --no-privileges /dump/oracle-YYYY-MM-DD.dump
   ```

5. Vérifier les données (section suivante), puis démarrer `server` et
   `client` normalement.

## Vérifications post-restauration

Après toute restauration, avant de rouvrir le service aux utilisatrices :

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U oracle -d oracle -c 'SELECT count(*) FROM "User";'

docker compose -f docker-compose.prod.yml exec db \
  psql -U oracle -d oracle -c 'SELECT count(*) FROM "Task";'
```

Comparer ces comptes avec les attentes (dernier compte connu, ou avec
l'application elle-même une fois `server` redémarré : se connecter avec un
compte de test et vérifier que les visions attendues sont présentes).

## Test de restauration effectué à la livraison (v3-14)

Conformément à l'exigence de la spec, un test de restauration réel a été
exécuté le 2026-07-08 (pas seulement documenté) :

1. Conteneur Postgres jetable `test-db` (`postgres:16-alpine`, `docker run`),
   base `oracle`, table `test_rows` créée avec **250 lignes** de données de
   test (`INSERT ... SELECT 'row-' || g FROM generate_series(1,250)`).
2. Dump produit avec le script `scripts/backup.sh` (mode `once`), format
   `pg_dump -Fc`, taille 3593 octets.
3. Dump validé avec `pg_restore --list` : TOC non vide (table, séquence,
   données listées).
4. Second conteneur Postgres jetable `test-db-restore`, base `oracle` vierge.
5. Restauration avec `pg_restore -h test-db-restore -U oracle -d oracle
   --no-owner --no-privileges oracle-2026-07-08.dump`.
6. Vérification :
   - `SELECT count(*) FROM test_rows;` → **250** dans la base source, **250**
     dans la base restaurée (identique).
   - Vérification renforcée : `SELECT md5(string_agg(label, ',' ORDER BY id))
     FROM test_rows;` → même empreinte MD5 (`aee445d163cc0b44c0df691ffad555ee`)
     des deux côtés, confirmant que le contenu restauré est byte-exact, pas
     seulement le même nombre de lignes.
7. Rotation locale testée séparément : 21 dumps simulés (`BACKUP_KEEP=14`) →
   après un cycle, exactement 14 conservés (les plus récents), les 7 plus
   anciens supprimés.
8. Copie hors machine testée avec un remote rclone local (`RCLONE_REMOTE=/tmp/rclone-remote`)
   : dump copié avec succès, rotation distante testée avec `RCLONE_KEEP=3` sur
   6 fichiers simulés → exactement 3 conservés (les plus récents).
9. Comportement sans `RCLONE_REMOTE` : avertissement unique loggé
   (`AVERTISSEMENT: RCLONE_REMOTE non défini, copie hors machine désactivée`),
   aucun échec du dump.

**Résultat : restauration complète réussie, 250/250 lignes vérifiées
identiques (comptage + empreinte MD5).** Conteneurs et volumes de test
supprimés après le test (aucune trace laissée sur la machine).

## Rappel trimestriel

Ce test de restauration doit être **rejoué manuellement tous les trimestres**
(prochaine échéance suggérée : à définir par l'équipe, ex. premier lundi du
trimestre) en suivant la procédure ci-dessus sur un dump réel de production,
restauré dans une base jetable — pas d'automatisation prévue pour l'instant
(YAGNI). Mettre à jour cette section avec la date et le résultat de chaque
re-test.

| Date | Résultat | Notes |
|------|----------|-------|
| 2026-07-08 | Succès | Test de livraison v3-14, données synthétiques (250 lignes), voir ci-dessus |
