import { PageHeader } from "@/components/layout/page-header";
import { requireTenant } from "@/lib/tenant";
import { NewDossierForm } from "./new-dossier-form";

export default async function NewDossierPage() {
  await requireTenant();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Novo dossiê" description="Cadastre um novo processo de importação para iniciar a análise documental." />
      <NewDossierForm />
    </div>
  );
}
