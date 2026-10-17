#!/bin/sh
# Backup diario de la base. Corre dentro del contenedor "backup" (ver docker-compose.yml).
# Guarda un archivo por día en /backups y borra los de más de DIAS_RETENCION días.
set -eu
HORA="${HORA_BACKUP:-02}"
RETENCION="${DIAS_RETENCION:-30}"

hacer_backup() {
  archivo="/backups/timereport_$(date +%Y-%m-%d_%H%M).dump"
  pg_dump -h db -U timereport -Fc -f "$archivo.tmp" timereport
  mv "$archivo.tmp" "$archivo"
  find /backups -name 'timereport_*.dump' -mtime +"$RETENCION" -delete
  echo "[backup] $(date '+%Y-%m-%d %H:%M') listo: $archivo"
}

if [ "${1:-}" = "ahora" ]; then
  hacer_backup
  exit 0
fi

echo "[backup] programado todos los días a las ${HORA} h, retención ${RETENCION} días"
ultimo=""
while true; do
  hoy="$(date +%Y-%m-%d)"
  if [ "$(date +%H)" = "$HORA" ] && [ "$ultimo" != "$hoy" ]; then
    hacer_backup && ultimo="$hoy"
  fi
  sleep 300
done
