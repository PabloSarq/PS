import { eliminarRegistroAccion } from '@/app/acciones';
import type { RegistroDia } from '@/lib/registros';
import { formatoHoras } from '@/lib/reglas';

export function ListaCargas({
  registros,
  editable,
  volver,
}: {
  registros: RegistroDia[];
  editable: boolean;
  volver: string;
}) {
  if (registros.length === 0) return <p className="muted">Todavía no hay horas cargadas en este día.</p>;
  return (
    <ul className="cargas">
      {registros.map((r) => (
        <li key={r.id}>
          <div style={{ minWidth: 0 }}>
            <div className="proy">
              {r.proyecto_codigo} · {r.proyecto_nombre}
            </div>
            <div className="det">
              {[r.fase_nombre, r.nota].filter(Boolean).join(' · ')}
              {r.cargado_por_otro && <> <span className="pill neutro">cargado por manager</span></>}
            </div>
            <div className="det">
              {r.horas_ord > 0 && <span className="pill ok">{formatoHoras(r.horas_ord)} h ord.</span>}{' '}
              {r.horas_ex50 > 0 && <span className="pill ex">{formatoHoras(r.horas_ex50)} h extra 50 %</span>}{' '}
              {r.horas_ex100 > 0 && <span className="pill ex">{formatoHoras(r.horas_ex100)} h extra 100 %</span>}
            </div>
          </div>
          <div className="h">{formatoHoras(r.horas)} h</div>
          <div>
            {editable && (
              <form action={eliminarRegistroAccion} className="inline">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="volver" value={volver} />
                <button type="submit" className="peligro mini" aria-label={`Eliminar ${formatoHoras(r.horas)} h de ${r.proyecto_nombre}`}>
                  Quitar
                </button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ResumenJornada({ registros, jornada, esHabil }: { registros: RegistroDia[]; jornada: number; esHabil: boolean }) {
  const ord = registros.reduce((s, r) => s + r.horas_ord, 0);
  const ext = registros.reduce((s, r) => s + r.horas_ex50 + r.horas_ex100, 0);
  const escala = Math.max(jornada, ord + ext, 1);
  return (
    <div className="jornada">
      <div className="cifras">
        <span className="grande">{formatoHoras(ord + ext)} h</span>
        {esHabil ? (
          <span className="muted">
            {formatoHoras(ord)} de {formatoHoras(jornada)} h ordinarias
            {ext > 0 && <> · <strong style={{ color: 'var(--wood)' }}>{formatoHoras(ext)} h extra</strong></>}
          </span>
        ) : (
          <span className="muted">Todo lo que se carga hoy cuenta como hora extra.</span>
        )}
      </div>
      <div className="barra" aria-hidden="true">
        <div className="o" style={{ width: `${(ord / escala) * 100}%` }} />
        <div className="e" style={{ width: `${(ext / escala) * 100}%` }} />
      </div>
    </div>
  );
}
