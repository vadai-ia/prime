import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { listClients } from "@/lib/queries/clients";
import { PageHeader } from "@/components/ui/page-header";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Nuevo levantamiento · Prime HR Innovation" };

export default async function LevantamientoPage() {
  const session = await requireStaff();
  const clients = await listClients();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        backHref="/perfiles"
        title="Nuevo levantamiento"
        subtitle="Secciones I a VI del formato con el cliente. Se guarda como borrador; el perfil y la configuración de IA se generan después."
      />
      <IntakeForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} canCreateProfile={session.role === "admin"} />
    </div>
  );
}
