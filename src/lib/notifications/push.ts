// In-app notification helper — writes a row to the `notifications` table for
// events that do not go through email. `sendEmail()` already writes a row when
// it dispatches; use this for everything else (retake scheduled, account
// deactivated, question approved for an owner, etc.).
//
// Uses the service-role client because callers are server actions that may
// notify users other than themselves (e.g. an admin reactivating someone).

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { NotificationKind } from "@/types";

export interface PushInAppNotificationInput {
  recipientId: string;
  kind: NotificationKind;
  subject: string;
  preview: string;
  /** Optional deep link for click-through from the bell. */
  href?: string | null;
  /** Optional HTML body for the full /notifications view. */
  body?: string | null;
}

export async function pushInAppNotification(input: PushInAppNotificationInput) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    kind: input.kind,
    recipient_id: input.recipientId,
    subject: input.subject,
    preview: input.preview,
    body: input.body ?? null,
    href: input.href ?? null,
  });
}
