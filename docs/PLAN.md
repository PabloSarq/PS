# Time Report — Estudio de Arquitectura

Plan funcional y técnico, v0.1 (borrador para discutir).

---

## 1. Objetivo

Medir, día por día, **cuántas horas profesionales dedica cada miembro a cada proyecto**, separando horas **ordinarias** (contratadas) de horas **extra**, valorizarlas con la tarifa de cada miembro y sacar indicadores de producción semanales y mensuales.

---

## 2. Roles

| Rol | Qué hace |
|---|---|
| **Profesional** | Se loguea, ve sus proyectos, carga las horas del día, ve su propio resumen del mes. |
| **Manager** | Todo lo anterior + ABM de proyectos, miembros, tarifas, horas contratadas, feriados, asignación de roles. Aprueba extras y correcciones. Ve todos los informes. |
| **Socio / Lectura** *(opcional)* | Solo informes, sin editar datos maestros. Útil para Álvaro o un contador. |

---

## 3. Reglas de negocio

### 3.1 Carga diaria
- Solo se carga el **día de hoy**, con hora del servidor en `America/Argentina/Tucuman`. No se confía en el reloj del celular/PC.
- No se puede cargar a futuro ni a días pasados.
- **Propuesta (ver §8, punto 1):** el día queda editable hasta las 23:59 y se cierra solo. Si alguien se olvidó, pide una **corrección** que el manager aprueba o rechaza. Todo queda en un registro de auditoría.

### 3.2 Horas ordinarias vs. extra
- Cada miembro tiene **horas contratadas por mes** (editables por el manager, mes a mes).
- De ahí sale una **jornada diaria ordinaria** (ej.: 160 h / 20 días hábiles = 8 h/día), o se fija a mano por miembro.
- En un día hábil: las primeras *N* horas son ordinarias; lo que exceda la jornada se carga como **extra**.
- Sábados, domingos y feriados: **todo es extra**.
- Tipos de extra sugeridos (referencia LCT, art. 201 — validar con contador/convenio):
  - **Extra 50 %**: días hábiles fuera de jornada.
  - **Extra 100 %**: sábados después de las 13 h, domingos y feriados.
- Las extras quedan **pendientes de aprobación** del manager hasta que se validan (cuestan plata; conviene que alguien las mire).

### 3.3 Tarifas
- Cada miembro tiene tarifa por tipo: ordinaria, extra 50 %, extra 100 % (o un multiplicador sobre la ordinaria).
- Las tarifas tienen **vigencia desde/hasta**. Si se actualizan en noviembre, los informes de octubre siguen calculándose con la tarifa de octubre. Con inflación, esto es indispensable.

### 3.4 Proyectos
- Cada proyecto tiene: código, nombre, cliente, estado (activo / pausado / cerrado), y opcionalmente **horas presupuestadas** y **fases** (anteproyecto, proyecto ejecutivo, documentación, dirección de obra).
- El manager define **qué miembros ven qué proyectos** en el desplegable (evita cargas a proyectos ajenos).
- Proyectos cerrados desaparecen del desplegable pero siguen en informes.
- Conviene un par de "proyectos internos" fijos: *Administración*, *Concursos/Propuestas*, *Capacitación*, para no forzar horas no productivas dentro de proyectos reales.

---

## 4. Pantallas

### Profesional
1. **Login** (email + contraseña, o Google).
2. **Hoy**: barra de progreso de la jornada (ej. `5,5 / 8 h ordinarias`), lista de cargas del día, botón *Agregar*: proyecto (desplegable) → fase (opcional) → horas (en bloques de 0,5 h) → nota corta. Si se pasa de la jornada, la app avisa que lo excedente va como extra.
3. **Mi mes**: calendario mensual con colores por día (cargado / incompleto / sin carga / feriado), totales ordinarias vs. extras, horas contratadas vs. cargadas.
4. **Solicitar corrección** de un día pasado (con motivo).

### Manager
5. **Dashboard** (ver §6).
6. **Proyectos**: ABM + asignación de miembros + presupuesto de horas.
7. **Miembros**: ABM, rol, horas contratadas por mes, jornada diaria, tarifas con vigencia.
8. **Feriados**: precargados (nacionales + Tucumán), editables.
9. **Aprobaciones**: extras y correcciones pendientes.
10. **Informes**: filtros por período / proyecto / miembro + exportar Excel y PDF.

---

## 5. Modelo de datos (simplificado)

```
miembros            (id, nombre, email, rol, activo, jornada_diaria_default)
contrato_mensual    (miembro_id, año_mes, horas_contratadas)
tarifas             (miembro_id, tipo[ordinaria|extra50|extra100], valor_hora, vigente_desde, vigente_hasta)
proyectos           (id, codigo, nombre, cliente, estado, horas_presupuestadas, interno[bool])
fases               (id, proyecto_id, nombre)
asignaciones        (proyecto_id, miembro_id)
feriados            (fecha, descripcion, ambito[nacional|provincial|estudio])
registros_horas     (id, miembro_id, proyecto_id, fase_id, fecha, horas, tipo[ordinaria|extra50|extra100],
                     estado[ok|pendiente|aprobado|rechazado], nota, creado_en)
correcciones        (id, miembro_id, fecha_objetivo, detalle, estado, resuelto_por, resuelto_en)
auditoria           (quién, qué, cuándo, valor_anterior, valor_nuevo)
```

El **costo** de un registro se calcula al momento del informe: `horas × tarifa vigente en esa fecha para ese tipo`.

---

## 6. Indicadores e informes

**Por proyecto**
- Horas totales (semana / mes / acumulado) y desglose por miembro y fase.
- Costo en horas-hombre ($) ordinario + extra.
- **Presupuestado vs. real** y % de avance de horas → alerta al pasar 80 % / 100 %.
- Ranking de **proyectos más demandantes** del período.

**Por miembro**
- Horas cargadas vs. contratadas (**% de utilización**).
- Distribución de sus horas por proyecto.
- Extras del mes (cantidad y $).
- Días hábiles **sin carga** (cumplimiento).

**Estudio**
- Horas facturables vs. internas.
- Total extras del mes ($) y tendencia mensual.
- Costo total de producción por mes.

**Formatos**: dashboard web + exportación Excel (datos crudos y resumen) + PDF A4 mensual por proyecto (sirve para respaldar honorarios ante un cliente).

---

## 7. Propuesta técnica

| Capa | Recomendación | Por qué |
|---|---|---|
| Frontend | **Next.js** (web responsive, usable desde el celular) | Una sola app para PC y móvil, sin app stores. |
| Backend + DB + Auth | **Supabase** (Postgres) | Login listo, permisos por fila (cada uno ve solo lo suyo), SQL real para informes. |
| Hosting | Vercel + Supabase | Plan gratuito alcanza para un estudio chico; escala a ~USD 25–45/mes si crece. |
| Informes | Vistas SQL + exportación XLSX/PDF | |
| Recordatorios | Email (o WhatsApp más adelante) a las 18 h si no cargó el día | Sin esto, la regla de "solo hoy" genera huecos. |

**Alternativa descartada para el núcleo:** Google Sheets + AppSheet. Es más rápido de armar, pero la regla de "solo hoy", la aprobación de extras y las tarifas con vigencia quedan frágiles y fáciles de saltear.

### Etapas
1. **MVP (3–4 semanas)**: login, roles, ABM de proyectos/miembros/tarifas, carga del día, cálculo ordinaria/extra, "Mi mes", exportación Excel.
2. **Fase 2 (2–3 semanas)**: dashboard de manager, aprobaciones, correcciones, presupuesto vs. real, PDF mensual, recordatorios.
3. **Fase 3**: fases de proyecto detalladas, comparativas entre proyectos similares (horas/m²), integración con facturación.

---

## 8. Puntos a definir

1. **"Solo hoy" sin excepciones es demasiado rígido.** Si alguien se olvida un viernes, esas horas se pierden o se cargan mal otro día (y el dato queda contaminado). Propuesta: cierre a las 23:59 + correcciones aprobadas por el manager. ¿Va?
2. **Horas contratadas**: ¿las edita solo el manager por cada miembro, o cada miembro puede tocar las suyas?
3. **Ordinaria vs. extra**: ¿cálculo automático por jornada diaria (propuesta) o el profesional marca a mano el tipo?
4. **Tarifas**: ¿es el **costo** para el estudio (sueldo/hora) o el **valor de venta** de la hora profesional al cliente? Se pueden manejar ambas; cambia los informes (costo vs. margen).
5. **Extras**: ¿requieren aprobación previa o se aprueban después de cargadas?
6. **Fases de proyecto**: ¿las incluimos desde el MVP?
7. **Cantidad de usuarios** aproximada (define plan de hosting).
8. ¿Hay colaboradores externos/monotributistas que también deban cargar? (sin horas extra, tarifa única).
