// Consultas de informes. Un período es un rango de fechas cerrado [desde, hasta].

import { q } from './db';
import {
  anioMes,
  diaSemana,
  esAnioMes,
  esFechaISO,
  formatoCorto,
  hoyISO,
  lunesDeSemana,
  nombreMes,
  primerDiaMes,
  rangoDias,
  sumarDias,
  ultimoDiaMes,
} from './fechas';

export interface Periodo {
  tipo: 'mes' | 'semana';
  desde: string;
  hasta: string;
  /** YYYY-MM si es un mes completo (para horas contratadas y topes). */
  mes: string | null;
  titulo: string;
  anterior: string;
  siguiente: string;
}

export function periodoDesdeParams(params: { mes?: string; semana?: string }): Periodo {
  if (params.semana && esFechaISO(params.semana)) {
    const desde = lunesDeSemana(params.semana);
    const hasta = sumarDias(desde, 6);
    return {
      tipo: 'semana',
      desde,
      hasta,
      mes: null,
      titulo: `Semana del ${formatoCorto(desde)} al ${formatoCorto(hasta)}`,
      anterior: `?semana=${sumarDias(desde, -7)}`,
      siguiente: `?semana=${sumarDias(desde, 7)}`,
    };
  }
  const mes = params.mes && esAnioMes(params.mes) ? params.mes : anioMes(hoyISO());
  const desde = primerDiaMes(mes);
  return {
    tipo: 'mes',
    desde,
    hasta: ultimoDiaMes(mes),
    mes,
    titulo: nombreMes(mes),
    anterior: `?mes=${anioMes(sumarDias(desde, -1))}`,
    siguiente: `?mes=${anioMes(sumarDias(ultimoDiaMes(mes), 1))}`,
  };
}

export interface FilaProyecto {
  id: number;
  codigo: string;
  nombre: string;
  cliente: string | null;
  interno: boolean;
  horas_ord: number;
  horas_ex50: number;
  horas_ex100: number;
  horas: number;
  costo: number;
  personas: number;
  horas_presupuestadas: number | null;
  horas_acumuladas: number;
}

export async function informeProyectos(p: Periodo): Promise<FilaProyecto[]> {
  return q<FilaProyecto>(
    `with periodo as (
       select proyecto_id,
              sum(horas_ord) as horas_ord, sum(horas_ex50) as horas_ex50, sum(horas_ex100) as horas_ex100,
              sum(horas) as horas, sum(costo) as costo, count(distinct miembro_id) as personas
         from v_registros_costo where fecha between $1 and $2
        group by proyecto_id),
     acumulado as (select proyecto_id, sum(horas) as horas from registros group by proyecto_id)
     select p.id, p.codigo, p.nombre, p.cliente, p.interno,
            pe.horas_ord, pe.horas_ex50, pe.horas_ex100, pe.horas, pe.costo, pe.personas::int as personas,
            p.horas_presupuestadas, coalesce(a.horas, 0) as horas_acumuladas
       from periodo pe
       join proyectos p on p.id = pe.proyecto_id
       left join acumulado a on a.proyecto_id = p.id
      order by pe.horas desc, p.codigo`,
    [p.desde, p.hasta],
  );
}

export interface FilaMiembro {
  id: number;
  nombre: string;
  rol: string;
  horas_ord: number;
  horas_ex50: number;
  horas_ex100: number;
  horas: number;
  costo: number;
  contratadas: number | null;
  tope_extras_mes: number | null;
  dias_cargados_por_manager: number;
  sin_tarifa: boolean;
  dias_sin_carga: number;
}

export async function informeMiembros(p: Periodo): Promise<FilaMiembro[]> {
  const filas = await q<Omit<FilaMiembro, 'dias_sin_carga'> & { creado: string; dias_con_carga: string[] }>(
    `select m.id, m.nombre, m.rol, m.tope_extras_mes, m.creado_en::date::text as creado,
            coalesce(sum(r.horas_ord), 0) as horas_ord, coalesce(sum(r.horas_ex50), 0) as horas_ex50,
            coalesce(sum(r.horas_ex100), 0) as horas_ex100, coalesce(sum(r.horas), 0) as horas,
            coalesce(sum(r.costo), 0) as costo,
            c.horas as contratadas,
            count(distinct r.fecha) filter (where r.cargado_por <> r.miembro_id)::int as dias_cargados_por_manager,
            coalesce(bool_or(r.sin_tarifa), false) as sin_tarifa,
            coalesce(array_agg(distinct r.fecha::text) filter (where r.id is not null), '{}') as dias_con_carga
       from miembros m
       left join v_registros_costo r on r.miembro_id = m.id and r.fecha between $1 and $2
       left join contratos_mensuales c on c.miembro_id = m.id and c.anio_mes = $3
      where m.activo or r.id is not null
      group by m.id, c.horas
      order by m.nombre`,
    [p.desde, p.hasta, p.mes],
  );
  const feriados = new Set(
    (await q<{ fecha: string }>('select fecha from feriados where fecha between $1 and $2', [p.desde, p.hasta])).map(
      (f) => f.fecha,
    ),
  );
  // Días hábiles ya cerrados (hasta ayer) en los que el miembro no cargó nada.
  const ayer = sumarDias(hoyISO(), -1);
  const fin = p.hasta < ayer ? p.hasta : ayer;
  return filas.map(({ creado, dias_con_carga, ...f }) => {
    const inicio = creado > p.desde ? creado : p.desde;
    const conCarga = new Set(dias_con_carga);
    const habiles = inicio <= fin ? rangoDias(inicio, fin) : [];
    const sinCarga = habiles.filter((d) => {
      const dow = diaSemana(d);
      return dow !== 0 && dow !== 6 && !feriados.has(d) && !conCarga.has(d);
    }).length;
    return { ...f, dias_sin_carga: sinCarga };
  });
}

export interface FilaRegistro {
  fecha: string;
  miembro: string;
  proyecto_codigo: string;
  proyecto: string;
  fase: string | null;
  horas: number;
  horas_ord: number;
  horas_ex50: number;
  horas_ex100: number;
  costo: number;
  nota: string | null;
  cargado_por: string;
}

export async function registrosDelPeriodo(p: Periodo): Promise<FilaRegistro[]> {
  return q<FilaRegistro>(
    `select r.fecha, m.nombre as miembro, p.codigo as proyecto_codigo, p.nombre as proyecto, f.nombre as fase,
            r.horas, r.horas_ord, r.horas_ex50, r.horas_ex100, r.costo, r.nota, c.nombre as cargado_por
       from v_registros_costo r
       join miembros m on m.id = r.miembro_id
       join miembros c on c.id = r.cargado_por
       join proyectos p on p.id = r.proyecto_id
       left join fases f on f.id = r.fase_id
      where r.fecha between $1 and $2
      order by r.fecha, m.nombre, r.creado_en`,
    [p.desde, p.hasta],
  );
}

export interface DiaMes {
  fecha: string;
  horas: number;
  horas_ord: number;
  horas_extra: number;
}

export async function resumenMesMiembro(miembroId: number, mes: string): Promise<DiaMes[]> {
  return q<DiaMes>(
    `select fecha, sum(horas) as horas, sum(horas_ord) as horas_ord, sum(horas_ex50 + horas_ex100) as horas_extra
       from registros where miembro_id = $1 and fecha between $2 and $3
      group by fecha order by fecha`,
    [miembroId, primerDiaMes(mes), ultimoDiaMes(mes)],
  );
}
