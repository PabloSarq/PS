// Fechas como texto ISO (YYYY-MM-DD). "Hoy" siempre se calcula con la hora del
// servidor en la zona del estudio, nunca con el reloj del dispositivo.

export const TZ = process.env.ZONA_HORARIA || 'America/Argentina/Tucuman';

export function hoyISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

function aUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function deUTC(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function esFechaISO(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  return deUTC(aUTC(valor)) === valor;
}

export function esAnioMes(valor: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(iso: string): number {
  return aUTC(iso).getUTCDay();
}

export function sumarDias(iso: string, dias: number): string {
  const f = aUTC(iso);
  f.setUTCDate(f.getUTCDate() + dias);
  return deUTC(f);
}

export function lunesDeSemana(iso: string): string {
  const dow = diaSemana(iso);
  return sumarDias(iso, dow === 0 ? -6 : 1 - dow);
}

export function anioMes(iso: string): string {
  return iso.slice(0, 7);
}

export function primerDiaMes(anioMes: string): string {
  return `${anioMes}-01`;
}

export function ultimoDiaMes(anioMes: string): string {
  const [y, m] = anioMes.split('-').map(Number);
  return deUTC(new Date(Date.UTC(y, m, 0)));
}

export function mesAnterior(anioMes: string): string {
  return sumarDias(primerDiaMes(anioMes), -1).slice(0, 7);
}

export function mesSiguiente(anioMes: string): string {
  return sumarDias(ultimoDiaMes(anioMes), 1).slice(0, 7);
}

export function rangoDias(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', ...opts });

export function formatoLargo(iso: string): string {
  const t = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(aUTC(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function formatoCorto(iso: string): string {
  return fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(aUTC(iso));
}

export function nombreMes(anioMes: string): string {
  const t = fmt({ month: 'long', year: 'numeric' }).format(aUTC(primerDiaMes(anioMes)));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function nombreDia(iso: string): string {
  return fmt({ weekday: 'short' }).format(aUTC(iso)).replace('.', '');
}
