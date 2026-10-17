import Link from 'next/link';
import { PillPresupuesto } from '@/app/admin/proyectos/campos';
import { Marco } from '@/components/Marco';
import { requireRol } from '@/lib/auth';
import { anioMes, hoyISO, lunesDeSemana } from '@/lib/fechas';
import { informeMiembros, informeProyectos, periodoDesdeParams } from '@/lib/informes';
import { formatoHoras, formatoPesos } from '@/lib/reglas';

export const dynamic = 'force-dynamic';

const suma = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

export default async function InformesPage({ searchParams }: { searchParams: Promise<{ mes?: string; semana?: string }> }) {
  const u = await requireRol('manager', 'socio');
  const sp = await searchParams;
  const p = periodoDesdeParams(sp);
  const [proyectos, miembros] = await Promise.all([informeProyectos(p), informeMiembros(p)]);
  const hoy = hoyISO();
  const qs = p.tipo === 'semana' ? `semana=${p.desde}` : `mes=${p.mes}`;

  const total = suma(proyectos, (x) => x.horas);
  const extras = suma(proyectos, (x) => x.horas_ex50 + x.horas_ex100);
  const costo = suma(proyectos, (x) => x.costo);
  const internas = suma(proyectos.filter((x) => x.interno), (x) => x.horas);
  const maxHoras = Math.max(1, ...proyectos.map((x) => x.horas));
  const sinTarifa = miembros.filter((m) => m.sin_tarifa);

  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <h1>Informes · {p.titulo}</h1>
          <p className="sub">Horas y costo para el estudio, por proyecto y por persona.</p>
        </div>
        <div className="pestanas">
          <Link href={`/informes?mes=${anioMes(hoy)}`} className={p.tipo === 'mes' ? 'activa' : ''}>Mes</Link>
          <Link href={`/informes?semana=${lunesDeSemana(hoy)}`} className={p.tipo === 'semana' ? 'activa' : ''}>Semana</Link>
          <Link href={`/informes${p.anterior}`}>← Anterior</Link>
          <Link href={`/informes${p.siguiente}`}>Siguiente →</Link>
          <a href={`/informes/exportar?${qs}`} className="boton">Descargar Excel</a>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="l">Horas totales</span><span className="v">{formatoHoras(total)}</span></div>
        <div className="kpi"><span className="l">Horas extra</span><span className="v" style={{ color: 'var(--wood)' }}>{formatoHoras(extras)}</span></div>
        <div className="kpi"><span className="l">En proyectos internos</span><span className="v">{total ? Math.round((internas / total) * 100) : 0} %</span></div>
        <div className="kpi"><span className="l">Costo de producción</span><span className="v">{formatoPesos(costo)}</span></div>
      </div>

      {sinTarifa.length > 0 && (
        <div className="aviso error">
          Sin tarifa cargada para alguna fecha del período: {sinTarifa.map((m) => m.nombre).join(', ')}. Esas horas suman $0 al costo.
        </div>
      )}

      <section className="panel">
        <h2>Proyectos, de más a menos demandante</h2>
        {proyectos.length === 0 ? (
          <p className="muted">No hay horas cargadas en este período.</p>
        ) : (
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proyecto</th><th style={{ width: '22%' }}></th><th className="num">Horas</th><th className="num">Ord.</th>
                  <th className="num">Extra</th><th className="num">Personas</th><th className="num">Costo</th><th className="num">Presupuesto (acum.)</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.map((x) => (
                  <tr key={x.id}>
                    <td><span className="mono">{x.codigo}</span> · {x.nombre}</td>
                    <td>
                      <div className="barra" aria-hidden="true">
                        <div className="o" style={{ width: `${(x.horas_ord / maxHoras) * 100}%` }} />
                        <div className="e" style={{ width: `${((x.horas_ex50 + x.horas_ex100) / maxHoras) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num">{formatoHoras(x.horas)}</td>
                    <td className="num">{formatoHoras(x.horas_ord)}</td>
                    <td className="num">{formatoHoras(x.horas_ex50 + x.horas_ex100)}</td>
                    <td className="num">{x.personas}</td>
                    <td className="num">{formatoPesos(x.costo)}</td>
                    <td className="num">{x.interno ? '—' : <PillPresupuesto horas={x.horas_acumuladas} presupuesto={x.horas_presupuestadas} />}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td><td></td>
                  <td className="num">{formatoHoras(total)}</td>
                  <td className="num">{formatoHoras(total - extras)}</td>
                  <td className="num">{formatoHoras(extras)}</td>
                  <td></td>
                  <td className="num">{formatoPesos(costo)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Equipo</h2>
        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Miembro</th><th className="num">Cargadas</th>
                {p.mes && <><th className="num">Contratadas</th><th className="num">Utilización</th></>}
                <th className="num">Extra 50 %</th><th className="num">Extra 100 %</th><th className="num">Costo</th>
                <th className="num">Días sin carga</th><th className="num">Cargados por manager</th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((m) => {
                const ext = m.horas_ex50 + m.horas_ex100;
                const util = p.mes && m.contratadas ? Math.round((m.horas / m.contratadas) * 100) : null;
                const pasaTope = p.mes !== null && m.tope_extras_mes !== null && ext > m.tope_extras_mes;
                return (
                  <tr key={m.id}>
                    <td>{u.rol === 'manager' ? <Link href={`/mes?miembro=${m.id}${p.mes ? `&mes=${p.mes}` : ''}`}>{m.nombre}</Link> : m.nombre}</td>
                    <td className="num">{formatoHoras(m.horas)}</td>
                    {p.mes && (
                      <>
                        <td className="num">{m.contratadas !== null ? formatoHoras(m.contratadas) : '—'}</td>
                        <td className="num">{util !== null ? `${util} %` : '—'}</td>
                      </>
                    )}
                    <td className="num">{formatoHoras(m.horas_ex50)}</td>
                    <td className="num">
                      {formatoHoras(m.horas_ex100)}
                      {pasaTope && <> <span className="pill warn" title={`Tope: ${formatoHoras(m.tope_extras_mes ?? 0)} h por mes`}>supera tope</span></>}
                    </td>
                    <td className="num">{formatoPesos(m.costo)}</td>
                    <td className="num">{m.dias_sin_carga > 0 ? <span className="pill mal">{m.dias_sin_carga}</span> : 0}</td>
                    <td className="num">{m.dias_cargados_por_manager}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Días sin carga: días hábiles ya cerrados del período sin ninguna hora cargada (no cuenta hoy).</p>
      </section>
    </Marco>
  );
}
