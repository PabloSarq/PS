import { FormCarga } from '@/components/FormCarga';
import { ListaCargas, ResumenJornada } from '@/components/ListaCargas';
import { Avisos, Marco } from '@/components/Marco';
import { requireRol } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { esFechaISO, formatoLargo, hoyISO, sumarDias } from '@/lib/fechas';
import { esFeriado, fasesDe, proyectosDisponibles, registrosDelDia } from '@/lib/registros';
import { ETIQUETA_DIA, tipoDeDia } from '@/lib/reglas';
import { cargarPorOtroAccion } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function CargaPorOtroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; miembro?: string; fecha?: string }>;
}) {
  const u = await requireRol('manager');
  const sp = await searchParams;
  const hoy = hoyISO();
  const fecha = sp.fecha && esFechaISO(sp.fecha) && sp.fecha <= hoy ? sp.fecha : sumarDias(hoy, -1);
  const miembros = await q<{ id: number; nombre: string }>('select id, nombre from miembros where activo order by nombre');
  const miembro = sp.miembro
    ? await q1<{ id: number; nombre: string; jornada_diaria: number }>(
        'select id, nombre, jornada_diaria from miembros where id = $1 and activo',
        [Number(sp.miembro) || 0],
      )
    : undefined;

  let contenido = null;
  if (miembro) {
    const [feriado, registros, proyectos] = await Promise.all([
      esFeriado(fecha),
      registrosDelDia(miembro.id, fecha),
      proyectosDisponibles(miembro.id),
    ]);
    const fases = await fasesDe(proyectos.map((p) => p.id));
    const tipo = tipoDeDia(fecha, feriado !== null);
    const volver = `/admin/carga?miembro=${miembro.id}&fecha=${fecha}`;
    contenido = (
      <>
        <section className="panel">
          <h2>
            {miembro.nombre} · {formatoLargo(fecha)}
          </h2>
          <p><span className={`pill ${tipo === 'habil' ? 'ok' : 'ex'}`}>{feriado ? `Feriado · ${feriado}` : ETIQUETA_DIA[tipo]}</span></p>
          <ResumenJornada registros={registros} jornada={miembro.jornada_diaria} esHabil={tipo === 'habil'} />
        </section>
        <div className="grid2">
          <section className="panel">
            <h2>Agregar horas</h2>
            <FormCarga
              accion={cargarPorOtroAccion}
              proyectos={proyectos}
              fases={fases}
              ocultos={{ miembro_id: String(miembro.id), fecha }}
              textoBoton="Cargar en su nombre"
            />
          </section>
          <section className="panel">
            <h2>Cargado ese día</h2>
            <ListaCargas registros={registros} editable volver={volver} />
          </section>
        </div>
      </>
    );
  }

  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <h1>Cargar por otro</h1>
          <p className="sub">Para cuando alguien se olvidó de cargar un día. Cada carga queda marcada como hecha por el manager.</p>
        </div>
      </div>
      <Avisos sp={sp} />
      <section className="panel">
        <form method="get" className="fila" style={{ alignItems: 'flex-end' }}>
          <label>
            Miembro
            <select id="miembro" name="miembro" defaultValue={miembro?.id ?? ''} required>
              <option value="">Elegí…</option>
              {miembros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </label>
          <label>Fecha<input id="fecha" name="fecha" type="date" max={hoy} defaultValue={fecha} required /></label>
          <div style={{ flexGrow: 0 }}><button type="submit" className="sec">Ver día</button></div>
        </form>
      </section>
      {contenido}
    </Marco>
  );
}
