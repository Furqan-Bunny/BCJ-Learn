import Link from "next/link";
import { getOwnedModuleOr404 } from "@/lib/auth/module-access";
import { getCurrentDelivery } from "@/lib/db/deliveries";
import { ensurePresentableContent, attachSignedMedia } from "@/lib/server/present-content";
import { getViewedContentIds } from "@/lib/server/content-views";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { PresenterView } from "./present-view";

export default async function PresenterPage(props: PageProps<"/teacher/modules/[slug]/present">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  // Read-only preview: render the live stage with no check-in, no session, no
  // recording. Available any time — even unpublished / no delivery scheduled.
  const preview = sp?.preview === "1";

  // Only an owning lead (or admin) may present this module.
  const mod = await getOwnedModuleOr404(slug);

  // Extract & cache real text for uploaded documents + slides (first present
  // only) so they render their actual content instead of a placeholder.
  await ensurePresentableContent(slug);

  // Mint signed URLs for uploaded video files so they play (done every render —
  // signed URLs expire). Neither this nor extraction needs a delivery.
  await attachSignedMedia(mod);

  // Preview skips the lobby entirely and needs no delivery / viewed state.
  if (preview) {
    return <PresenterView mod={mod} preview startInPresentation initialViewedContentIds={[]} />;
  }

  const [delivery, viewedContentIds] = await Promise.all([
    getCurrentDelivery(slug),
    getViewedContentIds(slug),
  ]);

  // Already delivered: the trainer ended this seminar (quiz opened to the room).
  // You can't re-present the same delivery — schedule a new seminar to run it
  // again. Retakes stay open for everyone meanwhile. (Preview is still allowed
  // above.)
  if (delivery?.sessionEndedAt) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">Already delivered</div>
        <h1 className="text-2xl font-bold tracking-tight">{mod.title}</h1>
        <p className="text-sm text-muted-foreground">
          This module was delivered on <span className="font-medium text-foreground">{fmtDate(delivery.sessionEndedAt, "MMM d, yyyy")}</span> and
          the quiz is open to the room. To present it again, schedule a new seminar from the module page.
          Retakes stay open for everyone in the meantime.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button asChild variant="outline">
            <Link href={`/teacher/modules/${slug}`}>Back to module &amp; schedule again</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/teacher/modules/${slug}/present?preview=1`}>Preview slides</Link>
          </Button>
        </div>
      </div>
    );
  }

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
