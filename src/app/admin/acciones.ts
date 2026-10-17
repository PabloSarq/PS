'use server';

import { redirect } from 'next/navigation';
import { auditar } from '@/lib/auditoria';
import { requireRol } from '@/lib/auth';
import { q, tx } from '@/lib/db';
import { esAnioMes, esFechaISO } from '@/lib/fechas';
import { hashPassword, validarPasswordNueva } from '@/lib/password';
import { agregarRegistro, ErrorCarga, recalcularFecha } from '@/lib/registros';

class ErrorDatos extends Error {}

const ir = (ruta: string, tipo: 'error' | 'ok', msg: string): never =>
  redirect(`${ruta}${ruta.includes('?') ? '&' : '?'}${tipo}=${encodeURIComponent(msg)}`);

const texto = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').trim().slice(0, max);

function numero(fd: FormData, k: string, opcional = false): number | null {
  const v = String(fd.get(k) ?? '').trim().replace(',', '.');
  if (v === '') {
    if (opcional) return null;
    throw new ErrorDatos(`Falta completar "${k.replace(/_/g, ' ')}".`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ErrorDatos(`"${k.replace(/_/g, ' ')}" tiene que ser un número positivo.`);
  return n;
}

/** Ejecuta una acción del manager y traduce los errores esperables a un mensaje. */
async function ejecutar(ruta: string, okMsg: string, fn: (actorId: number) => Promise<string | void>): Promise<never> {
  const u = await requireRol('manager');
  let destino = ruta;
  try {
    destino = (await fn(u.id)) || ruta;
  } catch (e) {
    if (e instanceof ErrorDatos || e instanceof ErrorCarga) ir(ruta, 'error', e.message);
    const code = (e as { code?: string }).code;
    if (code === '23505') ir(ruta, 'error', 'Ya existe un registro con ese dato (código, email o fecha repetidos).');
    if (code === '23503') ir(ruta, 'error', 'No se puede borrar porque tiene horas cargadas asociadas.');
    throw e;
  }
  return ir(destino, 'ok', okMsg);
}

// ---------- Proyectos ----------

function leerProyecto(fd: FormData) {
  const codigo = texto(fd, 'codigo', 30).toUpperCase();
  const nombre = texto(fd, 'nombre');
  if (!codigo || !nombre) throw new ErrorDatos('Código y nombre son obligatorios.');
  const estado = texto(fd, 'estado') || 'activo';
  if (!['activo', 'pausado', 'cerrado'].includes(estado)) throw new ErrorDatos('Estado inválido.');
  return {
    codigo,
    nombre,
    cliente: texto(fd, 'cliente') || null,
    estado,
    horas: numero(fd, 'horas_presupuestadas', true),
    interno: fd.get('interno') === 'on',
  };
}

export async function crearProyectoAccion(fd: FormData) {
  await ejecutar('/admin/proyectos', 'Proyecto creado.', async (actor) => {
    const p = leerProyecto(fd);
    const r = await q<{ id: number }>(
      `insert into proyectos (codigo, nombre, cliente, estado, horas_presupuestadas, interno)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [p.codigo, p.nombre, p.cliente, p.estado, p.horas, p.interno],
    );
    await auditar(actor, 'crear', 'proyecto', r[0].id, p);
    return `/admin/proyectos/${r[0].id}`;
  });
}

export async function editarProyectoAccion(fd: FormData) {
  const id = Number(fd.get('id'));
  await ejecutar(`/admin/proyectos/${id}`, 'Proyecto actualizado.', async (actor) => {
    const p = leerProyecto(fd);
    await q(
      `update proyectos set codigo = $2, nombre = $3, cliente = $4, estado = $5, horas_presupuestadas = $6, interno = $7
        where id = $1`,
      [id, p.codigo, p.nombre, p.cliente, p.estado, p.horas, p.interno],
    );
    await auditar(actor, 'editar', 'proyecto', id, p);
  });
}

export async function agregarFaseAccion(fd: FormData) {
  const id = Number(fd.get('proyecto_id'));
  await ejecutar(`/admin/proyectos/${id}`, 'Fase agregada.', async (actor) => {
    const nombre = texto(fd, 'nombre', 80);
    if (!nombre) throw new ErrorDatos('Escribí el nombre de la fase.');
    await q(
      'insert into fases (proyecto_id, nombre, orden) values ($1, $2, (select coalesce(max(orden), 0) + 1 from fases where proyecto_id = $1))',
      [id, nombre],
    );
    await auditar(actor, 'crear', 'fase', id, { nombre });
  });
}

export async function eliminarFaseAccion(fd: FormData) {
  const id = Number(fd.get('proyecto_id'));
  await ejecutar(`/admin/proyectos/${id}`, 'Fase eliminada. Las horas que tenía quedan en el proyecto sin fase.', async (actor) => {
    await q('delete from fases where id = $1 and proyecto_id = $2', [Number(fd.get('fase_id')), id]);
    await auditar(actor, 'eliminar', 'fase', String(fd.get('fase_id')));
  });
}

export async function guardarAsignacionesAccion(fd: FormData) {
  const id = Number(fd.get('proyecto_id'));
  await ejecutar(`/admin/proyectos/${id}`, 'Equipo del proyecto actualizado.', async (actor) => {
    const miembros = fd.getAll('miembro').map(Number).filter((n) => Number.isInteger(n) && n > 0);
    await tx(async (c) => {
      await c.query('delete from asignaciones where proyecto_id = $1', [id]);
      if (miembros.length)
        await c.query(
          'insert into asignaciones (proyecto_id, miembro_id) select $1, unnest($2::int[]) on conflict do nothing',
          [id, miembros],
        );
      await auditar(actor, 'asignar', 'proyecto', id, { miembros }, c);
    });
  });
}

// ---------- Miembros ----------

const ROLES = ['profesional', 'manager', 'socio'];

export async function crearMiembroAccion(fd: FormData) {
  await ejecutar('/admin/miembros', 'Miembro creado.', async (actor) => {
    const nombre = texto(fd, 'nombre');
    const email = texto(fd, 'email').toLowerCase();
    const rol = texto(fd, 'rol');
    const password = String(fd.get('password') ?? '');
    if (!nombre || !email) throw new ErrorDatos('Nombre y email son obligatorios.');
    if (!ROLES.includes(rol)) throw new ErrorDatos('Rol inválido.');
    const errPw = validarPasswordNueva(password);
    if (errPw) throw new ErrorDatos(errPw);
    const jornada = numero(fd, 'jornada_diaria') ?? 8;
    if (jornada > 24) throw new ErrorDatos('La jornada no puede superar 24 horas.');
    const r = await q<{ id: number }>(
      `insert into miembros (nombre, email, password_hash, rol, jornada_diaria, tope_extras_mes)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [nombre, email, await hashPassword(password), rol, jornada, numero(fd, 'tope_extras_mes', true)],
    );
    await auditar(actor, 'crear', 'miembro', r[0].id, { nombre, email, rol, jornada });
    return `/admin/miembros/${r[0].id}`;
  });
}

export async function editarMiembroAccion(fd: FormData) {
  const id = Number(fd.get('id'));
  await ejecutar(`/admin/miembros/${id}`, 'Datos actualizados.', async (actor) => {
    const nombre = texto(fd, 'nombre');
    const email = texto(fd, 'email').toLowerCase();
    const rol = texto(fd, 'rol');
    const activo = fd.get('activo') === 'on';
    if (!nombre || !email) throw new ErrorDatos('Nombre y email son obligatorios.');
    if (!ROLES.includes(rol)) throw new ErrorDatos('Rol inválido.');
    if (id === actor && (rol !== 'manager' || !activo))
      throw new ErrorDatos('No podés quitarte el rol de manager ni desactivarte a vos mismo.');
    const jornada = numero(fd, 'jornada_diaria') ?? 8;
    if (jornada > 24) throw new ErrorDatos('La jornada no puede superar 24 horas.');
    const tope = numero(fd, 'tope_extras_mes', true);
    await q(
      `update miembros set nombre = $2, email = $3, rol = $4, jornada_diaria = $5, tope_extras_mes = $6, activo = $7
        where id = $1`,
      [id, nombre, email, rol, jornada, tope, activo],
    );
    if (!activo) await q('delete from sesiones where miembro_id = $1', [id]);
    await auditar(actor, 'editar', 'miembro', id, { nombre, email, rol, jornada, tope, activo });
  });
}

export async function resetPasswordAccion(fd: FormData) {
  const id = Number(fd.get('id'));
  await ejecutar(`/admin/miembros/${id}`, 'Contraseña asignada. Pasásela al miembro para que la cambie.', async (actor) => {
    const password = String(fd.get('password') ?? '');
    const err = validarPasswordNueva(password);
    if (err) throw new ErrorDatos(err);
    await q('update miembros set password_hash = $2 where id = $1', [id, await hashPassword(password)]);
    await q('delete from sesiones where miembro_id = $1', [id]);
    await auditar(actor, 'reset_password', 'miembro', id);
  });
}

export async function guardarContratoAccion(fd: FormData) {
  const id = Number(fd.get('miembro_id'));
  await ejecutar(`/admin/miembros/${id}`, 'Horas contratadas guardadas.', async (actor) => {
    const mes = texto(fd, 'anio_mes');
    if (!esAnioMes(mes)) throw new ErrorDatos('Elegí un mes válido.');
    const horas = numero(fd, 'horas');
    await q(
      `insert into contratos_mensuales (miembro_id, anio_mes, horas) values ($1, $2, $3)
       on conflict (miembro_id, anio_mes) do update set horas = excluded.horas`,
      [id, mes, horas],
    );
    await auditar(actor, 'guardar', 'contrato', `${id}:${mes}`, { horas });
  });
}

export async function eliminarContratoAccion(fd: FormData) {
  const id = Number(fd.get('miembro_id'));
  await ejecutar(`/admin/miembros/${id}`, 'Mes eliminado.', async (actor) => {
    const mes = texto(fd, 'anio_mes');
    await q('delete from contratos_mensuales where miembro_id = $1 and anio_mes = $2', [id, mes]);
    await auditar(actor, 'eliminar', 'contrato', `${id}:${mes}`);
  });
}

export async function agregarTarifaAccion(fd: FormData) {
  const id = Number(fd.get('miembro_id'));
  await ejecutar(`/admin/miembros/${id}`, 'Tarifa guardada.', async (actor) => {
    const desde = texto(fd, 'vigente_desde');
    if (!esFechaISO(desde)) throw new ErrorDatos('Elegí la fecha desde la que rige la tarifa.');
    const t = {
      ord: numero(fd, 'costo_ordinaria'),
      ex50: numero(fd, 'costo_extra50'),
      ex100: numero(fd, 'costo_extra100'),
    };
    await q(
      `insert into tarifas (miembro_id, vigente_desde, costo_ordinaria, costo_extra50, costo_extra100)
       values ($1, $2, $3, $4, $5)
       on conflict (miembro_id, vigente_desde) do update
         set costo_ordinaria = excluded.costo_ordinaria, costo_extra50 = excluded.costo_extra50, costo_extra100 = excluded.costo_extra100`,
      [id, desde, t.ord, t.ex50, t.ex100],
    );
    await auditar(actor, 'guardar', 'tarifa', `${id}:${desde}`, t);
  });
}

export async function eliminarTarifaAccion(fd: FormData) {
  const id = Number(fd.get('miembro_id'));
  await ejecutar(`/admin/miembros/${id}`, 'Tarifa eliminada.', async (actor) => {
    await q('delete from tarifas where id = $1 and miembro_id = $2', [Number(fd.get('tarifa_id')), id]);
    await auditar(actor, 'eliminar', 'tarifa', String(fd.get('tarifa_id')));
  });
}

// ---------- Feriados ----------

export async function agregarFeriadoAccion(fd: FormData) {
  await ejecutar('/admin/feriados', 'Feriado agregado. Las horas de ese día se recalcularon como extra.', async (actor) => {
    const fecha = texto(fd, 'fecha');
    const descripcion = texto(fd, 'descripcion', 120);
    const ambito = texto(fd, 'ambito') || 'nacional';
    if (!esFechaISO(fecha) || !descripcion) throw new ErrorDatos('Completá fecha y descripción.');
    if (!['nacional', 'provincial', 'estudio'].includes(ambito)) throw new ErrorDatos('Ámbito inválido.');
    await tx(async (c) => {
      await c.query('insert into feriados (fecha, descripcion, ambito) values ($1, $2, $3)', [fecha, descripcion, ambito]);
      await recalcularFecha(c, fecha);
      await auditar(actor, 'crear', 'feriado', fecha, { descripcion, ambito }, c);
    });
    return `/admin/feriados?anio=${fecha.slice(0, 4)}`;
  });
}

export async function eliminarFeriadoAccion(fd: FormData) {
  await ejecutar('/admin/feriados', 'Feriado eliminado. Las horas de ese día se recalcularon.', async (actor) => {
    const fecha = texto(fd, 'fecha');
    if (!esFechaISO(fecha)) throw new ErrorDatos('Fecha inválida.');
    await tx(async (c) => {
      await c.query('delete from feriados where fecha = $1', [fecha]);
      await recalcularFecha(c, fecha);
      await auditar(actor, 'eliminar', 'feriado', fecha, undefined, c);
    });
    return `/admin/feriados?anio=${fecha.slice(0, 4)}`;
  });
}

// ---------- Carga por otro ----------

export async function cargarPorOtroAccion(fd: FormData) {
  const miembroId = Number(fd.get('miembro_id'));
  const fecha = texto(fd, 'fecha');
  const ruta = `/admin/carga?miembro=${miembroId}&fecha=${encodeURIComponent(fecha)}`;
  const u = await requireRol('manager');
  const proyectoId = Number(fd.get('proyecto'));
  const fase = String(fd.get('fase') ?? '');
  try {
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) throw new ErrorCarga('Elegí un proyecto.');
    await agregarRegistro(u, {
      miembroId,
      fecha,
      proyectoId,
      faseId: fase ? Number(fase) : null,
      horas: Number(String(fd.get('horas') ?? '').replace(',', '.')),
      nota: texto(fd, 'nota'),
    });
  } catch (e) {
    if (e instanceof ErrorCarga) ir(ruta, 'error', e.message);
    throw e;
  }
  ir(ruta, 'ok', 'Horas cargadas.');
}
