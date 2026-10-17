'use server';

import { redirect } from 'next/navigation';
import { auditar } from '@/lib/auditoria';
import { cerrarSesion, crearSesion, requireUsuario } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { hoyISO } from '@/lib/fechas';
import { hashPassword, validarPasswordNueva, verificarPassword } from '@/lib/password';
import { agregarRegistro, eliminarRegistro, ErrorCarga } from '@/lib/registros';

const conMensaje = (ruta: string, tipo: 'error' | 'ok', msg: string) =>
  `${ruta}${ruta.includes('?') ? '&' : '?'}${tipo}=${encodeURIComponent(msg)}`;

/** Solo rutas internas, para no redirigir a otro sitio. */
function volverA(fd: FormData, porDefecto: string): string {
  const v = String(fd.get('volver') ?? '');
  return v.startsWith('/') && !v.startsWith('//') ? v : porDefecto;
}

// Freno simple a intentos repetidos de login (por email, en memoria).
const intentos = new Map<string, { n: number; desde: number }>();
const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60_000;

export async function loginAccion(fd: FormData) {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');
  const ahora = Date.now();
  const reg = intentos.get(email);
  if (reg && ahora - reg.desde < VENTANA_MS && reg.n >= MAX_INTENTOS) {
    redirect(conMensaje('/login', 'error', 'Demasiados intentos. Probá de nuevo en 15 minutos.'));
  }
  const m = await q1<{ id: number; password_hash: string; activo: boolean }>(
    'select id, password_hash, activo from miembros where email = $1',
    [email],
  );
  if (!m || !m.activo || !(await verificarPassword(password, m.password_hash))) {
    const actual = reg && ahora - reg.desde < VENTANA_MS ? reg : { n: 0, desde: ahora };
    intentos.set(email, { n: actual.n + 1, desde: actual.desde });
    redirect(conMensaje('/login', 'error', 'Email o contraseña incorrectos.'));
  }
  intentos.delete(email);
  await crearSesion(m.id);
  await auditar(m.id, 'login', 'miembro', m.id);
  redirect('/');
}

export async function cerrarSesionAccion() {
  await cerrarSesion();
  redirect('/login');
}

function leerCarga(fd: FormData) {
  const proyectoId = Number(fd.get('proyecto'));
  const fase = String(fd.get('fase') ?? '');
  return {
    proyectoId,
    faseId: fase ? Number(fase) : null,
    horas: Number(String(fd.get('horas') ?? '').replace(',', '.')),
    nota: String(fd.get('nota') ?? '').trim().slice(0, 200),
  };
}

export async function agregarHoyAccion(fd: FormData) {
  const u = await requireUsuario();
  const c = leerCarga(fd);
  if (!Number.isInteger(c.proyectoId) || c.proyectoId <= 0) redirect(conMensaje('/', 'error', 'Elegí un proyecto.'));
  try {
    await agregarRegistro(u, { ...c, miembroId: u.id, fecha: hoyISO() });
  } catch (e) {
    if (e instanceof ErrorCarga) redirect(conMensaje('/', 'error', e.message));
    throw e;
  }
  redirect(conMensaje('/', 'ok', 'Horas cargadas.'));
}

export async function eliminarRegistroAccion(fd: FormData) {
  const u = await requireUsuario();
  const destino = volverA(fd, '/');
  try {
    await eliminarRegistro(u, Number(fd.get('id')));
  } catch (e) {
    if (e instanceof ErrorCarga) redirect(conMensaje(destino, 'error', e.message));
    throw e;
  }
  redirect(conMensaje(destino, 'ok', 'Carga eliminada.'));
}

export async function cambiarPasswordAccion(fd: FormData) {
  const u = await requireUsuario();
  const actual = String(fd.get('actual') ?? '');
  const nueva = String(fd.get('nueva') ?? '');
  const repetir = String(fd.get('repetir') ?? '');
  const m = await q1<{ password_hash: string }>('select password_hash from miembros where id = $1', [u.id]);
  if (!m || !(await verificarPassword(actual, m.password_hash)))
    redirect(conMensaje('/cuenta', 'error', 'La contraseña actual no es correcta.'));
  const err = validarPasswordNueva(nueva) ?? (nueva !== repetir ? 'Las contraseñas nuevas no coinciden.' : null);
  if (err) redirect(conMensaje('/cuenta', 'error', err));
  await q('update miembros set password_hash = $2 where id = $1', [u.id, await hashPassword(nueva)]);
  await auditar(u.id, 'cambiar_password', 'miembro', u.id);
  redirect(conMensaje('/cuenta', 'ok', 'Contraseña actualizada.'));
}
