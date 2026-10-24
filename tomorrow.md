# Próxima sesión · Prime HR Innovation

Escrito el 24 de octubre de 2026. **Léelo primero.** Después: `pendientes_revision.md` (qué probar; §1 a §3 tienen las notas de la calibración, §10 la interfaz y §11 la carga masiva), `tasks.md` (qué está hecho, qué falta y qué pedir a Prime), `plan.md` §12.10 y §12.11 (detalle) y `CLAUDE.md` (reglas).

**No se commitea ni se pushea**: lo hace el usuario. Todo lo del 21 y el 24 oct sigue sin commit.

## Dónde quedamos

- **Base hospedada:** archivos manuales `01` a `12` aplicados (el 12, `12_lectura_de_cv.sql`, el 24 oct con su checklist en ok). Se vació el 24 oct para probar desde cero; ahora tiene la vacante de prueba **Ejecutivo de Cobranza** (cliente Telasist) con su evaluación de IA v1 y 3 candidatos: Mariana (bueno), Jorge (medio) y Luis (malo).
- **Calibración de la IA (24 oct, plan §12.11):** evaluación con 6 criterios y umbral 65; scores 100 / 44 / 14. El orden y la evidencia están bien. El medio no quedó "cerca del umbral", pero el puntaje es justo: la expectativa de la prueba estaba mal, no la IA.
- **Ajustes del prompt anotados, sin hacer** (`pendientes_revision.md` §1 y §2):
  1. Un CV sin fechas sale como "CV ilegible o incompleto" o "Fechas inconsistentes": falta una alerta propia "Sin fechas de inicio y fin" (`src/lib/ai/prompts/cv-score.ts`).
  2. Pregunta del prefiltro "¿Qué CRM has usado?" da por hecho que usó uno.
  3. Sueldo máximo $11,000 como bloqueo cuando el puesto paga hasta $15,000 con comisiones (la IA lo anotó).
  4. Edad salió "23 a 43": confirmar si el levantamiento dice 45 (entonces la IA lo cambió).
- **Por diseño:** el score del CV ignora edad y domicilio; la edad es alerta del prefiltro. La residencia fuera de zona no la revisa nadie todavía (decisión de Prime, `tasks.md` §9). "Requiere tu atención" solo cuenta el CV bajo umbral en la etapa **Revisión de CV**.
- **Interfaz (24 oct):**
  - Levantamiento y edición de vacante por pasos, con barra de avance.
  - Tema claro / oscuro con los colores de marca.
  - Login rediseñado.
  - Menú lateral plegable.
  - El usuario confirmó que el menú funciona; lo demás de §10 falta probarlo.
- **Configuración → Prompts de IA (24 oct):** muestra cada prompt con su versión y lo que ha costado. Los prompts **viven en el código**, no en la base (`src/lib/ai/prompts/`); para cambiar uno se edita, se sube `PROMPT_VERSION` y se despliega. Hacerlos editables desde la app quedó como idea para después.
- **Carga masiva de CV (24 oct, plan §12.11):** Candidatos → Carga masiva. Hasta 30 PDF; la IA (`cv_extract`) lee los datos de contacto, tabla editable, "Dar de alta" con el mismo núcleo que el alta individual (`registerCandidate`). **Falta probarla en la app** (el archivo 12 ya está aplicado).
- **La edad de 15 años** de un candidato de prueba: no la puso la IA del score (no lee edad). Vino del campo Edad del alta individual, sea por el lector de texto del CV (`src/lib/cv/parse.ts`, solo toma "Edad: NN" o "NN años de edad") o por la flechita del campo numérico (mínimo 15). El prompt de `cv_extract` solo da edad si el CV la dice expresamente.
- **Verificado hoy:** `typecheck`, `eslint src`, `db:rls-lite` (con el caso K del archivo 12) y `next build`.

## Lo que falta (depende de terceros)

- **Lectura del psicométrico** (`psych_parse`): faltan PDF reales de Psicotest.
- **Teams y Outlook**: falta que Prime registre la app de Microsoft (`tasks.md` §6).
- **Fireflies y el análisis de entrevista** (`interview_analysis`): faltan la cuenta, la API key y dar de alta a los reclutadores.
- **WhatsApp** (agente Vale, prefiltro con `prefilter_reply`, documentos por WhatsApp, `doc_check`): falta que Meta apruebe número y templates.
- **Correos automáticos**: falta decidir entre Resend o un buzón de Prime.

**Por probar (no depende de nadie):** carga masiva de CV (§11), interfaz (§10), permanencia, inactivos, exportar, logs y avisos (§9) de `pendientes_revision.md`.

## Siguiente sesión, en este orden

1. **Probar la carga masiva de CV** (`pendientes_revision.md` §11) con 3 a 5 PDF: uno escaneado, uno que no sea CV y uno de alguien ya registrado. El prompt ya se probó contra la API con un PDF de prueba: 4.8 s, 0.014 USD, datos correctos, el teléfono de la referencia no se tomó y la edad quedó vacía aunque el CV dice "15 años de experiencia jugando futbol".
2. **Ajustar el prompt de CV** (alerta "Sin fechas de inicio y fin") y las dos reglas del prefiltro de `profile_generation`. Subir `PROMPT_VERSION` de los dos, **Regenerar con IA** la vacante y **Recalificar** los 3 CV; comparar contra 100 / 44 / 14.
3. Confirmar que Jorge y Luis (etapa **CV**, que internamente es `cv_review`) salen en el Tablero → Requiere tu atención con "CV bajo umbral".
4. Que el usuario pruebe `pendientes_revision.md` §10 (interfaz) y §9 (permanencia, inactivos, exportar, logs, avisos). Para Permanencia: mover a Mariana a **Contratado**.
5. Sin dependencias: reporte semanal con IA (`weekly_insights`); importar el Excel histórico cuando llegue.
6. Lo de terceros (arriba) conforme llegue.

**Pendientes chicos:**
- Importar el Excel histórico (falta el archivo).
- Recordatorios de WhatsApp a 12/24 h: necesitan `after()` o un cron externo, porque el de Vercel es diario.
- Poner el logotipo real cuando Prime lo mande.

## Lo que el usuario tiene pendiente

- Probar la carga masiva de CV (`pendientes_revision.md` §11).
- Confirmar la edad del levantamiento de prueba (43 o 45) y corregir la edad de 15 años del candidato.
- Probar §10 y §9 de `pendientes_revision.md`.
- CV reales de Prime (2 o 3) para calibrar con algo que no sea generado; PDF de Psicotest.
- Logotipo de Prime en SVG o PNG.
- Pedir al admin de Microsoft 365 de Prime los pasos de `tasks.md` §6 y los tres datos.
- Dar de alta a los reclutadores en Fireflies.
- Decisiones de Prime en `tasks.md` §9. Nuevas: residencia fuera de zona (alerta o pregunta) y sueldo arriba del tope (bloquea o avisa).
- (Opcional) Vaciar a mano los buckets de Storage de los PDF de antes del 24 oct.

## Cómo se trabaja el SQL aquí

- Cada migración nueva en `supabase/migrations/` lleva su archivo en `supabase/manual/NN_*.sql`, generado con `python scripts/build-manual.py` (un target por archivo, con `expected` de cuántas sentencias convierte). Re-ejecutable, en transacción, con checklist ok / FALTA. Un valor de enum nuevo no se puede usar en la misma transacción: va en su propia migración y el target lleva `"separate": True`.
- Cada archivo manual nuevo se agrega a `MANUAL_AFTER_0013` en `scripts/rls-lite/harness.mjs` y lleva su caso "dos veces" en `manual-sql.test.mjs`. Una política o RPC nueva lleva su suite en `scripts/rls-lite/` y se agrega a `db:rls-lite`.
- `src/lib/db/types.ts` se edita a mano.

## Comandos útiles

- `npm run dev`: app en http://localhost:3000. Si ya hay uno corriendo, `next dev` en otro puerto falla con "Another next dev server is already running".
- `npm run queue:tick` (con `--watch`, cada minuto): corre el cron local. El aviso ".env.local not found" es inofensivo.
- `npm run ai:smoke`: una llamada mínima a Claude con la forma de `runAi()`.
- `npx next typegen`: regenera los tipos de rutas al crear una página (ya lo hace `npm run typecheck`).
- Ver el login sin sesión con Chrome sin interfaz: `chrome --headless=new --screenshot=… --window-size=1280,800 http://localhost:3000/login`. Para modo oscuro hacen falta `--force-prefers-color-scheme=dark` **y** `--blink-settings=preferredColorScheme=0`. En Windows no baja de unos 500 px de ancho.
- Antes de cerrar: `npm run typecheck`, `npx eslint src scripts`, `npm run test:domain`, `npm run db:rls-lite`, `npm run build`.

## Gotchas

- El Bash de esta máquina falla con heredocs largos que traen `$$`, comillas o `\n`: escribir el archivo con Write (o un .py en el scratchpad) y correrlo.
- Al editar docs con scripts, comprobar que el archivo conserva su largo (una vez se truncó `tasks.md`; se recuperó desde el commit).
- Columnas `date` (como `due_at`, `left_at`, `start_date`) se formatean con `fmtDay`, no con `fmtDate`: con la zona de México saldrían un día antes. "Hoy" en la zona de la app: `todayLocal()`.
- La etapa `cv_review` se llama **CV** en pantalla: al hablar con el usuario, usar los nombres de `STAGE_LABELS`.
- `route.ts` solo puede exportar handlers y config: constantes compartidas van en `src/lib`. Lo mismo con un archivo `"use client"`: una constante exportada de ahí llega al servidor como referencia, no como valor (por eso `SIDEBAR_COOKIE` vive en `src/lib/sidebar.ts`).
- La regla `react-hooks/purity` no deja usar `Date.now()` al renderizar: calcularlo en la query. Tampoco conviene `setState` dentro de `useEffect` (ver `followup-form.tsx`, que deriva el estado abierto del resultado de la acción).
- En un formulario con `onInput` que hace `setState`, un `<select>` **controlado** se regresa a su valor anterior: `input` llega antes que `change`. Usar `defaultValue` (ver el selector de cliente del levantamiento).
- Colores: solo tokens (`bg-surface`, `text-ink`, `text-on-forest`…), nunca `bg-white` ni hex en componentes. Sobre `bg-forest` o `bg-leaf` el texto es `text-on-forest` (blanco en claro, negro en oscuro). El menú lateral y la barra del celular son `bg-chrome` (negro en los dos temas), ahí sí va `text-white`. Las gráficas usan `var(--…)` desde `src/components/charts/theme.ts`.
- Los archivos manuales tienen que poder correrse dos veces: el SQL Editor no lleva historial.
- El SDK de Anthropic manda los `z.enum` como texto libre: en los esquemas de salida de IA se usa `z.string()` y el código normaliza.
- `next` es 16.3: leer `node_modules/next/dist/docs/` antes de usar una API (el tema sigue `02-guides/preventing-flash-before-hydration.md`).

## Decisiones vigentes

- Sin magic link: los tres roles entran con correo y contraseña; las cuentas las crea un admin.
- Una sola organización (Prime) con muchos clientes.
- Claude lee y extrae; el código decide. Ningún descarte automático sale de la IA. Edad como alerta, no bloqueo. El score del CV no mira edad ni domicilio.
- El CV se sube en PDF (texto o escaneado).
- El cliente ve a los candidatos desde la etapa Psicométrico.
- Contratado → Descartado es "se fue"; "Cancelar contratación" limpia la contratación. En Permanencia, "Se fue" no cambia la etapa.
- Videollamadas solo por Teams; cada reclutador conecta su Outlook (opción B). Fireflies siempre invitado.
- Lista negra: solo admin; bloquea, no solo avisa; el intento de registrar a alguien avisa a los admins.
- Trabajo en segundo plano por la cola, no con `after()` suelto. Cron diario en Vercel Hobby (21 oct).
- Los avisos de un candidato no le llegan a quien hizo el cambio.
- Colores de marca (24 oct): turquesa brillante #18F5DE, verde turquesa #00B09E, negro, gris oscuro #171717, gris claro #EDEDED, blanco. Primario en claro #007A6E; en oscuro #18F5DE con texto negro. Tema por usuario en `localStorage`, por defecto el del sistema.
