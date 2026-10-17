import Link from 'next/link';
import { Avisos, Marco } from '@/components/Marco';
import { requireRol } from '@/lib/auth';
import { q } from '@/lib/db';
import { formatoHoras } from '@/lib/reglas';
import { crearProyectoAccion } from '../acciones';
import { CamposProyecto, PillPresupuesto } from './campos';

export const dynamic = 'force-dynamic';

interface Fila {
  id: number;
  codigo: string;
  nombre: string;
  cliente: string | null;
  estado: string;
  interno: boolean;
  horas_presupuestadas: number | null;
  horas: number;
  equipo: number;
}

export default async function ProyectosPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; ver?: string }> }) {
  const u = await requireRol('manager');
  const sp = await searchParams;
  const verTodos = sp.ver === 'todos';
  const filas = await q<Fila>(
    `select p.id, p.codigo, p.nombre, p.cliente, p.estado, p.interno, p.horas_presupuestadas,
            coalesce((select sum(horas) from registros r where r.proyecto_id = p.id), 0) as horas,
            (select count(*)::int from asignaciones a where a.proyecto_id = p.id) as equipo
       from proyectos p
      where $1 or p.estado <> 'cerrado'
      order by p.interno, p.estado, p.codigo`,
    [verTodos],
  );
  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <h1>Proyectos</h1>
          <p className="sub">Los proyectos cerrados no aparecen en el desplegable de carga, pero siguen en los informes.</p>
        </div>
        <div className="pestanas">
          <Link href="/admin/proyectos" className={verTodos ? '' : 'activa'}>Activos y pausados</Link>
          <Link href="/admin/proyectos?ver=todos" className={verTodos ? 'activa' : ''}>Todos</Link>
        </div>
      </div>
      <Avisos sp={sp} />
      <section className="panel">
        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th><th>Proyecto</th><th>Cliente</th><th>Estado</th>
                <th className="num">Equipo</th><th className="num">Horas cargadas</th><th className="num">Presupuesto</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id}>
                  <td className="mono"><Link href={`/admin/proyectos/${p.id}`}>{p.codigo}</Link></td>
                  <td>{p.nombre} {p.interno && <span className="pill neutro">interno</span>}</td>
                  <td>{p.cliente ?? '—'}</td>
                  <td><span className={`pill ${p.estado === 'activo' ? 'ok' : 'neutro'}`}>{p.estado}</span></td>
                  <td className="num">{p.interno ? 'todos' : p.equipo}</td>
                  <td className="num">{formatoHoras(p.horas)}</td>
                  <td className="num"><PillPresupuesto horas={p.horas} presupuesto={p.horas_presupuestadas} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" style={{ maxWidth: 720 }}>
        <h2>Nuevo proyecto</h2>
        <form action={crearProyectoAccion} className="campos">
          <CamposProyecto />
          <div><button type="submit">Crear proyecto</button></div>
        </form>
      </section>
    </Marco>
  );
}
