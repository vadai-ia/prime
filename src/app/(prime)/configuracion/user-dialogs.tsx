"use client";

import { useState, useTransition, type ReactNode } from "react";
import { resetUserPassword, setUserActive, setUserName, setUserRole } from "@/actions/users";
import { setRecruiterProfiles } from "@/actions/assignments";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { alertErrorClass, alertSuccessClass, inputClass } from "@/components/ui/form";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { fmtDateLong, timeAgo } from "@/lib/format";
import { tempPassword } from "@/lib/temp-password";
import type { UserRow } from "@/lib/queries/types";
import type { AssignableProfile, UserVacancy } from "@/lib/queries/users";
import { PROFILE_STATUS_LABELS } from "@/lib/labels";
import { InviteForm } from "./invite-form";

type ClientOption = { id: string; name: string };
type Outlook = { account_email: string | null; connected_at: string | null } | null;

const smallButton = "rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-canvas disabled:opacity-60";
const smallPrimary = "rounded-lg bg-forest px-3 py-1.5 text-xs font-medium text-on-forest transition hover:bg-forest-deep disabled:opacity-60";

/** Botón "Crear usuario" del encabezado de Configuración: el alta va en un modal. */
export function CreateUserDialog({ clients }: { clients: ClientOption[] }) {
  return (
    <Modal
      title="Crear usuario"
      subtitle="Sin registro público: todas las cuentas se crean aquí."
      trigger={(open) => (
        <button type="button" onClick={open} className="inline-flex items-center justify-center gap-2 rounded-lg bg-forest px-3.5 py-2 text-sm font-medium text-on-forest transition hover:bg-forest-deep">
          Crear usuario
        </button>
      )}
    >
      {() => <InviteForm clients={clients} />}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{title}</h3>
      <div className="mt-3 space-y-3 text-sm">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="min-w-0 text-right text-ink">{children}</span>
    </div>
  );
}

/**
 * Ficha de un reclutador o un usuario cliente (Configuración → Ver). Los admins no tienen ficha:
 * su rol y su contraseña no los cambia otro admin (la recupera él desde el login).
 */
export function UserDetailDialog({ user, outlook, vacancies, profiles, clients }: { user: UserRow; outlook: Outlook; vacancies: UserVacancy[]; profiles: AssignableProfile[]; clients: ClientOption[] }) {
  return (
    <Modal
      size="lg"
      title={user.full_name || "Sin nombre"}
      subtitle={user.email}
      trigger={(open) => (
        <button type="button" onClick={open} className={smallButton}>
          Ver
        </button>
      )}
    >
      {() => <UserDetail user={user} outlook={outlook} vacancies={vacancies} profiles={profiles} clients={clients} />}
    </Modal>
  );
}

function UserDetail({ user, outlook, vacancies, profiles, clients }: { user: UserRow; outlook: Outlook; vacancies: UserVacancy[]; profiles: AssignableProfile[]; clients: ClientOption[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.full_name || user.email} />
        <div className="flex flex-wrap gap-1.5">
          <Pill tone="neutral">{ROLE_LABELS[user.role]}</Pill>
          <Pill tone={user.is_active ? "mint" : "neutral"}>{user.is_active ? "Activo" : "Inactivo"}</Pill>
        </div>
      </div>

      <Section title="Datos">
        <NameRow userId={user.id} fullName={user.full_name} />
        <Row label="Correo">{user.email}</Row>
        {user.role === "client" && <Row label="Empresa">{user.client_name ?? "—"}</Row>}
        <Row label="Alta">{fmtDateLong(user.created_at)}</Row>
        <Row label="Última vez">{user.last_seen_at ? timeAgo(user.last_seen_at) : "Nunca"}</Row>
        {user.role !== "client" && (
          <Row label="Outlook">{outlook ? `Conectado${outlook.account_email ? ` · ${outlook.account_email}` : ""}` : "Sin conectar"}</Row>
        )}
      </Section>

      <PasswordSection userId={user.id} fullName={user.full_name} />

      <RoleSection user={user} vacancies={vacancies.length} clients={clients} />

      {user.role === "recruiter" && user.is_active && <VacanciesSection userId={user.id} vacancies={vacancies} profiles={profiles} />}

      <AccessSection userId={user.id} isActive={user.is_active} role={user.role} />
    </div>
  );
}

function NameRow({ userId, fullName }: { userId: string; fullName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fullName);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <Row label="Nombre">
        {fullName || "Sin nombre"}{" "}
        <button type="button" onClick={() => setEditing(true)} className="ml-2 text-xs font-medium text-forest hover:underline">
          Editar
        </button>
      </Row>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await setUserName(userId, name);
          setError(result?.error ?? null);
          if (!result?.error) setEditing(false);
        });
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} autoFocus aria-label="Nombre" className={`${inputClass} mt-0 flex-1`} />
      <button type="submit" disabled={pending} className={smallPrimary}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:bg-canvas">
        Cancelar
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </form>
  );
}

function PasswordSection({ userId, fullName }: { userId: string; fullName: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Section title="Contraseña">
      <p className="text-ink-muted">Las contraseñas se guardan cifradas: nadie puede verlas, ni un administrador. Si la olvidó, ponle una nueva y pásasela; la puede cambiar en Mi cuenta.</p>
      {saved && (
        <p className={alertSuccessClass}>
          Contraseña nueva de {fullName || "este usuario"}: <span className="select-all font-mono font-semibold">{saved}</span>
        </p>
      )}
      {password === null ? (
        <button
          type="button"
          onClick={() => {
            setSaved(null);
            setError(null);
            setPassword(tempPassword());
          }}
          className={smallButton}
        >
          Restablecer contraseña
        </button>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const result = await resetUserPassword(userId, password);
              setError(result?.error ?? null);
              if (!result?.error) {
                setSaved(password);
                setPassword(null);
              }
            });
          }}
        >
          <input value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus aria-label="Contraseña nueva" className={`${inputClass} mt-0 flex-1 font-mono`} />
          <button type="button" onClick={() => setPassword(tempPassword())} className={smallButton}>
            Otra
          </button>
          <button type="submit" disabled={pending} className={smallPrimary}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={() => setPassword(null)} className="rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:bg-canvas">
            Cancelar
          </button>
        </form>
      )}
      {error && <p className={alertErrorClass}>{error}</p>}
    </Section>
  );
}

function RoleSection({ user, vacancies, clients }: { user: UserRow; vacancies: number; clients: ClientOption[] }) {
  const [role, setRole] = useState<Role>(user.role);
  const [clientId, setClientId] = useState(user.client_id ?? "");
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = role !== user.role || (role === "client" && clientId !== (user.client_id ?? ""));

  return (
    <Section title="Rol">
      <div className="flex flex-wrap items-center gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rol" className={`${inputClass} mt-0 w-auto`}>
          <option value="recruiter">{ROLE_LABELS.recruiter}</option>
          <option value="client">{ROLE_LABELS.client}</option>
          <option value="admin">{ROLE_LABELS.admin}</option>
        </select>
        {role === "client" && (
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Empresa" className={`${inputClass} mt-0 w-auto flex-1`}>
            <option value="" disabled>
              Elige la empresa
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={!changed || pending || (role === "client" && !clientId)}
          onClick={() =>
            start(async () => {
              const r = await setUserRole(user.id, role, role === "client" ? clientId : null);
              setResult(r ?? null);
            })
          }
          className={smallPrimary}
        >
          {pending ? "Guardando…" : "Cambiar rol"}
        </button>
      </div>
      {changed && user.role === "recruiter" && role !== "recruiter" && (
        <p className="rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber">
          Saldrá de {vacancies === 1 ? "su vacante" : `sus ${vacancies} vacantes`}; los demás reclutadores de cada una siguen viendo a todos sus candidatos.
        </p>
      )}
      {changed && role === "admin" && (
        <p className="rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber">
          Como administrador verá todos los clientes y candidatos, y podrá crear usuarios. Después ya no se le puede cambiar el rol desde aquí.
        </p>
      )}
      {result?.error && <p className={alertErrorClass}>{result.error}</p>}
      {result?.message && <p className={alertSuccessClass}>{result.message} Si tiene la sesión abierta, el cambio le aplica en menos de una hora.</p>}
    </Section>
  );
}

/**
 * Vacantes del reclutador: lista y, al editar, checklist de todas las vacantes no cerradas agrupadas
 * por cliente. Guardar deja exactamente las marcadas (mismas reglas que Perfiles → Reclutadores).
 */
function VacanciesSection({ userId, vacancies, profiles }: { userId: string; vacancies: UserVacancy[]; profiles: AssignableProfile[] }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(vacancies.map((v) => v.id)));
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);
  const [pending, start] = useTransition();

  const q = query.trim().toLowerCase();
  const visible = profiles.filter((p) => !q || `${p.client_name} ${p.title}`.toLowerCase().includes(q));
  const byClient = Object.entries(
    visible.reduce<Record<string, AssignableProfile[]>>((acc, p) => {
      (acc[p.client_name] ??= []).push(p);
      return acc;
    }, {}),
  );
  const removed = vacancies.filter((v) => !selected.has(v.id)).length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!editing) {
    return (
      <Section title={`Vacantes asignadas (${vacancies.length})`}>
        {vacancies.length ? (
          <ul className="divide-y divide-line">
            {vacancies.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 py-1.5">
                <a href={`/perfiles/${v.id}`} className="font-medium text-forest hover:underline">
                  {v.title}
                </a>
                <span className="text-xs text-ink-muted">{v.client_name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">Ninguna todavía.</p>
        )}
        {result?.message && <p className={alertSuccessClass}>{result.message}</p>}
        <button
          type="button"
          onClick={() => {
            setSelected(new Set(vacancies.map((v) => v.id)));
            setResult(null);
            setEditing(true);
          }}
          className={smallButton}
        >
          Elegir vacantes
        </button>
      </Section>
    );
  }

  return (
    <Section title={`Elegir vacantes (${selected.size} marcadas)`}>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por cliente o puesto" aria-label="Buscar vacante" className={`${inputClass} mt-0`} />
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {byClient.length === 0 && <p className="text-ink-muted">Ninguna vacante coincide.</p>}
        {byClient.map(([client, list]) => (
          <fieldset key={client}>
            <legend className="text-xs font-semibold text-ink-muted">{client || "Sin cliente"}</legend>
            <div className="mt-1 space-y-1">
              {list.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-canvas">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 rounded border-line accent-forest" />
                  <span className="flex-1 text-ink">{p.title}</span>
                  {p.status !== "active" && <span className="text-xs text-ink-faint">{PROFILE_STATUS_LABELS[p.status]}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {removed > 0 && (
        <p className="rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber">
          Sale de {removed === 1 ? "1 vacante" : `${removed} vacantes`}: deja de ver sus candidatos.
        </p>
      )}
      {result?.error && <p className={alertErrorClass}>{result.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setRecruiterProfiles(userId, [...selected]);
              setResult(r ?? null);
              if (!r?.error) setEditing(false);
            })
          }
          className={smallPrimary}
        >
          {pending ? "Guardando…" : "Guardar vacantes"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:bg-canvas">
          Cancelar
        </button>
      </div>
    </Section>
  );
}

function AccessSection({ userId, isActive, role }: { userId: string; isActive: boolean; role: Role }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Section title="Acceso">
      <p className="text-ink-muted">
        {isActive
          ? `Desactivar bloquea su acceso${role === "recruiter" ? ", y lo saca de sus vacantes" : ""}. Se puede volver a activar.`
          : "La cuenta está desactivada: no puede entrar."}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setUserActive(userId, !isActive);
            setError(result?.error ?? null);
          })
        }
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
          isActive ? "bg-danger-soft text-danger hover:bg-danger hover:text-white" : "bg-mint text-forest hover:bg-forest hover:text-on-forest"
        }`}
      >
        {pending ? "Guardando…" : isActive ? "Desactivar" : "Activar"}
      </button>
      {error && <p className={alertErrorClass}>{error}</p>}
    </Section>
  );
}
