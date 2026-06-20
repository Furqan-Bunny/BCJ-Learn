/**
 * BCJ Learn — capture real app screenshots for the training guides.
 *
 * Logs in as each test account (employee / department lead / admin) against the
 * running dev server and screenshots every documented screen into
 * public/docs-img/<name>.png. The guides reference those via /docs-img/<name>.png
 * (served from /public) so the same shots appear in the in-app Help Center AND
 * the generated PDFs.
 *
 * Prereq: dev server running on http://localhost:3008 (override with SHOTS_BASE).
 * Run with:   npm run docs:shots
 * (Dev-only. Never imported by the app. Uses test accounts + test data only.)
 */

import { promises as fs } from "fs";
import path from "path";
import puppeteer, { type Page, type BrowserContext } from "puppeteer";

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3000";
const PASSWORD = "BcjLearnDemo2026!";
const OUT = path.join(process.cwd(), "public", "docs-img");

const ROLES = {
  employee: { email: "test-manager@bcjbuildingservices.com" },
  lead: { email: "test-lead@bcjbuildingservices.com" },
  admin: { email: "test-admin@bcjbuildingservices.com" },
};

/** A callout to draw on a screen before capturing: a teal ring + label around
 *  the first visible element matching `text` (or a CSS `selector`). Used to point
 *  out new features in the guides. */
interface Mark { text?: string; selector?: string; label?: string; nth?: number }

async function applyMarks(page: Page, marks: Mark[]) {
  for (const m of marks) {
    await page.evaluate((mk: Mark) => {
      const TEAL = "#25BCB9";
      let el: Element | null = null;
      if (mk.selector) {
        const list = Array.from(document.querySelectorAll(mk.selector)).filter((e) => (e as HTMLElement).getClientRects().length);
        el = list[mk.nth ?? 0] ?? null;
      } else if (mk.text) {
        const all = Array.from(document.querySelectorAll("button, a, span, div, input, label, h1, h2, h3, td, th, p"));
        const hits = all.filter((e) => {
          const t = (e.textContent ?? "").trim();
          const ph = (e as HTMLInputElement).placeholder ?? "";
          return ((mk.text && (t === mk.text || t.includes(mk.text!))) || (mk.text && ph.includes(mk.text!))) && (e as HTMLElement).getClientRects().length;
        });
        hits.sort((a, b) => {
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          return ra.width * ra.height - rb.width * rb.height;
        });
        el = hits[mk.nth ?? 0] ?? null;
      }
      if (!el) return;
      const r = el.getBoundingClientRect();
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed", left: `${r.left - 6}px`, top: `${r.top - 6}px`,
        width: `${r.width + 12}px`, height: `${r.height + 12}px`,
        border: `3px solid ${TEAL}`, borderRadius: "10px",
        boxShadow: `0 0 0 4px rgba(37,188,185,.22)`, zIndex: "2147483646", pointerEvents: "none",
      } as CSSStyleDeclaration);
      document.body.appendChild(ring);
      if (mk.label) {
        const tag = document.createElement("div");
        tag.textContent = mk.label;
        const above = r.top - 6 - 28 > 4;
        Object.assign(tag.style, {
          position: "fixed", left: `${r.left - 6}px`, top: above ? `${r.top - 6 - 28}px` : `${r.bottom + 8}px`,
          background: TEAL, color: "#fff", font: "600 13px 'Segoe UI', sans-serif",
          padding: "4px 10px", borderRadius: "7px", zIndex: "2147483647", pointerEvents: "none", whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(4,29,57,.25)",
        } as CSSStyleDeclaration);
        document.body.appendChild(tag);
      }
    }, m);
  }
}

const results = { ok: [] as string[], fail: [] as string[] };
const ONLY = process.env.SHOTS_ONLY; // when set, only capture shots whose name includes it
const settle = (ms = 1000) => new Promise((r) => setTimeout(r, ms));
const wanted = (name: string) => !ONLY || name.includes(ONLY);

async function setupViewport(page: Page) {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.type("#email", email, { delay: 8 });
  await page.type("#password", PASSWORD, { delay: 8 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
    page.keyboard.press("Enter"),
  ]);
  await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 25000 });
  await settle(1000);
}

/** Navigate to a page and screenshot the viewport. Optional `marks` draw teal
 *  callouts on new features before the capture. */
async function shot(page: Page, urlPath: string, name: string, settleMs = 1300, marks: Mark[] = []) {
  if (!wanted(name)) return;
  try {
    await page.goto(`${BASE}${urlPath}`, { waitUntil: "networkidle2", timeout: 45000 });
    await settle(settleMs);
    if (marks.length) await applyMarks(page, marks);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    results.ok.push(name);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.fail.push(`${name}: ${(e as Error).message}`);
    console.log(`  ✗ ${name} — ${(e as Error).message}`);
  }
}

/** Navigate, run an action (e.g. open a modal), then screenshot. */
async function shotAction(page: Page, urlPath: string, name: string, action: () => Promise<void>, settleMs = 1600, marks: Mark[] = []) {
  if (!wanted(name)) return;
  try {
    await page.goto(`${BASE}${urlPath}`, { waitUntil: "networkidle2", timeout: 45000 });
    await settle(900);
    await action();
    await settle(settleMs);
    if (marks.length) await applyMarks(page, marks);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    results.ok.push(name);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.fail.push(`${name}: ${(e as Error).message}`);
    console.log(`  ✗ ${name} — ${(e as Error).message}`);
  }
}

/** First module slug found on a list page (e.g. /manager/modules). */
async function firstModuleSlug(page: Page, listUrl: string): Promise<string | null> {
  await page.goto(`${BASE}${listUrl}`, { waitUntil: "networkidle2", timeout: 45000 });
  await settle(900);
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/modules/"]')) as HTMLAnchorElement[];
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      const m = href.match(/\/modules\/([^/?#]+)(?:$|[/?#])/);
      if (m && a.offsetParent) return m[1];
    }
    return null;
  });
}

/** Click the first visible button/link/tab whose text matches one of `labels`. */
async function clickByText(page: Page, labels: string[]): Promise<boolean> {
  const handles = await page.$$("button, a, [role='tab']");
  for (const label of labels) {
    for (const h of handles) {
      const txt = (await h.evaluate((b) => (b.textContent ?? "").trim()));
      if (txt === label || txt.includes(label)) {
        const visible = await h.evaluate((b) => (b as HTMLElement).getClientRects().length > 0);
        if (!visible) continue;
        await h.evaluate((b) => (b as HTMLElement).scrollIntoView({ block: "center" }));
        await settle(250);
        await h.click().catch(() => {});
        return true;
      }
    }
  }
  return false;
}

/** Click the first lesson-content card so the file-preview modal opens. */
async function openFirstContent(page: Page): Promise<boolean> {
  // Real Puppeteer click on the content <button> whose badge says "Preview"
  // (skips the plain "Available to preview now" label and "Open ↗" link cards).
  const handles = await page.$$("button");
  let candidates = 0;
  for (const h of handles) {
    const txt = (await h.evaluate((b) => b.textContent ?? "")).trim();
    if (!/preview/i.test(txt)) continue;
    candidates++;
    await h.evaluate((b) => b.scrollIntoView({ block: "center" }));
    await settle(300);
    await h.click().catch(() => {});
    const opened = await page
      .waitForSelector('[data-slot="dialog-content"]', { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return true;
  }
  console.log(`    (file-preview: ${candidates} preview button(s) tried, dialog not detected)`);
  return false;
}

async function captureEmployee(ctx: BrowserContext) {
  console.log("• Employee");
  const page = await ctx.newPage();
  await setupViewport(page);
  await login(page, ROLES.employee.email);

  await shot(page, "/manager/dashboard", "emp-dashboard");
  await shot(page, "/manager/modules", "emp-modules", 1300, [
    { text: "My Progress", label: "Your own results & answer review" },
  ]);

  const slug = await firstModuleSlug(page, "/manager/modules");
  if (slug) {
    await shot(page, `/manager/modules/${slug}`, "emp-module-detail");
    await shot(page, `/manager/modules/${slug}/quiz`, "emp-quiz");
    await shotAction(page, `/manager/modules/${slug}`, "emp-file-preview", async () => {
      await openFirstContent(page);
    }, 11000);
  } else {
    results.fail.push("emp-module-detail/quiz/file-preview: no module slug found");
  }

  await shot(page, "/manager/resources", "emp-resources");
  await shot(page, "/manager/progress", "emp-progress");

  // Attempt review — follow a "Review answers" link from the progress page.
  if (wanted("emp-attempt-review")) {
    try {
      await page.goto(`${BASE}/manager/progress`, { waitUntil: "networkidle2", timeout: 45000 });
      await settle(900);
      const href = await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll('a[href*="/attempts/"]')) as HTMLAnchorElement[];
        return a.find((x) => x.offsetParent)?.getAttribute("href") ?? null;
      });
      if (href) await shot(page, href, "emp-attempt-review");
      else results.fail.push("emp-attempt-review: no attempt link found");
    } catch (e) { results.fail.push(`emp-attempt-review: ${(e as Error).message}`); }
  }
  await shot(page, "/notifications", "emp-notifications");
  await shot(page, "/my-profile", "emp-profile");
  await shot(page, "/help", "emp-help");
  await shot(page, "/help/faq", "emp-help-faq");

  await shotAction(page, "/manager/dashboard", "emp-language-menu", async () => {
    await page.click('[aria-label="Open user menu"]').catch(() => {});
  }, 800);

  await page.close();
}

async function captureLead(ctx: BrowserContext) {
  console.log("• Department Lead");
  const page = await ctx.newPage();
  await setupViewport(page);
  await login(page, ROLES.lead.email);

  await shot(page, "/teacher/dashboard", "lead-dashboard");
  await shot(page, "/teacher/modules", "lead-modules", 1300, [
    { text: "My Progress", label: "Take a quiz yourself — your results live here" },
  ]);
  await shot(page, "/teacher/results", "lead-results");
  await shot(page, "/teacher/questions", "lead-questions");
  await shot(page, "/teacher/managers", "lead-team");

  const slug = await firstModuleSlug(page, "/teacher/modules");
  if (slug) {
    await shot(page, `/teacher/modules/${slug}/content`, "lead-content-builder");
    await shot(page, `/teacher/modules/${slug}/questions`, "lead-questions-detail");
    await shot(page, `/teacher/modules/${slug}/present`, "lead-present-lobby");
  } else {
    results.fail.push("lead-content/present: no owned module slug found");
  }

  await page.close();
}

async function captureAdmin(ctx: BrowserContext) {
  console.log("• Admin");
  const page = await ctx.newPage();
  await setupViewport(page);
  await login(page, ROLES.admin.email);

  await shot(page, "/admin/dashboard", "admin-dashboard");
  await shot(page, "/admin/managers", "admin-people");
  await shot(page, "/admin/modules", "admin-modules", 1300, [
    { text: "Delivered", label: "Delivered status, per module" },
  ]);
  await shot(page, "/admin/questions", "admin-questions");
  await shot(page, "/admin/resources", "admin-resources");
  await shot(page, "/admin/results", "admin-reports");
  await shot(page, "/admin/audit-log", "admin-audit-log");
  await shot(page, "/admin/notifications", "admin-notifications");
  await shot(page, "/admin/settings/branding", "admin-settings-branding");
  await shot(page, "/admin/settings/certificate", "admin-certificate-editor");

  // Resource detail (discover first resource row link).
  await page.goto(`${BASE}/admin/resources`, { waitUntil: "networkidle2", timeout: 45000 });
  await settle(900);
  const resId = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href*="/admin/resources/"]')) as HTMLAnchorElement[];
    for (const el of a) {
      const m = (el.getAttribute("href") ?? "").match(/\/admin\/resources\/([^/?#]+)/);
      if (m && el.offsetParent) return m[1];
    }
    return null;
  });
  if (resId) await shot(page, `/admin/resources/${resId}`, "admin-resource-detail");
  else results.fail.push("admin-resource-detail: no resource id found");

  // Schedule-seminar dialog — search the full directory to add anyone (new).
  if (wanted("admin-schedule-seminar")) {
    const slug = await firstModuleSlug(page, "/admin/modules");
    if (slug) {
      await shotAction(page, `/admin/modules/${slug}`, "admin-schedule-seminar", async () => {
        // Open the Roster tab if it's a tab, then the "Schedule seminar" dialog.
        await clickByText(page, ["Roster"]);
        await settle(600);
        await clickByText(page, ["Schedule seminar", "Schedule redelivery", "Schedule"]);
        await page.waitForSelector('[data-slot="dialog-content"]', { timeout: 8000 }).catch(() => {});
      }, 1600, [
        { selector: 'input[placeholder*="Search to add"]', label: "Search & add ANY manager" },
      ]);
    } else {
      results.fail.push("admin-schedule-seminar: no module slug found");
    }
  }

  await page.close();
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    // Login page (no auth needed).
    const lp = await browser.newPage();
    await setupViewport(lp);
    await shot(lp, "/login", "login");
    await lp.close();

    for (const cap of [captureEmployee, captureLead, captureAdmin]) {
      const ctx = await browser.createBrowserContext();
      try { await cap(ctx); } finally { await ctx.close(); }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n=== Capture summary ===`);
  console.log(`Captured: ${results.ok.length}`);
  if (results.fail.length) {
    console.log(`FAILED (${results.fail.length}):`);
    for (const f of results.fail) console.log(`  - ${f}`);
  } else {
    console.log("No failures ✓");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
