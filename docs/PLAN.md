# Time Report — Estudio de Arquitectura

Plan funcional y técnico, v0.2 (decisiones de la lámina 06 incorporadas).

---

## 1. Objetivo

Medir, día por día, **cuántas horas profesionales dedica cada miembro a cada proyecto**, separando horas **ordinarias** (contratadas) de horas **extra**, valorizarlas con la tarifa de cada miembro y sacar indicadores de producción semanales y mensuales.

---

## 2. Roles

| Rol | Qué hace |
|---|---|
| **Profesional** | Se loguea, ve sus proyectos, carga las horas del día, ve su propio resumen del mes. |
| **Manager** | Todo lo anterior + ABM de proyectos, miembros, tarifas, horas contratadas, feriados, asignación de roles. Carga horas de días pasados en nombre de quien se olvidó. Ve todos los informes. |
| **Socio / Lectura** *(opcional)* | Solo informes, sin editar datos maestros. Útil para Álvaro o un contador. |

---

## 3. Reglas de negocio

### 3.1 Carga diaria
- Solo se carga el **día de hoy**, con hora del servidor en `America/Argentina/Tucuman`. No se confía en el reloj del celular/PC.
- No se puede cargar a futuro ni a días pasados.
- El día queda editable hasta las 23:59 y se cierra solo.
- Si alguien se olvidó, **el manager carga esas horas** en su nombre. El registro queda marcado como "cargado por manager" y entra en la auditoría.

### 3.2 Horas ordinarias vs. extra
- Cada miembro tiene **horas contratadas por mes**. Solo las edita el manager, mes a mes.
- De ahí sale una **jornada diaria ordinaria** (ej.: 160 h / 20 días hábiles = 8 h/día), o se fija a mano por miembro.
- En un día hábil: las primeras *N* horas son ordinarias; lo que exceda la jornada se carga como **extra**.
- Sábados, domingos y feriados: **todo es extra**.
- Tipos de extra sugeridos (referencia LCT, art. 201 — validar con contador/convenio):
  - **Extra 50 %**: días hábiles fuera de jornada.
  - **Extra 100 %**: sábados después de las 13 h, domingos y feriados.
- Las extras **no requieren aprobación**: se cuentan automáticamente. Como control, el dashboard muestra extras por persona y avisa cuando alguien supera un tope mensual que define el manager.

### 3.3 Tarifas
- La tarifa es **costo para el estudio** (no precio de venta al cliente).
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

### Manager
5. **Dashboard** (ver §6).
6. **Proyectos**: ABM + asignación de miembros + presupuesto de horas.
7. **Miembros**: ABM, rol, horas contratadas por mes, jornada diaria, tarifas con vigencia.
8. **Feriados**: precargados (nacionales + Tucumán), editables.
9. **Carga por otro**: elegir miembro y fecha pasada, cargar sus horas.
10. **Informes**: filtros por período / proyecto / miembro + exportar Excel y PDF.

---

## 5. Modelo de datos (simplificado)

```
miembros            (id, nombre, email, rol, activo, jornada_diaria, tope_extras_mes)
contrato_mensual    (miembro_id, año_mes, horas_contratadas)
tarifas             (miembro_id, tipo[ordinaria|extra50|extra100], costo_hora, vigente_desde, vigente_hasta)
proyectos           (id, codigo, nombre, cliente, estado, horas_presupuestadas, interno[bool])
fases               (id, proyecto_id, nombre)
asignaciones        (proyecto_id, miembro_id)
feriados            (fecha, descripcion, ambito[nacional|provincial|estudio])
registros_horas     (id, miembro_id, proyecto_id, fase_id, fecha, horas, tipo[ordinaria|extra50|extra100],
                     nota, cargado_por, creado_en)
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

**Decisión (beta):** servidor local en el estudio, costo cero, datos bajo control propio. El sistema se arma **portable**: si más adelante conviene pasarlo a la nube, se mudan los datos sin reprogramar.

| Capa | Elección | Por qué |
|---|---|---|
| App | **Next.js** (web responsive, usable desde el celular) | Una sola app para PC y móvil, sin app stores. |
| Base de datos | **PostgreSQL** estándar | Sin funciones atadas a un proveedor. SQL real para informes. |
| Login y permisos | Dentro de la app (Auth.js), contraseñas cifradas | No depende de un servicio externo. |
| Empaquetado | **Docker Compose** (app + base + backup) | Se instala con un comando en cualquier máquina. |
| Máquina | Una PC o notebook que el estudio ya tenga, prendida 24/7 | Costo cero. Una notebook tiene batería propia: aguanta cortes cortos de luz. |
| Acceso desde afuera | **Cloudflare Tunnel** (gratis) | Permite cargar extras desde casa u obra sin abrir puertos del router. Necesita un dominio: si el estudio ya tiene uno, costo cero. |
| Backup | `pg_dump` automático cada noche, cifrado, a una carpeta del **Google Drive del estudio** + copia local | Si se roban o se rompe la máquina, los datos siguen a salvo. |
| Informes | Vistas SQL + exportación XLSX/PDF | |
| Recordatorios | Email a las 18 h si no cargó el día (cuenta de Gmail del estudio) | Sin esto, la regla de "solo hoy" genera huecos. |

**Riesgos aceptados para la beta:**
- Corte de luz o de internet en el estudio = nadie carga mientras dure. Esas horas las carga después el manager.
- El mantenimiento (actualizaciones, revisar que el backup ande) queda a cargo del estudio. Se deja un instructivo de una página.
- La máquina no se usa para otra cosa ni se apaga a la noche.

**Cuándo replantearlo:** si la beta funciona y el estudio entero depende del sistema, evaluar mudarlo a la nube (~USD 25/mes) o comprar un mini PC + UPS dedicados.

**Alternativa descartada para el núcleo:** Google Sheets + AppSheet. Es más rápido de armar, pero la regla de "solo hoy", la aprobación de extras y las tarifas con vigencia quedan frágiles y fáciles de saltear.

### Etapas
1. **MVP (4 semanas)**: servidor local, login, roles, ABM de proyectos/miembros/tarifas, carga del día, cálculo ordinaria/extra, carga del manager en días pasados, "Mi mes", exportación Excel.
2. **Fase 2 (2 semanas)**: dashboard de manager, alerta de extras, presupuesto vs. real, PDF mensual, recordatorios, backup.
3. **Fase 3**: fases de proyecto detalladas, comparativas entre proyectos similares (horas/m²), integración con facturación.

---

## 8. Decisiones

**Resueltas (14/10/2026)**

| Tema | Decisión |
|---|---|
| Tarifa | Solo costo para el estudio |
| Cierre del día | 23:59. Si alguien se olvidó, carga el manager |
| Ordinaria vs. extra | Automático: lo que excede la jornada es extra |
| Horas contratadas | Solo las edita el manager |
| Aprobación de extras | No hace falta |
| Servidor | Local, en una PC de la oficina |
| Usuarios | Hasta 30 |

**Adoptadas en el MVP (a confirmar)**

| Tema | Cómo quedó |
|---|---|
| Extra por cantidad o por horario | **Por cantidad**: lo que excede la jornada diaria en el día es extra. Solo se cargan horas, no horario. |
| Fases de proyecto | **Sí, opcionales** por proyecto. |
| Sábado | Extra 100 % (configurable a 50 % con `REGLA_SABADO`). Validar con contador. |

**Pendientes**

1. **Dominio** del estudio para el acceso desde afuera.
2. **PC servidor**: marca, modelo y RAM. Recomendado: Ubuntu antes que Windows (ver `docs/INSTALACION.md`).

## 9. Estado

**MVP implementado (17/10/2026).** Ver `README.md` e instalación en `docs/INSTALACION.md`.

Incluye: login y roles, carga del día con cierre 23:59, cálculo automático ordinaria / extra 50 % / extra 100 %, carga del manager en días pasados, "Mi mes" con calendario, ABM de proyectos (fases y equipo), equipo (jornada, horas contratadas por mes, tarifas con vigencia, tope de extras), feriados con recálculo, informes mensuales y semanales con exportación a Excel, auditoría, backup diario, instalación con Docker y túnel de Cloudflare opcional.

Queda para Fase 2: recordatorio por email a las 18 h, PDF mensual por proyecto, dashboard con gráficos, copia cifrada del backup.
