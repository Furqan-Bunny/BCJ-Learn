import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/current-user";
import {
  getResource,
  listResourceVersions,
  listAcknowledgementHistory,
  listAcknowledgementStatus,
} from "@/lib/db/resources";
import { ResourceDetailView } from "./resource-detail-view";

// Admin-only resource detail: preview + change audit + acknowledgement log.
export default async function ResourceDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "admin") return notFound();

  const resource = await getResource(id);
  if (!resource) return notFound();

  const [versions, ackHistory, ackStatus] = await Promise.all([
    listResourceVersions(id),
    listAcknowledgementHistory(id),
    listAcknowledgementStatus(id),
  ]);

  return (
    <ResourceDetailView
      resource={resource}
      versions={versions}
      ackHistory={ackHistory}
      ackStatus={ackStatus}
    />
  );
}
