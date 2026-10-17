import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avisos, Marco } from '@/components/Marco';
import { requireRol } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { anioMes, formatoCorto, hoyISO, nombreMes } from '@/lib/fechas';
import { formatoHoras, formatoPesos } from '@/lib/reglas';
import {
  agregarTarifaAccion,
  editarMiembroAccion,
  eliminarContratoAccion,
  eliminarTarifaAccion,
  guardarContratoAccion,
  resetPasswordAccion,
} from '../../acciones';

export const dynamic = 'force-dynamic';

interface Miembro {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  jornada_diaria: number;
  tope_extras_mes: number | null;
  activo: boolean;
}

export default async function MiembroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const u = await requireRol('manager');
  const { id } = await params;
  const sp = await searchParams;
  const m = await q1<Miembro>(
    'select id, nombre, email, rol, jornada_diaria, tope_extras_mes, activo from miembros where id = $1',
    [Number(id) || 0],
  );
  if (!m) notFound();
  const hoy = hoyISO();
  const [contratos, tarifas] = await Promise.all([
    q<{ anio_mes: string; horas: number }>(
      'select anio_mes, horas from contratos_mensuales where miembro_id = $1 order by anio_mes desc limit 24',
      [m.id],
    ),
    q<{ id: number; vigente_desde: string; costo_ordinaria: number; costo_extra50: number; costo_extra100: number }>(
      'select * from tarifas where miembro_id = $1 order by vigente_desde desc',
      [m.id],
    ),
  ]);
  const vigente = tarifas.find((t) => t.vigente_desde <= hoy);

  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <p className="muted small"><Link href="/admin/miembros">← Equipo</Link></p>
          <h1>{m.nombre}</h1>
          <p className="sub">{m.email} · <Link href={`/mes?miembro=${m.id}`}>Ver su mes</Link></p>
        </div>
      </div>
      <Avisos sp={sp} />
      <section className="panel">
        <h2>Datos</h2>
        <form action={editarMiembroAccion} className="campos">
          <input type="hidden" name="id" value={m.id} />
          <div className="fila">
            <label>Nombre y apellido<input id="nombre" name="nombre" required defaultValue={m.nombre} /></label>
            <label>Email<input id="email" name="email" type="email" required defaultValue={m.email} /></label>
          </div>
          <div className="fila">
            <label>
              Rol
              <select id="rol" name="rol" defaultValue={m.rol}>
                <option value="profesional">Profesional</option>
                <option value="socio">Socio (carga + informes)</option>
                <option value="manager">Manager (todo)</option>
              </select>
            </label>
            <label>Jornada diaria (h)<input id="jornada_diaria" name="jornada_diaria" type="number" min="0" max="24" step="0.5" required defaultValue={m.jornada_diaria} /></label>
            <label>Tope de extras por mes (h)<input id="tope_extras_mes" name="tope_extras_mes" type="number" min="0" step="1" defaultValue={m.tope_extras_mes ?? ''} placeholder="Sin tope" /></label>
          </div>
          <label className="check"><input id="activo" name="activo" type="checkbox" defaultChecked={m.activo} />Activo (puede entrar y cargar horas)</label>
          <p className="muted small">Un cambio de jornada se aplica a los días que se carguen a partir de ahora; los días ya cargados no cambian.</p>
          <div><button type="submit">Guardar cambios</button></div>
        </form>
      </section>
      <div className="grid2">
        <section className="panel">
          <h2>Horas contratadas por mes</h2>
          <form action={guardarContratoAccion} className="fila" style={{ alignItems: 'flex-end' }}>
            <input type="hidden" name="miembro_id" value={m.id} />
            <label>Mes<input id="anio_mes" name="anio_mes" type="month" required defaultValue={anioMes(hoy)} /></label>
            <label>Horas<input id="horas_contrato" name="horas" type="number" min="0" step="0.5" required /></label>
            <div style={{ flexGrow: 0 }}><button type="submit">Guardar</button></div>
          </form>
          {contratos.length === 0 ? (
            <p className="muted">Todavía no hay horas contratadas cargadas.</p>
          ) : (
            <table>
              <tbody>
                {contratos.map((c) => (
                  <tr key={c.anio_mes}>
                    <td>{nombreMes(c.anio_mes)}</td>
                    <td className="num">{formatoHoras(c.horas)} h</td>
                    <td className="num">
                      <form action={eliminarContratoAccion} className="inline">
                        <input type="hidden" name="miembro_id" value={m.id} />
                        <input type="hidden" name="anio_mes" value={c.anio_mes} />
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
          <h2>Costo por hora para el estudio</h2>
          <p className="muted small">
            Cada tarifa rige desde su fecha hasta que se cargue otra. Los meses anteriores se siguen calculando con la tarifa de su momento.
            {vigente ? ` Vigente hoy: ${formatoPesos(vigente.costo_ordinaria)} la hora ordinaria.` : ''}
          </p>
          <form action={agregarTarifaAccion} className="campos">
            <input type="hidden" name="miembro_id" value={m.id} />
            <div className="fila">
              <label>Rige desde<input id="vigente_desde" name="vigente_desde" type="date" required defaultValue={`${anioMes(hoy)}-01`} /></label>
              <label>Ordinaria ($/h)<input id="costo_ordinaria" name="costo_ordinaria" type="number" min="0" step="0.01" required /></label>
            </div>
            <div className="fila">
              <label>Extra 50 % ($/h)<input id="costo_extra50" name="costo_extra50" type="number" min="0" step="0.01" required /></label>
              <label>Extra 100 % ($/h)<input id="costo_extra100" name="costo_extra100" type="number" min="0" step="0.01" required /></label>
            </div>
            <div><button type="submit">Guardar tarifa</button></div>
          </form>
          {tarifas.length > 0 && (
            <div className="tabla-wrap">
              <table>
                <thead>
                  <tr><th>Desde</th><th className="num">Ord.</th><th className="num">Ex. 50 %</th><th className="num">Ex. 100 %</th><th></th></tr>
                </thead>
                <tbody>
                  {tarifas.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{formatoCorto(t.vigente_desde)} {t.id === vigente?.id && <span className="pill ok">vigente</span>}</td>
                      <td className="num">{formatoPesos(t.costo_ordinaria)}</td>
                      <td className="num">{formatoPesos(t.costo_extra50)}</td>
                      <td className="num">{formatoPesos(t.costo_extra100)}</td>
                      <td className="num">
                        <form action={eliminarTarifaAccion} className="inline">
                          <input type="hidden" name="miembro_id" value={m.id} />
                          <input type="hidden" name="tarifa_id" value={t.id} />
                          <button type="submit" className="peligro mini">Quitar</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <section className="panel" style={{ maxWidth: 480 }}>
        <h2>Asignar contraseña nueva</h2>
        <form action={resetPasswordAccion} className="campos">
          <input type="hidden" name="id" value={m.id} />
          <label>Contraseña nueva<input id="password_nueva" name="password" type="text" minLength={8} required autoComplete="off" /></label>
          <p className="muted small">Cierra las sesiones abiertas del miembro.</p>
          <div><button type="submit" className="sec">Asignar</button></div>
        </form>
      </section>
    </Marco>
  );
}
