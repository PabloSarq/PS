import { FormCarga } from '@/components/FormCarga';
import { ListaCargas, ResumenJornada } from '@/components/ListaCargas';
import { Avisos, Marco } from '@/components/Marco';
import { requireUsuario } from '@/lib/auth';
import { formatoLargo, hoyISO } from '@/lib/fechas';
import { esFeriado, fasesDe, proyectosDisponibles, registrosDelDia } from '@/lib/registros';
import { ETIQUETA_DIA, tipoDeDia } from '@/lib/reglas';
import { agregarHoyAccion } from './acciones';

export const dynamic = 'force-dynamic';

export default async function HoyPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const u = await requireUsuario();
  const sp = await searchParams;
  const hoy = hoyISO();
  const [feriado, registros, proyectos] = await Promise.all([
    esFeriado(hoy),
    registrosDelDia(u.id, hoy),
    proyectosDisponibles(u.id),
  ]);
  const fases = await fasesDe(proyectos.map((p) => p.id));
  const tipo = tipoDeDia(hoy, feriado !== null);

  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <h1>{formatoLargo(hoy)}</h1>
          <p className="sub">
            <span className={`pill ${tipo === 'habil' ? 'ok' : 'ex'}`}>{feriado ? `Feriado · ${feriado}` : ETIQUETA_DIA[tipo]}</span>{' '}
            El día se cierra a las 23:59.
          </p>
        </div>
      </div>
      <Avisos sp={sp} />
      <section className="panel" aria-label="Resumen del día">
        <ResumenJornada registros={registros} jornada={u.jornada_diaria} esHabil={tipo === 'habil'} />
      </section>
      <div className="grid2">
        <section className="panel">
          <h2>Cargar horas</h2>
          <FormCarga accion={agregarHoyAccion} proyectos={proyectos} fases={fases} />
        </section>
        <section className="panel">
          <h2>Cargado hoy</h2>
          <ListaCargas registros={registros} editable volver="/" />
        </section>
      </div>
    </Marco>
  );
}
