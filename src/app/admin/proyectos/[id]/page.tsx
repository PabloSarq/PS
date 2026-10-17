import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avisos, Marco } from '@/components/Marco';
import { requireRol } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { formatoHoras } from '@/lib/reglas';
import { agregarFaseAccion, editarProyectoAccion, eliminarFaseAccion, guardarAsignacionesAccion } from '../../acciones';
import { CamposProyecto, PillPresupuesto, type ProyectoForm } from '../campos';

export const dynamic = 'force-dynamic';

export default async function ProyectoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const u = await requireRol('manager');
  const { id } = await params;
  const sp = await searchParams;
  const p = await q1<ProyectoForm & { id: number }>('select * from proyectos where id = $1', [Number(id) || 0]);
  if (!p) notFound();

  const [fases, miembros, total] = await Promise.all([
    q<{ id: number; nombre: string; horas: number }>(
      `select f.id, f.nombre, coalesce(sum(r.horas), 0) as horas
         from fases f left join registros r on r.fase_id = f.id
        where f.proyecto_id = $1 group by f.id order by f.orden, f.nombre`,
      [p.id],
    ),
    q<{ id: number; nombre: string; rol: string; asignado: boolean; horas: number }>(
      `select m.id, m.nombre, m.rol,
              exists (select 1 from asignaciones a where a.proyecto_id = $1 and a.miembro_id = m.id) as asignado,
              coalesce((select sum(horas) from registros r where r.proyecto_id = $1 and r.miembro_id = m.id), 0) as horas
         from miembros m where m.activo order by m.nombre`,
      [p.id],
    ),
    q1<{ horas: number }>('select coalesce(sum(horas), 0) as horas from registros where proyecto_id = $1', [p.id]),
  ]);

  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <p className="muted small"><Link href="/admin/proyectos">← Proyectos</Link></p>
          <h1>{p.codigo} · {p.nombre}</h1>
          <p className="sub">
            {formatoHoras(total?.horas ?? 0)} h cargadas en total · Presupuesto: <PillPresupuesto horas={total?.horas ?? 0} presupuesto={p.horas_presupuestadas} />
          </p>
        </div>
      </div>
      <Avisos sp={sp} />
      <section className="panel">
        <h2>Datos</h2>
        <form action={editarProyectoAccion} className="campos">
          <input type="hidden" name="id" value={p.id} />
          <CamposProyecto p={p} />
          <div><button type="submit">Guardar cambios</button></div>
        </form>
      </section>
      <div className="grid2">
        <section className="panel">
          <h2>Equipo asignado</h2>
          {p.interno ? (
            <p className="muted">Es un proyecto interno: todo el equipo puede cargar horas acá.</p>
          ) : (
            <form action={guardarAsignacionesAccion} className="campos">
              <input type="hidden" name="proyecto_id" value={p.id} />
              {miembros.map((m) => (
                <label key={m.id} className="check">
                  <input type="checkbox" name="miembro" value={m.id} defaultChecked={m.asignado} />
                  {m.nombre} {m.horas > 0 && <span className="muted small">· {formatoHoras(m.horas)} h</span>}
                </label>
              ))}
              <div><button type="submit">Guardar equipo</button></div>
            </form>
          )}
        </section>
        <section className="panel">
          <h2>Fases</h2>
          <p className="muted small">Opcionales. Si el proyecto tiene fases, al cargar horas se puede elegir una.</p>
          {fases.length > 0 && (
            <table>
              <tbody>
                {fases.map((f) => (
                  <tr key={f.id}>
                    <td>{f.nombre}</td>
                    <td className="num">{formatoHoras(f.horas)} h</td>
                    <td className="num">
                      <form action={eliminarFaseAccion} className="inline">
                        <input type="hidden" name="proyecto_id" value={p.id} />
                        <input type="hidden" name="fase_id" value={f.id} />
                        <button type="submit" className="peligro mini">Quitar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form action={agregarFaseAccion} className="fila" style={{ alignItems: 'flex-end' }}>
            <input type="hidden" name="proyecto_id" value={p.id} />
            <label style={{ flexGrow: 3 }}>Nueva fase<input id="fase_nombre" name="nombre" maxLength={80} placeholder="Ej. Anteproyecto" required /></label>
            <div style={{ flexGrow: 0 }}><button type="submit">Agregar</button></div>
          </form>
        </section>
      </div>
    </Marco>
  );
}
