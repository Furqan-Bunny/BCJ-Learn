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

const BASE = process.env.SHOTS_BASE ?? "http://localhost:3008";
const PASSWORD = "BcjLearnDemo2026!";
const OUT = path.join(process.cwd(), "public", "docs-img");

const ROLES = {
  employee: { email: "testemployee@bcj.com" },
  lead: { email: "testlead@bcj.com" },
  admin: { email: "testadmin@bcj.com" },
};

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

/** Navigate to a page and screenshot the viewport. */
async function shot(page: Page, urlPath: string, name: string, settleMs = 1300) {
  if (!wanted(name)) return;
  try {
    await page.goto(`${BASE}${urlPath}`, { waitUntil: "networkidle2", timeout: 45000 });
    await settle(settleMs);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    results.ok.push(name);
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.fail.push(`${name}: ${(e as Error).message}`);
    console.log(`  ✗ ${name} — ${(e as Error).message}`);
  }
}

/** Navigate, run an action (e.g. open a modal), then screenshot. */
async function shotAction(page: Page, urlPath: string, name: string, action: () => Promise<void>, settleMs = 1600) {
  if (!wanted(name)) return;
  try {
    await page.goto(`${BASE}${urlPath}`, { waitUntil: "networkidle2", timeout: 45000 });
    await settle(900);
    await action();
    await settle(settleMs);
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
  await shot(page, "/manager/modules", "emp-modules");

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
  await shot(page, "/teacher/modules", "lead-modules");
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
  await shot(page, "/admin/modules", "admin-modules");
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
