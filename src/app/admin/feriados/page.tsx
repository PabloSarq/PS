import Link from 'next/link';
import { Avisos, Marco } from '@/components/Marco';
import { requireRol } from '@/lib/auth';
import { q } from '@/lib/db';
import { formatoLargo, hoyISO } from '@/lib/fechas';
import { agregarFeriadoAccion, eliminarFeriadoAccion } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function FeriadosPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; anio?: string }> }) {
  const u = await requireRol('manager');
  const sp = await searchParams;
  const anioActual = Number(hoyISO().slice(0, 4));
  const anio = /^\d{4}$/.test(sp.anio ?? '') ? Number(sp.anio) : anioActual;
  const feriados = await q<{ fecha: string; descripcion: string; ambito: string }>(
    `select fecha, descripcion, ambito from feriados where fecha between $1 and $2 order by fecha`,
    [`${anio}-01-01`, `${anio}-12-31`],
  );
  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <h1>Feriados {anio}</h1>
          <p className="sub">En un feriado todas las horas cuentan como extra al 100 %. Cargá los trasladables con el calendario oficial de cada año.</p>
        </div>
        <div className="pestanas">
          <Link href={`/admin/feriados?anio=${anio - 1}`}>← {anio - 1}</Link>
          <Link href={`/admin/feriados?anio=${anio + 1}`}>{anio + 1} →</Link>
        </div>
      </div>
      <Avisos sp={sp} />
      <div className="grid2">
        <section className="panel">
          {feriados.length === 0 ? (
            <p className="muted">No hay feriados cargados para {anio}.</p>
          ) : (
            <table>
              <tbody>
                {feriados.map((f) => (
                  <tr key={f.fecha}>
                    <td>{formatoLargo(f.fecha)}</td>
                    <td>{f.descripcion} <span className="pill neutro">{f.ambito}</span></td>
                    <td className="num">
                      <form action={eliminarFeriadoAccion} className="inline">
                        <input type="hidden" name="fecha" value={f.fecha} />
                        <button type="submit" className="peligro mini">Quitar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel">
          <h2>Agregar feriado</h2>
          <form action={agregarFeriadoAccion} className="campos">
            <label>Fecha<input id="fecha" name="fecha" type="date" required /></label>
            <label>Descripción<input id="descripcion" name="descripcion" required maxLength={120} placeholder="Ej. Batalla de Tucumán" /></label>
            <label>
              Ámbito
              <select id="ambito" name="ambito" defaultValue="nacional">
                <option value="nacional">Nacional</option>
                <option value="provincial">Provincial</option>
                <option value="estudio">Del estudio (asueto)</option>
              </select>
            </label>
            <div><button type="submit">Agregar</button></div>
          </form>
        </section>
      </div>
    </Marco>
  );
}
