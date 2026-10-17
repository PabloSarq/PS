// Reglas de clasificación de horas. Funciones puras, sin base de datos.
//
// Día hábil: las horas cargadas llenan la jornada diaria del miembro en el orden
// en que se cargaron; lo que excede la jornada es extra al 50 %.
// Sábado: según REGLA_SABADO (por defecto extra al 100 %; validar con contador).
// Domingo y feriado: todo es extra al 100 %.

import { diaSemana } from './fechas';

export type TipoDia = 'habil' | 'sabado' | 'domingo' | 'feriado';
export type TipoExtra = 'extra50' | 'extra100';

export interface Desglose {
  ord: number;
  ex50: number;
  ex100: number;
}

export const HORAS_MAX_DIA = 24;

export function reglaSabado(): TipoExtra {
  return process.env.REGLA_SABADO === 'extra50' ? 'extra50' : 'extra100';
}

export function tipoDeDia(iso: string, esFeriado: boolean): TipoDia {
  if (esFeriado) return 'feriado';
  const dow = diaSemana(iso);
  if (dow === 0) return 'domingo';
  if (dow === 6) return 'sabado';
  return 'habil';
}

export const ETIQUETA_DIA: Record<TipoDia, string> = {
  habil: 'Día hábil',
  sabado: 'Sábado',
  domingo: 'Domingo',
  feriado: 'Feriado',
};

// Se trabaja en medias horas enteras para evitar errores de redondeo.
const aMedias = (h: number) => Math.round(h * 2);
const deMedias = (m: number) => m / 2;

/**
 * Reparte las horas de un día (en orden de carga) entre ordinarias y extras.
 * Devuelve un desglose por cada entrada, en el mismo orden.
 */
export function clasificarDia(
  horas: number[],
  tipo: TipoDia,
  jornada: number,
  sabado: TipoExtra = reglaSabado(),
): Desglose[] {
  if (tipo !== 'habil') {
    const tipoExtra: TipoExtra = tipo === 'sabado' ? sabado : 'extra100';
    return horas.map((h) =>
      tipoExtra === 'extra50' ? { ord: 0, ex50: h, ex100: 0 } : { ord: 0, ex50: 0, ex100: h },
    );
  }
  let restante = Math.max(0, aMedias(jornada));
  return horas.map((h) => {
    const total = aMedias(h);
    const ord = Math.min(total, restante);
    restante -= ord;
    return { ord: deMedias(ord), ex50: deMedias(total - ord), ex100: 0 };
  });
}

/** Valida la cantidad de horas de una carga. Devuelve un mensaje de error o null. */
export function validarHoras(horas: number, yaCargadasEnElDia: number): string | null {
  if (!Number.isFinite(horas) || horas <= 0) return 'Ingresá una cantidad de horas mayor a 0.';
  if (aMedias(horas) !== horas * 2) return 'Las horas se cargan en bloques de media hora (0,5).';
  if (yaCargadasEnElDia + horas > HORAS_MAX_DIA)
    return `El día no puede superar ${HORAS_MAX_DIA} horas en total.`;
  return null;
}

export function formatoHoras(h: number): string {
  const n = Math.round(h * 100) / 100;
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export function formatoPesos(n: number): string {
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}
