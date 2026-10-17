import { describe, expect, it } from 'vitest';
import { diaSemana, hoyISO, lunesDeSemana, rangoDias, ultimoDiaMes } from './fechas';
import { clasificarDia, tipoDeDia, validarHoras } from './reglas';

describe('clasificarDia', () => {
  it('día hábil dentro de la jornada: todo ordinario', () => {
    expect(clasificarDia([3, 4], 'habil', 8)).toEqual([
      { ord: 3, ex50: 0, ex100: 0 },
      { ord: 4, ex50: 0, ex100: 0 },
    ]);
  });

  it('día hábil que excede la jornada: lo cargado después es extra 50 %', () => {
    expect(clasificarDia([5, 2, 3], 'habil', 8)).toEqual([
      { ord: 5, ex50: 0, ex100: 0 },
      { ord: 2, ex50: 0, ex100: 0 },
      { ord: 1, ex50: 2, ex100: 0 },
    ]);
  });

  it('respeta medias horas sin errores de redondeo', () => {
    expect(clasificarDia([7.5, 1.5], 'habil', 8.5)).toEqual([
      { ord: 7.5, ex50: 0, ex100: 0 },
      { ord: 1, ex50: 0.5, ex100: 0 },
    ]);
  });

  it('jornada 0: todo es extra', () => {
    expect(clasificarDia([2], 'habil', 0)).toEqual([{ ord: 0, ex50: 2, ex100: 0 }]);
  });

  it('domingo y feriado: todo extra 100 %', () => {
    expect(clasificarDia([4], 'domingo', 8)).toEqual([{ ord: 0, ex50: 0, ex100: 4 }]);
    expect(clasificarDia([2, 1], 'feriado', 8)).toEqual([
      { ord: 0, ex50: 0, ex100: 2 },
      { ord: 0, ex50: 0, ex100: 1 },
    ]);
  });

  it('sábado según la regla configurada', () => {
    expect(clasificarDia([3], 'sabado', 8, 'extra100')).toEqual([{ ord: 0, ex50: 0, ex100: 3 }]);
    expect(clasificarDia([3], 'sabado', 8, 'extra50')).toEqual([{ ord: 0, ex50: 3, ex100: 0 }]);
  });
});

describe('tipoDeDia', () => {
  it('distingue hábil, sábado, domingo y feriado', () => {
    expect(tipoDeDia('2026-10-16', false)).toBe('habil'); // viernes
    expect(tipoDeDia('2026-10-17', false)).toBe('sabado');
    expect(tipoDeDia('2026-10-18', false)).toBe('domingo');
    expect(tipoDeDia('2026-12-08', true)).toBe('feriado');
  });
});

describe('validarHoras', () => {
  it('acepta bloques de media hora', () => {
    expect(validarHoras(2.5, 0)).toBeNull();
  });
  it('rechaza cero, negativos y fracciones que no son media hora', () => {
    expect(validarHoras(0, 0)).not.toBeNull();
    expect(validarHoras(-1, 0)).not.toBeNull();
    expect(validarHoras(1.25, 0)).not.toBeNull();
    expect(validarHoras(Number.NaN, 0)).not.toBeNull();
  });
  it('no deja pasar de 24 h en el día', () => {
    expect(validarHoras(5, 20)).not.toBeNull();
    expect(validarHoras(4, 20)).toBeNull();
  });
});

describe('fechas', () => {
  it('hoy se calcula en hora de Tucumán (UTC-3)', () => {
    // 02:30 UTC del 18/10 = 23:30 del 17/10 en Tucumán
    expect(hoyISO(new Date('2026-10-18T02:30:00Z'))).toBe('2026-10-17');
    expect(hoyISO(new Date('2026-10-18T03:00:00Z'))).toBe('2026-10-18');
  });
  it('utilidades de calendario', () => {
    expect(diaSemana('2026-10-17')).toBe(6);
    expect(lunesDeSemana('2026-10-18')).toBe('2026-10-12');
    expect(ultimoDiaMes('2028-02')).toBe('2028-02-29');
    expect(rangoDias('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});
