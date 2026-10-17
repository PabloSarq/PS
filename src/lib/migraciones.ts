// Migraciones del esquema. Se aplican solas al arrancar el servidor (ver
// src/instrumentation.ts). Nunca editar una migración ya aplicada: agregar una nueva.

import { pool } from './db';
import { hashPassword } from './password';

const MIGRACIONES: { id: string; sql: string }[] = [
  {
    id: '001_inicial',
    sql: `
create table miembros (
  id serial primary key,
  nombre text not null,
  email text not null unique,
  password_hash text not null,
  rol text not null default 'profesional' check (rol in ('profesional', 'manager', 'socio')),
  jornada_diaria numeric(4,2) not null default 8 check (jornada_diaria >= 0 and jornada_diaria <= 24),
  tope_extras_mes numeric(6,2) check (tope_extras_mes >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table sesiones (
  token_hash text primary key,
  miembro_id int not null references miembros(id) on delete cascade,
  expira timestamptz not null,
  creado_en timestamptz not null default now()
);
create index sesiones_miembro on sesiones(miembro_id);

create table contratos_mensuales (
  miembro_id int not null references miembros(id) on delete cascade,
  anio_mes char(7) not null,
  horas numeric(6,2) not null check (horas >= 0),
  primary key (miembro_id, anio_mes)
);

-- Costo por hora para el estudio. La tarifa vigente en una fecha es la de
-- vigente_desde más reciente que no la supere.
create table tarifas (
  id serial primary key,
  miembro_id int not null references miembros(id) on delete cascade,
  vigente_desde date not null,
  costo_ordinaria numeric(12,2) not null check (costo_ordinaria >= 0),
  costo_extra50 numeric(12,2) not null check (costo_extra50 >= 0),
  costo_extra100 numeric(12,2) not null check (costo_extra100 >= 0),
  unique (miembro_id, vigente_desde)
);

create table proyectos (
  id serial primary key,
  codigo text not null unique,
  nombre text not null,
  cliente text,
  estado text not null default 'activo' check (estado in ('activo', 'pausado', 'cerrado')),
  horas_presupuestadas numeric(8,2) check (horas_presupuestadas >= 0),
  interno boolean not null default false,
  creado_en timestamptz not null default now()
);

create table fases (
  id serial primary key,
  proyecto_id int not null references proyectos(id) on delete cascade,
  nombre text not null,
  orden int not null default 0,
  unique (proyecto_id, nombre)
);

create table asignaciones (
  proyecto_id int not null references proyectos(id) on delete cascade,
  miembro_id int not null references miembros(id) on delete cascade,
  primary key (proyecto_id, miembro_id)
);

create table feriados (
  fecha date primary key,
  descripcion text not null,
  ambito text not null default 'nacional' check (ambito in ('nacional', 'provincial', 'estudio'))
);

-- Una fila por carga. horas_ord / horas_ex50 / horas_ex100 se recalculan para
-- todo el día cada vez que cambia una carga de ese miembro en esa fecha.
create table registros (
  id bigserial primary key,
  miembro_id int not null references miembros(id),
  proyecto_id int not null references proyectos(id),
  fase_id int references fases(id) on delete set null,
  fecha date not null,
  horas numeric(4,2) not null check (horas > 0 and horas <= 24),
  horas_ord numeric(4,2) not null default 0,
  horas_ex50 numeric(4,2) not null default 0,
  horas_ex100 numeric(4,2) not null default 0,
  nota text,
  cargado_por int not null references miembros(id),
  creado_en timestamptz not null default now()
);
create index registros_miembro_fecha on registros(miembro_id, fecha);
create index registros_proyecto_fecha on registros(proyecto_id, fecha);
create index registros_fecha on registros(fecha);

create table auditoria (
  id bigserial primary key,
  miembro_id int references miembros(id),
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb,
  creado_en timestamptz not null default now()
);
create index auditoria_fecha on auditoria(creado_en);

create view v_registros_costo as
select r.*,
  coalesce(t.costo_ordinaria, 0) as costo_ordinaria,
  coalesce(t.costo_extra50, 0) as costo_extra50,
  coalesce(t.costo_extra100, 0) as costo_extra100,
  (t.id is null) as sin_tarifa,
  r.horas_ord * coalesce(t.costo_ordinaria, 0)
    + r.horas_ex50 * coalesce(t.costo_extra50, 0)
    + r.horas_ex100 * coalesce(t.costo_extra100, 0) as costo
from registros r
left join lateral (
  select * from tarifas t
  where t.miembro_id = r.miembro_id and t.vigente_desde <= r.fecha
  order by t.vigente_desde desc
  limit 1
) t on true;
`,
  },
];

export async function migrar(): Promise<void> {
  const c = await pool.connect();
  try {
    // Evita que dos procesos migren a la vez.
    await c.query('select pg_advisory_lock(727001)');
    await c.query(
      'create table if not exists migraciones (id text primary key, aplicada_en timestamptz not null default now())',
    );
    const { rows } = await c.query<{ id: string }>('select id from migraciones');
    const aplicadas = new Set(rows.map((r) => r.id));
    for (const m of MIGRACIONES) {
      if (aplicadas.has(m.id)) continue;
      await c.query('begin');
      try {
        await c.query(m.sql);
        await c.query('insert into migraciones (id) values ($1)', [m.id]);
        await c.query('commit');
        console.log(`[migraciones] aplicada ${m.id}`);
      } catch (e) {
        await c.query('rollback');
        throw e;
      }
    }
    await datosIniciales(c);
  } finally {
    await c.query('select pg_advisory_unlock(727001)').catch(() => {});
    c.release();
  }
}

async function datosIniciales(c: import('pg').PoolClient): Promise<void> {
  const { rows } = await c.query<{ n: number }>('select count(*)::int as n from miembros');
  if (rows[0].n > 0) return;

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('[inicio] No hay miembros. Definí ADMIN_EMAIL y ADMIN_PASSWORD para crear el primer manager.');
    return;
  }
  await c.query(
    `insert into miembros (nombre, email, password_hash, rol) values ($1, $2, $3, 'manager')`,
    [process.env.ADMIN_NOMBRE || 'Manager', email, await hashPassword(password)],
  );
  // Proyectos internos para horas no productivas; los ve todo el equipo.
  await c.query(`
    insert into proyectos (codigo, nombre, interno) values
      ('INT-ADM', 'Administración', true),
      ('INT-CON', 'Concursos y propuestas', true),
      ('INT-CAP', 'Capacitación', true)
    on conflict (codigo) do nothing`);
  // Solo feriados de fecha fija. Los trasladables y los provinciales se cargan
  // desde Administración > Feriados con el calendario oficial de cada año.
  await c.query(`
    insert into feriados (fecha, descripcion, ambito) values
      ('2026-12-08', 'Inmaculada Concepción de María', 'nacional'),
      ('2026-12-25', 'Navidad', 'nacional'),
      ('2027-01-01', 'Año Nuevo', 'nacional')
    on conflict (fecha) do nothing`);
  console.log(`[inicio] Creado el manager ${email}`);
}
