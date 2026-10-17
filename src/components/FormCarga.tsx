'use client';

import { useState } from 'react';
import type { FaseOpcion, ProyectoOpcion } from '@/lib/registros';

interface Props {
  accion: (fd: FormData) => void | Promise<void>;
  proyectos: ProyectoOpcion[];
  fases: FaseOpcion[];
  ocultos?: Record<string, string>;
  textoBoton?: string;
}

export function FormCarga({ accion, proyectos, fases, ocultos = {}, textoBoton = 'Agregar' }: Props) {
  const [proyecto, setProyecto] = useState('');
  const fasesProyecto = fases.filter((f) => String(f.proyecto_id) === proyecto);

  if (proyectos.length === 0) {
    return <p className="aviso info">No hay proyectos disponibles. Pedile al manager que te asigne a uno.</p>;
  }

  return (
    <form action={accion} className="campos">
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label>
        Proyecto
        <select id="proyecto" name="proyecto" required value={proyecto} onChange={(e) => setProyecto(e.target.value)}>
          <option value="">Elegí un proyecto…</option>
          {proyectos.some((p) => !p.interno) && (
            <optgroup label="Proyectos">
              {proyectos.filter((p) => !p.interno).map((p) => (
                <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="Internos">
            {proyectos.filter((p) => p.interno).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </optgroup>
        </select>
      </label>
      {fasesProyecto.length > 0 && (
        <label>
          Fase
          <select id="fase" name="fase" defaultValue="">
            <option value="">Sin fase</option>
            {fasesProyecto.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
        </label>
      )}
      <div className="fila">
        <label>
          Horas
          <input id="horas" name="horas" type="number" inputMode="decimal" min="0.5" max="24" step="0.5" required placeholder="Ej. 2,5" />
        </label>
        <label style={{ flexGrow: 3 }}>
          Nota (opcional)
          <input id="nota" name="nota" type="text" maxLength={200} placeholder="Qué hiciste" />
        </label>
      </div>
      <div>
        <button type="submit">{textoBoton}</button>
      </div>
    </form>
  );
}
