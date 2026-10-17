# Instalación en la PC de la oficina

Instructivo para dejar el Time Report funcionando en una PC del estudio. Lo puede hacer alguien con manejo básico de computadoras; si nunca usaste una terminal, conviene que lo haga un técnico la primera vez (1–2 horas).

---

## 1. Qué hace falta

| | Mínimo |
|---|---|
| PC | 8 GB de RAM, 20 GB libres de disco. Prendida las 24 h, solo para esto. |
| Sistema | **Ubuntu 24.04** (recomendado) o Windows 10/11 con Docker Desktop |
| Red | Cable de red al router. IP fija reservada en el router. |
| Internet | Solo para acceso desde afuera de la oficina y para la copia en Drive. |

**Sobre Windows:** Docker Desktop es gratis para empresas de menos de 250 empleados y menos de USD 10 M de facturación anual. Docker Desktop arranca recién cuando alguien inicia sesión en Windows; si la PC se reinicia sola (corte de luz, actualización), el sistema queda caído hasta que alguien entre. Por eso en una PC dedicada conviene Ubuntu.

En cualquier caso: **desactivar la suspensión y la hibernación** de la PC.

---

## 2. Instalar

### Ubuntu

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
git clone https://github.com/pablosarq/ps.git time-report
cd time-report
cp .env.example .env
nano .env          # completar (ver abajo)
sudo docker compose up -d --build
```

### Windows

1. Instalar [Docker Desktop](https://www.docker.com/products/docker-desktop/) y [Git](https://git-scm.com/download/win).
2. En Docker Desktop: *Settings → General → Start Docker Desktop when you sign in*.
3. Abrir **PowerShell** y correr:

```powershell
git clone https://github.com/pablosarq/ps.git time-report
cd time-report
copy .env.example .env
notepad .env       # completar (ver abajo)
docker compose up -d --build
```

### Qué completar en `.env`

| Variable | Qué poner |
|---|---|
| `DB_PASSWORD` | Una contraseña larga inventada. No se usa para entrar a la app. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Email y contraseña del primer manager. |
| `NOMBRE_ESTUDIO` | Aparece arriba en la pantalla. |
| `REGLA_SABADO` | `extra100` o `extra50`. Confirmar con el contador. |

La primera vez tarda unos minutos. Para ver que esté todo arriba:

```bash
docker compose ps        # los 3 servicios tienen que decir "Up"
```

---

## 3. Primer ingreso y configuración

1. En la misma PC, abrir `http://localhost:3000` y entrar con el email de `ADMIN_EMAIL`.
2. **Mi cuenta → Cambiar contraseña.**
3. Cargar, en este orden:
   1. **Feriados** del año. Vienen precargados solo 8/12, 25/12 y 1/1. Los demás (incluidos los trasladables y el 24/9 provincial) se cargan con el calendario oficial.
   2. **Equipo:** cada miembro con su jornada diaria. Después, en su ficha: **horas contratadas del mes** y **tarifa** (costo por hora ordinaria, extra 50 % y extra 100 %).
   3. **Proyectos:** código, nombre, horas presupuestadas, fases (opcional) y el equipo asignado.
4. Pasarle a cada persona su email, la contraseña inicial y la dirección de acceso.

---

## 4. Acceso desde la red de la oficina

1. En el router, reservar una IP fija para la PC servidor (ej. `192.168.1.50`).
2. Desde cualquier PC o celular conectado al wifi de la oficina: `http://192.168.1.50:3000`.
3. En Windows, si no conecta: permitir el puerto 3000 en el Firewall de Windows.

---

## 5. Acceso desde afuera (casa, obra, fines de semana)

Se usa **Cloudflare Tunnel** (gratis). No hace falta abrir puertos en el router. Requiere que el dominio del estudio esté administrado en Cloudflare (la cuenta es gratis; se cambian los DNS del dominio donde esté registrado).

1. En [Cloudflare](https://dash.cloudflare.com) → *Zero Trust → Networks → Tunnels → Create a tunnel* → tipo *Cloudflared*.
2. Copiar el **token** que muestra y pegarlo en `.env` como `TUNNEL_TOKEN`.
3. En el túnel, agregar un *Public hostname*: por ejemplo `horas.tudominio.com` → servicio `http://app:3000`.
4. En `.env`, poner `COOKIE_SECURE=true`.
5. Reiniciar con el túnel:

```bash
docker compose --profile tunel up -d
```

Desde ese momento **todos entran por `https://horas.tudominio.com`**, también dentro de la oficina. Con `COOKIE_SECURE=true` el acceso por `http://IP:3000` deja de mantener la sesión.

Los nombres de los menús de Cloudflare cambian seguido. Si alguno no coincide, buscá "Cloudflare Tunnel" en su documentación.

---

## 6. Backups

- Todos los días a las 2 AM se guarda una copia de la base en la carpeta `backups/` (un archivo `.dump` por día; se conservan 30 días).
- **Copia fuera de la PC:** instalar *Google Drive para escritorio* con la cuenta del estudio y agregar la carpeta `backups/` a las carpetas sincronizadas. Si se rompe o se roban la PC, los datos quedan en Drive.
- **Control semanal (2 minutos):** mirar que en `backups/` haya un archivo con la fecha de ayer.

Backup manual en el momento:

```bash
docker compose exec backup /bin/sh /backup.sh ahora
```

Restaurar un backup (reemplaza todos los datos actuales):

```bash
docker compose stop app
docker compose exec backup sh -c "dropdb -h db -U timereport timereport && createdb -h db -U timereport timereport && pg_restore -h db -U timereport -d timereport /backups/ARCHIVO.dump"
docker compose start app
```

---

## 7. Actualizar a una versión nueva

```bash
cd time-report
git pull
docker compose up -d --build
```

Los datos no se tocan: la base vive en un volumen aparte y los cambios de estructura se aplican solos al arrancar.

---

## 8. Problemas comunes

| Síntoma | Qué hacer |
|---|---|
| No abre la página | `docker compose ps`. Si algo no está "Up": `docker compose up -d`. |
| Se cortó la luz | La PC tiene que arrancar sola (BIOS: *Restore on AC power loss → On*). Docker levanta todo solo. |
| Alguien se olvidó la contraseña | Manager → Equipo → la persona → *Asignar contraseña nueva*. |
| Alguien se olvidó de cargar un día | Manager → *Cargar por otro*. |
| Ver errores | `docker compose logs app --tail 100` |
