// Tests de integración contra Postgres. Se ejecutan solo si TEST_DATABASE_URL
// apunta a una base de prueba vacía (se crean y borran datos).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL_DB)('registros (integración)', async () => {
  process.env.DATABASE_URL = URL_DB;
  const { pool, q, tx } = await import('./db');
  const { migrar } = await import('./migraciones');
  const { agregarRegistro, eliminarRegistro, ErrorCarga, recalcularFecha } = await import('./registros');
  const { hoyISO, sumarDias } = await import('./fechas');

  const hoy = hoyISO();
  const ayer = sumarDias(hoy, -1);
  let prof: { id: number; nombre: string; email: string; rol: 'profesional'; jornada_diaria: number };
  let manager: { id: number; nombre: string; email: string; rol: 'manager'; jornada_diaria: number };
  let proyecto: number;
  let ajeno: number;

  beforeAll(async () => {
    await migrar();
    const ins = async (email: string, rol: string) =>
      (await q<{ id: number }>(
        `insert into miembros (nombre, email, password_hash, rol, jornada_diaria) values ($1, $1, 'x', $2, 8) returning id`,
        [email, rol],
      ))[0].id;
    prof = { id: await ins('prof@test', 'profesional'), nombre: 'p', email: 'prof@test', rol: 'profesional', jornada_diaria: 8 };
    manager = { id: await ins('mgr@test', 'manager'), nombre: 'm', email: 'mgr@test', rol: 'manager', jornada_diaria: 8 };
    proyecto = (await q<{ id: number }>(`insert into proyectos (codigo, nombre) values ('T-1', 'Test') returning id`))[0].id;
    ajeno = (await q<{ id: number }>(`insert into proyectos (codigo, nombre) values ('T-2', 'Ajeno') returning id`))[0].id;
    await q('insert into asignaciones values ($1, $2)', [proyecto, prof.id]);
  });

  afterAll(async () => {
    await q('delete from auditoria where miembro_id = any($1)', [[prof.id, manager.id]]);
    await q('delete from registros where miembro_id = any($1)', [[prof.id, manager.id]]);
    await q("delete from proyectos where codigo in ('T-1', 'T-2')");
    await q('delete from miembros where id = any($1)', [[prof.id, manager.id]]);
    await q("delete from feriados where descripcion = 'test'");
    await pool.end();
  });

  const base = () => ({ miembroId: prof.id, proyectoId: proyecto, faseId: null, horas: 2, nota: '' });

  it('el profesional carga hoy', async () => {
    await agregarRegistro(prof, { ...base(), fecha: hoy });
    const r = await q<{ n: number }>('select count(*)::int as n from registros where miembro_id = $1', [prof.id]);
    expect(r[0].n).toBe(1);
  });

  it('el profesional no puede cargar ayer ni mañana', async () => {
    await expect(agregarRegistro(prof, { ...base(), fecha: ayer })).rejects.toBeInstanceOf(ErrorCarga);
    await expect(agregarRegistro(prof, { ...base(), fecha: sumarDias(hoy, 1) })).rejects.toBeInstanceOf(ErrorCarga);
  });

  it('el profesional no puede cargar a nombre de otro ni en un proyecto no asignado', async () => {
    await expect(agregarRegistro(prof, { ...base(), miembroId: manager.id, fecha: hoy })).rejects.toBeInstanceOf(ErrorCarga);
    await expect(agregarRegistro(prof, { ...base(), proyectoId: ajeno, fecha: hoy })).rejects.toBeInstanceOf(ErrorCarga);
  });

  it('el manager carga un día pasado en nombre del profesional, pero no a futuro', async () => {
    await agregarRegistro(manager, { ...base(), fecha: ayer, horas: 9 });
    const r = await q<{ cargado_por: number }>('select cargado_por from registros where miembro_id = $1 and fecha = $2', [prof.id, ayer]);
    expect(r[0].cargado_por).toBe(manager.id);
    await expect(agregarRegistro(manager, { ...base(), fecha: sumarDias(hoy, 1) })).rejects.toBeInstanceOf(ErrorCarga);
  });

  it('el profesional no puede borrar una carga de un día cerrado; el manager sí', async () => {
    const [r] = await q<{ id: number }>('select id from registros where miembro_id = $1 and fecha = $2', [prof.id, ayer]);
    await expect(eliminarRegistro(prof, r.id)).rejects.toBeInstanceOf(ErrorCarga);
    await eliminarRegistro(manager, r.id);
  });

  it('un feriado nuevo recalcula las horas de ese día como extra 100 %', async () => {
    // Un día hábil fijo en el pasado para que el test no dependa de qué día se corre.
    const fecha = '2026-10-14';
    await agregarRegistro(manager, { ...base(), fecha, horas: 9 });
    let [d] = await q<{ o: number; e50: number; e100: number }>(
      'select sum(horas_ord) as o, sum(horas_ex50) as e50, sum(horas_ex100) as e100 from registros where miembro_id = $1 and fecha = $2',
      [prof.id, fecha],
    );
    expect(d).toEqual({ o: 8, e50: 1, e100: 0 });
    await tx(async (c) => {
      await c.query(`insert into feriados (fecha, descripcion) values ($1, 'test')`, [fecha]);
      await recalcularFecha(c, fecha);
    });
    [d] = await q('select sum(horas_ord) as o, sum(horas_ex50) as e50, sum(horas_ex100) as e100 from registros where miembro_id = $1 and fecha = $2', [
      prof.id,
      fecha,
    ]);
    expect(d).toEqual({ o: 0, e50: 0, e100: 9 });
  });

  it('el día no puede superar 24 horas', async () => {
    await expect(agregarRegistro(manager, { ...base(), fecha: '2026-10-13', horas: 25 })).rejects.toBeInstanceOf(ErrorCarga);
  });
});
