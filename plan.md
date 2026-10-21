# Plan técnico · Sistema de reclutamiento Prime HR Innovation

Borrador v1 · 14 de septiembre de 2026 · VADAI
Fuentes: demo interactiva (`PropuestaPrime.jsx`) y propuesta VAD-COT-2026-PRM01.
Stack fijado: Next.js 16.3 (App Router, Turbopack), React 19, TypeScript, Tailwind 4, Supabase (Postgres, Auth, Storage, RLS), Vercel, API de Anthropic, Whaapy, Fireflies, Microsoft 365 (Outlook y Teams vía Microsoft Graph), Resend.

---

## 0. Cómo lo veo

**Lo que ya está resuelto.** La demo es la especificación funcional. El modelo clientes → perfiles → candidatos → etapas, las reglas de prefiltro, los pesos del CV, los mínimos psicométricos, los tres correos y los tres roles están definidos. Las tablas de la sección 3 salen casi 1:1 de ahí, y la lógica de `scoreCV`, `prefiltro` y `psicoFit` se porta tal cual a funciones puras con tests.

**Lo que la propuesta subestima o deja abierto.** Hay que resolverlo en la semana 0 y 1, no en la 6.

1. **Entrada de candidatos.** Pandape, Facebook y LinkedIn no exponen API de postulantes. Sin teléfono no hay agente de WhatsApp. Opciones: carga manual o masiva de CV (PDF) + teléfono + canal desde la app; importación CSV/Excel de Pandape; buzón de correo que reciba las notificaciones de Pandape con el CV adjunto. Recomendación MVP: carga desde la app (individual y masiva). Buzón de correo en fase 2.
2. **Primer contacto por WhatsApp.** El candidato nunca ha escrito al número de Prime, así que el primer mensaje tiene que ser un template aprobado por Meta (ventana de 24 h). La aprobación tarda días: mandar los templates en la semana 1. Lo mismo aplica a recordatorios de psicométrico y de documentos cuando pasan más de 24 h sin respuesta.
3. **Quién es "Vale".** Whaapy trae su propio agente de IA (colme-2) con tools y MCP. Dos formas de armarlo:
   - **A. Orquestación propia.** Whaapy es transporte. Cada `message.received` llega a nuestro webhook, cargamos el estado de la conversación, llamamos a Claude con las reglas del perfil y contestamos por la API de Whaapy.
   - **B. Agente nativo de Whaapy + MCP nuestro.** Whaapy conversa y consulta o escribe en nuestra base vía un servidor MCP (`/api/mcp`).
   - **Recomendación: A para el MVP.** El prefiltro es una máquina de estados atada a las reglas del perfil y a nuestra base; cada respuesta se guarda contra un criterio; el mismo motor sirve para agenda, psicométrico y documentos; y se prueba sin WhatsApp. B queda como evolución si Prime quiere que Vale también resuelva preguntas libres. En cualquier caso la IA nativa de Whaapy debe estar apagada en ese número (o pausada por conversación) para que no contesten dos agentes.
4. **Psicotest no tiene API pública conocida.** Flujo realista: el reclutador crea la evaluación en el panel de Psicotest y pega el enlace en el sistema; el agente lo envía; el PDF de resultados se sube a mano (o llega por correo) y Claude lo lee. Confirmar con Prime si Psicotest ofrece API o exportación.
5. **Videollamada y Fireflies.** Prime usa Microsoft 365: las entrevistas son reuniones de **Teams** creadas en el calendario de **Outlook** del reclutador vía Microsoft Graph (decisión del 19 oct 2026; sustituye a Google Calendar y Meet). Fireflies se invita al evento y entra a la reunión de Teams. Zoom y Meet: fuera del MVP.
6. **Datos personales (LFPDPPP).** INE, CURP, RFC, NSS y domicilio son datos sensibles: buckets privados, URLs firmadas de corta vida, RLS estricto, aviso de privacidad en el primer mensaje del agente, bitácora de quién abre qué y política de borrado de descartados. Es requisito, no extra.
7. **Edad y sexo como criterios de descarte automático** son legalmente delicados (discriminación laboral, LFT art. 3 y 133). El sistema debe permitir configurarlos como alerta y no como bloqueo, y registrar quién decide. Hablarlo con Prime antes de programar reglas duras.
8. **Diez semanas son viables** si las integraciones riesgosas (template de Meta, webhook de Whaapy, Teams + Fireflies) se prueban como spikes en la semana 1.

---

## 1. Arquitectura

```
Pandape / Facebook / LinkedIn ──(carga manual · CSV · correo)──▶ Next.js 16 en Vercel
                                                                    │
Whaapy (WhatsApp)  ◀── webhooks + REST ─────────────────────────────┤──▶ Supabase: Postgres + Auth + Storage
Fireflies          ◀── webhook + GraphQL ───────────────────────────┤──▶ Anthropic API (Claude Opus 5.5)
Microsoft Graph    ◀── Entra ID + REST (Outlook, Teams) ────────────┤──▶ Resend (correo saliente)
Vercel Cron        ── /api/cron/tick diario 8:00 ──────────────────┘
```

Principios:

- Toda lectura y escritura de la app pasa por Supabase con RLS activo y la sesión del usuario. El service role se usa solo en webhooks, cron y jobs.
- Server Components para leer; Server Actions para mutar. Cada action verifica sesión y rol antes de tocar datos (los actions son endpoints POST públicos).
- Integraciones externas entran por webhooks idempotentes (`webhook_events`) y salen por tareas programadas (`scheduled_tasks`) que ejecuta un cron. Nada de lógica de negocio dentro del handler del webhook: el handler valida firma, guarda el evento y encola.
- IA = funciones con entrada y salida tipadas (zod), prompts versionados en el repo y registro en `ai_runs` (tokens, costo, latencia).
- Lógica de dominio (`scoreCV`, `prefiltro`, `psicoFit`, transiciones de etapa) en `src/lib/domain/` como funciones puras con tests. Es lo que ya existe en la demo.

Decisiones de Next 16 que aplican aquí:

- `proxy.ts` (antes `middleware.ts`) solo para redirecciones optimistas por sesión y rol. La autorización real vive en el DAL.
- `cacheComponents` apagado en el MVP: todas las vistas son por usuario y cambian a cada minuto. Se puede activar después para el portal.
- `after()` de `next/server` para trabajo posterior a la respuesta (por ejemplo el debounce de mensajes de WhatsApp).
- `@supabase/ssr` con `cookies()` asíncrono; un cliente por contexto (`server`, `client`, `admin`).

---

## 2. Roles y seguridad

### 2.1 Roles

| Rol | Quién | Ve | Hace |
|---|---|---|---|
| `admin` | Andrea Lugo y dirección de Prime | Todo, incluida inteligencia interna, clientes, candidatos inactivos y lista negra | Alta de usuarios y clientes, crear vacantes, asignar reclutadores a cada vacante, reasignar candidatos, exportar, y todas las acciones del reclutador |
| `recruiter` | Reclutadores de Prime | Solo las vacantes que un admin le asignó, los clientes de esas vacantes y los candidatos asignados a él. Tablero, entrevistas y reportes salen de ese mismo universo (sin BI) | Avanzar/descartar, agendar, enviar psicométrico, validar documentos, enviar al cliente, capturar levantamientos y candidatos en sus vacantes. No exporta ni se asigna solo |
| `client` | Contacto de cada empresa cliente | Portal: sus vacantes, candidatos que ya pasaron entrevista Prime, reporte semanal | Vo.Bo. o "no continuar" en etapa entrevista cliente |

### 2.2 Implementación

- **Supabase Auth.** Los tres roles entran con correo y contraseña. Sin registro público: todas las cuentas las crea un admin desde Configuración, con contraseña temporal (sin correo) o por invitación por correo. Decisión del 16 sep 2026: se descartó el magic link para el cliente.
- **Rol y `client_id` en `app_metadata`** del usuario (solo se escribe con service role). Viajan en el JWT y las políticas RLS los leen con helpers SQL: `app.role()`, `app.client_id()`, `app.is_staff()`. Tabla `users` espejo para nombre, avatar y joins, creada por trigger en `auth.users`.
- **Next:** `proxy.ts` redirige sin sesión a `/login` y a los `client` a `/portal`. `src/lib/dal.ts` expone `verifySession()` y `requireRole()` con `React.cache`; los usan layouts, páginas y actions.
- **Decisiones del cliente** (Vo.Bo., no continuar) van por función SQL `client_decide_application(application_id, decision)` `SECURITY DEFINER` que valida rol, `client_id` y etapa. El cliente nunca hace `UPDATE` directo sobre `applications`.
- **Storage:** todos los buckets privados; acceso por URL firmada de 60 s generada en el servidor tras verificar rol. El cliente no descarga documentos del expediente ni el PDF psicométrico (por confirmar con Prime).
- **Auditoría:** `application_stage_events` para cada cambio de etapa, `audit_log` para lecturas de documentos y descargas, y `job_profile_assignment_events` para cada cambio de asignación de reclutadores.
- **Asignación por vacante** (junta del 11 sep 2026). Prime trabaja unas 100 vacantes de 25 clientes con 5 reclutadores que rotan seguido. Un admin marca en el perfil qué reclutadores lo trabajan (checklist, RPC `set_profile_recruiters`) y lo cambia cuando quiera; el reclutador nunca se asigna solo. La visibilidad se hace cumplir en la base: los helpers `app.assigned_profile_ids()`, `app.assigned_client_ids()`, `app.can_access_profile()`, `app.can_access_client()`, `app.can_access_application()` y `app.can_access_candidate()` leen la tabla de asignaciones (no el JWT), así que un cambio aplica en la siguiente consulta, sin volver a entrar. Toda tabla nueva que cuelgue de una vacante o de un candidato usa esos helpers.
- **Round robin.** Cada postulación nueva se asigna por turno a uno de los reclutadores de la vacante (`applications.assigned_recruiter_id`, trigger). Si la captura un reclutador a mano, es suya. Dos reclutadores de la misma vacante no ven los candidatos del otro. Solo un admin reasigna. Al quitar a un reclutador de una vacante o desactivarlo, sus candidatos en proceso se reparten entre los que quedan; si no queda nadie, quedan sin asignar y solo los ve el admin.
- **Permisos solo de admin:** exportar o descargar bases (Excel, PDF), ver la base de candidatos inactivos y ver la lista negra. `app.has_permission()` en SQL y `src/lib/auth/permissions.ts` (`can`, `requirePermission`, `assertPermission`) en la app; los módulos que vengan consultan ahí. `log_audit('export')` rechaza a quien no sea admin.

### 2.3 Matriz RLS (resumen)

"Asignado" = la vacante está en `job_profile_assignments` para ese reclutador. "Suyo" = la postulación tiene `assigned_recruiter_id` = el reclutador **y** la vacante sigue asignada a él. Vigente desde las migraciones 0014 y 0015; sustituye la regla original de que el reclutador veía todo.

| Tabla | admin | recruiter | client |
|---|---|---|---|
| `clients` | CRUD | R (solo clientes con una vacante asignada) | R (solo el propio) |
| `job_intakes` | CRUD | CRU (los que capturó o los de sus vacantes) | — |
| `job_profiles` | CRUD | RU (asignadas). Crear vacantes es de admin | R (propios) |
| `job_profile_ai_configs` | CRUD | CRU (vacantes asignadas) | — |
| `job_profile_assignments` | CRUD (checklist vía `set_profile_recruiters`) | R (solo sus propias filas) | — |
| `job_profile_assignment_events` | R (escribe el trigger) | — | — |
| `candidates` | CRUD | CRU (suyos; crea, y lo ve en cuanto lo postula). Borrar es de admin | R vía `applications` visibles |
| `applications` | CRUD, reasigna | CRU (suyas; alta solo en vacantes asignadas; no reasigna) | R (propias con etapa ≥ `psychometric`); decisión vía RPC |
| `application_stage_events`, `prefilter_answers` | CRUD | CR (de postulaciones suyas) | R (de applications visibles) |
| `wa_conversations`, `wa_messages` | CRUD | CRU (de candidatos suyos) | — |
| `wa_templates` | CRUD | R | — |
| `interviews` | CRUD | CRUD (de postulaciones suyas) | R (visibles) |
| `interview_transcripts` | R | R (de postulaciones suyas) | — |
| `psychometric_tests` | CRUD | CRUD (de postulaciones suyas) | R (visibles, sin archivo) |
| `candidate_documents` | CRUD | CRUD (de candidatos suyos) | R solo estado, sin archivo |
| `placement_followups` | CRUD | CRUD (de postulaciones suyas) | R (visibles) |
| `import_batches` | CRUD | CRUD (vacantes asignadas) | — |
| `report_runs` | R | R (clientes de sus vacantes; el diario interno es de admin) | R (propios) |
| `ai_insights` | R | — | — |
| `ai_runs`, `webhook_events`, `scheduled_tasks`, `audit_log` | R | — | — (escribe solo service role) |
| `users` | CRUD | R (staff y contactos de sus clientes) | R (self) |
| `notifications` | R/U propias | R/U propias | R/U propias |

Permisos que no dependen de la asignación (`app.has_permission`, `src/lib/auth/permissions.ts`), todos solo de admin: `manage_assignments`, `export`, `view_inactive_candidates`, `view_blacklist`.

Las vistas `v_pipeline` y `v_bi_*` son `security_invoker` y heredan lo anterior: el tablero, el kanban y los reportes de un reclutador salen solo de sus candidatos. `v_portal_*` son `security definer` y filtran por `app.client_id()` o `app.can_access_application()`.

---

## 3. Modelo de datos

Convenciones: identificadores en inglés `snake_case` (evita acentos y ñ en tipos generados y en libs), etiquetas en español en la UI. `id uuid primary key default gen_random_uuid()`, `created_at` y `updated_at timestamptz` con trigger. Fechas en `timestamptz`; la zona de negocio es `America/Mexico_City`.

### 3.1 Enums

```sql
user_role          admin | recruiter | client
profile_status     intake | active | paused | closed
application_stage  new | prefilter | cv_review | prime_interview | psychometric | documents | client_interview | hired | discarded
source_channel     pandape | facebook | linkedin | prime_pool | referral | other
prefilter_status   pending | in_progress | passed | failed | exception
interview_type     prime | client
interview_status   scheduled | confirmed | completed | no_show | cancelled | recorded | transcribed | analyzed
psych_status       pending | sent | completed | parsed | failed
psych_verdict      fit | fit_with_reservations | not_recommended
doc_status         pending | received | in_review | validated | rejected
wa_direction       inbound | outbound
wa_flow            prefilter | scheduling | psychometric | documents | reminder | manual
actor_type         agent | recruiter | client | system
task_status        pending | running | done | failed | cancelled
assignment_action  assigned | unassigned
assignment_source  manual | user_deactivated | role_changed
```

Mapa de etapas contra la demo: `nuevo→new`, `prefiltro→prefilter`, `cv→cv_review`, `entrevista_prime→prime_interview`, `psico→psychometric`, `expediente→documents`, `entrevista_cliente→client_interview`, `contratado→hired`, `descartado→discarded`.

### 3.2 Identidad

```
users                       -- espejo de auth.users
  id (= auth.users.id), email, full_name, role user_role, client_id → clients (null si staff),
  phone, avatar_url, is_active bool, last_seen_at
```

### 3.3 Clientes y perfiles de puesto

```
clients
  id, name, industry, address, city, contact_name, contact_title, contact_email, contact_phone,
  client_since date, daily_report_time time, weekly_report_dow smallint, weekly_report_time time,
  portal_enabled bool, is_active bool

job_intakes                 -- levantamiento (secciones I–VI del Excel), se conserva para auditoría y regeneración
  id, client_id → clients (null hasta alta), profile_id → job_profiles (null hasta generar),
  form jsonb, status (draft | generated), created_by → users

job_profiles                -- descriptivo de puesto (D.P.)
  id, client_id → clients, intake_id → job_intakes, title, status profile_status, openings int,
  unit, work_zone, objective, reports_to, prepared_by → users, prepared_at date,
  specs jsonb            -- {age, sex, marital_status, children, residence}
  requirements jsonb     -- {education, experience, knowledge, languages, systems}
  activities text[],
  conditions jsonb       -- {salary, benefits, schedule, modality, travel, staff_in_charge, tools}
  relations jsonb        -- [{with, purpose}]
  competencies jsonb     -- {functional:[{name,level}], leadership:[{name,level}], labor:[string]}
  selection_process text[], posting_text text, published_channels source_channel[]

job_profile_assignments     -- qué reclutadores trabajan cada vacante (N:M). Solo admin escribe.
  profile_id → job_profiles, recruiter_id → users (rol recruiter, activo), PK (profile_id, recruiter_id),
  assigned_by → users, assigned_at, turn_seq bigint (turno del round robin), last_candidate_at

job_profile_assignment_events   -- historial: quién asignó o quitó a quién y cuándo (lo escribe un trigger)
  id, profile_id, recruiter_id, action assignment_action, source assignment_source,
  actor_user_id → users (null = sistema), created_at

job_profile_ai_configs      -- 1:1 con job_profiles; lo que usa la IA. Versionado.
  profile_id PK → job_profiles, version int,
  age_min, age_max, age_is_blocking bool, commute_max_min, experience_min_months,
  salary_expectation_max numeric, schedule_text, requires_saturdays bool, education_min,
  cv_weights jsonb       -- [{key, label, weight}]  (suma 100)
  cv_threshold int,
  prefilter_questions jsonb  -- [{order, key, text, rule_key, answer_type}]
  psych_minimums jsonb   -- [{scale, min}]
  psych_blocking jsonb   -- [{scale, min}]  (por ejemplo tolerancia a la presión en Cobranza)
  generated_by_ai bool, generated_at, prompt_version
```

### 3.4 Candidatos

Se separa la **persona** (`candidates`) de la **postulación** (`applications`). Un candidato puede aplicar a varias vacantes, ir a la bolsa de Prime y reutilizar sus documentos. La etapa vive en la postulación.

```
candidates
  id, full_name, first_name, phone_e164 unique, email, birth_date, age_reported int, gender,
  zone, municipality, education_level, cv_file_path, cv_text, cv_summary,
  privacy_consent_at, privacy_consent_via, whaapy_contact_id, in_prime_pool bool, notes

applications
  id, candidate_id → candidates, profile_id → job_profiles, unique(candidate_id, profile_id)
  stage application_stage, stage_changed_at, source_channel, applied_at,
  assigned_recruiter_id → users, assigned_at,        -- round robin entre los reclutadores de la vacante; solo admin reasigna
  commute_minutes int, experience_months int, salary_expectation numeric, available bool, availability_notes,
  prefilter_status, prefilter_result jsonb,           -- [{criterion, answer, ok, required}]
  cv_score int, cv_score_breakdown jsonb, cv_score_version int, cv_scored_at, cv_ai_rationale,
  ai_note text,                                       -- la "Nota de la IA" de la ficha
  discard_reason, discarded_by actor_type, discarded_at,
  hired_at, agreed_salary, confirmation_sheet_path, confirmation_signed_at

application_stage_events    -- línea de tiempo y BI de tiempos por etapa
  id, application_id, from_stage, to_stage, actor_type, actor_user_id → users, reason, created_at

prefilter_answers           -- una fila por pregunta; alimenta "motivos de descarte"
  id, application_id, question_key, question_text, answer_raw, answer_parsed jsonb,
  passes bool, rule_snapshot jsonb, answered_at
```

### 3.5 WhatsApp

```
wa_conversations
  id, candidate_id, application_id (null si es conversación general), phone_e164,
  whaapy_conversation_id, flow wa_flow, flow_state jsonb,   -- {question_index, awaiting, retries}
  status (open | closed_success | closed_rule | handoff | expired),
  ai_paused bool, paused_by → users, last_inbound_at, last_outbound_at, window_expires_at

wa_messages
  id, conversation_id, direction wa_direction, whaapy_message_id, wamid,
  type (text | image | document | audio | template | interactive), body, interactive_payload jsonb,
  media_path, media_mime, status (queued | sent | delivered | read | failed), error,
  sent_by actor_type, sent_by_user_id → users, ai_run_id → ai_runs, created_at

wa_templates                -- catálogo de templates aprobados por Meta
  id, name, language, purpose (first_contact | interview_confirm | psych_link | docs_request | reminder | courtesy_close),
  variables jsonb, meta_status, is_active bool
```

### 3.6 Entrevistas

```
interviews
  id, application_id, type interview_type, status interview_status,
  scheduled_at timestamptz, duration_min, platform (teams | meet | zoom), meeting_url,
  calendar_event_id (id del evento de Outlook), calendar_owner_id → users, interviewer_user_id → users, client_interviewer_name,
  fireflies_meeting_id, summary, score int, findings jsonb,   -- [{criterion, ok, evidence, quote, at}]
  analyzed_at, analysis_version, ai_run_id → ai_runs

interview_transcripts       -- separada para que el cliente no la lea
  interview_id PK → interviews, fireflies_transcript_id, language, text, sentences jsonb, duration_sec, received_at
```

### 3.7 Psicométrico

```
psychometric_tests
  id, application_id, provider (psicotest), test_link, sent_at, reminder_sent_at, due_at, completed_at,
  report_file_path, status psych_status,
  parsed jsonb,          -- {iq, iq_level, coleibor:[{scale,score}], cibain_high[], cibain_low[], inceval:{trust,honesty,ethics}, cacter, ciesman_low[]}
  fit_rows jsonb, fit_pct int, verdict psych_verdict, parsed_at, ai_run_id → ai_runs
```

### 3.8 Expediente

```
document_types              -- semilla con los 10 documentos de la demo
  key PK, label, required bool, sort_order, accepts text[] (image | pdf), validation_hints

candidate_documents         -- pertenece a la persona; application_id da contexto
  id, candidate_id, application_id, document_type_key → document_types,
  file_path, mime, size_bytes, status doc_status, received_via (whatsapp | upload),
  ai_check jsonb,        -- {legible, name_matches, extracted:{curp, rfc, nss, address}, issues[]}
  rejected_reason, validated_by → users, validated_at, ai_run_id → ai_runs
```

### 3.9 Reportes e inteligencia

```
report_runs
  id, type (daily_internal | daily_client | weekly_client), client_id, period_start, period_end,
  recipients text[], subject, html_path, pdf_path, sent_at, status, error, resend_message_id

ai_insights                 -- áreas de mejora generadas cada lunes
  id, client_id (null = global), week_start date, items jsonb, ai_run_id → ai_runs
```

### 3.10 Sistema

```
ai_runs                     -- observabilidad y costo de cada llamada a Claude
  id, kind (profile_generation | cv_score | prefilter_reply | interview_analysis | psych_parse | doc_check | weekly_insights),
  entity_type, entity_id, model, prompt_version, effort, input_tokens, output_tokens,
  cache_read_tokens, cost_usd, latency_ms, status, error, output jsonb, created_at

webhook_events              -- idempotencia y replay
  id, source (whaapy | fireflies | resend | google | microsoft), event_type, external_id unique, payload jsonb,
  received_at, processed_at, error, attempts

scheduled_tasks             -- cola simple sobre Postgres
  id, type, payload jsonb, run_at, status task_status, attempts, max_attempts, locked_at, locked_by,
  last_error, created_at, finished_at
  índice (status, run_at)

user_integrations           -- tokens OAuth cifrados (Outlook de cada reclutador, §4.4 opción B)
  id, user_id → users, provider (google | microsoft), access_token_enc, refresh_token_enc, expires_at, scopes text[], account_email

audit_log
  id, user_id, action (view_document | download_document | view_psych_report | export), entity_type, entity_id, ip, created_at
```

### 3.11 Vistas

- `v_pipeline`: application + candidate + profile + client + `cv_score` + conteo de documentos + veredicto psicométrico + score de entrevista + días en etapa + reclutador asignado. Es lo que pintan el kanban, la lista y el tablero.
- `v_portal_applications`: subconjunto de `v_pipeline` filtrado por `app.client_id()` y etapa ≥ `psychometric`, sin columnas internas.
- `v_bi_funnel`, `v_bi_channel`, `v_bi_stage_durations`, `v_bi_discard_reasons`: agregados para reportes e inteligencia interna, calculados desde `application_stage_events` y `prefilter_answers`.

### 3.12 Storage (buckets privados)

| Bucket | Contenido | Quién lee |
|---|---|---|
| `cvs` | CV en PDF | staff |
| `documents` | INE, CURP, RFC, NSS, domicilio, acta, estudios, cartas, hoja de confirmación | staff; URL firmada 60 s; se registra en `audit_log` |
| `psychometrics` | PDF de Psicotest | staff |
| `wa-media` | Media entrante sin clasificar (antes de asignarse a un documento) | staff |
| `reports` | HTML y PDF de reportes enviados | staff y cliente propio |

Rutas: `{bucket}/{candidate_id}/{document_type_key}/{uuid}.{ext}`.

---

## 4. Integraciones

El detalle operativo de cada servicio, llave, tarea de IA y tarea de la cola está en `tasks.md`.

### 4.1 Whaapy (WhatsApp Business API)

- Base `https://api.whaapy.com`, `Authorization: Bearer wha_…`.
- **Enviar texto:** `POST /messages/v1` con `{to, content}`. Solo funciona dentro de la ventana de 24 h desde el último mensaje del candidato; fuera de ella responde error `131047` y hay que mandar template.
- **Template:** `POST /messages/v1` con `type: "template"`, `template.name`, `template.language: "es_MX"`, `components[].parameters`. Se usa para primer contacto, recordatorios y cierres.
- **Botones:** `type: "interactive"` con hasta 3 botones `reply` (`id` regresa en el webhook). Útil para "Sí / No" y para elegir horario de entrevista sin texto libre.
- **Webhooks:** `POST /user-webhooks` para suscribir `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.failed`, `conversation.created`, `conversation.handoff` a `/api/webhooks/whaapy`. Firma HMAC-SHA256 en `X-Webhook-Signature` con el `secret` que devuelve al crear el webhook (se ve una sola vez). `X-Webhook-ID` sirve para idempotencia.
- **Media entrante:** el webhook trae `media_url` con token de 24 h. Descargar de inmediato a Storage y guardar el path; nunca guardar la URL.
- **Límites:** imagen 5 MB, documento 100 MB.
- **Convivencia con humanos:** IA nativa de Whaapy apagada para el número (o pausada por conversación vía la API de control). Cuando un reclutador contesta desde el inbox de Whaapy, nuestro orquestador pausa la conversación (`wa_conversations.ai_paused`) al detectar un `message.sent` que no originó nuestra API, o un `conversation.handoff`.
- **Batching:** al recibir `message.received`, esperar 6 a 8 s con `after()` y contestar solo si no llegó otro mensaje después (`last_inbound_at`).
- **Templates que hay que crear y mandar a aprobación (semana 1):** `prime_primer_contacto`, `prime_confirmacion_entrevista`, `prime_enlace_psicometrico`, `prime_recordatorio`, `prime_solicitud_documentos`, `prime_cierre_cortes`. Variables: nombre, vacante, fecha/hora, enlace.

### 4.2 API de Anthropic (Claude)

- SDK `@anthropic-ai/sdk`. Modelo por defecto `claude-opus-5-5` (desde el 19 oct 2026; antes `claude-opus-5`, misma familia y más barato); thinking adaptativo (siempre encendido en este modelo); `output_config.effort` como palanca de costo: `low` o `medium` para respuestas de WhatsApp y verificación de documentos, `high` para análisis de entrevista, generación de perfil e insights semanales. Streaming para salidas largas (perfil, insights).
- **Salidas estructuradas** con `client.messages.parse()` + esquemas zod. Cada tarea de IA tiene su esquema: perfil generado, score de CV con desglose y razonamiento, hallazgos de entrevista con cita y marca de tiempo, parse de Psicotest, verificación de documento.
- **PDF e imágenes:** CV y PDF de Psicotest se mandan como bloques `document` en base64 (Claude los lee directo, sin extracción de texto previa; límite 32 MB por request). INE y comprobantes como bloques `image`.
- **Prompt caching:** el system prompt y el perfil de puesto (D.P. + config de IA) van primero con `cache_control`; lo variable (candidato, transcripción, mensaje) al final. Un prefiltro de 10 turnos reutiliza el mismo prefijo.
- `fallbacks: "default"` activado para manejar `stop_reason: "refusal"` sin tumbar el flujo.
- Todo se registra en `ai_runs`. Prompts en `src/lib/ai/prompts/*.ts` con `PROMPT_VERSION`.

Costo estimado con Opus 5 (orden de magnitud, tarifas de lista; Opus 5.5 cuesta 20 % menos por token):

| Tarea | Tokens aprox. (entrada / salida) | USD aprox. |
|---|---|---|
| Prefiltro por WhatsApp, 7 a 10 turnos con caché | 25k / 2k | 0.17 |
| Score de CV (PDF de 2 páginas) | 8k / 1k | 0.07 |
| Análisis de entrevista de 30 min | 15k / 3k | 0.15 |
| Lectura de PDF de Psicotest (~15 páginas) | 30k / 2k | 0.20 |
| Verificación de 10 documentos | 20k / 2k | 0.15 |
| Candidato que llega a expediente | | ≈ 0.75 |
| Candidato descartado en prefiltro | | ≈ 0.10 a 0.20 |

Con el volumen de Telasist (unos 130 postulantes al mes, 10 que llegan a expediente) el consumo ronda 30 a 50 USD al mes. Si Prime quiere bajarlo, la primera palanca es `effort`, no cambiar de modelo.

### 4.3 Fireflies

- GraphQL en `https://api.fireflies.ai/graphql`, `Authorization: Bearer <API key>` de la cuenta de Prime.
- **Que se una a la llamada:** Fireflies entra a reuniones de Teams igual que a Meet. Invitar `fred@fireflies.ai` al evento de Outlook (auto-join) o mutation `addToLiveMeeting(meeting_link)` al momento de la cita. Recomendación: invitación en el evento, con `addToLiveMeeting` como respaldo si no se unió.
- **Webhook** de transcripción completada configurado en la cuenta de Fireflies hacia `/api/webhooks/fireflies` con `meetingId`. Luego query `transcript(id)` → `sentences {speaker_name, text, start_time}` y `summary` → `interview_transcripts` → tarea `interview_analyze`.
- **Sala de espera de Teams:** el bot de Fireflies y el candidato son externos a la organización de Prime. Si la política de Teams los manda a la sala de espera, el reclutador tiene que admitirlos; conviene que la reunión deje entrar sin espera (`lobbyBypassSettings`) o ajustar la política de reuniones en el centro de administración de Teams. También tiene que estar permitido que usuarios anónimos se unan a reuniones.
- **Alternativa sin Fireflies:** Teams transcribe solo y Graph expone la transcripción (`/onlineMeetings/{id}/transcripts`, permiso `OnlineMeetingTranscript.Read.All`). Si la licencia de Prime lo incluye y se puede activar al crear la reunión, se ahorra Fireflies. Se decide con el spike de la semana 1.
- Verificar en semana 1: firma del webhook (Fireflies admite secret), idioma español en la cuenta, cómo empatar `meetingId` con nuestra `interviews.meeting_url` (por título del evento o por `fireflies_meeting_id` guardado al agendar).

### 4.4 Microsoft 365: Outlook y Teams (Microsoft Graph)

Decisión del 19 oct 2026: Prime usa Outlook (clásico y nuevo) y Teams. Da igual qué Outlook use cada quien: los dos leen el mismo buzón de Exchange Online. Requisito: que el correo de Prime esté en Microsoft 365, no en un Exchange propio ni en POP/IMAP.

- **Registro de la app** en Microsoft Entra ID (lo hace el admin de Microsoft 365 de Prime): una app de un solo inquilino con secreto de cliente. Variables `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`. El secreto vence (máximo 24 meses): anotar la fecha para renovarlo.
- **Conexión elegida (20 oct 2026): opción B, cada reclutador conecta su cuenta.** OAuth delegado con PKCE (`openid email offline_access User.Read Calendars.ReadWrite`) desde **Mi cuenta → Conectar Outlook** (`/api/integrations/microsoft/connect` y `/callback`). Tokens cifrados con AES-256-GCM (`src/lib/crypto.ts`, `ENCRYPTION_KEY`) en `user_integrations` con `provider = 'microsoft'`; la fila la escribe el propio usuario (RLS "cada quien la suya"). El token se refresca solo; si Microsoft lo revoca, la app pide reconectar. Quien no conecte sigue pegando el enlace de Teams a mano.
- **Service role para tokens:** leer y refrescar el token del dueño del calendario (`interviews.calendar_owner_id`) se hace con service role en `src/lib/integrations/microsoft-graph.ts`, porque quien mueve o cancela puede ser otra persona (un admin). Solo toca `user_integrations`, nunca datos de candidatos.
- **Lo que pone Prime:** registrar la app en su Entra ID (permisos delegados, URI de redirección `https://<dominio>/api/integrations/microsoft/callback` y `http://localhost:3000/...` para pruebas) y dar el **consentimiento del administrador** una vez; si no, a cada reclutador le sale "Se necesita aprobación del administrador". Cada reclutador necesita licencia con Teams y buzón de Exchange Online.
- *Opción A (descartada por ahora):* permiso de aplicación con client credentials, acotado con RBAC for Applications a un grupo. Nadie conecta nada, pero pide más trabajo al admin de Prime. El código de Graph cambiaría solo en cómo se obtiene el token.
- **Crear:** `POST /me/events` con el token de quien agenda con `isOnlineMeeting: true` y `onlineMeetingProvider: "teamsForBusiness"` → `onlineMeeting.joinUrl` = `meeting_url`, `id` = `calendar_event_id`. Invitados: candidato (si tiene correo) y `fred@fireflies.ai`. Exchange manda la invitación desde el buzón del reclutador. Sin correo del candidato, el enlace le llega por WhatsApp (template `prime_confirmacion_entrevista`).
- **Mover:** `PATCH /me/events/{id}` con el token del dueño del calendario; si el evento ya no existe (se canceló), se crea otro. **Cancelar:** `POST /me/events/{id}/cancel` (manda el aviso a los invitados). `transactionId` = id de la entrevista para que un reintento no duplique el evento.
- **Sin Outlook conectado** el enlace se pega a mano. Si Outlook falla, el reclutador puede desconectarlo en Mi cuenta y agendar a mano.
- **Correos automáticos (opcional):** podrían salir de un buzón de Prime con `Mail.Send` en lugar de Resend; se decide con Prime (§4.5).
- Zoom y Google Meet: fuera del MVP.

### 4.5 Resend (correo)

- Dominio de Prime verificado (SPF, DKIM, DMARC), de preferencia en un subdominio (`notificaciones.…`). Plantillas como componentes de React con estilos en línea en `src/lib/email/templates.tsx` (sin `react-email`); los datos salen de funciones puras en `src/lib/email/data.ts`. La vista previa vive en Reportes → "Vista previa de correos" desde el 25 sep 2026; al conectar Resend se mandan las mismas plantillas con `renderToStaticMarkup`. El resumen interno llega completo a los admins y a cada reclutador solo con lo suyo.
- Tres correos: resumen diario interno, candidatos que avanzaron (por cliente), reporte semanal (por cliente) con PDF adjunto generado con `@react-pdf/renderer` y guardado en `reports`.
- Fase 2: buzón entrante `candidatos@…` para las notificaciones de Pandape con CV adjunto (Resend Inbound o Postmark) → crea `candidates` + `applications` en etapa `new`.

### 4.6 Psicotest

- Sin API. Enlace pegado a mano por el reclutador; PDF subido a mano o recibido por correo; lectura con Claude. Si Prime confirma que existe API o exportación, se agrega en fase 3.

### 4.7 Cron y cola de tareas

- Vercel Cron `* * * * *` → `GET /api/cron/tick` protegido con `CRON_SECRET`. Toma hasta N tareas de `scheduled_tasks` con `run_at <= now()` usando `FOR UPDATE SKIP LOCKED`, las ejecuta y reintenta con backoff (`attempts`, `run_at = now() + 2^attempts min`).
- Vercel Cron `0 * * * *` → `GET /api/cron/schedule-reports` agenda los correos diarios y semanales según `clients.daily_report_time` y `weekly_report_dow` en `America/Mexico_City`.
- Tipos de tarea: `wa_send`, `wa_first_contact`, `wa_reminder`, `interview_confirm`, `cv_score`, `interview_analyze`, `psych_parse`, `doc_check`, `report_daily_internal`, `report_daily_client`, `report_weekly_client`, `weekly_insights`, `fireflies_fetch_transcript`.
- Cada tarea corre en menos de 60 s (límite de una función de Vercel con Fluid Compute es mayor, pero conviene diseñar así). Si más adelante hacen falta flujos durables con esperas largas, Inngest o Trigger.dev se conectan sin cambiar el modelo.

---

## 5. Estructura del proyecto

```
src/
  proxy.ts                          # redirecciones optimistas por sesión y rol
  app/
    (auth)/login/page.tsx
    auth/callback/route.ts          # intercambio de código de Supabase
    (prime)/                        # layout con sidebar; requireRole(['admin','recruiter'])
      layout.tsx
      tablero/page.tsx
      clientes/page.tsx  clientes/[clientId]/page.tsx  clientes/nuevo/page.tsx
      perfiles/page.tsx  perfiles/[profileId]/page.tsx  perfiles/levantamiento/page.tsx
      candidatos/page.tsx  candidatos/[applicationId]/page.tsx  (drawer con intercepting route @drawer/(.)candidatos/[id])
      entrevistas/page.tsx
      reportes/page.tsx
      configuracion/page.tsx        # usuarios, templates, integraciones (admin)
    (portal)/portal/                # layout de cliente; requireRole(['client'])
      layout.tsx  page.tsx  candidatos/page.tsx  candidatos/[applicationId]/page.tsx  semanal/page.tsx
    api/
      webhooks/whaapy/route.ts
      webhooks/fireflies/route.ts
      cron/tick/route.ts
      cron/schedule-reports/route.ts
      files/[...path]/route.ts      # URL firmada tras verificar rol + audit_log
  actions/                          # Server Actions por módulo ('use server')
    clients.ts  profiles.ts  intakes.ts  candidates.ts  applications.ts  interviews.ts
    psychometrics.ts  documents.ts  reports.ts  users.ts
  lib/
    supabase/{server,client,admin}.ts
    dal.ts                          # verifySession, requireRole, getUser (React.cache)
    domain/                         # funciones puras portadas de la demo + tests
      scoring.ts  prefilter.ts  psych-fit.ts  stages.ts  docs.ts
    ai/
      client.ts  run.ts             # wrapper: parse() + ai_runs + caché
      schemas/*.ts                  # zod por tarea
      prompts/*.ts                  # versionados
      tasks/{generate-profile,score-cv,prefilter-reply,analyze-interview,parse-psych,check-document,weekly-insights}.ts
    integrations/
      whaapy.ts  fireflies.ts  microsoft-graph.ts  resend.ts  crypto.ts
    tasks/                          # ejecutores de scheduled_tasks
      registry.ts  handlers/*.ts
    format.ts                       # fechas es-MX, moneda, iniciales
  components/
    ui/                             # Pill, Btn, Card, Stat, Ring, Bar, Avatar, Field, Input, Toast (portados de la demo)
    layout/                         # Sidebar, Header, RoleBadge
    pipeline/                       # Kanban, Lista, Filtros
    candidate/                      # Drawer y sus tabs: Resumen, WhatsApp, Entrevista, Psicométrico, Expediente
    profile/                        # Descriptivo, EvaluaciónIA, Levantamiento
    charts/                         # Recharts con tokens de color
    emails/                         # react-email: DailyInternal, DailyClient, WeeklyClient
supabase/
  config.toml
  migrations/                       # 0001_enums, 0002_identity, 0003_clients_profiles, 0004_candidates, ...
  seed.sql                          # datos de la demo (3 clientes, 5 perfiles, 29 candidatos, 8 entrevistas)
  functions/                        # vacío en el MVP; todo corre en Next
docs/
  demo/PropuestaPrime.jsx           # la demo como referencia visual y funcional
  plan.md                           # este documento (mover aquí cuando arranque el código)
```

Convenciones de UI:

- Portar los tokens `T` de la demo a variables CSS en `globals.css` con `@theme` de Tailwind 4 (`--color-forest`, `--color-leaf`, …). Fuente IBM Plex Sans con `next/font`.
- Componentes primitivos de la demo se reescriben con Tailwind, mismos nombres y props, para que la maqueta sea fiel a lo que Prime ya vio.
- `'use client'` solo en kanban, drawer, formularios, gráficas y el switch de vista. Todo lo demás es Server Component.
- Recharts para gráficas, lucide-react para iconos.

Dependencias a instalar:

```
@supabase/supabase-js @supabase/ssr @anthropic-ai/sdk zod lucide-react recharts
resend react-email @react-email/components @react-pdf/renderer
date-fns date-fns-tz             # Microsoft Graph con fetch y client credentials, sin SDK
-D supabase vitest @testing-library/react
```

---

## 6. Flujos clave

### 6.1 Alta de candidato → prefiltro → score de CV

1. Reclutador sube CV (PDF), teléfono, canal y vacante (uno o en lote). Se crea `candidates` + `applications` en `new`. La postulación queda con quien la captura; si entra por el sistema (agente, importación, admin), la base la asigna por round robin entre los reclutadores de la vacante. Pendiente de rediseño: la junta del 11 sep pidió entrada por WhatsApp inbound (el candidato escribe primero y el agente pide el CV).
2. Se encola `cv_score` (Claude lee el PDF contra `job_profile_ai_configs`) y `wa_first_contact` (template de primer contacto + aviso de privacidad).
3. El candidato responde → `message.received` → `webhook_events` → tarea `prefilter_reply`: carga `flow_state`, valida la respuesta contra la regla, guarda `prefilter_answers`, decide siguiente pregunta o cierre.
4. Al terminar: todas las reglas pasan → etapa `cv_review` y se ofrece agenda; una regla bloqueante falla → `discarded` con mensaje cortés; una regla en modo alerta falla → `prefilter_status = exception` y aparece en "Requiere tu atención".
5. Con `cv_score ≥ cv_threshold` y prefiltro aprobado, el reclutador agenda (o se agenda solo si Prime lo autoriza).

### 6.2 Entrevista Prime

1. Reclutador elige fecha en el drawer → Server Action crea el evento en el Outlook del reclutador con reunión de Teams, invita a Fireflies, crea `interviews`, manda template de confirmación por WhatsApp, agenda `interview_confirm` para el día anterior.
2. Termina la llamada → webhook de Fireflies → `fireflies_fetch_transcript` → `interview_transcripts` → `interview_analyze` (hallazgos con cita, score) → etapa `psychometric` si el reclutador confirma.

### 6.3 Psicométrico

1. Reclutador pega el enlace de Psicotest → `psychometric_tests` en `sent` → el agente lo manda por WhatsApp con fecha límite → `wa_reminder` a las 12 h si no hay respuesta.
2. Llega el PDF (subida manual o correo) → `psych_parse` → `fit_rows`, `fit_pct`, `verdict` → etapa `documents` si el reclutador confirma.

### 6.4 Expediente

1. El agente pide los 10 documentos por WhatsApp uno por uno. Cada media entrante se descarga a `wa-media`, `doc_check` la clasifica (qué documento es, legibilidad, nombre coincide, CURP/RFC válidos) y la mueve a `documents` como `candidate_documents` en `received` o `in_review`.
2. El reclutador valida o rechaza; al rechazar, el agente pide la foto de nuevo. Con los 10 en `validated` se genera la hoja de confirmación (PDF) y el botón "Enviar a cliente" pasa a `client_interview`.

### 6.5 Portal y decisión del cliente

1. El contacto del cliente entra con la cuenta que le creó Prime. Ve `v_portal_applications` y el reporte semanal.
2. En etapa `client_interview` decide Vo.Bo. o no continuar vía `client_decide_application`. Vo.Bo. → `hired`, `hired_at`, notificación a Prime y al agente (mensaje de felicitación y siguiente paso).

### 6.6 Reportes

- 18:00 diario: `report_daily_internal` (todas las vacantes activas, pendientes del reclutador, agenda de mañana) y `report_daily_client` por cliente con vacantes activas (solo candidatos con etapa ≥ `psychometric`).
- Semanal según `weekly_report_dow`: `report_weekly_client` con embudo, canal, perfil contratado y siguientes pasos, HTML + PDF.
- Lunes 7:00: `weekly_insights` (Claude sobre `v_bi_*`) → `ai_insights` → pestaña Inteligencia interna.

---

## 7. Prerrequisitos antes de maquetar (semana 0)

**Cuentas y accesos**

- [ ] Proyecto Supabase (región `us-east-1`), Postgres 17. Guardar `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`.
- [ ] Proyecto en Vercel ligado al repo; dominio `app.primehrinnovation.com.mx` (o el que defina Prime).
- [ ] API key de Anthropic con límite de gasto mensual configurado.
- [ ] Número de WhatsApp de Prime dado de alta en Whaapy, API key `wha_…`, IA nativa apagada en ese número. Templates enviados a aprobación de Meta.
- [ ] Cuenta Fireflies de Prime (plan con API) y API key. Webhook apuntando a la URL de preview.
- [ ] App registrada en Microsoft Entra ID por el admin de Microsoft 365 de Prime, con `Calendars.ReadWrite` (aplicación) acotado al grupo de reclutadores (§4.4).
- [ ] Resend: dominio de Prime verificado (SPF, DKIM, DMARC).
- [ ] Psicotest: confirmar si hay API. Tres o cuatro PDFs reales para calibrar el parser.

**Repositorio**

- [ ] `supabase init`, `supabase start` (Docker) para desarrollo local; migraciones versionadas; `supabase gen types typescript` en un script `db:types`.
- [ ] Migraciones 0001 a 0008 con enums, tablas, helpers `app.*`, políticas RLS, buckets y vistas. Seed con los datos de la demo.
- [ ] `proxy.ts`, clientes de Supabase, `dal.ts`, layout `(prime)` con sidebar y selector de rol de prueba (solo en desarrollo).
- [ ] Tokens de diseño en `globals.css`, primitivas de UI portadas, `next/font` con IBM Plex Sans.
- [ ] `src/lib/domain/*` con `scoreCV`, `prefilter`, `psychFit` y sus tests (los casos de la demo son los fixtures).
- [ ] `.env.local` y `.env.example`; variables en Vercel para preview y producción.
- [ ] Guardar `PropuestaPrime.jsx` en `docs/demo/` como referencia.

**Spikes de la semana 1 (medio día cada uno, antes de programar módulos)**

- [ ] Whaapy: recibir `message.received` firmado en un handler de Next, contestar con `POST /messages/v1`, descargar un `media_url` a Storage.
- [ ] Teams + Fireflies: crear un evento de Outlook con Teams desde Graph, que Fireflies se una (sala de espera incluida), recibir el webhook y traer la transcripción. Probar también la transcripción nativa de Teams.
- [ ] Claude: score de un CV real en PDF y parse de un PDF de Psicotest real con `messages.parse()`; validar que los campos salen bien.

**Decisiones que hay que cerrar con Prime**

- [ ] Cómo entran hoy los postulantes de Pandape (correo con CV adjunto, exportación, panel).
- [ ] Edad y sexo: alerta o bloqueo.
- [ ] Qué ve el cliente del psicométrico y del expediente.
- [x] Videollamada: Teams con Outlook (19 oct 2026).
- [ ] Texto del aviso de privacidad y plazo de conservación de datos de descartados.
- [ ] Quién contesta desde el inbox de Whaapy cuando el agente escala.

---

## 8. Fases (10 semanas)

| Fase | Semanas | Entregable | Criterio de aceptación |
|---|---|---|---|
| 0. Base | 0 | Repo, Supabase con migraciones y seed, auth con 3 roles, layout y navegación, primitivas de UI, spikes de integración | Andrea, Roberto y Verónica entran con su rol y ven la navegación de la demo con datos semilla. Los tres spikes pasaron. |
| 1. Clientes, perfiles y levantamiento | 1 y 2 | Alta de clientes, levantamiento (secciones I a VI), generación del D.P. y de la config de IA con Claude, vista de perfil con sus tres pestañas | Se levanta Diseñador Industrial desde el formulario y sale el perfil completo con reglas, pesos, preguntas y mínimos. Se cargan las tres vacantes de Telasist. |
| 2. Candidatos, agente y CV | 3 a 5 | Alta manual y masiva de candidatos, pipeline kanban y lista, drawer con Resumen y WhatsApp, agente de prefiltro en producción con el número de Prime, score de CV, "Requiere tu atención" | Un postulante real recibe el template, contesta las 7 preguntas, queda evaluado y aparece en la etapa correcta sin intervención. El reclutador resuelve una excepción desde el drawer. |
| 3. Entrevistas, psicométrico y expediente | 6 a 8 | Agenda con Teams + Fireflies, análisis de entrevista, envío y lectura de Psicotest, captura y validación de documentos por WhatsApp, hoja de confirmación | Una entrevista real queda transcrita y analizada en la ficha. Un PDF real de Psicotest da veredicto. Un candidato completa sus 10 documentos por WhatsApp. |
| 4. Reportes, inteligencia y portal | 9 y 10 | Tres correos automáticos, PDF semanal, inteligencia interna con insights de Claude, portal del cliente con Vo.Bo., capacitación, salida a productivo | Telasist recibe su correo diario y semanal sin que nadie lo arme. Verónica da un Vo.Bo. desde el portal y Prime lo ve al instante. |

Cada fase se despliega a producción y Prime la usa con Telasist antes de arrancar la siguiente.

---

## 9. Variables de entorno

```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
WHAAPY_API_KEY
WHAAPY_WEBHOOK_SECRET
WHAAPY_PHONE_E164
FIREFLIES_API_KEY
FIREFLIES_WEBHOOK_SECRET
MICROSOFT_TENANT_ID
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
RESEND_API_KEY
RESEND_FROM
CRON_SECRET
ENCRYPTION_KEY            # AES-256-GCM para tokens en user_integrations
APP_TIMEZONE=America/Mexico_City
```

---

## 10. Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Templates de Meta rechazados o tardíos | Sin primer contacto no hay agente | Enviar en semana 1 con textos neutros; tener template genérico de respaldo |
| Candidato sin teléfono válido o sin WhatsApp | Se cae el prefiltro | Validar E.164 al capturar; tarea `wa_first_contact` marca `message.failed` y el candidato entra a "Requiere tu atención" para llamada manual |
| Fireflies no se une o transcribe mal en español | Sin análisis de entrevista | Sala de espera de Teams sin espera para externos; `addToLiveMeeting` como respaldo; transcripción nativa de Teams como alternativa; permitir subir transcripción o grabación a mano; el reclutador puede capturar hallazgos |
| Psicotest cambia el formato del PDF | Parser falla | Esquema zod con campos opcionales; `psych_status = failed` visible; fixtures de 3 o 4 PDFs reales en tests |
| Dos agentes contestando (Whaapy nativo + nuestro) | Conversaciones duplicadas | IA nativa apagada en el número; verificación en el spike |
| Reglas de edad/sexo como bloqueo | Riesgo legal para Prime | Modo alerta por defecto; registro de quién decide |
| Fuga de documentos de identidad | Incumplimiento LFPDPPP | Buckets privados, URLs firmadas de 60 s, RLS, `audit_log`, borrado programado |
| Vercel Cron cada minuto no basta para chat | Respuestas lentas | El webhook contesta directo con `after()`; el cron solo corre tareas diferidas |

---

## 11. Fuera del alcance del MVP (queda anotado)

- Publicación automática en Pandape, Facebook y LinkedIn.
- Zoom y Google Meet.
- Firma electrónica del contrato y nómina u Odoo.
- Multi-organización (segunda vertiente de Prime). El modelo actual es una sola organización con muchos clientes; si se necesita, se agrega `org_id` a `clients` y `users` sin rehacer el resto.
- Agente conversacional libre (preguntas fuera del guion). Con la opción B de Whaapy se puede sumar después.

---

## 12. Cambios aplicados en las migraciones (16 de septiembre de 2026)

Deltas respecto al modelo de la sección 3, ya implementados en `supabase/migrations/0001–0012`:

- **Enums nuevos** para todo lo que estaba como texto entre paréntesis (`intake_status`, `wa_conversation_status`, `wa_message_type`, `wa_message_status`, `wa_template_purpose`, `meeting_platform`, `received_via`, `report_type`, `report_status`, `ai_run_kind`, `ai_run_status`, `webhook_source`, `audit_action`, `integration_provider`, `client_decision`, `discard_reason_key`). Así `supabase gen types` produce uniones de TypeScript.
- **`applications`**: se agregan `discard_reason_key` (categorizado, para BI en cualquier etapa), `discarded_from_stage`, `discarded_by_user_id` y `client_decision*` (decisión, fecha, quién, comentario). `unique(candidate_id, profile_id)` se mantiene; reaplicar a la misma vacante implica reabrir la postulación.
- **Línea de tiempo por trigger**: `application_stage_events` se escribe solo desde triggers en `applications` (también al crear). `set_application_stage(id, etapa, motivo, motivo_key, actor)` es la RPC para mover con motivo; `client_decide_application` devuelve `{id, stage}` y no la fila completa.
- **`job_profile_ai_configs`** no guarda historial: una fila por perfil con `version`; el historial queda en `ai_runs.output`.
- **`users`**: `role` y `client_id` solo se escriben vía `app_metadata` (trigger desde `auth.users`; un trigger bloquea el UPDATE directo). Check `(role = 'client') = (client_id is not null)`. Desactivar = `is_active` + ban en Auth (`setUserActive`).
- **`clients`**: `report_recipients text[]` y `timezone`. Recruiter solo lee; admin crea.
- **Índices de negocio**: una conversación `open` por teléfono (`wa_conversations`), un documento vivo por tipo y candidato (`candidate_documents` donde `status <> 'rejected'`), `unique(source, external_id)` en `webhook_events`, `dedupe_key` en `scheduled_tasks`, `unique nulls not distinct` en `ai_insights`.
- **Cola**: RPCs `claim_scheduled_tasks` (FOR UPDATE SKIP LOCKED), `finish_scheduled_task` (backoff 2^attempts min) y `enqueue_task` (dedupe).
- **Vistas**: `v_pipeline` y `v_bi_*` son `security_invoker` y además filtran `app.is_staff()`. `v_portal_applications` y `v_portal_documents` son security definer con filtro por `app.client_id()`: el cliente **no** tiene política sobre `psychometric_tests` ni `candidate_documents`; ve veredicto, % de fit y conteo de documentos solo por esas vistas (sin rutas de archivo). Se agrega `v_bi_prefilter_failures`.
- **Storage**: buckets creados sin políticas para `authenticated`; todo pasa por el servidor (URL firmada de lectura y `createSignedUploadUrl` para subir directo desde el navegador sin pasar el archivo por Vercel).
- **Auth**: acceso con correo y contraseña para los tres roles; cuentas creadas por el admin (contraseña temporal o invitación). Templates de correo con `token_hash` solo para invitación y recuperación (`supabase/templates/*`), `/auth/callback` acepta `code` y `token_hash`; `enable_signup = false`. En producción hay que replicar los dos templates y desactivar el registro en el dashboard.
- **Pendiente de confirmar con Prime**: las 10 claves de `document_types` en `seed.sql` son una propuesta; qué columnas del psicométrico ve el cliente; y si `prefilter_answers` (edad, sexo) debe ser visible para el cliente (hoy sí, según la matriz).

### 12.1 Migración 0013 (16 de septiembre de 2026, cotejo contra el alcance de la propuesta)

- **`candidates`**: `curp`, `rfc`, `nss`, `address_line` (identidad validada desde el expediente, para la hoja de confirmación) y `retention_until` (borrado programado de descartados, plazo por definir con Prime). Índice único sobre CURP.
- **`applications`**: `start_date` (fecha de ingreso) e `import_batch_id`.
- **`placement_followups`**: "permanencia según puntuación". Al contratar se programan tres cortes (30, 90 y 180 días desde `start_date` o `hired_at`) con `outcome` pending | active | left | unknown; los confirma el reclutador o el cliente. Vista `v_bi_retention` cruza score de CV, entrevista y psicométrico con la permanencia.
- **`import_batches`**: cargas masivas (CSV de Pandape o lote de CVs) con conteos y errores por fila.
- **`notifications`**: una fila por destinatario; `notify_staff()` avisa a todo el staff activo y `mark_notifications_read()` marca leídas. `client_decide_application` ahora notifica a Prime al instante (la propuesta lo promete: "Vo.Bo. con notificación a Prime").
- **Filtro por canal** en el pipeline (la propuesta dice "filtros por vacante y canal").
- **`MOCK_DATA`** acepta alcance: `1` todo, `core` solo clientes y vacantes, `pipeline` solo candidatos, reportes y portal. Permite arrancar la fase 1 con datos reales mientras el pipeline sigue en demo.

### 12.2 Migraciones 0014 y 0015 (21 de septiembre de 2026, junta con Prime del 11 sep)

La junta cambió la regla de que el reclutador ve todo. Prime trabaja unas 100 vacantes de 25 clientes con 5 reclutadores; varios trabajan la misma vacante y dirección los rota seguido.

- **0014 · asignación por vacante.** `job_profile_assignments` (N:M) y `job_profile_assignment_events` (historial por trigger, con actor y origen: manual, usuario desactivado, cambio de rol). RPC `set_profile_recruiters(profile, recruiter_ids[])` para el checklist: solo toca diferencias, altas antes que bajas. Solo se asignan usuarios activos con rol `recruiter`. Desactivar a un usuario o cambiarle el rol lo saca de todas sus vacantes (trigger en `users`); `setUserActive` actualiza `is_active` con la sesión del admin para que el historial registre quién fue.
- **0014 · visibilidad.** Helpers `app.assigned_profile_ids()`, `app.assigned_client_ids()`, `app.can_access_profile()`, `app.can_access_client()`. Políticas de `clients`, `job_profiles`, `job_profile_ai_configs`, `job_intakes`, `import_batches`, `report_runs` y `users` pasan de "staff" a "admin, o reclutador asignado". Crear vacantes pasa a ser de admin (quien crea decide quién la trabaja); el reclutador sigue capturando levantamientos.
- **0014 · permisos solo-admin.** `app.has_permission()` con `manage_assignments`, `export`, `view_inactive_candidates`, `view_blacklist`. `log_audit('export')` rechaza a quien no tenga `export`. Todavía no hay nada que exportar ni bases de inactivos o lista negra: la regla queda puesta para que esos módulos la hereden.
- **0015 · candidatos por reclutador.** `applications.assigned_recruiter_id` y `assigned_at`; round robin por trigger con turno en `job_profile_assignments.turn_seq` (secuencia, no fecha, para que un lote en una sentencia no empate). Alta manual por reclutador = suya. Solo admin reasigna, y solo a alguien que trabaje la vacante. Al salir un reclutador de una vacante, sus postulaciones en proceso se reparten entre los que quedan; las cerradas conservan a su reclutador histórico para BI, pero él ya no las ve. Sin reclutadores, quedan sin asignar (solo admin) y se reparten en cuanto se asigne a alguien.
- **0015 · políticas.** `candidates`, `applications`, `application_stage_events`, `prefilter_answers`, `wa_*`, `interviews`, `interview_transcripts`, `psychometric_tests`, `candidate_documents` y `placement_followups` pasan a `app.can_access_application()` / `app.can_access_candidate()`. Borrar candidatos queda solo para admin (un candidato puede tener postulaciones con otro reclutador). `find_candidate_by_phone()` resuelve el id de un teléfono existente en el alta manual sin exponer al candidato.
- **0015 · huecos cerrados.** `v_portal_applications` y `v_portal_documents` dejaban leer todo a cualquier staff (`or app.is_staff()`); ahora filtran con `app.can_access_application()`. `notify_staff()` era ejecutable por cualquier usuario autenticado (incluido un cliente) y avisaba a todo el staff con el nombre del candidato: se revoca a `authenticated` y la decisión del cliente avisa con `app.notify_application()` solo a los admins y al reclutador del candidato.
- **App.** Pestaña Reclutadores en el perfil (checklist e historial, solo admin), columna de reclutadores en la lista de vacantes, reclutador asignado y reasignación en la ficha del candidato (solo admin), alta de candidato reordenada para RLS acotado, `src/lib/auth/permissions.ts` y `requirePermission` / `assertPermission` en el DAL.
- **Verificación sin Docker.** `npm run db:rls-lite` carga las migraciones en PGlite (Postgres en WASM) con stubs de `auth.*` y corre más de 70 verificaciones de estas reglas. `scripts/rls-check.mjs` quedó actualizado para el stack local.
- **Pendiente de la misma junta** (no está hecho): filtro por reclutador en Tablero y Entrevistas para admin (`v_pipeline` ya trae `assigned_recruiter_id` y `assigned_recruiter_name`), importación de la base histórica de Excel, clientes (~25) y vacantes (~100), detección de duplicados con historial, lista negra, candidatos inactivos con auto-inactivación configurable, entrada por WhatsApp inbound, análisis de entrevista contra el guion de Prime, evaluaciones adicionales (Black Trust, socioeconómico, polígrafo), reporte interno en Excel y PDF, y uso desde el celular.
- **Por confirmar con Prime:** si un admin también puede recibir candidatos (hoy solo se asignan usuarios con rol reclutador); si al relevar a un reclutador sus candidatos se reparten solos (hoy sí) o los reasigna dirección a mano; y si el reclutador debe ver quién más trabaja su vacante (hoy no).

### 12.3 Migración 0016 y captura manual (21 de septiembre de 2026)

Para operar con datos reales antes de conectar IA, Google Calendar, Fireflies y Whaapy, todo lo que esas integraciones harán solas se puede capturar a mano desde la ficha. Las integraciones entran después en los mismos puntos, sin rehacer pantallas.

- **0016.** `interview_status` gana `completed` (entrevista realizada sin grabación; `recorded → transcribed → analyzed` quedan para Fireflies y la IA). RPC `candidate_history_by_phone(phone)`: todas las postulaciones de la persona con vacante, cliente, etapa, motivo de descarte, reclutador e `is_mine`. Es una divulgación acotada a propósito (la junta pidió "ya se envió a X cliente hace 2 meses"): el reclutador ve que existe una postulación ajena y a qué cliente fue, pero no puede abrirla.
- **Editar cliente** (`/clientes/[id]/editar`, solo admin): los campos del alta, más destinatarios de reportes y baja (`is_active`).
- **Editar vacante** (`/perfiles/[id]/editar`, admin o reclutador asignado): descriptivo completo y estado (activa, pausada, cerrada). Los campos de las secciones II a VII viven en `components/profile/position-fields.tsx` y los comparten el levantamiento y la edición; `lib/domain/intake-form-data.ts` los lee.
- **Expediente**: carga manual por tipo de documento (PDF o imagen según `document_types.accepts`), ver archivo, validar y rechazar con motivo. Un solo documento vigente por tipo; para reemplazar se rechaza primero. Una carga manual no muestra revisión de IA (antes la pantalla afirmaba "legible / nombre coincide" por defecto).
- **Psicométrico**: enlace de Psicotest y fecha límite, PDF del reporte y veredicto con % de ajuste capturados por el reclutador. El veredicto deja la evaluación en `parsed`, que es lo que ve el cliente en el portal; sin escalas leídas, la pantalla lo dice en lugar de pintar una tabla vacía.
- **Entrevistas**: agendar (Prime o cliente; fecha, hora, duración, plataforma, enlace pegado a mano, entrevistador), reagendar, confirmar, no se presentó, cancelar y cerrar como realizada con notas y calificación. Agendar puede mover la postulación a la etapa de esa entrevista. `/entrevistas` enlaza a la ficha en la pestaña Entrevista (`?tab=entrevista`). En `actions/interviews.ts` están marcados los tres puntos `INTEGRACIÓN` (crear, mover, cancelar) donde entran Google Calendar y Fireflies.
- **Historial de la persona**: aviso en la ficha ("esta persona tiene otras N postulaciones") y en el alta al salir del teléfono o cuando el CV lo llena.
- **Archivos**: `lib/uploads.ts` concentra el flujo de tres pasos (boleto firmado → subida directa a Storage → registro) y las URL firmadas de 60 s; las rutas `/candidatos/[id]/documentos/[doc]` y `/candidatos/[id]/psicometrico` leen la fila con la sesión del usuario (RLS), registran en `audit_log` y redirigen. Las fechas se capturan en la zona de la app y se guardan en UTC (`lib/domain/time.ts`).
- **SQL manual**: `supabase/manual/05_captura_manual.sql`, re-ejecutable y con checklist; `scripts/build-manual.py` genera el 04 y el 05. Verificación en `scripts/rls-lite/manual-capture.test.mjs`.
- **Sigue sin construir**: generación y edición de la evaluación automática de la vacante (pesos del CV, preguntas del agente, mínimos psicométricos) y puntuación del CV, que necesitan `ANTHROPIC_API_KEY`; Whaapy; Google Calendar y Fireflies; correos con Resend; pantalla de permanencia (garantía); datos de identidad validados del expediente (CURP, RFC, NSS).

### 12.4 Primera pasada con datos reales (21 de septiembre de 2026)

Lo que salió al probar con Telasist en la base hospedada, y cómo quedó:

- **Migración 0017 · catálogos.** Los 10 tipos de documento del expediente y los 6 templates de WhatsApp vivían solo en `seed.sql`; una base armada con los archivos manuales quedaba sin ellos y la pestaña Expediente salía sin renglones. Ahora son migración (`supabase/manual/06_catalogos.sql`) y `seed.sql` ya no los trae. Si el catálogo falta, la pestaña lo dice en lugar de pintar una tabla vacía. Regla: un dato sin el que una pantalla no funciona va en migración, no en la semilla.
- **Llave de servicio.** `SUPABASE_SERVICE_ROLE_KEY` traía pegadas la llave de demo del stack local y la real ("Invalid API key" en Auth, "Invalid Compact JWS" en Storage). Todo lo que usa `createAdminClient()` no había funcionado nunca contra la base real.
- **Nombres de usuario.** Las cuentas creadas en el dashboard de Supabase llegan sin nombre; Configuración ya permite ponerlo o corregirlo (`setUserName`: Auth y espejo).
- **Tablero arrastrable.** Las tarjetas del kanban se arrastran entre columnas, hacia adelante o hacia atrás (HTML5 nativo, sin dependencias, con `useOptimistic`); usa la misma acción `setStage`, así que queda en la línea de tiempo y RLS decide. Descartar sigue en la ficha (pide motivo) y un contratado no se arrastra.
- **Regresar de etapa.** Botón "Regresar a (etapa anterior)" en la ficha; el motivo queda registrado.
- **Cancelar contratación (0018).** Botón en la ficha, con motivo obligatorio, que regresa a Entrevista cliente. El trigger limpia `hired_at`, `start_date` y la decisión del cliente (puede volver a decidir) y borra los seguimientos pendientes; la línea de tiempo conserva el Vo.Bo. y el regreso. Contratado → Descartado no limpia nada: eso es "se fue", no "se canceló". La columna Contratado del kanban no participa del arrastre en ningún sentido. Archivo `supabase/manual/07_cancelar_contratacion.sql`.

### 12.5 IA: wrapper, evaluación de la vacante y score de CV (19 de octubre de 2026)

Sin migración: todo cabe en las columnas que ya existían (`job_profile_ai_configs`, `applications.cv_*`, `ai_runs`).

- **Wrapper** (`src/lib/ai/client.ts`, `run.ts`). `runAi(task, input)` es la única puerta a Claude: `beta.messages.parse()` con el esquema zod de la tarea, prompt del sistema con `cache_control`, `thinking` adaptativo, `effort` por tarea y `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) para que un rechazo por política se reintente en otro modelo. Registra cada llamada en `ai_runs` con service role (tokens, costo en USD según el modelo que contestó, latencia, error o rechazo). Nunca lanza: devuelve `ok: false` con un mensaje para la pantalla. Sin `ANTHROPIC_API_KEY` la IA queda apagada y los botones lo dicen.
- **Esquemas sin enums ni rangos** (`src/lib/ai/schemas.ts`). El SDK manda los `z.enum` como texto libre, y un valor fuera de lista tumbaría toda la respuesta. Claude devuelve la forma; `src/lib/domain/scoring.ts` acota y normaliza. Pruebas en `scripts/domain/scoring.test.mjs` (`npm run test:domain`, Node con `--experimental-strip-types`, sin dependencias).
- **`profile_generation`** (`tasks/generate-profile.ts`, prompt `prompts/profile-generation.ts`). Botón "Generar con IA" en la pestaña Evaluación IA de la vacante (admin o reclutador asignado; RLS decide al guardar). Lee el descriptivo de la vacante, no el levantamiento, porque el descriptivo es lo que se edita después. Propone de 4 a 6 criterios del CV con pesos y una guía (`hint`) de qué da puntaje completo o parcial, el umbral, las reglas del prefiltro, de 4 a 7 preguntas para WhatsApp, mínimos psicométricos y lo que faltó en el descriptivo (se muestra al terminar). El código fuerza: pesos enteros que suman 100, `age_is_blocking = false` siempre, rangos válidos, una sola escala bloqueante. Regenerar reemplaza la configuración (pide confirmar) y sube `version`. Por ahora no reescribe el descriptivo: solo la configuración de evaluación.
- **Edición a mano de pesos y umbral** en la misma pestaña (`saveCvWeights`): solo guarda si los pesos suman 100; sube `version` y marca la configuración como manual.
- **`cv_score`** (`tasks/score-cv.ts`). Corre con la sesión del usuario: si RLS no le deja leer la postulación, no se califica. Manda la vacante (requisitos, actividades y criterios con su guía) en caché y el CV como documento PDF (Claude lee tablas y columnas); si el PDF no se puede bajar, usa el texto extraído en el alta. Claude devuelve puntos, evidencia y nota por criterio, un resumen y alertas; `buildCvScore` acota cada criterio a su peso y suma. Se guarda en `cv_score`, `cv_score_breakdown` (con `evidence` y `note`), `cv_score_version`, `cv_scored_at`, `cv_ai_rationale` (resumen) y `ai_note` ("Revisar: …" con las alertas). No mueve de etapa ni descarta.
- **Cuándo corre:** al dar de alta un candidato con CV, en segundo plano con `after()` (el reclutador ya está en la ficha); y con "Calificar CV" o "Recalificar" en la pestaña Resumen. Si la vacante cambió sus pesos después de calificar, la ficha avisa y ofrece recalificar. Cuando exista la cola, el alta encola `cv_score` en lugar de usar `after()`, con la misma función.
- **Sin probar contra la API**: falta la llave. Lo siguiente es correr la generación sobre la vacante de Telasist y dos o tres CV reales, y ajustar los prompts (subiendo `PROMPT_VERSION`).

### 12.6 Videollamadas por Teams y Outlook (19 de octubre de 2026)

Prime usa Microsoft 365 (Outlook clásico y New Outlook, Teams). Sustituye a Google Calendar y Meet en §0.5, §4.3, §4.4, §6.2, §7, §8 y §9.

- Las entrevistas se crean en el calendario de Outlook del reclutador con reunión de Teams, vía Microsoft Graph. Las pantallas no cambian: entra en los tres puntos `INTEGRACIÓN` de `actions/interviews.ts`.
- Fireflies se mantiene (entra a Teams igual que a Meet), con la transcripción nativa de Teams como alternativa a probar.
- Pendiente: migración que agrega `teams` a `meeting_platform` (y lo deja como valor por defecto al agendar) y `microsoft` a `integration_provider` y `webhook_source`; opciones de plataforma en el formulario de entrevista; registro de la app en Entra ID por el admin de Prime. Lista completa en `tasks.md` §6.


### 12.7 Teams y Outlook por reclutador, migraciones 0019 y 0020 (20 de octubre de 2026)

- **Decisión:** opción B de §4.4. Cada reclutador conecta su Outlook en **Mi cuenta** (`/mi-cuenta`, enlace en su nombre abajo del menú). Meet y Zoom salen de la app: el formulario de entrevista ya no pregunta plataforma, todo es Teams, y las entrevistas viejas de Meet o Zoom pasan a Teams (0020; el enlace guardado no cambia).
- **Con Outlook conectado el evento siempre se crea** en su calendario y `fred@fireflies.ai` siempre va invitado; el campo de enlace ni aparece. Sin Outlook conectado, el enlace se pega a mano y el formulario invita a conectar.
- **0019** agrega `teams` a `meeting_platform` y `microsoft` a `integration_provider` y `webhook_source`; **0020** deja `teams` por defecto en `interviews.platform` y pasa a Teams las entrevistas de Meet o Zoom (en otra transacción: Postgres no usa un valor de enum en la transacción que lo crea). Archivo manual `08_microsoft_teams.sql`, en dos transacciones. `meet`, `zoom` y `google` se quedan en los enums por las filas viejas.
- **Código:** `src/lib/crypto.ts`, `src/lib/integrations/microsoft-graph.ts` (OAuth, refresh, crear, mover y cancelar), rutas `/api/integrations/microsoft/connect` y `/callback`, `actions/integrations.ts` (desconectar) y los tres puntos de `actions/interviews.ts`. Configuración → Integraciones muestra "Outlook y Teams" en lugar de Google.
- **Invitados:** el candidato si tiene correo, el entrevistador Prime si no es quien agenda, y siempre `fred@fireflies.ai` (para que entre, el reclutador que organiza tiene que estar en la cuenta de Fireflies de Prime). Al cliente no se le invita (no tenemos su correo): el reclutador le reenvía el evento. Sin correo del candidato, el enlace se le manda por WhatsApp cuando exista `interview_confirm`.
- **Sin probar contra Microsoft:** falta que Prime registre la app. Recorrido en `pendientes_revision.md` §5.
- **Pendiente:** sala de espera de Teams (`lobbyBypassSettings` pide `OnlineMeetings.ReadWrite`; por ahora se ajusta en la política de Teams de Prime), y que el admin vea en Configuración quién ya conectó su Outlook.

### 12.8 Lista negra, migración 0021 (20 de octubre de 2026)

- **Solo admin** (`view_blacklist`): la ve, agrega y quita. El reclutador y el cliente no ven la lista ni el motivo.
- **Tabla `candidate_blacklist`**: candidato, copia de nombre, teléfono, CURP y correo (por si cambian o se borra el candidato), motivo (`blacklist_reason`: robo o faltante, abandono sin aviso, documentos falsos, mala conducta, otro), nota, quién y cuándo; al quitarla, `removed_at`, quién y por qué. RLS: solo lectura para admin; se escribe solo con las RPC `blacklist_candidate` y `unblacklist_candidate`.
- **La base impide postularla:** trigger `applications_block_blacklisted` rechaza cualquier postulación nueva (alta manual, carga masiva, WhatsApp, service role) si coincide candidato, teléfono, CURP o correo. Error `candidate_blacklisted`.
- **Al agregarla** se descartan sus postulaciones abiertas con motivo neutro "Descartado por administración"; las contrataciones no se tocan. Quitarla no reabre nada.
- **Alta de candidato:** `is_blacklisted(teléfono, correo)` responde sí o no antes de crear nada. Al reclutador: "No se puede registrar a esta persona. Consulta con tu administrador."; al admin le dice que está en la lista.
- **Pantallas:** Candidatos → **Lista negra** (vigentes y, con `?historial=1`, las quitadas) y en la ficha del candidato, para admin, "Agregar a lista negra" o el aviso con motivo y "Quitar de la lista negra".
- Pruebas en `scripts/rls-lite/blacklist.test.mjs`; archivo manual `09_lista_negra.sql`.
- **Pendiente:** avisar al admin cuando alguien intenta registrar a una persona de la lista; que el agente de WhatsApp no la contacte (cuando exista).

### 12.9 Cola de tareas y cron, migración 0022 (20 de octubre de 2026)

- **Ejecutor:** `GET /api/cron/tick` (Vercel Cron una vez al día, `0 14 * * *` UTC = 8:00 en México, `vercel.json`; Vercel Hobby no permite más seguido. Decidido el 21 oct 2026. El primer intento de cada tarea corre al momento con `after()`; el cron solo hace reintentos y lo diario. Si algún día hace falta más seguido: Pro o un cron externo contra la misma ruta, `CRON_SECRET` como Bearer, `maxDuration` 60 s). Encola las tareas diarias que ya tocan (`src/lib/queue/recurring.ts`, una por día con llave `tipo:fecha` buscada en toda la cola) y corre la cola de 4 en 4 hasta 45 s (`src/lib/queue/run.ts`). Sin lógica de negocio en la ruta.
- **Handlers** en `src/lib/queue/handlers.ts`: payload validado con zod, `maxAttempts` por tipo, y `retry: false` cuando reintentar no sirve. Un tipo desconocido falla sin reintentar. Corren con service role (no hay sesión).
- **0022:** `claim_scheduled_tasks` recupera tareas colgadas en `running` más de 10 minutos y acepta `p_only` (correr una tarea concreta); `finish_scheduled_task` acepta `p_retry` y, al fallar del todo, avisa a los admins (`task_failed`, enlace a Configuración → Tareas automáticas); `retry_scheduled_task` y `cancel_scheduled_task` (solo admin); `notify_followups_due` y `placement_followups.notified_at`; `followup_due` en `notification_kind`. Archivo manual `10_cola_de_tareas.sql`; pruebas en `scripts/rls-lite/queue.test.mjs`.
- **Tareas hechas:** `cv_score` (el alta la encola y la corre con `after()` sin esperar al cron; 3 intentos; sin CV o sin pesos no reintenta) y `followups_due` (diario 8:00: avisa al reclutador y a los admins cuando vence un corte de permanencia, una vez por corte).
- **Configuración → Tareas automáticas:** pendientes, corriendo, fallidas, terminadas en 24 h, aviso si el cron no está llegando, y Reintentar / Cancelar.
- **Siguientes tipos** (con su integración): `wa_*`, `interview_confirm`, `fireflies_fetch_transcript`, `interview_analyze`, `psych_parse`, `doc_check`, los tres correos y `weekly_insights`.
