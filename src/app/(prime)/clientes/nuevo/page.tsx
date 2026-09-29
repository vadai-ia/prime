import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ClientForm } from "./client-form";

export const metadata: Metadata = { title: "Nuevo cliente · Prime HR Innovation" };

export default async function NuevoClientePage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader backHref="/clientes" title="Nuevo cliente" subtitle="Datos de la empresa, contacto principal y horario de reportes." />
      <Card>
        <ClientForm />
      </Card>
    </div>
  );
}
