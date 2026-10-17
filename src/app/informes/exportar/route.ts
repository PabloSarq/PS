import ExcelJS from 'exceljs';
import { usuarioActual } from '@/lib/auth';
import { informeMiembros, informeProyectos, periodoDesdeParams, registrosDelPeriodo } from '@/lib/informes';

export const dynamic = 'force-dynamic';

const HORAS = '#,##0.0';
const PESOS = '"$" #,##0';

function hoja(wb: ExcelJS.Workbook, nombre: string, columnas: { header: string; key: string; width: number; fmt?: string }[]) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }));
  ws.getRow(1).font = { bold: true };
  return ws;
}

export async function GET(req: Request) {
  const u = await usuarioActual();
  if (!u || (u.rol !== 'manager' && u.rol !== 'socio')) return new Response('No autorizado', { status: 403 });

  const url = new URL(req.url);
  const p = periodoDesdeParams({
    mes: url.searchParams.get('mes') ?? undefined,
    semana: url.searchParams.get('semana') ?? undefined,
  });
  const [proyectos, miembros, registros] = await Promise.all([informeProyectos(p), informeMiembros(p), registrosDelPeriodo(p)]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Time Report';
  wb.created = new Date();

  const wp = hoja(wb, 'Proyectos', [
    { header: 'Código', key: 'codigo', width: 12 },
    { header: 'Proyecto', key: 'nombre', width: 34 },
    { header: 'Cliente', key: 'cliente', width: 24 },
    { header: 'Horas', key: 'horas', width: 10, fmt: HORAS },
    { header: 'Ordinarias', key: 'horas_ord', width: 11, fmt: HORAS },
    { header: 'Extra 50 %', key: 'horas_ex50', width: 11, fmt: HORAS },
    { header: 'Extra 100 %', key: 'horas_ex100', width: 11, fmt: HORAS },
    { header: 'Personas', key: 'personas', width: 10 },
    { header: 'Costo', key: 'costo', width: 14, fmt: PESOS },
    { header: 'Horas presupuestadas', key: 'horas_presupuestadas', width: 14, fmt: HORAS },
    { header: 'Horas acumuladas', key: 'horas_acumuladas', width: 14, fmt: HORAS },
  ]);
  proyectos.forEach((x) => wp.addRow(x));

  const wm = hoja(wb, 'Equipo', [
    { header: 'Miembro', key: 'nombre', width: 28 },
    { header: 'Horas', key: 'horas', width: 10, fmt: HORAS },
    { header: 'Contratadas', key: 'contratadas', width: 12, fmt: HORAS },
    { header: 'Ordinarias', key: 'horas_ord', width: 11, fmt: HORAS },
    { header: 'Extra 50 %', key: 'horas_ex50', width: 11, fmt: HORAS },
    { header: 'Extra 100 %', key: 'horas_ex100', width: 11, fmt: HORAS },
    { header: 'Costo', key: 'costo', width: 14, fmt: PESOS },
    { header: 'Días sin carga', key: 'dias_sin_carga', width: 13 },
    { header: 'Días cargados por manager', key: 'dias_cargados_por_manager', width: 16 },
  ]);
  miembros.forEach((x) => wm.addRow(x));

  const wr = hoja(wb, 'Registros', [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Miembro', key: 'miembro', width: 24 },
    { header: 'Código', key: 'proyecto_codigo', width: 12 },
    { header: 'Proyecto', key: 'proyecto', width: 30 },
    { header: 'Fase', key: 'fase', width: 18 },
    { header: 'Horas', key: 'horas', width: 8, fmt: HORAS },
    { header: 'Ordinarias', key: 'horas_ord', width: 11, fmt: HORAS },
    { header: 'Extra 50 %', key: 'horas_ex50', width: 11, fmt: HORAS },
    { header: 'Extra 100 %', key: 'horas_ex100', width: 11, fmt: HORAS },
    { header: 'Costo', key: 'costo', width: 12, fmt: PESOS },
    { header: 'Nota', key: 'nota', width: 40 },
    { header: 'Cargado por', key: 'cargado_por', width: 20 },
  ]);
  registros.forEach((x) => wr.addRow(x));
  wr.autoFilter = { from: 'A1', to: 'L1' };

  const buffer = await wb.xlsx.writeBuffer();
  const nombre = `time-report_${p.tipo === 'mes' ? p.mes : `semana_${p.desde}`}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
