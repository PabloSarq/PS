import Link from 'next/link';
import { Avisos, Marco } from '@/components/Marco';
import { requireRol } from '@/lib/auth';
import { q } from '@/lib/db';
import { anioMes, hoyISO } from '@/lib/fechas';
import { formatoHoras, formatoPesos } from '@/lib/reglas';
import { crearMiembroAccion } from '../acciones';

export const dynamic = 'force-dynamic';

interface Fila {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  jornada_diaria: number;
  activo: boolean;
  contratadas: number | null;
  costo_ordinaria: number | null;
}

export default async function MiembrosPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const u = await requireRol('manager');
  const sp = await searchParams;
  const hoy = hoyISO();
  const filas = await q<Fila>(
    `select m.id, m.nombre, m.email, m.rol, m.jornada_diaria, m.activo, c.horas as contratadas,
            (select t.costo_ordinaria from tarifas t where t.miembro_id = m.id and t.vigente_desde <= $2
              order by t.vigente_desde desc limit 1) as costo_ordinaria
       from miembros m
       left join contratos_mensuales c on c.miembro_id = m.id and c.anio_mes = $1
      order by m.activo desc, m.nombre`,
    [anioMes(hoy), hoy],
  );
  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <h1>Equipo</h1>
          <p className="sub">Horas contratadas y tarifa vigente del mes actual.</p>
        </div>
      </div>
      <Avisos sp={sp} />
      <section className="panel">
        <div className="tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th><th>Email</th><th>Rol</th><th className="num">Jornada</th>
                <th className="num">Contratadas mes</th><th className="num">Costo hora ord.</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/admin/miembros/${m.id}`}>{m.nombre}</Link></td>
                  <td>{m.email}</td>
                  <td>{m.rol}</td>
                  <td className="num">{formatoHoras(m.jornada_diaria)} h</td>
                  <td className="num">{m.contratadas !== null ? `${formatoHoras(m.contratadas)} h` : <span className="pill warn">sin cargar</span>}</td>
                  <td className="num">{m.costo_ordinaria !== null ? formatoPesos(m.costo_ordinaria) : <span className="pill warn">sin tarifa</span>}</td>
                  <td><span className={`pill ${m.activo ? 'ok' : 'neutro'}`}>{m.activo ? 'activo' : 'inactivo'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" style={{ maxWidth: 720 }}>
        <h2>Nuevo miembro</h2>
        <form action={crearMiembroAccion} className="campos">
          <div className="fila">
            <label>Nombre y apellido<input id="nombre" name="nombre" required maxLength={200} /></label>
            <label>Email<input id="email" name="email" type="email" required /></label>
          </div>
          <div className="fila">
            <label>
              Rol
              <select id="rol" name="rol" defaultValue="profesional">
                <option value="profesional">Profesional</option>
                <option value="socio">Socio (carga + informes)</option>
                <option value="manager">Manager (todo)</option>
              </select>
            </label>
            <label>Jornada diaria (h)<input id="jornada_diaria" name="jornada_diaria" type="number" min="0" max="24" step="0.5" defaultValue="8" required /></label>
            <label>Tope de extras por mes (h)<input id="tope_extras_mes" name="tope_extras_mes" type="number" min="0" step="1" placeholder="Opcional" /></label>
          </div>
          <label>Contraseña inicial<input id="password" name="password" type="text" minLength={8} required autoComplete="off" /></label>
          <p className="muted small">Después de crearlo, cargá sus horas contratadas y su tarifa en la ficha del miembro.</p>
          <div><button type="submit">Crear miembro</button></div>
        </form>
      </section>
    </Marco>
  );
}
