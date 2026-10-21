# Próxima sesión · Prime HR Innovation

Escrito el 20 de octubre de 2026. **Léelo primero.** Después: `pendientes_revision.md` (qué probar cuando llegue cada llave), `tasks.md` (qué está hecho, qué falta y qué pedir a Prime), `plan.md` §12.5 a §12.9 (detalle) y `CLAUDE.md` (reglas).

**No se commitea ni se pushea**: lo hace el usuario.

## Dónde quedamos

- **Base hospedada:** archivos manuales `01` a `09` aplicados (08 Teams y 09 lista negra el 20 oct). **Falta pegar `10_cola_de_tareas.sql`.**
- **IA programada, sin probar contra la API** (plan §12.5): `runAi()`, "Generar con IA" en la vacante, score del CV. Falta la API key.
- **Teams con Outlook por reclutador** (plan §12.7, opción B): Mi cuenta → Conectar Outlook (OAuth con PKCE, tokens cifrados en `user_integrations`). Con Outlook conectado el evento siempre se crea en su calendario con Teams e invita al candidato, al entrevistador y a Fireflies; sin conectar se pega el enlace. Meet y Zoom fuera de la app; las entrevistas viejas pasaron a Teams. Sin probar: falta que Prime registre la app en Entra ID.
- **Lista negra** (plan §12.8): solo admin. Se agrega desde la ficha, se ve y se quita en Candidatos → Lista negra. La base bloquea cualquier postulación nueva de la persona (teléfono, CURP o correo); al reclutador no se le dice el motivo. Se puede probar ya.
- **Cola de tareas y cron** (plan §12.9): `/api/cron/tick` una vez al día a las 8:00 (`vercel.json`, Vercel Hobby; decidido el 21 oct), handlers en `src/lib/queue/`, `cv_score` por la cola con reintentos, avisos de permanencia diarios (`followups_due`), Configuración → Tareas automáticas con reintentar/cancelar. En local: `npm run queue:tick`.
- **Verificado:** `tsc`, `eslint src scripts`, `test:domain`, `db:rls-lite` (6 suites, incluidas `blacklist` y `queue`) y `next build`. La ruta del cron responde 401 sin el secreto.

## Siguiente sesión, en este orden

1. Que el usuario pegue `10_cola_de_tareas.sql`, ponga `CRON_SECRET` y pruebe `pendientes_revision.md` §6 (lista negra) y §7 (cola).
2. **`psych_parse`** como tarea de la cola: prompt, esquema y cálculo de `fit_rows`, `fit_pct` y veredicto con pruebas en `test:domain`. Se calibra con PDF reales.
3. **Pantalla de permanencia** (30, 90 y 180 días): lista de cortes por vencer y vencidos con Sigue / Se fue / No se sabe. Los avisos ya salen.
4. Con la API key: `pendientes_revision.md` §1 a §3.
5. Cuando Prime registre la app de Microsoft: §5.

Después (pedido el 21 oct): apartado **"Logs técnicos"** para el admin (ai_runs, cola, errores). Si sobra: inactivos (solo admin), exportar a Excel con `log_audit('export')`, que el admin vea quién conectó su Outlook, aviso al admin cuando alguien intenta registrar a alguien de la lista negra.

## Lo que el usuario tiene pendiente

- Pegar `supabase/manual/10_cola_de_tareas.sql` y poner `CRON_SECRET` en `.env.local`.
- `ANTHROPIC_API_KEY` con crédito; CV reales y PDF de Psicotest.
- Pedir al admin de Microsoft 365 de Prime los pasos de `tasks.md` §6 (registro de la app, consentimiento, política de Teams) y los tres datos.
- Dar de alta a los reclutadores en la cuenta de Fireflies de Prime.
- El resto en `tasks.md` §9.

## Cómo se trabaja el SQL aquí

- Cada migración nueva en `supabase/migrations/` lleva su archivo en `supabase/manual/NN_*.sql`, generado con `python scripts/build-manual.py` (un target por archivo, con `expected` de cuántas sentencias convierte). Re-ejecutable, en transacción, con checklist ok / FALTA. Un valor de enum nuevo no se puede usar en la misma transacción: `"separate": True` parte el archivo.
- Cada archivo manual nuevo se agrega a `MANUAL_AFTER_0013` en `scripts/rls-lite/harness.mjs` y lleva su caso "dos veces" en `manual-sql.test.mjs`. Una política o RPC nueva lleva su suite en `scripts/rls-lite/` y se agrega a `db:rls-lite`.
- `src/lib/db/types.ts` se edita a mano.

## Comandos útiles

- `npm run dev`: app en http://localhost:3000.
- `npm run queue:tick` (con `--watch`, cada minuto): corre el cron local.
- `npx next typegen`: regenera los tipos de rutas (`PageProps<"/ruta">`) al crear una página.
- Antes de cerrar: `npm run typecheck`, `npx eslint src scripts`, `npm run test:domain`, `npm run db:rls-lite`, `npm run build`.

## Gotchas

- El Bash de esta máquina falla con heredocs largos que traen `$$` o comillas: escribir el archivo con Write (o un .py en el scratchpad) y correrlo.
- Al editar docs con scripts, comprobar que el archivo conserva su largo (una vez se truncó `tasks.md`; se recuperó desde el commit).
- `route.ts` solo puede exportar handlers y config: constantes compartidas van en `src/lib`.
- La regla `react-hooks/purity` no deja usar `Date.now()` al renderizar: calcularlo en la query.
- Los archivos manuales tienen que poder correrse dos veces: el SQL Editor no lleva historial.
- El SDK de Anthropic manda los `z.enum` como texto libre: en los esquemas de salida de IA se usa `z.string()` y el código normaliza.
- `next` es 16.3: leer `node_modules/next/dist/docs/` antes de usar una API.

## Decisiones vigentes

- Sin magic link: los tres roles entran con correo y contraseña; las cuentas las crea un admin.
- Una sola organización (Prime) con muchos clientes.
- Claude lee y extrae; el código decide. Ningún descarte automático sale de la IA. Edad como alerta, no bloqueo.
- El cliente ve a los candidatos desde la etapa Psicométrico.
- Contratado → Descartado es "se fue"; "Cancelar contratación" limpia la contratación.
- Videollamadas solo por Teams; cada reclutador conecta su Outlook (opción B). Fireflies siempre invitado.
- Lista negra: solo admin; bloquea, no solo avisa.
- Trabajo en segundo plano por la cola, no con `after()` suelto.
