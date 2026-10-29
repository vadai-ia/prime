import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { listClients } from "@/lib/queries/clients";
import { listActiveRecruiters } from "@/lib/queries/assignments";
import { PageHeader } from "@/components/ui/page-header";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Nuevo levantamiento · Prime HR Innovation" };

export default async function LevantamientoPage() {
  const session = await requireStaff();
  const isAdmin = session.role === "admin";
  const [clients, recruiters] = await Promise.all([listClients(), isAdmin ? listActiveRecruiters() : []]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        backHref="/perfiles"
        title="Nuevo levantamiento"
        subtitle="Secciones I a VII del formato con el cliente. Si el cliente mandó su descriptivo de puesto, súbelo y la IA llena los pasos 2 a 7. Se guarda como borrador; el perfil y la configuración de IA se generan después."
      />
      <IntakeForm
        clients={clients.map((c) => ({ id: c.id, name: c.name, city: c.city, contact_name: c.contact_name }))}
        canCreateProfile={isAdmin}
        recruiters={recruiters}
      />
    </div>
  );
}
