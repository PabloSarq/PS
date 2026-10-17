import Link from 'next/link';
import { cerrarSesionAccion } from '@/app/acciones';
import type { Usuario } from '@/lib/auth';

const ROL: Record<Usuario['rol'], string> = { profesional: 'Profesional', manager: 'Manager', socio: 'Socio' };

export function Marco({ usuario, children }: { usuario: Usuario; children: React.ReactNode }) {
  const informes = usuario.rol === 'manager' || usuario.rol === 'socio';
  return (
    <>
      <header className="top">
        <div className="top-in">
          <Link href="/" className="marca">
            Time Report<small>{process.env.NOMBRE_ESTUDIO || ''}</small>
          </Link>
          <nav className="nav" aria-label="Principal">
            <Link href="/">Hoy</Link>
            <Link href="/mes">Mi mes</Link>
            {informes && <Link href="/informes">Informes</Link>}
            {usuario.rol === 'manager' && (
              <>
                <Link href="/admin/carga">Cargar por otro</Link>
                <Link href="/admin/proyectos">Proyectos</Link>
                <Link href="/admin/miembros">Equipo</Link>
                <Link href="/admin/feriados">Feriados</Link>
              </>
            )}
          </nav>
          <div className="usuario">
            <Link href="/cuenta">{usuario.nombre}</Link>
            <span>· {ROL[usuario.rol]}</span>
            <form action={cerrarSesionAccion} className="inline">
              <button className="sec mini" type="submit">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </>
  );
}

export function Avisos({ sp }: { sp: { error?: string; ok?: string } }) {
  return (
    <>
      {sp.error && <div className="aviso error" role="alert">{sp.error}</div>}
      {sp.ok && <div className="aviso ok" role="status">{sp.ok}</div>}
    </>
  );
}
