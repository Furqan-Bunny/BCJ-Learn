"use client";

// Keeps the employee's view in sync with the live seminar in real time. Polls
// the current delivery's lifecycle (check-in opened → session started → ended)
// and refreshes the page the moment anything changes — so the quiz unlocks, the
// check-in box appears, etc. without anyone hitting refresh.

import * as React from "react";
import { useRouter } from "next/navigation";
import { getDeliveryPulse } from "@/lib/server/attendance-actions";

const POLL_MS = 4000;

export function DeliveryLiveSync({ slug, signature }: { slug: string; signature: string }) {
  const router = useRouter();
  const last = React.useRef(signature);

  React.useEffect(() => {
    last.current = signature;
  }, [signature]);

  React.useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const p = await getDeliveryPulse(slug);
        if (alive && p.ok) {
          const sig = `${p.checkinOpen}|${p.sessionStarted}|${p.sessionEnded}|${p.checkedIn}`;
          if (sig !== last.current) {
            last.current = sig;
            router.refresh();
          }
        }
      } catch {
        // transient — keep polling
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }

    timer = setTimeout(tick, POLL_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [slug, router]);

  return null;
}
