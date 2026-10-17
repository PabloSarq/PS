import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { q, q1 } from './db';

export type Rol = 'profesional' | 'manager' | 'socio';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  jornada_diaria: number;
}

const COOKIE = 'tr_sesion';
const DURACION_DIAS = 30;

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export async function crearSesion(miembroId: number): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DURACION_DIAS * 86400_000);
  await q('insert into sesiones (token_hash, miembro_id, expira) values ($1, $2, $3)', [
    hashToken(token),
    miembroId,
    expira,
  ]);
  await q('delete from sesiones where expira < now()');
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    expires: expira,
  });
}

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('delete from sesiones where token_hash = $1', [hashToken(token)]);
  jar.delete(COOKIE);
}

export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const u = await q1<Usuario>(
    `select m.id, m.nombre, m.email, m.rol, m.jornada_diaria
       from sesiones s join miembros m on m.id = s.miembro_id
      where s.token_hash = $1 and s.expira > now() and m.activo`,
    [hashToken(token)],
  );
  return u ?? null;
});

export async function requireUsuario(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect('/login');
  return u;
}

export async function requireRol(...roles: Rol[]): Promise<Usuario> {
  const u = await requireUsuario();
  if (!roles.includes(u.rol)) redirect('/?error=' + encodeURIComponent('No tenés permiso para entrar ahí.'));
  return u;
}

export const puedeVerInformes = (u: Usuario) => u.rol === 'manager' || u.rol === 'socio';
