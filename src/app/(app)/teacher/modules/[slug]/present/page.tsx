import { notFound } from "next/navigation";
import { getModule } from "@/lib/db/modules";
import { getCurrentDelivery } from "@/lib/db/deliveries";
import { ensurePresentableContent, attachSignedMedia } from "@/lib/server/present-content";
import { PresenterView } from "./present-view";

export default async function PresenterPage(props: PageProps<"/teacher/modules/[slug]/present">) {
  const { slug } = await props.params;

  // Extract & cache real text for uploaded documents + slides (first present
  // only) so they render their actual content instead of a placeholder.
  await ensurePresentableContent(slug);

  const [mod, delivery] = await Promise.all([getModule(slug), getCurrentDelivery(slug)]);
  if (!mod) return notFound();

  // Mint signed URLs for uploaded video files so they play (done every render —
  // signed URLs expire).
  await attachSignedMedia(mod);

  // Start in the presentation if the session already began; otherwise the
  // presenter opens to the check-in lobby (phase 1).
  const alreadyPresenting = !!delivery?.sessionStartedAt;

  return <PresenterView mod={mod} startInPresentation={alreadyPresenting} />;
}
