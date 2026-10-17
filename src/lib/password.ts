import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificarPassword(password: string, guardado: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = guardado.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), esperado.length);
  return timingSafeEqual(hash, esperado);
}

export function validarPasswordNueva(password: string): string | null {
  if (password.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.';
  return null;
}
