# Próxima sesión · Prime HR Innovation

Escrito el 21 de octubre de 2026, actualizado el 24 oct. **Léelo primero.** Después: `pendientes_revision.md` (qué probar; §9 es lo de hoy), `tasks.md` (qué está hecho, qué falta y qué pedir a Prime), `plan.md` §12.5 a §12.10 (detalle) y `CLAUDE.md` (reglas).

**No se commitea ni se pushea**: lo hace el usuario.

## Dónde quedamos

- **Base hospedada:** archivos manuales `01` a `11` aplicados (10 y 11 el 21 oct, checklists completos).
- **Base vaciada para probar desde cero (24 oct):** se corrió un `truncate ... restart identity` de las 25 tablas de vacantes, levantamientos, candidatos, postulaciones e historial (IA, avisos, cola, webhooks, `audit_log`) y se reinició `app.recruiter_turn_seq`. Quedaron intactos `clients` (2), `users` (5), `user_integrations` (0, nadie ha conectado Outlook), `document_types` y `wa_templates`. Checklist completo. La primera versión falló con `relation "_antes" does not exist`: el SQL Editor no encontró la tabla temporal `on commit drop` en el checklist; la versión buena no usa tabla temporal. Los PDF de Storage siguen ahí (buckets `cvs`, `documents`, `psychometrics`, `wa-media`, `reports`), el usuario puede vaciarlos a mano.
- **IA probada contra la API el 21 oct** (plan §12.5): la llave está en `.env` (no en `.env.local`; Next lee los dos). "Generar con IA" en una vacante de prueba (Full Stack Engineer) tardó 28 s y costó 0.074 USD; un score de CV real 19 s y 0.057 USD, con evidencia citada. `npm run ai:smoke` prueba la llave y la forma de la petición. Falta calibrar con 2 CV más (uno fuerte, uno débil) y ajustar prompts (§3).
- **Vercel:** plan Hobby, el usuario ya puso variables y dominio. Cron **diario** a las 8:00 (`0 14 * * *` UTC); el primer intento de cada tarea corre al momento con `after()`, el cron solo reintenta y hace lo diario. `typecheck` ahora corre `next typegen` antes de `tsc` (en Vercel faltaban `PageProps`/`LayoutProps`/`RouteContext`) y eslint ignora `docs/`.
- **Hecho el 21 oct, sin depender de IA ni de Prime** (plan §12.10, migraciones 0023 y 0024): pantalla de Permanencia (y bloque en la ficha, aviso en el tablero), Inactivos (solo admin), Exportar a Excel (`exceljs`, solo admin, con `log_audit('export')`), Logs técnicos en Configuración, avisos nuevos (candidato asignado, entrevista agendada, documento recibido, intento de lista negra), columna Outlook por usuario, menú para celular.
- **Teams con Outlook por reclutador** (plan §12.7): sin probar; falta que Prime registre la app en Entra ID.
- **Verificado hoy:** `typecheck`, `eslint src scripts`, `test:domain`, `db:rls-lite` (7 suites, nueva `admin-tools`, y el caso J de manual-sql) y `next build`.

## Siguiente sesión, en este orden

1. **Prueba desde cero** (sección de abajo): vacante de prueba, 3 CV generados con IA y comparar el orden contra `pendientes_revision.md` §1 y §2. Ajustar prompts si hace falta (§3, subir `PROMPT_VERSION`).
2. Que el usuario pruebe `pendientes_revision.md` §9 (el 11 ya está aplicado). Con la base vacía, primero hay que tener candidatos.
3. **`psych_parse`** como tarea de la cola en cuanto haya PDF reales de Psicotest: prompt, esquema y cálculo de `fit_rows`, `fit_pct` y veredicto con pruebas en `test:domain`.
4. Cuando Prime registre la app de Microsoft: §5.

Pendientes chicos que salieron hoy: carga masiva de CV (mejor con IA para sacar nombre y teléfono), importar el Excel histórico (falta el archivo), recordatorios de WhatsApp a 12/24 h van a necesitar correr al momento con `after()` o un cron externo (el de Vercel es diario).

## Lo que el usuario tiene pendiente

- Generar los 3 CV de prueba con IA y crear la vacante (sección "Prueba desde cero"); PDF de Psicotest.
- (Opcional) Vaciar a mano los buckets de Storage.
- Pedir al admin de Microsoft 365 de Prime los pasos de `tasks.md` §6 y los tres datos.
- Dar de alta a los reclutadores en Fireflies.
- Decisiones de Prime en `tasks.md` §9 (entre ellas: después de cuánto tiempo un candidato es inactivo).

## Prueba desde cero (pendiente)

Orden: crear la vacante → asignarle un reclutador → Evaluación IA → **Generar con IA** → agregar los 3 candidatos con su CV. Para probar el caso "vacante sin pesos" (`pendientes_revision.md` §7), agregar un candidato antes de generar.

**Esperado:** bueno > medio > malo. El bueno arriba del umbral; el medio cerca del umbral, con alertas (hueco laboral, cobranza parcial) pero sin descarte; el malo en "Requiere tu atención" (falla escolaridad, experiencia y sistemas; la edad sale como alerta, no como bloqueo; residencia fuera de la zona). Si sale así, se cierra §2.

### Vacante: Ejecutivo de Cobranza

Se captura en Perfiles → Levantamiento, en el orden del formulario:

| Campo | Valor |
| --- | --- |
| Nombre del puesto | Ejecutivo de Cobranza |
| Unidad o área | Crédito y Cobranza |
| Reporta a | Coordinador de Cobranza |
| Plazas | 2 |
| Zona de trabajo | Aguascalientes, zona centro |
| Objetivo | Recuperar la cartera vencida de 30 a 90 días, negociando convenios de pago por teléfono y en campo, manteniendo la relación con el cliente. |
| Edad | 23 a 45 años |
| Sexo / Estado civil / Hijos | Indistinto |
| Residencia | Aguascalientes o municipios conurbados |
| Escolaridad | Preparatoria terminada (deseable licenciatura en Administración o afín) |
| Experiencia | Mínimo 1 año en cobranza |
| Idiomas | Español |
| Conocimientos | Negociación y manejo de objeciones; Convenios y reestructuras de pago; Ley Federal de Protección al Consumidor y buenas prácticas de cobranza (REDECO) |
| Sistemas | Excel intermedio (filtros, tablas dinámicas); CRM o sistema de gestión de cobranza |
| Actividades | Gestionar diariamente la cartera asignada por teléfono y WhatsApp; Negociar convenios y promesas de pago; Visitar clientes en la zona asignada (2 días por semana); Registrar cada gestión en el CRM; Dar seguimiento a promesas incumplidas; Reportar avance diario al coordinador |
| Sueldo | $11,000 mensuales brutos + comisiones hasta $4,000 |
| Horario | L-V 8:30 a 17:30, sábado 9:00 a 13:00 |
| Modalidad | Presencial |
| Viajes | Local, 2 días por semana |
| Personal a cargo | Ninguno |
| Prestaciones | Prestaciones de ley; Vales de despensa; Fondo de ahorro; Seguro de vida |
| Herramientas | Celular de empresa; Computadora; Apoyo de gasolina para visitas |
| Competencias laborales | Tolerancia a la presión; Orientación a resultados; Negociación; Empatía |
| Notas | Alta rotación en el puesto: se busca estabilidad laboral comprobable. Indispensable experiencia real en cobranza, no solo ventas. |

(En los campos de lista, cada `;` es un renglón.)

### Prompts para los 3 CV

A los tres se les agrega al final: "Formato de CV en una página, listo para exportar a PDF. Datos de contacto ficticios."

- **Bueno** (arriba del umbral): CV de Mariana López Herrera, 31 años, Aguascalientes, tel 449 555 0101, mariana.lopez.test@example.com. Licenciatura en Administración (UAA). 4 años como ejecutiva de cobranza en una financiera de crédito al consumo: cartera de 31-90 días, cobranza telefónica y de campo, convenios y reestructuras, 82% de recuperación promedio, registro en CRM (Cobra/Salesforce), Excel con tablas dinámicas, conocimiento de REDECO y buenas prácticas de cobranza. Antes, 1 año de atención a clientes en banco. Trayectoria continua, sin huecos.
- **Medio** (cerca del umbral, con alertas): CV de Jorge Ramírez Soto, 27 años, Jesús María, Ags., tel 449 555 0202, jorge.ramirez.test@example.com. Preparatoria terminada. 2 años como asesor de ventas telefónicas en un call center (incluye 8 meses en el área de recuperación de pagos atrasados) y 1 año como vendedor en tienda departamental. Excel básico. Menciona negociación con clientes pero sin cifras. Hueco laboral de 7 meses entre empleos sin explicar.
- **Malo** (debe caer en "Requiere tu atención"): CV de Luis Fernández Cruz, 52 años, León, Gto., tel 477 555 0303, luis.fernandez.test@example.com. Secundaria terminada. 10 años como chofer repartidor y 3 como almacenista. Sin experiencia en cobranza, ventas ni atención a clientes. Sin manejo de Excel ni CRM. Último empleo terminó hace año y medio.

## Cómo se trabaja el SQL aquí

- Cada migración nueva en `supabase/migrations/` lleva su archivo en `supabase/manual/NN_*.sql`, generado con `python scripts/build-manual.py` (un target por archivo, con `expected` de cuántas sentencias convierte). Re-ejecutable, en transacción, con checklist ok / FALTA. Un valor de enum nuevo no se puede usar en la misma transacción: va en su propia migración y el target lleva `"separate": True`.
- Cada archivo manual nuevo se agrega a `MANUAL_AFTER_0013` en `scripts/rls-lite/harness.mjs` y lleva su caso "dos veces" en `manual-sql.test.mjs`. Una política o RPC nueva lleva su suite en `scripts/rls-lite/` y se agrega a `db:rls-lite`.
- `src/lib/db/types.ts` se edita a mano.

## Comandos útiles

- `npm run dev`: app en http://localhost:3000.
- `npm run queue:tick` (con `--watch`, cada minuto): corre el cron local. El aviso ".env.local not found" es inofensivo.
- `npm run ai:smoke`: una llamada mínima a Claude con la forma de `runAi()`.
- `npx next typegen`: regenera los tipos de rutas al crear una página (ya lo hace `npm run typecheck`).
- Antes de cerrar: `npm run typecheck`, `npx eslint src scripts`, `npm run test:domain`, `npm run db:rls-lite`, `npm run build`.

## Gotchas

- El Bash de esta máquina falla con heredocs largos que traen `$$`, comillas o `\n`: escribir el archivo con Write (o un .py en el scratchpad) y correrlo.
- Al editar docs con scripts, comprobar que el archivo conserva su largo (una vez se truncó `tasks.md`; se recuperó desde el commit).
- Columnas `date` (como `due_at`, `left_at`, `start_date`) se formatean con `fmtDay`, no con `fmtDate`: con la zona de México saldrían un día antes. "Hoy" en la zona de la app: `todayLocal()`.
- `route.ts` solo puede exportar handlers y config: constantes compartidas van en `src/lib`.
- La regla `react-hooks/purity` no deja usar `Date.now()` al renderizar: calcularlo en la query. Tampoco conviene `setState` dentro de `useEffect` (ver `followup-form.tsx`, que deriva el estado abierto del resultado de la acción).
- Los archivos manuales tienen que poder correrse dos veces: el SQL Editor no lleva historial.
- El SDK de Anthropic manda los `z.enum` como texto libre: en los esquemas de salida de IA se usa `z.string()` y el código normaliza.
- `next` es 16.3: leer `node_modules/next/dist/docs/` antes de usar una API.

## Decisiones vigentes

- Sin magic link: los tres roles entran con correo y contraseña; las cuentas las crea un admin.
- Una sola organización (Prime) con muchos clientes.
- Claude lee y extrae; el código decide. Ningún descarte automático sale de la IA. Edad como alerta, no bloqueo.
- El cliente ve a los candidatos desde la etapa Psicométrico.
- Contratado → Descartado es "se fue"; "Cancelar contratación" limpia la contratación. En Permanencia, "Se fue" no cambia la etapa.
- Videollamadas solo por Teams; cada reclutador conecta su Outlook (opción B). Fireflies siempre invitado.
- Lista negra: solo admin; bloquea, no solo avisa; el intento de registrar a alguien avisa a los admins.
- Trabajo en segundo plano por la cola, no con `after()` suelto. Cron diario en Vercel Hobby (21 oct).
- Los avisos de un candidato no le llegan a quien hizo el cambio.
