/**
 * BCJ Learn — render the Markdown guides in /docs to polished, client-ready PDFs.
 *
 * Each /docs/<name>.md becomes /docs/pdf/<name>.pdf: a clean-corporate layout
 * with a cover page, a table of contents, numbered sections with teal accent
 * rules, and the embedded screenshots (from /public/docs-img, referenced in the
 * Markdown as /docs-img/<x>.png) shown as bordered cards with captions.
 *
 * Run with:   npm run docs:pdf   (after npm run docs:shots)
 * (Dev-only. Never imported by the app.)
 */

import { promises as fs } from "fs";
import path from "path";
import { marked } from "marked";
import puppeteer from "puppeteer";

const NAVY = "#041D39";
const TEAL = "#25BCB9";
const INK = "#1a2330";
const MUTED = "#5b6675";
const BORDER = "#dbe2ea";

const DOCS = [
  { slug: "platform-overview", title: "Platform Overview" },
  { slug: "admin-guide", title: "Admin Guide" },
  { slug: "dept-lead-guide", title: "Department Lead Guide" },
  { slug: "employee-guide", title: "Employee Guide" },
  { slug: "faq", title: "Frequently Asked Questions" },
];

const IMG_DIR = path.join(process.cwd(), "public", "docs-img");

// Screenshots inlined as base64 data URIs — headless Chrome won't load file://
// images from a setContent page (no file origin), so we embed them directly.
const imgDataUri = new Map<string, string>();
async function loadImages() {
  const files = await fs.readdir(IMG_DIR).catch(() => [] as string[]);
  for (const f of files) {
    if (!f.toLowerCase().endsWith(".png")) continue;
    const buf = await fs.readFile(path.join(IMG_DIR, f));
    imgDataUri.set(f, `data:image/png;base64,${buf.toString("base64")}`);
  }
}

/** "June 2026" — fine to use a live date inside a one-shot script. */
function monthYear(): string {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Pull the `##` section titles for the table of contents. */
function tocItems(md: string): string[] {
  return Array.from(md.matchAll(/^##\s+(.+?)\s*$/gm)).map((m) => m[1].replace(/`/g, ""));
}

/**
 * Turn each `<img src="/docs-img/x.png" alt="caption">` into a figure with a
 * local file:// source (so headless Chrome loads the PNG) and a caption.
 */
function rewriteImages(html: string): string {
  return html.replace(
    /<p>\s*<img[^>]*\bsrc="\/docs-img\/([^"]+)"[^>]*\balt="([^"]*)"[^>]*>\s*<\/p>/g,
    (_full, file: string, alt: string) => {
      const src = imgDataUri.get(file);
      if (!src) { console.warn(`  ! missing image: ${file}`); return _full; }
      const caption = alt ? `<figcaption>${alt}</figcaption>` : "";
      return `<figure class="shot"><img src="${src}" alt="${alt}"/>${caption}</figure>`;
    },
  );
}

function coverHtml(title: string): string {
  return `<section class="cover">
    <div class="cover-top">
      <span class="cover-tile">BCJ</span>
      <span class="cover-org">Building&nbsp;Services</span>
    </div>
    <div class="cover-mid">
      <div class="cover-eyebrow">BCJ&nbsp;Learn</div>
      <h1 class="cover-title">${title}</h1>
      <div class="cover-rule"></div>
      <div class="cover-prepared">Prepared for BCJ Building Services</div>
      <div class="cover-date">${monthYear()}</div>
    </div>
    <div class="cover-foot">Confidential — for internal use</div>
  </section>`;
}

function tocHtml(items: string[]): string {
  const lis = items.map((t) => `<li><span class="toc-text">${t}</span></li>`).join("");
  return `<section class="toc"><h2 class="toc-title">Contents</h2><ol class="toc-list">${lis}</ol></section>`;
}

function pageHtml(title: string, coverAndToc: string, body: string, bodyClass = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif;
      color: ${INK}; line-height: 1.6; font-size: 11.5px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }

    /* ── Cover ───────────────────────────────────────────── */
    .cover {
      height: 247mm; display: flex; flex-direction: column; justify-content: space-between;
      break-after: page; padding: 4mm 2mm;
    }
    .cover-top { display: flex; align-items: center; gap: 10px; }
    .cover-tile {
      display: inline-flex; align-items: center; justify-content: center;
      width: 46px; height: 46px; border-radius: 10px; background: ${NAVY};
      color: #fff; font-weight: 800; font-size: 17px; letter-spacing: .5px;
    }
    .cover-org { color: ${NAVY}; font-weight: 700; font-size: 15px; letter-spacing: .3px; }
    .cover-mid { padding-bottom: 30mm; }
    .cover-eyebrow { color: ${TEAL}; font-weight: 700; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 10px; }
    .cover-title { color: ${NAVY}; font-size: 40px; line-height: 1.1; font-weight: 800; margin: 0 0 18px; letter-spacing: -.5px; }
    .cover-rule { width: 90px; height: 5px; background: ${TEAL}; border-radius: 3px; margin-bottom: 22px; }
    .cover-prepared { color: ${INK}; font-size: 14px; font-weight: 600; }
    .cover-date { color: ${MUTED}; font-size: 13px; margin-top: 4px; }
    .cover-foot { color: ${MUTED}; font-size: 10px; letter-spacing: .5px; border-top: 1px solid ${BORDER}; padding-top: 8px; }

    /* ── Table of contents ───────────────────────────────── */
    .toc { break-after: page; padding: 2mm; }
    .toc-title { color: ${NAVY}; font-size: 22px; font-weight: 800; margin: 0 0 4px; padding-bottom: 8px; border-bottom: 3px solid ${TEAL}; }
    .toc-list { list-style: none; counter-reset: toc; margin: 14px 0 0; padding: 0; }
    .toc-list li { counter-increment: toc; display: flex; align-items: baseline; gap: 10px; padding: 7px 0; border-bottom: 1px solid #eef2f6; }
    .toc-list li::before { content: counter(toc); color: ${TEAL}; font-weight: 800; font-size: 12px; min-width: 20px; }
    .toc-text { color: ${INK}; font-weight: 600; font-size: 12.5px; }

    /* ── Body ────────────────────────────────────────────── */
    .doc { padding: 0 2mm; }
    .doc > p:first-of-type { color: ${MUTED}; font-size: 12.5px; font-style: italic; margin-top: 0; }
    h2 {
      color: ${NAVY}; font-size: 17px; font-weight: 800; margin: 26px 0 10px;
      padding-bottom: 6px; border-bottom: 2px solid ${TEAL}; break-after: avoid; letter-spacing: -.2px;
    }
    h3 { color: ${NAVY}; font-size: 13px; font-weight: 700; margin: 16px 0 5px; break-after: avoid; }
    h4 { color: ${INK}; font-size: 12px; font-weight: 700; margin: 12px 0 4px; break-after: avoid; }
    p, li { font-size: 11.5px; }
    p { margin: 0 0 9px; }
    ul, ol { margin: 6px 0 10px 20px; padding: 0; }
    li { margin: 3px 0; break-inside: avoid; }
    strong { color: ${NAVY}; font-weight: 700; }
    a { color: ${NAVY}; text-decoration: none; border-bottom: 1px solid ${TEAL}; }
    hr { border: 0; border-top: 1px solid ${BORDER}; margin: 18px 0; }
    code { background: #eef2f6; padding: 1px 5px; border-radius: 4px; font-size: 10.5px; font-family: "SF Mono", Consolas, monospace; color: ${NAVY}; }
    pre { background: #f4f7fa; border: 1px solid ${BORDER}; padding: 11px 13px; border-radius: 7px; overflow-x: auto; font-size: 10px; line-height: 1.45; break-inside: avoid; }
    pre code { background: none; padding: 0; color: ${INK}; }
    blockquote {
      border-left: 4px solid ${TEAL}; margin: 12px 0; padding: 8px 14px;
      color: #36506a; background: #f2fcfc; border-radius: 0 8px 8px 0; font-size: 11.5px;
    }
    blockquote p { margin: 0; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0 14px; break-inside: avoid; font-size: 11px; }
    th, td { border: 1px solid ${BORDER}; padding: 7px 9px; text-align: left; vertical-align: top; }
    th { background: ${NAVY}; color: #fff; font-weight: 700; }
    tbody tr:nth-child(even) { background: #f6f9fb; }

    /* ── Screenshot cards ────────────────────────────────── */
    figure.shot { margin: 14px 0 16px; break-inside: avoid; text-align: center; }
    figure.shot img {
      display: block; margin: 0 auto; max-width: 100%; height: auto;
      border: 1px solid ${BORDER}; border-radius: 9px; box-shadow: 0 3px 12px rgba(4,29,57,.12);
    }
    figure.shot figcaption { color: ${MUTED}; font-size: 10px; font-style: italic; margin-top: 7px; }

    /* ── FAQ: separate each audience group clearly ───────── */
    /* Each "For Employees / Department Leads / Admins / …" group starts on a
       fresh page with a filled navy band, so it's obvious who it's for. */
    .doc.faq h2 {
      break-before: page; margin: 0 0 16px; padding: 11px 16px;
      background: ${NAVY}; color: #fff; border: none; border-radius: 9px;
      font-size: 18px; letter-spacing: .2px;
    }
    .doc.faq h2:first-of-type { break-before: avoid; }
    .doc.faq p > strong:first-child { color: ${NAVY}; }
    .doc.faq > p, .doc.faq > blockquote { break-inside: avoid; }
  </style></head><body>${coverAndToc}<article class="doc ${bodyClass}">${body}</article></body></html>`;
}

function headerFooter(title: string) {
  const header = `<div style="font-size:8px;width:100%;padding:0 14mm;color:#9aa5b3;display:flex;justify-content:space-between;align-items:center;font-family:'Segoe UI',Arial,sans-serif;">
    <span style="font-weight:700;color:${NAVY};">BCJ&nbsp;Learn</span>
    <span>${title}</span></div>`;
  const footer = `<div style="font-size:8px;width:100%;padding:0 14mm;color:#9aa5b3;display:flex;justify-content:space-between;align-items:center;font-family:'Segoe UI',Arial,sans-serif;">
    <span>BCJ Building Services · Confidential</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
  return { header, footer };
}

async function main() {
  const docsDir = path.join(process.cwd(), "docs");
  const outDir = path.join(docsDir, "pdf");
  await fs.mkdir(outDir, { recursive: true });

  await loadImages();
  console.log(`Loaded ${imgDataUri.size} screenshots`);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const d of DOCS) {
      const raw = await fs.readFile(path.join(docsDir, `${d.slug}.md`), "utf8");
      // The cover shows the title, so drop the leading "# …" H1 from the body.
      const md = raw.replace(/^#\s+.*\r?\n/, "");
      const parsed = await marked.parse(md, { gfm: true, breaks: true });
      const body = rewriteImages(parsed);
      const coverAndToc = coverHtml(d.title) + tocHtml(tocItems(raw));
      const html = pageHtml(d.title, coverAndToc, body, d.slug === "faq" ? "faq" : "");

      const page = await browser.newPage();
      // `load` (not networkidle) so local file:// images are awaited.
      await page.setContent(html, { waitUntil: "load" });
      // Optional full-page PNG preview (visual QA) when DOCS_PREVIEW is set.
      if (process.env.DOCS_PREVIEW) {
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.5 });
        await page.screenshot({ path: path.join(outDir, `_preview-${d.slug}.png`), fullPage: true });
      }
      const { header, footer } = headerFooter(d.title);
      await page.pdf({
        path: path.join(outDir, `${d.slug}.pdf`),
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: header,
        footerTemplate: footer,
        margin: { top: "16mm", bottom: "15mm", left: "15mm", right: "15mm" },
      });
      await page.close();
      console.log(`✓ docs/pdf/${d.slug}.pdf`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\nDone — ${DOCS.length} PDFs in docs/pdf/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
