import type { PoolClient } from 'pg';
import { pool } from './db';

export async function auditar(
  actorId: number | null,
  accion: string,
  entidad: string,
  entidadId: string | number | null,
  detalle?: unknown,
  c?: PoolClient,
): Promise<void> {
  await (c ?? pool).query(
    'insert into auditoria (miembro_id, accion, entidad, entidad_id, detalle) values ($1, $2, $3, $4, $5)',
    [actorId, accion, entidad, entidadId === null ? null : String(entidadId), detalle ? JSON.stringify(detalle) : null],
  );
}
