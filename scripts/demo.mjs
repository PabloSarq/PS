// Carga datos de EJEMPLO para probar el sistema: 4 miembros, 3 proyectos con
// fases y horas en los días hábiles del mes en curso hasta ayer.
// Usar solo en una base de prueba: `DATABASE_URL=... npm run demo`.

import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

const TZ = 'America/Argentina/Tucuman';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const hash = (pw) => {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 64).toString('hex')}`;
};

const { rows: ya } = await db.query("select 1 from miembros where email like '%@demo.test'");
if (ya.length) {
  console.log('Los datos de ejemplo ya están cargados.');
  process.exit(0);
}

const miembros = [
  ['Ana Ruiz', 'ana@demo.test', 'profesional', 8, 160, 9000],
  ['Martín Paz', 'martin@demo.test', 'profesional', 8, 160, 8000],
  ['Lucía Gómez', 'lucia@demo.test', 'profesional', 6, 120, 7500],
  ['Álvaro Sánchez', 'alvaro@demo.test', 'socio', 8, 160, 15000],
];
const ids = [];
for (const [nombre, email, rol, jornada, contratadas, costo] of miembros) {
  const { rows } = await db.query(
    `insert into miembros (nombre, email, password_hash, rol, jornada_diaria, tope_extras_mes, creado_en)
     values ($1, $2, $3, $4, $5, 20, $6::date - 30) returning id`,
    [nombre, email, hash('demo1234'), rol, jornada, hoy],
  );
  const id = rows[0].id;
  ids.push(id);
  await db.query('insert into contratos_mensuales values ($1, $2, $3)', [id, hoy.slice(0, 7), contratadas]);
  await db.query(
    'insert into tarifas (miembro_id, vigente_desde, costo_ordinaria, costo_extra50, costo_extra100) values ($1, $2, $3, $4, $5)',
    [id, `${hoy.slice(0, 7)}-01`, costo, costo * 1.5, costo * 2],
  );
}

const proyectos = [
  ['SDT-01', 'Solar de las Tipas', 'Fideicomiso SDT', 900, ['Anteproyecto', 'Proyecto ejecutivo', 'Dirección de obra']],
  ['PAC-02', 'Paseo comercial Av. Aconquija', 'Consorcio Aconquija', 400, ['Relevamiento', 'Anteproyecto']],
  ['ASU-03', 'Torres Asunción', 'Desarrolladora PY', 1500, ['Masterplan', 'Anteproyecto']],
];
const pids = [];
for (const [codigo, nombre, cliente, horas, fases] of proyectos) {
  const { rows } = await db.query(
    'insert into proyectos (codigo, nombre, cliente, horas_presupuestadas) values ($1, $2, $3, $4) returning id',
    [codigo, nombre, cliente, horas],
  );
  pids.push(rows[0].id);
  for (const [i, f] of fases.entries()) await db.query('insert into fases (proyecto_id, nombre, orden) values ($1, $2, $3)', [rows[0].id, f, i]);
  for (const mid of ids) await db.query('insert into asignaciones values ($1, $2)', [rows[0].id, mid]);
}
const { rows: internos } = await db.query("select id from proyectos where codigo = 'INT-ADM'");

// Horas en días hábiles del mes hasta ayer; algunos días con extras y alguno sin carga.
const desde = `${hoy.slice(0, 7)}-01`;
let semilla = 7;
const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
for (let d = new Date(desde + 'T12:00:00Z'); d.toISOString().slice(0, 10) < hoy; d.setUTCDate(d.getUTCDate() + 1)) {
  const fecha = d.toISOString().slice(0, 10);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) continue;
  for (const [i, mid] of ids.entries()) {
    if (azar() < 0.06) continue; // olvidó cargar
    const jornada = miembros[i][3];
    const total = jornada + (azar() < 0.2 ? 2 : 0);
    const bloques = [Math.min(total, 4), Math.max(0, total - 4 - 1), 1].filter((h) => h > 0);
    let restante = jornada;
    for (const [j, h] of bloques.entries()) {
      const proyecto = j === 2 ? internos[0].id : pids[Math.floor(azar() * pids.length)];
      const ord = Math.min(h, restante);
      restante -= ord;
      await db.query(
        `insert into registros (miembro_id, proyecto_id, fecha, horas, horas_ord, horas_ex50, cargado_por, creado_en)
         values ($1, $2, $3, $4, $5, $6, $1, $3::date + interval '9 hours' + ($7 || ' minutes')::interval)`,
        [mid, proyecto, fecha, h, ord, h - ord, j],
      );
    }
  }
}
console.log(`Datos de ejemplo cargados. Usuarios: ana@demo.test, martin@demo.test, lucia@demo.test, alvaro@demo.test (contraseña demo1234).`);
await db.end();
