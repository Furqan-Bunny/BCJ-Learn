// Server component — fetches resources + per-resource ack counts.

import { PageHeader } from "@/components/shared/page-header";
import { listResources, ackCountForResource } from "@/lib/db/resources";
import { ResourcesAdminView } from "./resources-view";

export default async function AdminResourcesPage() {
  const resources = await listResources();
  const enriched = await Promise.all(
    resources.map(async (r) => ({
      ...r,
      ackCount: await ackCountForResource(r.id),
    })),
  );

  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Resources & Policies"
        description="Documents available to employees alongside training modules. Toggle 'requires acknowledgement' to force a read-and-understand sign-off."
      />
      <ResourcesAdminView initialResources={enriched} />
    </>
  );
}
