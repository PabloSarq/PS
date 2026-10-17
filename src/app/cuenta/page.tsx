import { Avisos, Marco } from '@/components/Marco';
import { requireUsuario } from '@/lib/auth';
import { formatoHoras } from '@/lib/reglas';
import { cambiarPasswordAccion } from '../acciones';

export const dynamic = 'force-dynamic';

export default async function CuentaPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const u = await requireUsuario();
  const sp = await searchParams;
  return (
    <Marco usuario={u}>
      <div className="cabecera">
        <div>
          <h1>Mi cuenta</h1>
          <p className="sub">{u.email} · jornada de {formatoHoras(u.jornada_diaria)} h</p>
        </div>
      </div>
      <Avisos sp={sp} />
      <section className="panel" style={{ maxWidth: 480 }}>
        <h2>Cambiar contraseña</h2>
        <form action={cambiarPasswordAccion} className="campos">
          <label>Contraseña actual<input id="actual" name="actual" type="password" autoComplete="current-password" required /></label>
          <label>Nueva contraseña<input id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Repetir nueva contraseña<input id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={8} required /></label>
          <div><button type="submit">Guardar</button></div>
        </form>
      </section>
    </Marco>
  );
}
