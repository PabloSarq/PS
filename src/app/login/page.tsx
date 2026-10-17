import { redirect } from 'next/navigation';
import { Avisos } from '@/components/Marco';
import { usuarioActual } from '@/lib/auth';
import { loginAccion } from '../acciones';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await usuarioActual()) redirect('/');
  const sp = await searchParams;
  return (
    <div className="login">
      <div className="panel">
        <div>
          <h1>Time Report</h1>
          <p className="muted">{process.env.NOMBRE_ESTUDIO || 'Registro diario de horas'}</p>
        </div>
        <Avisos sp={sp} />
        <form action={loginAccion} className="campos">
          <label>
            Email
            <input id="email" name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">Entrar</button>
        </form>
        <p className="muted small">¿Te olvidaste la contraseña? Pedile al manager que te asigne una nueva.</p>
      </div>
    </div>
  );
}
