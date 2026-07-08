#!/bin/sh
# scripts/backup.sh
#
# Boucle de sauvegarde Postgres pour l'environnement de production (service
# `db-backup` de docker-compose.prod.yml). Fait un pg_dump quotidien à
# BACKUP_HOUR:00 UTC, applique une rotation locale, et copie optionnellement
# hors machine via rclone si RCLONE_REMOTE est défini.
#
# Usage:
#   sh backup.sh          -> boucle infinie (comportement du service en prod)
#   sh backup.sh once      -> un seul cycle dump + rotation puis sortie
#                              (tests manuels, dump pré-migration en CI)
#
# Variables d'environnement:
#   BACKUP_DIR      dossier de sortie des dumps (défaut: /backups)
#   BACKUP_KEEP     nombre de dumps locaux conservés (défaut: 14)
#   BACKUP_HOUR     heure UTC (0-23) du dump quotidien (défaut: 3)
#   BACKUP_NAME     nom du fichier (sans .dump) pour un run "once" ponctuel,
#                   ex: pre-deploy-<sha> (défaut: oracle-YYYY-MM-DD)
#   PGHOST          hôte Postgres (défaut: db)
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB   credentials (réutilise
#                   les mêmes variables que le service `db`)
#   RCLONE_REMOTE   remote rclone (ex: s3:mon-bucket/oracle) — absent =
#                   copie hors machine désactivée
#   RCLONE_KEEP     nombre de dumps conservés côté remote (défaut: 30)

set -u

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_HOUR="${BACKUP_HOUR:-3}"
PGHOST="${PGHOST:-db}"
RCLONE_KEEP="${RCLONE_KEEP:-30}"
RCLONE_WARNED=0

export PGPASSWORD="${POSTGRES_PASSWORD:-}"

log() {
  echo "[backup] $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*"
}

ensure_rclone() {
  if command -v rclone >/dev/null 2>&1; then
    return 0
  fi
  log "installation de rclone..."
  if apk add --no-cache rclone >/dev/null 2>&1; then
    return 0
  fi
  log "[backup] ÉCHEC installation de rclone, copie hors machine désactivée"
  return 1
}

offsite_copy() {
  dump_file="$1"

  if [ -z "${RCLONE_REMOTE:-}" ]; then
    if [ "$RCLONE_WARNED" = "0" ]; then
      log "AVERTISSEMENT: RCLONE_REMOTE non défini, copie hors machine désactivée"
      RCLONE_WARNED=1
    fi
    return 0
  fi

  if ! ensure_rclone; then
    return 1
  fi

  if rclone copy "$dump_file" "${RCLONE_REMOTE}"; then
    log "copie hors machine réussie: $(basename "$dump_file") -> ${RCLONE_REMOTE}"
  else
    log "[backup] ÉCHEC copie hors machine de $(basename "$dump_file")"
    return 1
  fi

  rclone lsf "${RCLONE_REMOTE}" --files-only 2>/dev/null | grep -E '^oracle-[0-9]{4}-[0-9]{2}-[0-9]{2}\.dump$' | sort -r | tail -n "+$((RCLONE_KEEP + 1))" | while IFS= read -r old; do
    [ -z "$old" ] && continue
    if rclone deletefile "${RCLONE_REMOTE%/}/${old}"; then
      log "rotation distante: suppression de ${old}"
    else
      log "[backup] ÉCHEC suppression distante de ${old}"
    fi
  done
}

rotate_local() {
  ls -1t "$BACKUP_DIR"/oracle-*.dump 2>/dev/null | tail -n "+$((BACKUP_KEEP + 1))" | while IFS= read -r old; do
    [ -z "$old" ] && continue
    rm -f "$old"
    log "rotation locale: suppression de $(basename "$old")"
  done
}

do_backup() {
  mkdir -p "$BACKUP_DIR"
  name="${BACKUP_NAME:-oracle-$(date -u +'%Y-%m-%d')}"
  dump_file="$BACKUP_DIR/${name}.dump"
  tmp_file="${dump_file}.tmp"

  if pg_dump -Fc -h "$PGHOST" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "$tmp_file"; then
    mv "$tmp_file" "$dump_file"
    size="$(du -h "$dump_file" 2>/dev/null | cut -f1)"
    log "dump réussi: $(basename "$dump_file") (${size})"
  else
    log "[backup] ÉCHEC dump de ${name}"
    rm -f "$tmp_file"
    return 1
  fi

  # La rotation locale ne s'applique qu'aux dumps quotidiens réguliers
  # (oracle-YYYY-MM-DD.dump), pas aux dumps ponctuels (pre-deploy-*).
  case "$name" in
    oracle-*) rotate_local ;;
  esac

  offsite_copy "$dump_file"
}

# Secondes avant la prochaine occurrence de BACKUP_HOUR:00 UTC.
# N'utilise que des opérations sur epoch (pas de parsing "today"/"tomorrow",
# non supporté par le `date` de busybox/alpine).
seconds_until_next_run() {
  now="$(date -u +%s)"
  midnight=$((now - (now % 86400)))
  target=$((midnight + BACKUP_HOUR * 3600))
  if [ "$target" -le "$now" ]; then
    target=$((target + 86400))
  fi
  echo $((target - now))
}

main_loop() {
  log "démarrage du service de sauvegarde (heure planifiée: ${BACKUP_HOUR}h00 UTC, rétention locale: ${BACKUP_KEEP})"
  while true; do
    wait_s="$(seconds_until_next_run)"
    log "prochain dump dans ${wait_s}s"
    sleep "$wait_s"
    do_backup
  done
}

case "${1:-loop}" in
  once)
    do_backup
    ;;
  loop | *)
    main_loop
    ;;
esac
