// Server component — fetches resources assigned to the current user with ack status.

import { PageHeader } from "@/components/shared/page-header";
import { listResourcesForCurrentUser } from "@/lib/db/resources";
import { ResourcesEmployeeView } from "./resources-view";

export default async function EmployeeResourcesPage() {
  const resources = await listResourcesForCurrentUser();

  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Resources & Policies"
        description="Documents your leadership team has shared. Items marked as new or updated need a quick acknowledgement."
      />
      <ResourcesEmployeeView initialResources={resources} />
    </>
  );
}
