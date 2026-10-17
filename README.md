# Time Report

Registro diario de horas profesionales por proyecto para un estudio de arquitectura. Separa horas ordinarias de extras, las valoriza con el costo por hora de cada miembro y arma informes mensuales y semanales.

- **Plan y decisiones:** [docs/PLAN.md](docs/PLAN.md)
- **Roadmap gráfico:** [docs/roadmap.html](docs/roadmap.html)
- **Instalación en la PC de la oficina:** [docs/INSTALACION.md](docs/INSTALACION.md)

## Qué hace (MVP)

| Rol | Puede |
|---|---|
| Profesional | Cargar horas **solo del día de hoy** en sus proyectos asignados y en los internos. Ver su mes. |
| Socio | Lo mismo + ver informes y descargar Excel. |
| Manager | Todo + proyectos, fases, equipo, horas contratadas, tarifas, feriados y cargar horas de días pasados en nombre de otro. |

Reglas de horas:

- Día hábil: las horas llenan la jornada diaria del miembro en el orden en que se cargan; lo que excede es **extra 50 %**.
- Sábado: extra 100 % (configurable con `REGLA_SABADO`).
- Domingo y feriado: **extra 100 %**.
- El día se cierra a las 23:59, hora de Tucumán, calculada en el servidor.

## Desarrollo

Requiere Node 22 y PostgreSQL 16.

```bash
npm install
cp .env.example .env.local   # completar DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev                  # http://localhost:3000; crea las tablas al arrancar
npm run demo                 # opcional: datos de ejemplo (solo en base de prueba)
npm test                     # tests de reglas
TEST_DATABASE_URL=postgres://... npm test   # + tests de integración contra una base vacía
```

Estructura:

```
src/lib/reglas.ts        clasificación ordinaria / extra (funciones puras)
src/lib/registros.ts     alta y baja de cargas, permisos por fecha, recálculo del día
src/lib/informes.ts      consultas de informes
src/lib/migraciones.ts   esquema de la base (se aplica solo al arrancar)
src/app/                 pantallas y acciones
```
