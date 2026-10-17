import Link from 'next/link';
import { Marco } from '@/components/Marco';
import { requireUsuario } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import {
  anioMes,
  diaSemana,
  esAnioMes,
  hoyISO,
  mesAnterior,
  mesSiguiente,
  nombreMes,
  primerDiaMes,
  rangoDias,
  ultimoDiaMes,
} from '@/lib/fechas';
import { resumenMesMiembro } from '@/lib/informes';
import { formatoHoras } from '@/lib/reglas';

export const dynamic = 'force-dynamic';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default async function MesPage({ searchParams }: { searchParams: Promise<{ mes?: string; miembro?: string }> }) {
  const u = await requireUsuario();
  const sp = await searchParams;
  const hoy = hoyISO();
  const mes = sp.mes && esAnioMes(sp.mes) ? sp.mes : anioMes(hoy);

  // El manager puede ver el mes de cualquier miembro.
  let miembroId = u.id;
  if (u.rol === 'manager' && sp.miembro && Number(sp.miembro) > 0) miembroId = Number(sp.miembro);
  const m = await q1<{ id: number; nombre: string; alta: string }>(
    'select id, nombre, creado_en::date::text as alta from miembros where id = $1',
    [miembroId],
  );
  if (!m) miembroId = u.id;
  const nombre = m?.nombre ?? u.nombre;
  const alta = m?.alta ?? '0000-00-00';
  const extra = miembroId !== u.id ? `&miembro=${miembroId}` : '';

  const [dias, feriados, contrato] = await Promise.all([
    resumenMesMiembro(miembroId, mes),
    q<{ fecha: string; descripcion: string }>('select fecha, descripcion from feriados where fecha between $1 and $2', [
      primerDiaMes(mes),
      ultimoDiaMes(mes),
    ]),
    q1<{ horas: number }>('select horas from contratos_mensuales where miembro_id = $1 and anio_mes = $2', [miembroId, mes]),
  ]);
  const porDia = new Map(dias.map((d) => [d.fecha, d]));
  const fer = new Map(feriados.map((f) => [f.fecha, f.descripcion]));
  const total = dias.reduce((s, d) => s + d.horas, 0);
  const ord = dias.reduce((s, d) => s + d.horas_ord, 0);
  const ext = dias.reduce((s, d) => s + d.horas_extra, 0);

  const fechas = rangoDias(primerDiaMes(mes), ultimoDiaMes(mes));
  const huecos = (diaSemana(fechas[0]) + 6) % 7; // lunes primero
  let faltan = 0;

  const celdas = fechas.map((f) => {
    const d = porDia.get(f);
    const dow = diaSemana(f);
    const finde = dow === 0 || dow === 6;
    const feriado = fer.get(f);
    const falta = !d && !finde && !feriado && f < hoy && f >= alta;
    if (falta) faltan++;
    const clases = ['dia', finde ? 'finde' : '', feriado ? 'feriado' : '', falta ? 'falta' : '', f === hoy ? 'hoy' : '', f > hoy ? 'futuro' : '']
      .filter(Boolean)
      .join(' ');
    return (
      <div key={f} className={clases} title={feriado ?? undefined}>
        <span className="n">{Number(f.slice(8))}</span>
        {feriado && <span className="fer">{feriado}</span>}
        {d ? (
          <span>
            <span className="t">{formatoHoras(d.horas)} h</span>
            {d.horas_extra > 0 && <span className="x"> +{formatoHoras(d.horas_extra)} ext</span>}
          </span>
        ) : (
          falta && <span className="x" style={{ color: 'var(--warn)' }}>sin carga</span>
        )}
      </div>
    );
  });

  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <h1>{nombreMes(mes)}</h1>
          <p className="sub">{miembroId === u.id ? 'Mis horas del mes' : `Horas de ${nombre}`}</p>
        </div>
        <div className="pestanas">
          <Link href={`/mes?mes=${mesAnterior(mes)}${extra}`}>← Anterior</Link>
          <Link href={`/mes?mes=${anioMes(hoy)}${extra}`}>Este mes</Link>
          <Link href={`/mes?mes=${mesSiguiente(mes)}${extra}`}>Siguiente →</Link>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span className="l">Cargadas</span><span className="v">{formatoHoras(total)} h</span></div>
        <div className="kpi"><span className="l">Contratadas</span><span className="v">{contrato ? `${formatoHoras(contrato.horas)} h` : '—'}</span></div>
        <div className="kpi"><span className="l">Ordinarias</span><span className="v">{formatoHoras(ord)} h</span></div>
        <div className="kpi"><span className="l">Extras</span><span className="v" style={{ color: ext > 0 ? 'var(--wood)' : undefined }}>{formatoHoras(ext)} h</span></div>
        <div className="kpi"><span className="l">Días hábiles sin carga</span><span className="v" style={{ color: faltan > 0 ? 'var(--warn)' : undefined }}>{faltan}</span></div>
      </div>
      <section className="panel">
        <div className="cal" role="grid" aria-label={`Calendario de ${nombreMes(mes)}`}>
          {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
          {Array.from({ length: huecos }, (_, i) => <div key={`h${i}`} className="dia vacio" />)}
          {celdas}
        </div>
        <p className="muted small">
          Los días con borde punteado rojo son días hábiles cerrados sin horas cargadas. Si te olvidaste de cargar, avisale al manager.
        </p>
      </section>
    </Marco>
  );
}
