import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { getClientRow } from "@/lib/queries/clients";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ClientForm } from "../../nuevo/client-form";

export const metadata: Metadata = { title: "Editar cliente · Prime HR Innovation" };

export default async function EditarClientePage(props: PageProps<"/clientes/[clientId]/editar">) {
  await requireAdmin();
  const { clientId } = await props.params;
  const client = await getClientRow(clientId);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader backHref={`/clientes/${client.id}`} title={`Editar ${client.name}`} subtitle="Datos de la empresa, contacto, destinatarios de reportes y portal." />
      <Card>
        <ClientForm client={client} />
      </Card>
    </div>
  );
}
