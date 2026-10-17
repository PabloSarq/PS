// Alta, baja y recálculo de cargas de horas. Toda la lógica de permisos de
// fecha vive acá: el profesional solo toca el día de hoy; el manager puede
// cargar o borrar en cualquier día hasta hoy, en nombre de cualquier miembro.

import type { PoolClient } from 'pg';
import { auditar } from './auditoria';
import type { Usuario } from './auth';
import { q, tx } from './db';
import { esFechaISO, hoyISO } from './fechas';
import { clasificarDia, tipoDeDia, validarHoras } from './reglas';

export class ErrorCarga extends Error {}

export interface ProyectoOpcion {
  id: number;
  codigo: string;
  nombre: string;
  interno: boolean;
}

export interface FaseOpcion {
  id: number;
  proyecto_id: number;
  nombre: string;
}

/** Proyectos donde un miembro puede cargar: activos y asignados, o internos. */
export async function proyectosDisponibles(miembroId: number): Promise<ProyectoOpcion[]> {
  return q<ProyectoOpcion>(
    `select p.id, p.codigo, p.nombre, p.interno
       from proyectos p
      where p.estado = 'activo'
        and (p.interno or exists (select 1 from asignaciones a where a.proyecto_id = p.id and a.miembro_id = $1))
      order by p.interno, p.codigo`,
    [miembroId],
  );
}

export async function fasesDe(proyectoIds: number[]): Promise<FaseOpcion[]> {
  if (proyectoIds.length === 0) return [];
  return q<FaseOpcion>(
    'select id, proyecto_id, nombre from fases where proyecto_id = any($1) order by orden, nombre',
    [proyectoIds],
  );
}

export async function recalcularDia(c: PoolClient, miembroId: number, fecha: string): Promise<void> {
  const fer = await c.query('select 1 from feriados where fecha = $1', [fecha]);
  const m = await c.query<{ jornada_diaria: number }>('select jornada_diaria from miembros where id = $1', [miembroId]);
  const filas = await c.query<{ id: number; horas: number }>(
    'select id, horas from registros where miembro_id = $1 and fecha = $2 order by creado_en, id',
    [miembroId, fecha],
  );
  const desglose = clasificarDia(
    filas.rows.map((r) => r.horas),
    tipoDeDia(fecha, (fer.rowCount ?? 0) > 0),
    m.rows[0]?.jornada_diaria ?? 0,
  );
  for (let i = 0; i < filas.rows.length; i++) {
    const d = desglose[i];
    await c.query('update registros set horas_ord = $2, horas_ex50 = $3, horas_ex100 = $4 where id = $1', [
      filas.rows[i].id,
      d.ord,
      d.ex50,
      d.ex100,
    ]);
  }
}

/** Recalcula todos los días de una fecha (se usa al agregar o quitar un feriado). */
export async function recalcularFecha(c: PoolClient, fecha: string): Promise<void> {
  const r = await c.query<{ miembro_id: number }>('select distinct miembro_id from registros where fecha = $1', [fecha]);
  for (const row of r.rows) await recalcularDia(c, row.miembro_id, fecha);
}

function verificarFecha(actor: Usuario, miembroId: number, fecha: string): void {
  if (!esFechaISO(fecha)) throw new ErrorCarga('Fecha inválida.');
  const hoy = hoyISO();
  if (fecha > hoy) throw new ErrorCarga('No se pueden cargar horas en días futuros.');
  if (actor.rol === 'manager') return;
  if (miembroId !== actor.id) throw new ErrorCarga('Solo podés cargar tus propias horas.');
  if (fecha !== hoy)
    throw new ErrorCarga('El día ya está cerrado. Pedile al manager que cargue las horas que faltan.');
}

export interface NuevaCarga {
  miembroId: number;
  proyectoId: number;
  faseId: number | null;
  fecha: string;
  horas: number;
  nota: string;
}

export async function agregarRegistro(actor: Usuario, d: NuevaCarga): Promise<void> {
  verificarFecha(actor, d.miembroId, d.fecha);
  await tx(async (c) => {
    // Serializa las cargas de un mismo miembro.
    const m = await c.query<{ activo: boolean }>('select activo from miembros where id = $1 for update', [d.miembroId]);
    if (!m.rows[0]?.activo) throw new ErrorCarga('El miembro no existe o está inactivo.');

    const disponibles = await c.query(
      `select 1 from proyectos p
        where p.id = $1 and p.estado = 'activo'
          and (p.interno or exists (select 1 from asignaciones a where a.proyecto_id = p.id and a.miembro_id = $2))`,
      [d.proyectoId, d.miembroId],
    );
    if (!disponibles.rowCount) throw new ErrorCarga('El proyecto no está disponible para este miembro.');

    if (d.faseId !== null) {
      const f = await c.query('select 1 from fases where id = $1 and proyecto_id = $2', [d.faseId, d.proyectoId]);
      if (!f.rowCount) throw new ErrorCarga('La fase no corresponde al proyecto.');
    }

    const suma = await c.query<{ total: number }>(
      'select coalesce(sum(horas), 0) as total from registros where miembro_id = $1 and fecha = $2',
      [d.miembroId, d.fecha],
    );
    const error = validarHoras(d.horas, suma.rows[0].total);
    if (error) throw new ErrorCarga(error);

    const ins = await c.query<{ id: number }>(
      `insert into registros (miembro_id, proyecto_id, fase_id, fecha, horas, nota, cargado_por)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [d.miembroId, d.proyectoId, d.faseId, d.fecha, d.horas, d.nota || null, actor.id],
    );
    await recalcularDia(c, d.miembroId, d.fecha);
    await auditar(actor.id, 'crear', 'registro', ins.rows[0].id, d, c);
  });
}

export async function eliminarRegistro(actor: Usuario, registroId: number): Promise<void> {
  await tx(async (c) => {
    const r = await c.query<{ miembro_id: number; fecha: string; horas: number; proyecto_id: number }>(
      'select miembro_id, fecha, horas, proyecto_id from registros where id = $1',
      [registroId],
    );
    const reg = r.rows[0];
    if (!reg) throw new ErrorCarga('La carga ya no existe.');
    verificarFecha(actor, reg.miembro_id, reg.fecha);
    await c.query('select 1 from miembros where id = $1 for update', [reg.miembro_id]);
    await c.query('delete from registros where id = $1', [registroId]);
    await recalcularDia(c, reg.miembro_id, reg.fecha);
    await auditar(actor.id, 'eliminar', 'registro', registroId, reg, c);
  });
}

export interface RegistroDia {
  id: number;
  proyecto_codigo: string;
  proyecto_nombre: string;
  fase_nombre: string | null;
  horas: number;
  horas_ord: number;
  horas_ex50: number;
  horas_ex100: number;
  nota: string | null;
  cargado_por_otro: boolean;
}

export async function registrosDelDia(miembroId: number, fecha: string): Promise<RegistroDia[]> {
  return q<RegistroDia>(
    `select r.id, p.codigo as proyecto_codigo, p.nombre as proyecto_nombre, f.nombre as fase_nombre,
            r.horas, r.horas_ord, r.horas_ex50, r.horas_ex100, r.nota,
            (r.cargado_por <> r.miembro_id) as cargado_por_otro
       from registros r
       join proyectos p on p.id = r.proyecto_id
       left join fases f on f.id = r.fase_id
      where r.miembro_id = $1 and r.fecha = $2
      order by r.creado_en, r.id`,
    [miembroId, fecha],
  );
}

export async function esFeriado(fecha: string): Promise<string | null> {
  const r = await q<{ descripcion: string }>('select descripcion from feriados where fecha = $1', [fecha]);
  return r[0]?.descripcion ?? null;
}
