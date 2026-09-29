import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/queries/profiles";
import { PageHeader } from "@/components/ui/page-header";
import { asJson, type ProfileCompetencies, type ProfileConditions, type ProfileRequirements, type ProfileSpecs } from "@/lib/domain/json";
import { ProfileEditForm } from "./profile-edit-form";

export const metadata: Metadata = { title: "Editar vacante · Prime HR Innovation" };

export default async function EditarPerfilPage(props: PageProps<"/perfiles/[profileId]/editar">) {
  const { profileId } = await props.params;
  // getProfile exige staff y pasa por RLS: un reclutador solo llega aquí si la vacante es suya
  const profile = await getProfile(profileId);
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader backHref={`/perfiles/${profile.id}`} title={`Editar ${profile.title}`} subtitle={`${profile.client_name} · descriptivo del puesto y estado de la vacante`} />
      <ProfileEditForm
        profileId={profile.id}
        status={profile.status}
        defaults={{
          title: profile.title,
          unit: profile.unit,
          reports_to: profile.reports_to,
          openings: profile.openings,
          work_zone: profile.work_zone,
          objective: profile.objective,
          specs: asJson<ProfileSpecs>(profile.specs, {}),
          requirements: asJson<ProfileRequirements>(profile.requirements, {}),
          activities: profile.activities,
          conditions: asJson<ProfileConditions>(profile.conditions, {}),
          competencies: asJson<ProfileCompetencies>(profile.competencies, {}),
        }}
      />
    </div>
  );
}
