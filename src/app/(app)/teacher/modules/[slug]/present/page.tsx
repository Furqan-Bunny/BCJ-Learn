import { getAccessibleModuleOr404 } from "@/lib/auth/module-access";
import { getCurrentDelivery } from "@/lib/db/deliveries";
import { ensurePresentableContent, attachSignedMedia } from "@/lib/server/present-content";
import { getViewedContentIds } from "@/lib/server/content-views";
import { PresenterView } from "./present-view";

export default async function PresenterPage(props: PageProps<"/teacher/modules/[slug]/present">) {
  const { slug } = await props.params;

  // Only an owning lead (or admin) may present this module.
  const mod = await getAccessibleModuleOr404(slug);

  // Extract & cache real text for uploaded documents + slides (first present
  // only) so they render their actual content instead of a placeholder.
  await ensurePresentableContent(slug);

  const [delivery, viewedContentIds] = await Promise.all([
    getCurrentDelivery(slug),
    getViewedContentIds(slug),
  ]);

  // Mint signed URLs for uploaded video files so they play (done every render —
  // signed URLs expire).
  await attachSignedMedia(mod);

  // Start in the presentation if the session already began; otherwise the
  // presenter opens to the check-in lobby (phase 1).
  const alreadyPresenting = !!delivery?.sessionStartedAt;

  return (
    <PresenterView
      mod={mod}
      startInPresentation={alreadyPresenting}
      initialViewedContentIds={viewedContentIds}
    />
  );
}
