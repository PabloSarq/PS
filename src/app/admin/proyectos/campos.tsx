import { formatoHoras } from '@/lib/reglas';

export interface ProyectoForm {
  codigo: string;
  nombre: string;
  cliente: string | null;
  estado: string;
  horas_presupuestadas: number | null;
  interno: boolean;
}

export function CamposProyecto({ p }: { p?: ProyectoForm }) {
  return (
    <>
      <div className="fila">
        <label>Código<input id="codigo" name="codigo" required maxLength={30} defaultValue={p?.codigo} placeholder="Ej. SDT-01" /></label>
        <label style={{ flexGrow: 3 }}>Nombre<input id="nombre" name="nombre" required maxLength={200} defaultValue={p?.nombre} /></label>
      </div>
      <div className="fila">
        <label>Cliente<input id="cliente" name="cliente" maxLength={200} defaultValue={p?.cliente ?? ''} /></label>
        <label>
          Estado
          <select id="estado" name="estado" defaultValue={p?.estado ?? 'activo'}>
            <option value="activo">Activo</option>
            <option value="pausado">Pausado</option>
            <option value="cerrado">Cerrado</option>
          </select>
        </label>
        <label>
          Horas presupuestadas
          <input id="horas_presupuestadas" name="horas_presupuestadas" type="number" min="0" step="1" defaultValue={p?.horas_presupuestadas ?? ''} />
        </label>
      </div>
      <label className="check">
        <input id="interno" name="interno" type="checkbox" defaultChecked={p?.interno} />
        Proyecto interno (lo ve todo el equipo, no necesita asignación)
      </label>
    </>
  );
}

export function PillPresupuesto({ horas, presupuesto }: { horas: number; presupuesto: number | null }) {
  if (!presupuesto) return <span className="muted">—</span>;
  const pct = Math.round((horas / presupuesto) * 100);
  const clase = pct >= 100 ? 'mal' : pct >= 80 ? 'warn' : 'ok';
  return (
    <span title={`${formatoHoras(horas)} de ${formatoHoras(presupuesto)} h`}>
      {formatoHoras(presupuesto)} h <span className={`pill ${clase}`}>{pct} %</span>
    </span>
  );
}
